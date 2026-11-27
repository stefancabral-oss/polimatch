const API_BASE = String(import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
const TIMEOUT_MS = 8000;

/**
 * Erro de API que preserva o motivo da falha.
 *
 * `status` 0 significa que nenhuma resposta chegou (rede caiu ou estourou o tempo);
 * qualquer outro valor é o status HTTP real. Quem chama precisa dessa distinção:
 * só um 401 autoriza descartar a chave de recuperação, e só um 409 pede
 * ressincronização de versão. Colapsar tudo numa mensagem única faz o app
 * apagar a conta do jogador por causa de um 503 passageiro.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "", body = null, retryAfterSeconds = null, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
    const retryDelay = Number(retryAfterSeconds ?? body?.retryAfterSeconds);
    this.retryAfterSeconds = Number.isFinite(retryDelay) && retryDelay > 0
      ? Math.min(86400, Math.ceil(retryDelay))
      : null;
  }

  /** Nenhuma resposta chegou: a tentativa pode ter sido aplicada no servidor. */
  get unreachable() {
    return this.status === 0;
  }
}

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(apiUrl(path), { ...options, signal: controller.signal });
    if (!response.ok) {
      let body = null;
      try {
        body = await response.json();
      } catch (error) {
        // Cabeçalhos podem chegar antes do prazo e o corpo continuar pendente.
        // Se o timer abortou a leitura, a incerteza ainda é de transporte —
        // não uma resposta HTTP válida nem um payload malformado.
        if (controller.signal.aborted) throw error;
      }
      const retryAfterHeader = Number(response.headers?.get?.("retry-after"));
      throw new ApiError(body?.error || `Servidor respondeu ${response.status}`, {
        status: response.status,
        code: body?.code || "",
        body,
        retryAfterSeconds: body?.retryAfterSeconds ?? retryAfterHeader,
      });
    }
    if (response.status === 204) return null;
    try {
      return await response.json();
    } catch (error) {
      // Resposta 2xx com corpo ilegível: proxy, portal cativo ou deploy quebrado.
      // A conexão está de pé, então dizer "sem conexão" manda a pessoa
      // consertar a coisa errada.
      if (controller.signal.aborted) throw error;
      throw new ApiError("O servidor respondeu em um formato inesperado", {
        status: response.status,
        code: "BAD_PAYLOAD",
        cause: error,
      });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const aborted = controller.signal.aborted;
    throw new ApiError(aborted ? "O servidor demorou para responder" : "Sem conexão com o servidor", {
      status: 0,
      code: aborted ? "TIMEOUT" : "NETWORK",
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function loadCandidates(topicId = "eleicoes-2026") {
  const result = await requestJson(`/api/candidates?topic=${encodeURIComponent(topicId)}`);
  if (!Array.isArray(result.candidates)) throw new ApiError("Catálogo inválido");
  return result.candidates;
}

export function loadCapabilities() {
  return requestJson("/api/capabilities");
}

export function loadRanking(topicId = "eleicoes-2026") {
  return requestJson(`/api/ranking?topic=${encodeURIComponent(topicId)}`);
}

export function createPlayer() {
  return requestJson("/api/player", { method: "POST" });
}

export function loadPlayerRanking(recoveryKey, topicId = "eleicoes-2026") {
  return requestJson(`/api/player/state?topic=${encodeURIComponent(topicId)}`, {
    headers: { Authorization: `Bearer ${recoveryKey}` },
  });
}

export function loadDailySession(recoveryKey, topicId = "eleicoes-2026") {
  return requestJson(`/api/daily-session?topic=${encodeURIComponent(topicId)}`, {
    headers: { Authorization: `Bearer ${recoveryKey}` },
  });
}

export function loadDailyCut(date, topicId = "eleicoes-2026") {
  return requestJson(`/api/daily-cut?topic=${encodeURIComponent(topicId)}&date=${encodeURIComponent(date)}`);
}

export function loadDailyPredictionResults(recoveryKey, topicId = "eleicoes-2026") {
  return requestJson(`/api/daily-prediction-results?topic=${encodeURIComponent(topicId)}`, {
    headers: { Authorization: `Bearer ${recoveryKey}` },
  });
}

export function exchangeGoogleCredential(credential, currentToken, topicId = "eleicoes-2026") {
  return requestJson("/api/auth/google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
    },
    body: JSON.stringify({ credential, topicId }),
  });
}

export function endSession(accessToken) {
  return requestJson("/api/auth/logout", {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
}

/**
 * O `roundId` vem de quem chama, nunca daqui.
 *
 * Ele é a chave de idempotência que o servidor usa para reconhecer a repetição
 * de uma rodada (trava consultiva + UNIQUE + resposta `alreadyProcessed`). Se
 * nascesse a cada requisição, uma nova tentativa depois de um tempo esgotado
 * viraria uma rodada diferente e derrubaria toda essa proteção.
 */
export function submitRoundVote(roundId, winnerId, candidateIds, topicId = "eleicoes-2026", player = {}) {
  return requestJson("/api/round-vote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(player.recoveryKey ? { Authorization: `Bearer ${player.recoveryKey}` } : {}),
    },
    body: JSON.stringify({
      roundId,
      winnerId,
      candidateIds,
      topicId,
      playerVersion: player.version,
      ...(player.selectionIds ? { selectionIds: player.selectionIds } : {}),
    }),
  });
}

export function submitDailyVote(answerId, editionId, slot, winnerId, topicId = "eleicoes-2026", player = {}) {
  return requestJson("/api/daily-vote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(player.recoveryKey ? { Authorization: `Bearer ${player.recoveryKey}` } : {}),
    },
    body: JSON.stringify({
      answerId,
      editionId,
      slot,
      winnerId,
      topicId,
      playerVersion: player.version,
      ...(player.selectionIds ? { selectionIds: player.selectionIds } : {}),
      ...(player.predictionEnabled === true ? { predictionContractVersion: 1 } : {}),
    }),
  });
}

export function submitDailyPrediction(predictionId, editionId, slot, candidateId, topicId = "eleicoes-2026", player = {}) {
  const skipped = candidateId === null;
  return requestJson("/api/daily-prediction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(player.recoveryKey ? { Authorization: `Bearer ${player.recoveryKey}` } : {}),
    },
    body: JSON.stringify({
      predictionId,
      editionId,
      slot,
      decision: skipped ? "skip" : "predict",
      candidateId,
      topicId,
    }),
  });
}

export function loadGameCapabilities() { return requestJson("/api/game-capabilities"); }
export function gameRequest(path, recoveryKey, body = {}) {
  return requestJson(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + recoveryKey }, body: JSON.stringify(body) });
}

// Pesquisa por foto (ICM 68, #324). O sorteio é emitido pelo servidor; a
// resposta leva o recibo que quem chama gerou uma vez, para a repetição depois
// de um tempo esgotado não virar outra resposta.
const photoSurveyPath = (surveyId, action = "") => `/api/photo-surveys/${encodeURIComponent(surveyId)}${action}`;

export function loadPhotoSurvey(surveyId) {
  return requestJson(photoSurveyPath(surveyId));
}

// Rodadas (ICM 75, #350). `next` pede a rodada seguinte e só vai no corpo
// quando é pedido; sem ele o servidor devolve a rodada em que a pessoa está.
export function drawPhotoSurvey(surveyId, recoveryKey, { next = false } = {}) {
  return gameRequest(photoSurveyPath(surveyId, "/draw"), recoveryKey, next === true ? { next: true } : {});
}

// `round` é a rodada a que a resposta pertence, como o sorteio a numerou. Só
// vai no corpo quando o servidor disse o número: um servidor de antes das
// rodadas recebe o corpo de sempre.
export function respondPhotoSurvey(surveyId, recoveryKey, { answerId, pickIds, championId, round } = {}) {
  const body = { answerId, pickIds, championId };
  return gameRequest(photoSurveyPath(surveyId, "/response"), recoveryKey, Number.isInteger(round) && round >= 1 ? { ...body, round } : body);
}

// Resultado da pessoa, feed e perfil (ICM 76, #354). Ler o resultado e o perfil
// não grava nada; só `saveMyProfile` grava, e só no toque.
const authorized = (sessionToken) => ({ Authorization: `Bearer ${sessionToken}` });

/** O resultado prévio da própria pessoa numa pesquisa: as cartas dela em ordem de pontos. */
export function loadPhotoSurveyResult(surveyId, sessionToken) {
  return requestJson(photoSurveyPath(surveyId, "/result"), { headers: authorized(sessionToken) });
}

/** O perfil da conta: ligado ou não, o nome, as marcações e a primeira colocada de cada pesquisa. */
export function loadMyProfile(sessionToken) {
  return requestJson("/api/me/profile", { headers: authorized(sessionToken) });
}

/**
 * Liga, desliga ou muda as marcações do perfil. Só vão os campos do contrato:
 * `enabled` sempre; `handle`, `surveys` e `consentVersion` quando vierem.
 */
export function saveMyProfile(sessionToken, { enabled, handle, surveys, consentVersion } = {}) {
  const body = { enabled: enabled === true };
  if (typeof handle === "string") body.handle = handle;
  if (Array.isArray(surveys)) body.surveys = surveys.filter((id) => typeof id === "string");
  if (typeof consentVersion === "string" && consentVersion) body.consentVersion = consentVersion;
  return requestJson("/api/me/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authorized(sessionToken) },
    body: JSON.stringify(body),
  });
}

/** O perfil público de um nome de perfil. Sem sessão: qualquer um com o link lê. */
export function loadPublicProfile(handle) {
  return requestJson(`/api/profiles/${encodeURIComponent(handle)}`);
}

// Cadastro com CPF (ICM 71, #336). O CPF só viaja neste pedido, no corpo:
// nunca no endereço e nunca para o armazenamento do aparelho.
export function registerCpf(sessionToken, body) {
  return gameRequest("/api/registration", sessionToken, body);
}
