// Relatos de erro do navegador. O app envia por sendBeacon um objeto pequeno,
// sem dados do jogador: build, página, tipo, mensagem, arquivo, linha e stack
// curta. O servidor revalida tudo, corta de novo e registra uma linha JSON.
export const CLIENT_ERROR_MAX_BYTES = 2048;
export const CLIENT_ERROR_KINDS = Object.freeze(["error", "unhandledrejection", "preload"]);
// Por processo. Bastam para notar um erro novo depois de um deploy sem deixar
// que um cliente com defeito, ou uma rajada, encha o log.
export const CLIENT_ERROR_LIMITS = Object.freeze({ perNetworkPerMinute: 10, globalPerMinute: 120 });

const FIELD_LIMITS = Object.freeze({ build: 64, page: 120, message: 300, source: 200, stack: 1200 });
const BUILD_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function invalidReport() {
  return Object.assign(new Error("relato de erro inválido"), { status: 400, code: "INVALID_CLIENT_ERROR" });
}

// Query string e fragmento nunca entram no log, mesmo dentro de uma linha de
// stack; o sufixo ":linha:coluna" fica.
function withoutQuery(token) {
  const cut = token.search(/[?#]/);
  if (cut <= 0 || !token.slice(0, cut).includes("/")) return token;
  const suffix = /(?::\d+){0,2}\)?$/.exec(token.slice(cut))?.[0] || "";
  return token.slice(0, cut) + suffix;
}

function withoutUrlQueries(text) {
  return text.replace(/\S+/g, withoutQuery);
}

function optionalText(value, limit) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw invalidReport();
  return withoutUrlQueries(value).slice(0, limit);
}

function optionalPosition(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function normalizeClientErrorReport(raw) {
  let report = raw;
  if (typeof raw === "string") {
    try {
      report = JSON.parse(raw);
    } catch {
      throw invalidReport();
    }
  }
  if (!report || typeof report !== "object" || Array.isArray(report)) throw invalidReport();
  if (!CLIENT_ERROR_KINDS.includes(report.kind)) throw invalidReport();
  const message = optionalText(report.message, FIELD_LIMITS.message);
  const stack = optionalText(report.stack, FIELD_LIMITS.stack);
  if (!message && !stack) throw invalidReport();
  const page = typeof report.page === "string" && report.page.startsWith("/")
    ? report.page.split(/[?#]/)[0].slice(0, FIELD_LIMITS.page)
    : null;
  // Só campos conhecidos seguem adiante; qualquer outro é descartado.
  return {
    build: typeof report.build === "string" && BUILD_PATTERN.test(report.build) ? report.build : "unknown",
    page,
    kind: report.kind,
    message,
    source: optionalText(report.source, FIELD_LIMITS.source),
    line: optionalPosition(report.line),
    column: optionalPosition(report.column),
    stack,
  };
}

// Janela fixa de um minuto, em memória. A chave é o pseudônimo de rede (HMAC),
// nunca o IP. O mapa só cresce até o teto global e é zerado a cada janela.
export function createClientErrorLimiter({
  perNetworkPerMinute = CLIENT_ERROR_LIMITS.perNetworkPerMinute,
  globalPerMinute = CLIENT_ERROR_LIMITS.globalPerMinute,
  now = () => Date.now(),
} = {}) {
  let window = null;
  let total = 0;
  const perNetwork = new Map();
  return {
    take(networkKey) {
      const current = Math.floor(now() / 60000);
      if (current !== window) {
        window = current;
        total = 0;
        perNetwork.clear();
      }
      if (total >= globalPerMinute) return false;
      const used = perNetwork.get(networkKey) || 0;
      if (used >= perNetworkPerMinute) return false;
      perNetwork.set(networkKey, used + 1);
      total += 1;
      return true;
    },
  };
}
