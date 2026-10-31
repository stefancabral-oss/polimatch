// Relato mínimo de erros do navegador para a API: tipo, mensagem, arquivo,
// linha, stack curta, página e build. Nada do jogador (chave, voto, nome,
// armazenamento) entra no relato; query string e fragmento saem das URLs.
export const CLIENT_ERROR_PATH = "/api/client-errors";
export const MAX_REPORT_BYTES = 2048;
export const MAX_REPORTS_PER_PAGE = 5;

const LIMITS = Object.freeze({ build: 64, page: 120, message: 300, source: 200, stack: 1200 });
const TOKEN_PATTERN = /\bpm[2s]_[A-Za-z0-9_-]{16,}/g;
const BEARER_PATTERN = /(Bearer\s+)\S+/gi;
// Erros de extensões do navegador não são do app.
const EXTENSION_SOURCE_PATTERN = /^(?:chrome|moz|safari-web|safari)-extension:/i;

// Query string e fragmento saem de qualquer caminho ou URL, inclusive dentro
// de uma linha de stack; o sufixo ":linha:coluna" fica.
function withoutQuery(token) {
  const cut = token.search(/[?#]/);
  if (cut <= 0 || !token.slice(0, cut).includes("/")) return token;
  const suffix = /(?::\d+){0,2}\)?$/.exec(token.slice(cut))?.[0] || "";
  return token.slice(0, cut) + suffix;
}

export function scrubText(value, limit) {
  return String(value ?? "")
    .slice(0, limit * 4)
    .replace(/\S+/g, withoutQuery)
    .replace(TOKEN_PATTERN, "[redacted-token]")
    .replace(BEARER_PATTERN, "$1[redacted]")
    .slice(0, limit);
}

function byteLength(text) {
  return new TextEncoder().encode(text).length;
}

function position(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function describeReason(reason) {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  // Objetos rejeitados podem carregar estado do app; só o tipo segue.
  return Object.prototype.toString.call(reason);
}

export function buildClientErrorReport({ kind, error = null, message = "", source = "", line, column, build, page }) {
  const report = {
    build: scrubText(build || "unknown", LIMITS.build),
    page: scrubText(String(page || "/").split(/[?#]/)[0], LIMITS.page),
    kind,
    message: scrubText(message || (error instanceof Error ? error.message : ""), LIMITS.message),
    // O WebKit informa "undefined" como arquivo de código avaliado.
    source: source && source !== "undefined" ? scrubText(source, LIMITS.source) : null,
    line: position(line),
    column: position(column),
    stack: error instanceof Error && typeof error.stack === "string" ? scrubText(error.stack, LIMITS.stack) : null,
  };
  // O teto de 2 KB vale mesmo com caracteres de vários bytes.
  while (report.stack && byteLength(JSON.stringify(report)) > MAX_REPORT_BYTES) {
    report.stack = report.stack.slice(0, Math.floor(report.stack.length / 2)) || null;
  }
  while (report.message.length > 1 && byteLength(JSON.stringify(report)) > MAX_REPORT_BYTES) {
    report.message = report.message.slice(0, Math.floor(report.message.length / 2));
  }
  return report;
}

export function beaconSender(target, endpoint) {
  return (body) => {
    const navigator = target?.navigator;
    // Uma string vai como text/plain: sem preflight de CORS, e o envio
    // sobrevive à troca de página.
    if (typeof navigator?.sendBeacon === "function" && navigator.sendBeacon(endpoint, body)) return;
    target?.fetch?.(endpoint, {
      method: "POST",
      body,
      keepalive: true,
      credentials: "omit",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
    })?.catch?.(() => {});
  };
}

export function installErrorReporter({
  target = globalThis.window,
  endpoint,
  build,
  send = beaconSender(target, endpoint),
  maxReports = MAX_REPORTS_PER_PAGE,
} = {}) {
  if (typeof target?.addEventListener !== "function" || !endpoint) return () => {};
  const seen = new Set();
  let sent = 0;

  const report = (details) => {
    if (sent >= maxReports) return;
    try {
      const payload = buildClientErrorReport({ ...details, build, page: target.location?.pathname });
      if (!payload.message && !payload.stack) return;
      const key = [payload.kind, payload.message, payload.source, payload.line].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      sent += 1;
      send(JSON.stringify(payload));
    } catch {
      // Relatar nunca pode causar outro erro na página.
    }
  };

  // Sem captura: falhas de imagem e de recurso não sobem até a janela, e o app
  // já trata essas falhas com fallback próprio.
  const onError = (event) => {
    if (EXTENSION_SOURCE_PATTERN.test(String(event?.filename || ""))) return;
    report({
      kind: "error",
      error: event?.error,
      message: event?.message,
      source: event?.filename,
      line: event?.lineno,
      column: event?.colno,
    });
  };
  const onRejection = (event) => {
    const reason = event?.reason;
    report({ kind: "unhandledrejection", error: reason instanceof Error ? reason : null, message: describeReason(reason) });
  };
  // Disparado pelo Vite quando um import dinâmico falha (chunk antigo depois
  // de um deploy, rede caída).
  const onPreloadError = (event) => {
    const error = event?.payload;
    report({ kind: "preload", error: error instanceof Error ? error : null, message: describeReason(error) });
  };

  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  target.addEventListener("vite:preloadError", onPreloadError);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
    target.removeEventListener("vite:preloadError", onPreloadError);
  };
}
