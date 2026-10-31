// Prova de resiliência da API contra um PostgreSQL local descartável:
// 1. limites de sessão do pool e erros de conexão sem derrubar o processo;
// 2. a API real (src/server.js) sobrevive ao encerramento das próprias
//    conexões pelo banco e o /api/health seguinte responde 200;
// 3. corpos comprimidos ou malformados recebem 4xx sem derrubar nada;
// 4. espera por trava vira 503 com Retry-After em vez de pendurar;
// 5. uma linha JSON por requisição, 429 contável com o código, sem IP/token,
//    e relato de erro do navegador registrado com o build;
// 6. SIGTERM encerra em ordem com código 0.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import pg from "pg";
import {
  DATABASE_APPLICATION_NAME,
  applyMigrationTimeouts,
  createDatabasePool,
  isTransientDatabaseError,
} from "../src/database-resilience.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL é obrigatória para o smoke de resiliência");
// O smoke encerra conexões e trava tabelas: só roda contra banco local.
const { hostname } = new URL(connectionString);
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname)) {
  throw new Error("o smoke de resiliência exige um PostgreSQL local descartável");
}

const backDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const evidence = {};

const admin = new pg.Pool({ connectionString, application_name: "polimatch-resilience-smoke", max: 2 });
admin.on("error", () => {});

async function terminateApiBackends() {
  const result = await admin.query(
    `SELECT count(*)::int AS terminated FROM (
       SELECT pg_terminate_backend(pid) AS done FROM pg_stat_activity
       WHERE datname = current_database() AND application_name = $1 AND pid <> pg_backend_pid()
     ) AS killed WHERE done`,
    [DATABASE_APPLICATION_NAME],
  );
  return result.rows[0].terminated;
}

// --- 1. Pool no próprio processo do smoke ---------------------------------
{
  const logs = [];
  const logger = { error: (entry) => logs.push(entry), warn: (entry) => logs.push(entry), info() {} };
  const pool = createDatabasePool(connectionString, {
    env: { PG_STATEMENT_TIMEOUT_MS: "300", PG_IDLE_IN_TRANSACTION_TIMEOUT_MS: "400" },
    logger,
  });
  try {
    const settings = (await pool.query(`SELECT current_setting('statement_timeout') AS statement,
      current_setting('lock_timeout') AS lock, current_setting('idle_in_transaction_session_timeout') AS idle,
      current_setting('application_name') AS app`)).rows[0];
    assert.deepEqual(settings, { statement: "300ms", lock: "5s", idle: "400ms", app: DATABASE_APPLICATION_NAME });

    await assert.rejects(pool.query("SELECT pg_sleep(2)"), (error) => error.code === "57014" && isTransientDatabaseError(error));

    const migrating = await pool.connect();
    await migrating.query("BEGIN");
    await applyMigrationTimeouts(migrating);
    const inside = (await migrating.query("SHOW statement_timeout")).rows[0].statement_timeout;
    await migrating.query("COMMIT");
    const after = (await migrating.query("SHOW statement_timeout")).rows[0].statement_timeout;
    migrating.release();
    assert.equal(inside, "2min");
    assert.equal(after, "300ms");

    // Transação esquecida aberta: o servidor encerra a sessão enquanto o
    // cliente está emprestado. Sem ouvinte, este processo morreria aqui.
    const held = await pool.connect();
    await held.query("BEGIN");
    await sleep(1000);
    await assert.rejects(held.query("SELECT 1"), isTransientDatabaseError);
    held.release();
    assert.ok(logs.some((entry) => entry.event === "pg_pool_error" && entry.scope === "checked-out"));

    // Cliente ocioso encerrado pelo banco: o pool descarta e reconecta.
    await pool.query("SELECT 1");
    assert.ok(await terminateApiBackends() >= 1);
    await sleep(300);
    assert.ok(logs.some((entry) => entry.event === "pg_pool_error" && entry.scope === "idle"));
    assert.equal((await pool.query("SELECT 1 AS ok")).rows[0].ok, 1);
    evidence.pool = { statementTimeout: "57014", migrationScoped: [inside, after], idleInTransaction: "logged", idleTerminated: "logged" };
  } finally {
    await pool.end();
  }
}

// --- 2. API real ------------------------------------------------------------
async function freePort() {
  const server = createServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address();
  await new Promise((done) => server.close(done));
  return port;
}

const port = Number(process.env.API_RESILIENCE_PORT) || await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const stdout = [];
const stderr = [];
const child = spawn(process.execPath, ["src/server.js"], {
  cwd: backDir,
  env: {
    ...process.env,
    DATABASE_URL: connectionString,
    PORT: String(port),
    NODE_ENV: "production",
    // Segredo novo a cada execução: a cota por rede começa zerada.
    VOTER_NETWORK_SECRET: randomBytes(32).toString("hex"),
    TRUST_PROXY_HOPS: "0",
    PG_LOCK_TIMEOUT_MS: "1000",
    LOG_LEVEL: "info",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let pending = "";
child.stdout.setEncoding("utf8").on("data", (chunk) => {
  pending += chunk;
  const lines = pending.split("\n");
  pending = lines.pop();
  stdout.push(...lines.filter(Boolean));
});
child.stderr.setEncoding("utf8").on("data", (chunk) => stderr.push(chunk));
const exited = new Promise((done) => child.once("exit", (code, signal) => done({ code, signal })));

function alive() {
  return child.exitCode === null && child.signalCode === null;
}

function entries() {
  return stdout.map((line) => JSON.parse(line));
}

async function post(path, { headers = {}, body = "{}" } = {}) {
  return fetch(`${baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
}

try {
  const deadline = Date.now() + 90000;
  let ready = false;
  while (!ready && Date.now() < deadline) {
    assert.ok(alive(), `a API encerrou durante o boot\n${stderr.join("")}\n${stdout.join("\n")}`);
    try {
      ready = (await fetch(`${baseUrl}/api/health`)).status === 200;
    } catch {}
    if (!ready) await sleep(250);
  }
  assert.ok(ready, "a API não ficou saudável a tempo");
  const pid = child.pid;

  for (let index = 0; index < 3; index += 1) {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-powered-by"), null);
  }

  const terminated = await terminateApiBackends();
  assert.ok(terminated >= 1, "nenhuma conexão da API para encerrar");
  await sleep(300);
  assert.ok(alive(), `a API morreu depois de pg_terminate_backend\n${stderr.join("")}`);
  const afterTerminate = await fetch(`${baseUrl}/api/health`);
  assert.equal(afterTerminate.status, 200);
  assert.equal((await afterTerminate.json()).ok, true);
  assert.equal(child.pid, pid);
  assert.ok(entries().some((entry) => entry.event === "pg_pool_error" && entry.scope === "idle"));
  evidence.terminate = { terminatedBackends: terminated, nextHealthStatus: afterTerminate.status, samePid: true };

  // --- 3. Corpos inesperados ------------------------------------------------
  const compressed = await post("/api/player", {
    headers: { "Content-Encoding": "gzip" },
    body: gzipSync(Buffer.from("{}")),
  });
  assert.equal(compressed.status, 415);
  assert.equal((await compressed.json()).code, "UNSUPPORTED_CONTENT_ENCODING");
  const malformed = await post("/api/player", { body: '{"broken' });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).code, "INVALID_JSON");
  const oversized = await post("/api/player", { body: JSON.stringify({ padding: "x".repeat(40 * 1024) }) });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).code, "PAYLOAD_TOO_LARGE");
  assert.ok(alive());
  assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  evidence.bodies = { compressedBody: 415, malformedJson: 400, oversized: 413 };

  // --- 4. Espera por trava com limite --------------------------------------
  const locker = await admin.connect();
  let locked;
  let lockedElapsedMs;
  try {
    await locker.query("BEGIN");
    await locker.query("LOCK TABLE abuse_quota_counters IN ACCESS EXCLUSIVE MODE");
    const startedAt = Date.now();
    locked = await post("/api/player");
    lockedElapsedMs = Date.now() - startedAt;
  } finally {
    await locker.query("ROLLBACK");
    locker.release();
  }
  assert.equal(locked.status, 503);
  assert.equal(locked.headers.get("retry-after"), "5");
  assert.equal((await locked.json()).code, "DATABASE_UNAVAILABLE");
  assert.ok(lockedElapsedMs < 5000, `espera de ${lockedElapsedMs} ms`);
  evidence.lockTimeout = { status: 503, elapsedMs: lockedElapsedMs };

  // --- 5. Cota, linhas de log e ausência de IP/token -----------------------
  const keys = [];
  for (let index = 0; index < 3; index += 1) {
    const created = await post("/api/player");
    assert.equal(created.status, 201);
    keys.push((await created.json()).recoveryKey);
  }
  const refused = await post("/api/player");
  assert.equal(refused.status, 429);
  assert.equal((await refused.json()).code, "PLAYER_ISSUANCE_LIMIT");
  const state = await fetch(`${baseUrl}/api/player/state?topic=eleicoes-2026`, { headers: { Authorization: `Bearer ${keys[0]}` } });
  assert.equal(state.status, 200);
  // Relato de erro do navegador, no formato do sendBeacon (text/plain).
  const clientBuild = "f".repeat(40);
  const clientError = await fetch(`${baseUrl}/api/client-errors`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify({ build: clientBuild, page: "/index.html", kind: "error", message: "erro forçado no smoke", line: 1, column: 2 }),
  });
  assert.equal(clientError.status, 204);
  await sleep(200);

  const lines = stdout.slice();
  for (const line of lines) assert.doesNotThrow(() => JSON.parse(line), line);
  const requests = entries().filter((entry) => entry.event === "http_request");
  const allowed = new Set(["t", "level", "service", "rev", "event", "requestId", "method", "route", "status", "ms", "code", "path", "aborted"]);
  for (const entry of requests) {
    for (const key of Object.keys(entry)) assert.ok(allowed.has(key), `campo inesperado ${key}`);
    assert.ok(Object.hasOwn(entry, "rev"));
    assert.match(entry.requestId, /^[0-9a-f-]{36}$/);
  }
  const quotaLines = lines.filter((line) => line.includes('"status":429'));
  assert.equal(quotaLines.length, 1);
  assert.ok(quotaLines[0].includes('"code":"PLAYER_ISSUANCE_LIMIT"'));
  assert.ok(requests.some((entry) => entry.status === 503 && entry.code === "DATABASE_UNAVAILABLE"));
  assert.ok(entries().some((entry) => entry.event === "request_failed" && entry.errorCode === "55P03" && typeof entry.error === "string"));
  assert.ok(requests.some((entry) => entry.status === 415 && entry.code === "UNSUPPORTED_CONTENT_ENCODING"));
  const clientReports = entries().filter((entry) => entry.event === "client_error");
  assert.equal(clientReports.length, 1);
  assert.equal(clientReports[0].build, clientBuild);
  assert.equal(clientReports[0].message, "erro forçado no smoke");
  const joined = lines.join("\n");
  for (const key of keys) assert.equal(joined.includes(key), false);
  assert.equal(joined.includes("Bearer "), false);
  assert.equal(requests.some((entry) => JSON.stringify(entry).includes("127.0.0.1")), false);
  evidence.logs = { requestLines: requests.length, status429Lines: quotaLines.length, clientErrorLines: clientReports.length, allLinesJson: true };

  // --- 6. Encerramento ordenado --------------------------------------------
  child.kill("SIGTERM");
  const outcome = await exited;
  assert.deepEqual(outcome, { code: 0, signal: null });
  await sleep(50);
  assert.ok(entries().some((entry) => entry.event === "shutdown_completed"));
  evidence.sigterm = { exitCode: 0 };
} finally {
  if (alive()) child.kill("SIGKILL");
  await admin.end();
}

console.log(JSON.stringify({ smoke: "api-resilience", ...evidence }));
console.log("Resiliência da API comprovada: pool sobrevive a conexões encerradas e transações abertas, /api/health volta a 200 sem reiniciar, corpos inesperados recebem 4xx, trava vira 503, cada requisição gera uma linha JSON sem IP nem token e o relato de erro do navegador chega ao log com o build.");
