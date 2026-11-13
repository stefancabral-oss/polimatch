#!/usr/bin/env node
// Ensaio de restauração do PostgreSQL do PoliMatch num banco descartável local.
// Restaura um dump (formato custom do pg-backup-vps.sh, .gz do Dokploy ou SQL
// puro), confere as contagens com o manifesto e com o próprio dump, sobe a API
// desta cópia do repositório contra o banco restaurado e exige /api/health 200
// com resetApplied:false sem perda de linhas. Procedimento em docs/ops/BACKUP.md.
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { closeSync, createReadStream, createWriteStream, existsSync, mkdtempSync, openSync, readSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import { requireDisposableDatabase } from "../../back/test-support/disposable-db.js";

const backDir = fileURLToPath(new URL("../../back/", import.meta.url));
const pg = createRequire(join(backDir, "package.json"))("pg");
const REQUIRED_MIGRATION = "20260913_eleicoes_2026_clean_start";
// O boot pode completar catálogo e estatísticas para candidatos novos do
// release e podar cotas vencidas; qualquer outra diferença é perda ou desvio.
const BOOT_MAY_GROW = new Set([
  "public.schema_migrations",
  "public.ranking_pools",
  "public.ranking_stats",
  "public.player_pools",
  "public.player_stats",
]);
// O estágio 40 (#313) passou a podar no boot também o agregado de recusas de
// cota, depois de QUOTA_REJECTION_RETENTION_DAYS. Sem ele aqui, um dump com
// recusas mais antigas que a retenção seria acusado de perda.
const BOOT_MAY_PRUNE = new Set(["public.abuse_quota_counters", "public.quota_rejections_daily"]);

const USAGE = `Uso:
  POLIMATCH_DISPOSABLE_DB=1 \\
  DRILL_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/polimatch_drill_test \\
  node scripts/ops/drill-local.mjs <dump> [--manifest arquivo] [--report arquivo.json] [--skip-boot] [--keep-db]

Variáveis:
  DRILL_DATABASE_URL     banco descartável recriado pelo ensaio (local e terminado em _test)
  DRILL_MAINTENANCE_DB   banco usado para DROP/CREATE DATABASE (padrão: postgres)
  DRILL_API_PORT         porta local da API durante o ensaio (padrão: porta livre)
  DRILL_BOOT_TIMEOUT_MS  limite para /api/health responder (padrão: 180000)
  PG_RESTORE / PSQL      comandos (padrão: pg_restore / psql); aceitam "docker exec -i <container> pg_restore"`;

function parseArgs(argv) {
  const options = { dump: null, manifest: null, report: null, skipBoot: false, keepDb: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") options.help = true;
    else if (value === "--manifest") options.manifest = argv[++index];
    else if (value === "--report") options.report = argv[++index];
    else if (value === "--skip-boot") options.skipBoot = true;
    else if (value === "--keep-db") options.keepDb = true;
    else if (!value.startsWith("--") && !options.dump) options.dump = value;
    else throw new Error(`argumento desconhecido: ${value}`);
  }
  return options;
}

const commandFrom = (value, fallback) => (value || fallback).trim().split(/\s+/);
const quoteIdentifier = (name) => `"${String(name).replaceAll('"', '""')}"`;

function readMagic(path) {
  const descriptor = openSync(path, "r");
  try {
    const buffer = Buffer.alloc(5);
    const bytes = readSync(descriptor, buffer, 0, 5, 0);
    return buffer.subarray(0, bytes);
  } finally {
    closeSync(descriptor);
  }
}

async function sha256File(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

// pg_restore e psql (libpq) leem destino também do ambiente: PGHOSTADDR ou
// PGSERVICE passariam por cima do host da URL conferida pela guarda.
const LIBPQ_TARGET_VARIABLES = ["PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGSERVICE", "PGSERVICEFILE"];

function libpqEnvironment(env = process.env) {
  const clean = { ...env };
  for (const name of LIBPQ_TARGET_VARIABLES) delete clean[name];
  return clean;
}

function run(argv, { stdinFile, onLine } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(argv[0], argv.slice(1), {
      env: libpqEnvironment(),
      stdio: [stdinFile ? "pipe" : "ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-8000); });
    if (onLine) createInterface({ input: child.stdout, crlfDelay: Infinity }).on("line", onLine);
    else child.stdout.resume();
    if (stdinFile) {
      const input = createReadStream(stdinFile);
      input.on("error", reject);
      child.stdin.on("error", () => {});
      input.pipe(child.stdin);
    }
    child.on("error", reject);
    child.on("close", (code) => resolvePromise({ code, stderr }));
  });
}

// Mesma regra do pg-backup-vps.sh: uma linha de dado do COPY é uma linha da
// tabela; a chave é esquema.tabela sem aspas de identificador.
function copyCounter() {
  const tables = {};
  const migrations = [];
  let table = null;
  return {
    tables,
    migrations,
    line(text) {
      if (table === null) {
        const match = /^COPY (\S+) .*FROM stdin;$/.exec(text);
        if (match) {
          table = match[1].replaceAll('"', "");
          tables[table] = 0;
        }
        return;
      }
      if (text === "\\.") {
        table = null;
        return;
      }
      tables[table] += 1;
      if (table === "public.schema_migrations") migrations.push(text.split("\t")[0]);
    },
  };
}

async function freePort() {
  const fixed = Number(process.env.DRILL_API_PORT);
  if (Number.isInteger(fixed) && fixed > 0) return fixed;
  return new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolvePromise(port));
    });
  });
}

async function databaseCounts(connectionString) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const tables = await client.query(`
      SELECT namespace.nspname AS schema_name, class.relname AS table_name
      FROM pg_class AS class
      JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE class.relkind IN ('r', 'p')
        AND namespace.nspname NOT IN ('pg_catalog', 'information_schema')
        AND namespace.nspname NOT LIKE 'pg_toast%'
      ORDER BY 1, 2
    `);
    const counts = {};
    for (const { schema_name: schemaName, table_name: tableName } of tables.rows) {
      const result = await client.query(
        `SELECT count(*)::bigint AS n FROM ${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`,
      );
      counts[`${schemaName}.${tableName}`] = Number(result.rows[0].n);
    }
    return counts;
  } finally {
    await client.end();
  }
}

function compareCounts(expected, actual) {
  const mismatches = [];
  for (const [table, rows] of Object.entries(expected)) {
    if (actual[table] !== rows) mismatches.push({ table, expected: rows, actual: actual[table] ?? null });
  }
  for (const [table, rows] of Object.entries(actual)) {
    if (!(table in expected) && rows > 0) mismatches.push({ table, expected: null, actual: rows });
  }
  return mismatches;
}

async function bootApi(connectionString, timeoutMs) {
  const port = await freePort();
  const started = Date.now();
  const child = spawn(process.execPath, [join(backDir, "src/server.js")], {
    cwd: backDir,
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      DATABASE_URL: connectionString,
      PORT: String(port),
      VOTER_NETWORK_SECRET: randomBytes(32).toString("hex"),
      TRUST_PROXY_HOPS: "0",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  let exit = null;
  const exited = new Promise((resolvePromise) => child.once("exit", (code, signal) => {
    exit = { code, signal };
    resolvePromise(exit);
  }));
  let health = null;
  while (!exit && Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      health = { status: response.status, body: await response.json().catch(() => null) };
      if (response.status === 200) break;
    } catch {
      // A API ainda não escuta.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  const healthyAfterMs = health?.status === 200 ? Date.now() - started : null;
  if (!exit) child.kill("SIGTERM");
  const result = await exited;
  const reset = /"?resetApplied"?:\s*(true|false)/.exec(output);
  return {
    port,
    healthStatus: health?.status ?? null,
    revision: health?.body?.revision ?? null,
    resetApplied: reset ? reset[1] === "true" : null,
    healthyAfterMs,
    exitCode: result.code,
    blockedReset: /SCHEMA_RESET_BLOCKED/.test(output),
    logTail: output.slice(-2000),
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.dump) {
    console.log(USAGE);
    process.exit(options.help ? 0 : 1);
  }
  const drillUrl = requireDisposableDatabase({
    connectionString: process.env.DRILL_DATABASE_URL,
    variable: "DRILL_DATABASE_URL",
  });
  const dumpPath = resolve(options.dump);
  if (!existsSync(dumpPath)) throw new Error(`dump não encontrado: ${dumpPath}`);
  const pgRestore = commandFrom(process.env.PG_RESTORE, "pg_restore");
  const psql = commandFrom(process.env.PSQL, "psql");
  const bootTimeoutMs = Number(process.env.DRILL_BOOT_TIMEOUT_MS) || 180_000;
  const failures = [];
  const report = {
    drill: "polimatch-restore-drill/v1",
    checkedAt: new Date().toISOString(),
    dumpFile: basename(dumpPath),
    dumpSha256: await sha256File(dumpPath),
  };
  const scratch = mkdtempSync(join(tmpdir(), "polimatch-drill-"));
  const target = new URL(drillUrl);
  const databaseName = decodeURIComponent(target.pathname.slice(1));
  const maintenance = new URL(drillUrl);
  maintenance.pathname = `/${process.env.DRILL_MAINTENANCE_DB || "postgres"}`;
  let created = false;
  try {
    // Dokploy grava .gz; o conteúdo pode ser formato custom ou SQL puro.
    let restorePath = dumpPath;
    let compression = null;
    if (readMagic(dumpPath).toString("latin1") === "age-e") {
      throw new Error("dump cifrado com age: decifre antes (age -d -i chave.txt -o arquivo.dump arquivo.dump.age)");
    }
    if (readMagic(dumpPath).subarray(0, 2).equals(Buffer.from([0x1f, 0x8b]))) {
      compression = "gzip";
      restorePath = join(scratch, "dump");
      await pipeline(createReadStream(dumpPath), createGunzip(), createWriteStream(restorePath));
    }
    const format = readMagic(restorePath).toString("latin1") === "PGDMP" ? "custom" : "plain";
    report.dumpFormat = compression ? `${format}+gzip` : format;

    const counter = copyCounter();
    if (format === "custom") {
      const listed = await run([...pgRestore, "--data-only", "--file=-"], { stdinFile: restorePath, onLine: counter.line });
      if (listed.code !== 0) throw new Error(`pg_restore não leu o dump: ${listed.stderr.trim()}`);
    } else {
      const lines = createInterface({ input: createReadStream(restorePath), crlfDelay: Infinity });
      for await (const text of lines) counter.line(text);
    }
    const expected = counter.tables;
    report.dumpCounts = { tables: Object.keys(expected).length, totalRows: Object.values(expected).reduce((a, b) => a + b, 0) };
    if (!counter.migrations.includes(REQUIRED_MIGRATION)) {
      failures.push(`schema_migrations do dump não tem ${REQUIRED_MIGRATION}; a API recusaria o boot`);
    }

    const manifestPath = options.manifest
      || [/\.dump$/, /\.sql\.gz$/, /\.gz$/, /\.sql$/].reduce((found, pattern) => found
        || (pattern.test(dumpPath) && existsSync(dumpPath.replace(pattern, ".manifest.json"))
          ? dumpPath.replace(pattern, ".manifest.json") : null), null);
    if (manifestPath) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const manifestMismatches = compareCounts(manifest.tables || {}, expected);
      report.manifest = {
        file: basename(manifestPath),
        createdAt: manifest.createdAt ?? null,
        releaseRevision: manifest.releaseRevision ?? null,
        sha256Matches: manifest.sha256 === report.dumpSha256,
        countsMatchDump: manifestMismatches.length === 0,
      };
      if (!report.manifest.sha256Matches) failures.push("sha256 do dump difere do manifesto");
      if (manifestMismatches.length) {
        failures.push(`manifesto e dump divergem em ${manifestMismatches.length} tabela(s)`);
        report.manifest.mismatches = manifestMismatches;
      }
    } else {
      report.manifest = null;
    }

    const admin = new pg.Client({ connectionString: maintenance.toString() });
    await admin.connect();
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${quoteIdentifier(databaseName)} TEMPLATE template0 ENCODING 'UTF8'`);
      created = true;
    } finally {
      await admin.end();
    }

    const restoreStarted = Date.now();
    const restore = format === "custom"
      ? await run([...pgRestore, "--exit-on-error", "--single-transaction", "--no-owner", "--no-privileges", `--dbname=${drillUrl}`], { stdinFile: restorePath })
      : await run([...psql, "-X", "-q", "-v", "ON_ERROR_STOP=1", "--single-transaction", `--dbname=${drillUrl}`], { stdinFile: restorePath });
    report.restore = { exitCode: restore.code, durationMs: Date.now() - restoreStarted };
    if (restore.code !== 0) {
      report.restore.stderrTail = restore.stderr.trim().slice(-1500);
      failures.push(`restauração terminou com código ${restore.code}`);
    }

    const restored = await databaseCounts(drillUrl);
    const restoreMismatches = compareCounts(expected, restored);
    report.counts = {
      tables: Object.keys(expected).length,
      totalRows: report.dumpCounts.totalRows,
      matchDump: restoreMismatches.length === 0,
      mismatches: restoreMismatches,
      sample: Object.fromEntries(["public.anonymous_players", "public.player_identities", "public.choice_rounds", "public.votes", "public.daily_answers"]
        .filter((table) => table in restored).map((table) => [table, restored[table]])),
    };
    if (restoreMismatches.length) failures.push(`contagens restauradas divergem em ${restoreMismatches.length} tabela(s)`);

    if (options.skipBoot) {
      report.boot = null;
    } else if (restore.code === 0) {
      const boot = await bootApi(drillUrl, bootTimeoutMs);
      const afterBoot = await databaseCounts(drillUrl);
      const changes = [];
      for (const table of new Set([...Object.keys(restored), ...Object.keys(afterBoot)])) {
        const before = restored[table] ?? 0;
        const after = afterBoot[table] ?? 0;
        if (before === after) continue;
        const allowed = (after > before && BOOT_MAY_GROW.has(table)) || (after < before && BOOT_MAY_PRUNE.has(table));
        changes.push({ table, before, after, allowed });
      }
      report.boot = {
        health: boot.healthStatus,
        resetApplied: boot.resetApplied,
        revision: boot.revision,
        healthyAfterMs: boot.healthyAfterMs,
        changes,
      };
      if (boot.healthStatus !== 200) {
        report.boot.logTail = boot.logTail;
        failures.push(boot.blockedReset
          ? "a API recusou o boot (SCHEMA_RESET_BLOCKED): o dump não trouxe schema_migrations completo"
          : `a API não respondeu /api/health 200 (último status ${boot.healthStatus ?? "sem resposta"})`);
      }
      if (boot.resetApplied !== false) failures.push(`resetApplied deveria ser false (obtido ${boot.resetApplied})`);
      const lost = changes.filter(({ allowed }) => !allowed);
      if (lost.length) failures.push(`o boot alterou ${lost.map(({ table }) => table).join(", ")}`);
    }
  } finally {
    if (created && !options.keepDb) {
      const admin = new pg.Client({ connectionString: maintenance.toString() });
      await admin.connect();
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`).finally(() => admin.end());
    }
    rmSync(scratch, { recursive: true, force: true });
  }

  report.result = failures.length ? "fail" : "pass";
  report.failures = failures;
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (options.report) writeFileSync(options.report, json);
  process.stdout.write(json);
  console.error(failures.length
    ? `DRILL FALHOU: ${failures.join("; ")}`
    : `DRILL OK: ${report.counts.tables} tabelas, ${report.counts.totalRows} linhas, health ${report.boot?.health ?? "não testado"}`);
  process.exit(failures.length ? 1 : 0);
}

main().catch((error) => {
  console.error(`drill interrompido: ${error.message}`);
  process.exit(1);
});
