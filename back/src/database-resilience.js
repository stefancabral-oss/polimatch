import pg from "pg";

const { Pool } = pg;

export const DATABASE_APPLICATION_NAME = "polimatch-api";

// Limites das consultas do dia a dia. Votos levam dezenas de milissegundos;
// passar disso por segundos indica banco travado, e é melhor responder 503 do
// que segurar a requisição e uma conexão do pool sem prazo.
export const DATABASE_TIMEOUT_DEFAULTS = Object.freeze({
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  statementTimeoutMs: 10000,
  lockTimeoutMs: 5000,
  idleInTransactionTimeoutMs: 15000,
});

// A migração de boot roda numa transação só e pode alterar tabelas grandes.
// Ela ganha prazos próprios, mais longos, mas ainda finitos: um boot travado
// precisa falhar para o orquestrador tentar de novo.
export const MIGRATION_TIMEOUTS = Object.freeze({
  statementTimeoutMs: 120000,
  lockTimeoutMs: 30000,
  idleInTransactionTimeoutMs: 60000,
});

const TIMEOUT_ENVIRONMENT = Object.freeze({
  connectionTimeoutMillis: "PG_CONNECT_TIMEOUT_MS",
  statementTimeoutMs: "PG_STATEMENT_TIMEOUT_MS",
  lockTimeoutMs: "PG_LOCK_TIMEOUT_MS",
  idleInTransactionTimeoutMs: "PG_IDLE_IN_TRANSACTION_TIMEOUT_MS",
});

export function databaseTimeouts(env = process.env) {
  const timeouts = { ...DATABASE_TIMEOUT_DEFAULTS };
  for (const [key, variable] of Object.entries(TIMEOUT_ENVIRONMENT)) {
    const raw = env[variable];
    if (raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (!/^\d+$/.test(String(raw)) || !Number.isSafeInteger(value) || value < 1) {
      throw new Error(`${variable} deve ser um inteiro positivo em milissegundos`);
    }
    timeouts[key] = value;
  }
  return timeouts;
}

export function databasePoolConfig(connectionString, env = process.env) {
  const timeouts = databaseTimeouts(env);
  return {
    connectionString,
    max: Number(env.PG_POOL_MAX) || 10,
    application_name: DATABASE_APPLICATION_NAME,
    connectionTimeoutMillis: timeouts.connectionTimeoutMillis,
    idleTimeoutMillis: timeouts.idleTimeoutMillis,
    keepAlive: true,
    // Enviados como parâmetros de sessão na conexão: valem para cada consulta,
    // inclusive esperas por trava e transações esquecidas abertas.
    statement_timeout: timeouts.statementTimeoutMs,
    lock_timeout: timeouts.lockTimeoutMs,
    idle_in_transaction_session_timeout: timeouts.idleInTransactionTimeoutMs,
  };
}

function errorFields(error) {
  return { errorCode: error?.code === undefined ? null : String(error.code), message: String(error?.message || error) };
}

// Sem ouvinte, um erro de conexão vira exceção não tratada e derruba o
// processo. O pg-pool só escuta clientes ociosos e repassa esses erros ao
// evento `error` do pool; enquanto um cliente está emprestado (no meio de uma
// transação), ninguém escuta. Os dois casos ganham ouvinte aqui. A consulta em
// andamento continua rejeitada normalmente e o cliente quebrado é descartado
// quando volta ao pool.
export function guardPoolErrors(pool, logger) {
  const checkedOut = new WeakMap();
  pool.on("error", (error) => {
    logger?.error?.({ event: "pg_pool_error", scope: "idle", ...errorFields(error) });
  });
  pool.on("acquire", (client) => {
    if (checkedOut.has(client)) return;
    const listener = (error) => {
      logger?.error?.({ event: "pg_pool_error", scope: "checked-out", ...errorFields(error) });
    };
    checkedOut.set(client, listener);
    client.on("error", listener);
  });
  pool.on("release", (_error, client) => {
    const listener = checkedOut.get(client);
    if (!listener) return;
    client.removeListener("error", listener);
    checkedOut.delete(client);
  });
  return pool;
}

export function createDatabasePool(connectionString, { env = process.env, logger } = {}) {
  return guardPoolErrors(new Pool(databasePoolConfig(connectionString, env)), logger);
}

export async function applyMigrationTimeouts(client, timeouts = MIGRATION_TIMEOUTS) {
  // SET LOCAL vale só até o COMMIT/ROLLBACK desta transação; a conexão volta
  // ao pool com os limites normais.
  await client.query(`SET LOCAL statement_timeout = ${Number(timeouts.statementTimeoutMs)}`);
  await client.query(`SET LOCAL lock_timeout = ${Number(timeouts.lockTimeoutMs)}`);
  await client.query(`SET LOCAL idle_in_transaction_session_timeout = ${Number(timeouts.idleInTransactionTimeoutMs)}`);
}

// SQLSTATE de indisponibilidade passageira: prazo de consulta, espera por
// trava, sessão encerrada pelo servidor, banco subindo ou sem conexões livres.
const TRANSIENT_SQLSTATES = new Set(["57014", "55P03", "25P03", "57P01", "57P02", "57P03", "53300", "40P01"]);
const TRANSIENT_NODE_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH"]);
const TRANSIENT_DRIVER_MESSAGES = [
  /timeout exceeded when trying to connect/i,
  /Connection terminated/i,
  /not queryable/i,
];

export function isTransientDatabaseError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  if (TRANSIENT_SQLSTATES.has(code) || code.startsWith("08") || TRANSIENT_NODE_CODES.has(code)) return true;
  const message = String(error.message || "");
  return TRANSIENT_DRIVER_MESSAGES.some((pattern) => pattern.test(message));
}
