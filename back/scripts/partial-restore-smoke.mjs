import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { CLEAN_START_MIGRATION, createTopicStore } from "../src/topic-store.js";
import { PRODUCTION_CANDIDATE_REGISTRY as registry } from "../src/candidates.js";
import { requireDisposableDatabase } from "../test-support/disposable-db.js";

// Reproduz uma restauração parcial: o dump volta sem as linhas de
// schema_migrations (pg_restore -L sem aquele TABLE DATA) e sem daily_answers.
// Antes da guarda, o boot seguinte apagava jogadores, rodadas e votos e o
// /api/health continuava 200. Agora a API precisa encerrar sem mudar nada.
const connectionString = requireDisposableDatabase();
const serverPath = fileURLToPath(new URL("../src/server.js", import.meta.url));
const topicId = "eleicoes-2026";
const audit = new pg.Pool({ connectionString });

async function freePort() {
  const fixed = Number(process.env.SMOKE_API_PORT);
  if (Number.isInteger(fixed) && fixed > 0) return fixed;
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

async function tableCounts() {
  const tables = await audit.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const counts = {};
  for (const { tablename } of tables.rows) {
    const quoted = `"${tablename.replaceAll('"', '""')}"`;
    counts[tablename] = (await audit.query(`SELECT count(*)::int AS n FROM public.${quoted}`)).rows[0].n;
  }
  return counts;
}

async function constraintNames() {
  const rows = await audit.query(`
    SELECT conrelid::regclass::text AS relation, conname
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
    ORDER BY 1, 2
  `);
  return rows.rows.map(({ relation, conname }) => `${relation}.${conname}`);
}

// Sobe o mesmo processo da imagem (src/server.js) com ambiente de produção e
// observa se ele atende /api/health ou encerra antes de escutar.
async function bootApi({ allowReset = false, stopWhenHealthy = true, timeoutMs = 60_000 } = {}) {
  const port = await freePort();
  const env = {
    PATH: process.env.PATH,
    NODE_ENV: "production",
    DATABASE_URL: connectionString,
    PORT: String(port),
    VOTER_NETWORK_SECRET: randomBytes(32).toString("hex"),
    TRUST_PROXY_HOPS: "0",
    ...(allowReset ? { POLIMATCH_ALLOW_RESET: "1" } : {}),
  };
  const child = spawn(process.execPath, [serverPath], { env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  let exit = null;
  exited.then((result) => { exit = result; });
  let healthStatus = null;
  const deadline = Date.now() + timeoutMs;
  while (!exit && Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      healthStatus = response.status;
      if (response.status === 200 && stopWhenHealthy) break;
    } catch {
      // Ainda não escuta (ou nunca vai escutar).
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (!exit) child.kill("SIGTERM");
  const result = await exited;
  return { ...result, healthStatus, output };
}

try {
  await audit.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");

  // Banco vazio de verdade: o boot inicializa normalmente.
  const fresh = await bootApi();
  assert.equal(fresh.healthStatus, 200, fresh.output);
  assert.match(fresh.output, /"?resetApplied"?:\s*true/);
  assert.equal(fresh.code, 0, fresh.output);

  const store = createTopicStore(connectionString, { candidateRegistry: registry });
  assert.equal((await store.init()).resetApplied, false);
  const ids = registry.candidatesForTopic(topicId).slice(0, 4).map(({ id }) => id);
  assert.equal(ids.length, 4);
  for (let index = 0; index < 6; index += 1) {
    const networkHash = createHash("sha256").update(`partial-restore:${index}:${randomUUID()}`).digest("hex");
    const { recoveryKey } = await store.createPlayer({ networkHash });
    let playerVersion = 0;
    for (let round = 0; round < 3; round += 1) {
      const order = [...ids.slice(round % 4), ...ids.slice(0, round % 4)];
      const vote = await store.roundVote({
        topicId,
        winnerId: order[0],
        selectionIds: order.slice(0, 2),
        candidateIds: order,
        roundId: randomUUID(),
        recoveryKey,
        playerVersion,
      });
      playerVersion = vote.player.version;
    }
    if (index < 2) {
      await store.signInWithGoogle({
        identity: { subject: `partial-restore-${index}-${randomUUID()}`, displayName: `Pessoa ${index}`, avatarUrl: "" },
        currentToken: recoveryKey,
        topicId,
      });
    }
  }
  await store.close();

  const healthy = await tableCounts();
  assert.equal(healthy.anonymous_players, 6);
  assert.equal(healthy.choice_rounds, 18);
  assert.equal(healthy.votes, 90);
  assert.equal(healthy.player_identities, 2);
  assert.equal(healthy.daily_answers, 0, "cenário reproduzido sem daily_answers");

  // pg_restore -L sem o TABLE DATA de schema_migrations deixa a tabela vazia.
  const migrations = (await audit.query("SELECT id, applied_at FROM schema_migrations ORDER BY id")).rows;
  assert.ok(migrations.some(({ id }) => id === CLEAN_START_MIGRATION));
  await audit.query("TRUNCATE schema_migrations");

  const before = await tableCounts();
  const constraintsBefore = await constraintNames();
  const blocked = await bootApi();
  assert.equal(blocked.code, 1, blocked.output);
  assert.equal(blocked.healthStatus, null, "a API não pode escutar com o reset bloqueado");
  assert.match(blocked.output, /SCHEMA_RESET_BLOCKED/);
  assert.match(blocked.output, /reset destrutivo bloqueado/);
  assert.deepEqual(await tableCounts(), before, "nenhuma contagem muda quando o boot aborta");
  assert.deepEqual(await constraintNames(), constraintsBefore, "nenhuma constraint é removida");

  // Com o dump completo, a mesma base sobe sem reset e sem perder linhas.
  for (const { id, applied_at: appliedAt } of migrations) {
    await audit.query("INSERT INTO schema_migrations (id, applied_at) VALUES ($1, $2)", [id, appliedAt]);
  }
  const restored = await bootApi();
  assert.equal(restored.healthStatus, 200, restored.output);
  assert.match(restored.output, /"?resetApplied"?:\s*false/);
  assert.equal(restored.code, 0, restored.output);
  assert.deepEqual(await tableCounts(), healthy);

  // O reset só acontece com autorização explícita de quem opera.
  await audit.query("TRUNCATE schema_migrations");
  const authorized = await bootApi({ allowReset: true });
  assert.equal(authorized.healthStatus, 200, authorized.output);
  assert.match(authorized.output, /"?resetApplied"?:\s*true/);
  const afterReset = await tableCounts();
  assert.equal(afterReset.anonymous_players, 0);
  assert.equal(afterReset.votes, 0);

  console.log(JSON.stringify({
    emptyDatabaseBoot: "initialized",
    partialRestoreBoot: { exitCode: blocked.code, health: blocked.healthStatus, code: "SCHEMA_RESET_BLOCKED" },
    countsUnchanged: before,
    completeRestoreBoot: { health: restored.healthStatus, resetApplied: false },
    explicitResetBoot: { health: authorized.healthStatus, resetApplied: true },
  }));
} finally {
  await audit.end();
}
