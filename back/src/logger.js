// Logger JSON de uma linha por evento, sem dependências. Os chamadores passam
// apenas campos explícitos (lista de permissão): cabeçalhos, IP e corpo nunca
// entram por padrão. A limpeza abaixo é uma segunda barreira para texto livre,
// como mensagens e stacks de erro.
const LEVELS = Object.freeze({ debug: 20, info: 30, warn: 40, error: 50, fatal: 60 });
const MAX_STACK_LENGTH = 4000;

const SECRET_PATTERNS = [
  [/(Bearer\s+)[^\s"\\]+/gi, "$1[redacted]"],
  [/\bpm[2s]_[A-Za-z0-9_-]{16,}/g, "[redacted-token]"],
  [/(postgres(?:ql)?:\/\/)[^@\s"\\/]+@/gi, "$1[redacted]@"],
  [/(password=)[^\s"\\]+/gi, "$1[redacted]"],
];

export function redactSecrets(text) {
  return SECRET_PATTERNS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), String(text));
}

export function serializeError(error) {
  if (!(error instanceof Error)) return { message: String(error) };
  const serialized = { type: error.name, message: error.message };
  if (error.code !== undefined) serialized.code = String(error.code);
  if (typeof error.stack === "string") serialized.stack = error.stack.slice(0, MAX_STACK_LENGTH);
  return serialized;
}

function jsonReplacer(_key, value) {
  if (value instanceof Error) return serializeError(value);
  if (typeof value === "bigint") return value.toString();
  return value;
}

function defaultWrite(line) {
  process.stdout.write(line);
}

export function createLogger({
  write = defaultWrite,
  base = {},
  level = "info",
  clock = () => new Date(),
} = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function emit(entryLevel, fields) {
    if (LEVELS[entryLevel] < threshold) return;
    const prefix = { t: clock().toISOString(), level: entryLevel, ...base };
    let line;
    try {
      line = JSON.stringify({ ...prefix, ...fields }, jsonReplacer);
    } catch (error) {
      line = JSON.stringify({ ...prefix, event: "log_serialization_failed", reason: String(error?.message) });
    }
    // Registrar nunca pode derrubar a requisição nem o processo.
    try {
      write(`${redactSecrets(line)}\n`);
    } catch {}
  }

  return {
    debug: (fields) => emit("debug", fields),
    info: (fields) => emit("info", fields),
    warn: (fields) => emit("warn", fields),
    error: (fields) => emit("error", fields),
    fatal: (fields) => emit("fatal", fields),
    child: (extra) => createLogger({ write, base: { ...base, ...extra }, level, clock }),
  };
}

export function logLevelFromEnvironment(env = process.env) {
  const value = String(env.LOG_LEVEL || "info").toLowerCase();
  return Object.hasOwn(LEVELS, value) ? value : "info";
}
