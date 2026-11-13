import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  DATABASE_APPLICATION_NAME,
  DATABASE_TIMEOUT_DEFAULTS,
  MIGRATION_TIMEOUTS,
  applyMigrationTimeouts,
  createDatabasePool,
  databasePoolConfig,
  databaseTimeouts,
  guardPoolErrors,
  isTransientDatabaseError,
} from "./database-resilience.js";

test("runtime database timeouts have finite defaults and accept explicit overrides", () => {
  assert.deepEqual(databaseTimeouts({}), DATABASE_TIMEOUT_DEFAULTS);
  assert.equal(DATABASE_TIMEOUT_DEFAULTS.connectionTimeoutMillis, 5000);
  const custom = databaseTimeouts({ PG_STATEMENT_TIMEOUT_MS: "2000", PG_LOCK_TIMEOUT_MS: "1000", PG_IDLE_IN_TRANSACTION_TIMEOUT_MS: "3000", PG_CONNECT_TIMEOUT_MS: "1500" });
  assert.deepEqual(
    [custom.statementTimeoutMs, custom.lockTimeoutMs, custom.idleInTransactionTimeoutMs, custom.connectionTimeoutMillis],
    [2000, 1000, 3000, 1500],
  );
  for (const invalid of ["0", "-1", "1.5", "abc", "10s"]) {
    assert.throws(() => databaseTimeouts({ PG_STATEMENT_TIMEOUT_MS: invalid }), /PG_STATEMENT_TIMEOUT_MS/);
  }
});

test("the pool sends statement, lock and idle-transaction limits as session settings", () => {
  const config = databasePoolConfig("postgresql://u:p@127.0.0.1:5432/db", {});
  assert.equal(config.application_name, DATABASE_APPLICATION_NAME);
  assert.equal(config.connectionTimeoutMillis, 5000);
  assert.equal(config.statement_timeout, 10000);
  assert.equal(config.lock_timeout, 5000);
  assert.equal(config.idle_in_transaction_session_timeout, 15000);
  assert.equal(config.keepAlive, true);
  assert.equal(config.max, 10);
  assert.equal(databasePoolConfig("x", { PG_POOL_MAX: "4" }).max, 4);
  // A migração tem prazos maiores, mas nunca ilimitados.
  for (const value of Object.values(MIGRATION_TIMEOUTS)) assert.ok(Number.isSafeInteger(value) && value > 0);
  assert.ok(MIGRATION_TIMEOUTS.statementTimeoutMs > DATABASE_TIMEOUT_DEFAULTS.statementTimeoutMs);
});

test("idle and checked-out client errors are logged instead of crashing the process", () => {
  const logs = [];
  const pool = guardPoolErrors(new EventEmitter(), { error: (entry) => logs.push(entry) });

  // Cliente ocioso: o pg-pool repassa ao evento error do pool.
  assert.doesNotThrow(() => pool.emit("error", Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" })));

  // Cliente emprestado: sem ouvinte próprio, o emit lançaria.
  const client = new EventEmitter();
  pool.emit("acquire", client);
  pool.emit("acquire", client);
  assert.equal(client.listenerCount("error"), 1);
  assert.doesNotThrow(() => client.emit("error", new Error("Connection terminated unexpectedly")));

  // Devolvido ao pool, o ouvinte temporário sai; o pg-pool religa o dele.
  pool.emit("release", undefined, client);
  assert.equal(client.listenerCount("error"), 0);

  assert.deepEqual(logs.map(({ event, scope, errorCode }) => [event, scope, errorCode]), [
    ["pg_pool_error", "idle", "57P01"],
    ["pg_pool_error", "checked-out", null],
  ]);
  assert.equal(JSON.stringify(logs).includes("connectionString"), false);
});

test("the real pool is created with error listeners and the configured limits", async () => {
  const pool = createDatabasePool("postgresql://user:pass@127.0.0.1:1/never_connected", { env: { PG_LOCK_TIMEOUT_MS: "1234" }, logger: { error() {} } });
  try {
    assert.ok(pool.listenerCount("error") >= 1);
    assert.ok(pool.listenerCount("acquire") >= 1);
    assert.ok(pool.listenerCount("release") >= 1);
    assert.equal(pool.options.lock_timeout, 1234);
    assert.equal(pool.options.statement_timeout, 10000);
    assert.equal(pool.options.connectionTimeoutMillis, 5000);
  } finally {
    await pool.end();
  }
});

test("migration timeouts are scoped to the boot transaction", async () => {
  const queries = [];
  await applyMigrationTimeouts({ query: async (sql) => { queries.push(sql); } });
  assert.deepEqual(queries, [
    `SET LOCAL statement_timeout = ${MIGRATION_TIMEOUTS.statementTimeoutMs}`,
    `SET LOCAL lock_timeout = ${MIGRATION_TIMEOUTS.lockTimeoutMs}`,
    `SET LOCAL idle_in_transaction_session_timeout = ${MIGRATION_TIMEOUTS.idleInTransactionTimeoutMs}`,
  ]);
});

test("only infrastructure failures are classified as transient", () => {
  const transient = [
    { code: "57014" }, { code: "55P03" }, { code: "25P03" }, { code: "57P01" }, { code: "57P03" },
    { code: "53300" }, { code: "08006" }, { code: "ECONNREFUSED" }, { code: "ECONNRESET" },
    new Error("timeout exceeded when trying to connect"),
    new Error("Connection terminated unexpectedly"),
    new Error("Client has encountered a connection error and is not queryable"),
  ];
  for (const error of transient) assert.equal(isTransientDatabaseError(error), true, JSON.stringify(error) + error.message);
  const permanent = [
    null, undefined, "57014", { code: "23505" }, { code: "42P01" }, { code: "PLAYER_SESSION_REQUIRED" },
    new Error("sessão de jogador obrigatória"), new TypeError("x is not a function"),
  ];
  for (const error of permanent) assert.equal(isTransientDatabaseError(error), false, String(error?.code || error));
});
