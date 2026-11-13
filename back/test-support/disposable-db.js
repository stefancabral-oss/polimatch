// Guarda dos smokes de integração e do ensaio de restauração. Esses scripts
// recriam o schema public, truncam tabelas e criam bancos: só podem apontar
// para um PostgreSQL descartável na própria máquina (ou no serviço do CI, que
// o workflow expõe em 127.0.0.1). A checagem roda antes de qualquer conexão.

export const DISPOSABLE_DB_FLAG = "POLIMATCH_DISPOSABLE_DB";
export const DISPOSABLE_DB_EXIT_CODE = 2;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
// Parâmetros que o driver aceitaria no lugar do host ou do banco da URL.
const OVERRIDE_PARAMETERS = ["host", "hostaddr", "dbname", "database", "service"];

export function disposableDatabaseRefusal(connectionString, { env = process.env, variable = "DATABASE_URL" } = {}) {
  if (env.NODE_ENV === "production") return "NODE_ENV=production";
  if (env[DISPOSABLE_DB_FLAG] !== "1") return `${DISPOSABLE_DB_FLAG}=1 ausente`;
  if (!connectionString) return `${variable} ausente`;
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    return `${variable} não é uma URL postgresql:// válida`;
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    return `${variable} deve usar postgresql://`;
  }
  const hostname = url.hostname.toLowerCase();
  if (!LOCAL_HOSTS.has(hostname)) return `host ${hostname || "(vazio)"} não é local`;
  const override = OVERRIDE_PARAMETERS.find((name) => url.searchParams.has(name));
  if (override) return `parâmetro ${override}= na URL não é aceito`;
  let database;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    return "nome do banco ilegível";
  }
  if (!database || database.includes("/")) return "nome do banco ausente na URL";
  if (!database.endsWith("_test")) return `banco ${database} não termina em _test`;
  return null;
}

export function requireDisposableDatabase({
  connectionString = process.env.DATABASE_URL,
  env = process.env,
  variable = "DATABASE_URL",
  exit = (code) => process.exit(code),
  log = (message) => console.error(message),
} = {}) {
  const refusal = disposableDatabaseRefusal(connectionString, { env, variable });
  if (!refusal) return connectionString;
  log(
    `Recusado (${refusal}). Este script apaga dados e só roda com ${DISPOSABLE_DB_FLAG}=1, `
    + `${variable} em localhost, 127.0.0.1 ou ::1, banco terminado em _test e NODE_ENV diferente de production.`,
  );
  exit(DISPOSABLE_DB_EXIT_CODE);
  throw new Error(`banco não descartável: ${refusal}`);
}
