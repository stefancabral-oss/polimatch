// Pesquisa por foto (ICM 68, #324): o caminho da pessoa dentro da pesquisa.
// Funções puras. A página (photo-survey-page.js) cuida da tela, da rede e do
// armazenamento; aqui ficam as regras de escolher, voltar, trocar e retomar.

export const PHOTO_SURVEY_ID = "politica-2026-01";
export const PHOTO_SURVEY_STORAGE_KEY = "polimatch:photo-survey:v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const newUuid = () => crypto.randomUUID();

/** Cartas que ilustram a entrada: distintas e sorteadas a cada visita. */
export function sampleCards(cardIds, count, randomInt = (limit) => Math.floor(Math.random() * limit)) {
  const pool = [...cardIds];
  const size = Math.min(count, pool.length);
  for (let index = 0; index < size; index += 1) {
    const chosen = index + randomInt(pool.length - index);
    [pool[index], pool[chosen]] = [pool[chosen], pool[index]];
  }
  return pool.slice(0, size);
}

export function sameGroups(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((group, index) => Array.isArray(group) && Array.isArray(right[index])
      && group.length === right[index].length
      && group.every((id, position) => id === right[index][position]));
}

// `step`: 0 até n-1 são as telas de voto, n é a final e n+1 a confirmação.
export function freshProgress(groups, uuid = newUuid) {
  return {
    groups: groups.map((group) => [...group]),
    picks: groups.map(() => null),
    championId: null,
    answerId: uuid(),
    step: 0,
  };
}

// A primeira tela ainda sem escolha; com as quatro escolhidas, a final.
function firstOpenStep(picks) {
  const open = picks.indexOf(null);
  return open === -1 ? picks.length : open;
}

export function progressView(progress) {
  const screens = progress.groups.length;
  if (progress.step < screens) {
    return {
      kind: "vote",
      screen: progress.step,
      screens,
      cards: progress.groups[progress.step],
      selectedId: progress.picks[progress.step],
    };
  }
  if (progress.step === screens) return { kind: "final", cards: [...progress.picks], selectedId: progress.championId };
  return {
    kind: "confirm",
    championId: progress.championId,
    otherIds: progress.picks.filter((id) => id !== progress.championId),
  };
}

/** Um toque na tela de voto: guarda a escolha e segue para a próxima tela sem escolha. */
export function pickCard(progress, cardId) {
  const screen = progress.step;
  if (screen >= progress.groups.length || !progress.groups[screen].includes(cardId)) return progress;
  const previous = progress.picks[screen];
  const picks = progress.picks.map((id, index) => (index === screen ? cardId : id));
  return {
    ...progress,
    picks,
    championId: previous !== cardId && progress.championId === previous ? null : progress.championId,
    step: firstOpenStep(picks),
  };
}

/** Um toque na final: guarda a escolhida e segue para a confirmação. */
export function chooseChampion(progress, cardId) {
  const screens = progress.groups.length;
  if (progress.step !== screens || typeof cardId !== "string" || !progress.picks.includes(cardId)) return progress;
  return { ...progress, championId: cardId, step: screens + 1 };
}

export function goBack(progress) {
  return progress.step > 0 ? { ...progress, step: progress.step - 1 } : progress;
}

/** O corpo da resposta, ou null enquanto faltar escolha. */
export function responseBody(progress) {
  if (progress.picks.includes(null) || !progress.picks.includes(progress.championId)) return null;
  return { answerId: progress.answerId, pickIds: [...progress.picks], championId: progress.championId };
}

/**
 * Retoma o que estava salvo no aparelho quando o sorteio é o mesmo. O que foi
 * salvo é texto que qualquer um edita: cada campo é conferido contra o sorteio.
 */
export function restoreProgress(saved, groups, uuid = newUuid) {
  if (!saved || typeof saved !== "object" || !sameGroups(saved.groups, groups)) return freshProgress(groups, uuid);
  const screens = groups.length;
  const savedPicks = Array.isArray(saved.picks) ? saved.picks : [];
  const picks = groups.map((group, index) => (group.includes(savedPicks[index]) ? savedPicks[index] : null));
  const championId = picks.includes(saved.championId) && saved.championId !== null ? saved.championId : null;
  const open = firstOpenStep(picks);
  let step = Number.isInteger(saved.step) ? Math.max(0, saved.step) : open;
  if (step > open) step = open;
  if (step > screens && !championId) step = screens;
  if (step > screens + 1) step = screens + 1;
  return {
    groups: groups.map((group) => [...group]),
    picks,
    championId,
    answerId: typeof saved.answerId === "string" && UUID_PATTERN.test(saved.answerId) ? saved.answerId : uuid(),
    step,
  };
}

/**
 * Marca curta da identidade (FNV-1a de 32 bits). Serve só para saber se o que
 * está salvo é de quem está com a chave agora; a chave em si não é copiada.
 */
export function identityTag(key) {
  if (typeof key !== "string" || key === "") return "";
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function parseSaved(text) {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** O registro de uma pesquisa no armazenamento, ou null. */
export function readSavedProgress(text, surveyId) {
  const record = parseSaved(text)[surveyId];
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  return {
    identity: typeof record.identity === "string" ? record.identity : "",
    progress: record.progress && typeof record.progress === "object" ? record.progress : null,
    response: record.response && typeof record.response === "object" ? record.response : null,
  };
}

/** O texto a gravar, preservando o que estiver salvo de outras pesquisas. */
export function savedProgressText(text, surveyId, { identity = "", progress = null, response = null }) {
  return JSON.stringify({ ...parseSaved(text), [surveyId]: { identity, progress, response } });
}
