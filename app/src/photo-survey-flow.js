// Pesquisa por foto (ICM 68, #324): o caminho da pessoa dentro da pesquisa.
// Funções puras. A página (photo-survey-page.js) cuida da tela, da rede e do
// armazenamento; aqui ficam as regras de escolher, voltar, trocar e retomar,
// desde a ICM 70 (#334) as da capa com várias pesquisas e, desde a ICM 75
// (#350), as das rodadas.

import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";

export const PHOTO_SURVEY_STORAGE_KEY = "polimatch:photo-survey:v1";

// Cartas que podem ilustrar a entrada da pesquisa de política, a pedido do
// dono do produto (14/11/2026). As outras dez seguem na pesquisa e no sorteio;
// isto só decide a ilustração. Ao trocar as cartas da pesquisa, ou ao abrir
// outra pesquisa, rever esta lista com ele.
export const ENTRY_CARD_IDS = Object.freeze([
  "bruno-zambelli", "cabo-gilberto-silva", "carlos-bolsonaro", "deltan-dallagnol", "guilherme-derrite",
  "gustavo-gayer", "jeffrey-chiquini", "lucas-pavanato", "nikolas-ferreira", "sergio-moro",
]);

// A lista acima vale para as pesquisas de política. Uma pesquisa de outro
// assunto (roupas na ICM 73, #345; famosos na ICM 74, #348) ilustra a entrada
// com as próprias cartas.
const isPolitics = (definition) => definition?.subject === "Política";

/** As cartas que podem ilustrar a entrada de uma pesquisa. */
export function entryCardIdsFor(definition) {
  return isPolitics(definition) ? ENTRY_CARD_IDS : [...(definition?.cardIds ?? [])];
}

/**
 * O título da final: "quem" nas pesquisas em que as cartas são pessoas
 * (`people` na definição: política e famosos); "qual" nas outras.
 */
export function finalTitleFor(definition) {
  return definition?.people === true ? "Entre elas, quem fica?" : "Entre elas, qual fica?";
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const newUuid = () => crypto.randomUUID();

/** Sorteia as cartas que ilustram a entrada: distintas, a cada visita. */
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

// A rodada de um progresso: da segunda em diante o número vai guardado junto
// das escolhas; sem ele, é a primeira. Assim o que se guarda da primeira
// rodada é o mesmo de antes das rodadas (ICM 75, #350).
const laterRound = (round) => (Number.isInteger(round) && round >= 2 ? round : 1);
const roundMark = (round) => (laterRound(round) >= 2 ? { round: laterRound(round) } : {});

// `step`: 0 até n-1 são as telas de voto, n é a final e n+1 a confirmação.
// `round` é a rodada a que o sorteio pertence.
export function freshProgress(groups, uuid = newUuid, round = 1) {
  return {
    groups: groups.map((group) => [...group]),
    picks: groups.map(() => null),
    championId: null,
    answerId: uuid(),
    step: 0,
    ...roundMark(round),
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

/**
 * O corpo da resposta, ou null enquanto faltar escolha. `round` é o número que
 * o servidor deu à rodada no sorteio: vai junto sempre que ele disse um. Um
 * servidor de antes das rodadas não diz, e recebe o corpo de sempre.
 */
export function responseBody(progress, round = 0) {
  if (progress.picks.includes(null) || !progress.picks.includes(progress.championId)) return null;
  const body = { answerId: progress.answerId, pickIds: [...progress.picks], championId: progress.championId };
  return Number.isInteger(round) && round >= 1 ? { ...body, round } : body;
}

/**
 * Retoma o que estava salvo no aparelho quando o sorteio é o mesmo, da mesma
 * rodada. O que foi salvo é texto que qualquer um edita: cada campo é
 * conferido contra o sorteio. As escolhas de uma rodada não passam para outra,
 * nem o recibo.
 */
export function restoreProgress(saved, groups, uuid = newUuid, round = 1) {
  if (!saved || typeof saved !== "object" || !sameGroups(saved.groups, groups) || laterRound(saved.round) !== laterRound(round)) {
    return freshProgress(groups, uuid, round);
  }
  const screens = groups.length;
  const savedPicks = Array.isArray(saved.picks) ? saved.picks : [];
  const picks = groups.map((group, index) => (group.includes(savedPicks[index]) ? savedPicks[index] : null));
  const championId = picks.includes(saved.championId) && saved.championId !== null ? saved.championId : null;
  // O mais longe que o salvo pode levar: a primeira tela sem escolha; com as
  // quatro feitas, a final; com a escolhida válida, a confirmação.
  const open = firstOpenStep(picks);
  const furthest = open === screens && championId ? screens + 1 : open;
  const step = Number.isInteger(saved.step) ? Math.min(Math.max(0, saved.step), furthest) : open;
  return {
    groups: groups.map((group) => [...group]),
    picks,
    championId,
    answerId: typeof saved.answerId === "string" && UUID_PATTERN.test(saved.answerId) ? saved.answerId : uuid(),
    step,
    ...roundMark(round),
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

/**
 * O registro de uma pesquisa no armazenamento, ou null. Depois de registrada,
 * o aparelho guarda só que a pessoa respondeu (`answered`), nunca a escolha:
 * quem mostra a escolha é o servidor. Numa rodada nova em andamento o registro
 * tem as duas coisas: `answered`, das rodadas anteriores, e as escolhas da
 * rodada que ainda não foi confirmada.
 */
export function readSavedProgress(text, surveyId) {
  const record = parseSaved(text)[surveyId];
  if (!record || typeof record !== "object" || Array.isArray(record)) return null;
  return {
    identity: typeof record.identity === "string" ? record.identity : "",
    progress: record.progress && typeof record.progress === "object" ? record.progress : null,
    answered: record.answered === true,
  };
}

/** O texto a gravar, preservando o que estiver salvo de outras pesquisas. */
export function savedProgressText(text, surveyId, { identity = "", progress = null, answered = false }) {
  return JSON.stringify({ ...parseSaved(text), [surveyId]: { identity, progress, answered: answered === true } });
}

// Capa com várias pesquisas -------------------------------------------------

/** A pesquisa pedida no endereço (`?p=<código>`), ou "" quando não há uma válida. */
export function surveyIdFromSearch(search, surveys = PHOTO_SURVEYS) {
  const requested = new URLSearchParams(typeof search === "string" ? search : "").get("p") || "";
  return surveys.some((survey) => survey.id === requested) ? requested : "";
}

function savedRecords(text, tag, surveys) {
  if (!tag) return [];
  return surveys
    .map((survey) => ({ id: survey.id, record: readSavedProgress(text, survey.id) }))
    .filter(({ record }) => record && record.identity === tag);
}

/** As pesquisas que este aparelho sabe respondidas pela identidade `tag`, na ordem da capa. */
export function answeredSurveyIds(text, tag, surveys = PHOTO_SURVEYS) {
  return savedRecords(text, tag, surveys).filter(({ record }) => record.answered).map(({ id }) => id);
}

/**
 * Outra aba registrou a resposta da rodada que esta aba tem na tela (`round`):
 * o registro diz que a pessoa respondeu e não guarda mais escolha pela metade,
 * ou já guarda as escolhas de uma rodada mais nova. Durante uma rodada nova
 * `answered` já é verdadeiro, e as escolhas dessa mesma rodada continuam lá.
 */
export function answeredElsewhere(record, round = 1) {
  if (!record?.answered) return false;
  return !record.progress || laterRound(record.progress.round) > laterRound(round);
}

/**
 * A pesquisa que esta identidade deixou pela metade neste aparelho, ou "".
 * Só conta quem já escolheu ao menos uma carta: um sorteio emitido e não
 * tocado não tira a pessoa da capa. Numa pesquisa já respondida, só contam as
 * escolhas de uma rodada nova (da segunda em diante).
 */
export function inProgressSurveyId(text, tag, surveys = PHOTO_SURVEYS) {
  return inProgressSurveyIds(text, tag, surveys)[0] || "";
}

/** Todas as pesquisas que esta identidade deixou pela metade neste aparelho, na ordem da capa (ICM 76, #354). */
export function inProgressSurveyIds(text, tag, surveys = PHOTO_SURVEYS) {
  return savedRecords(text, tag, surveys).filter(({ record }) => Array.isArray(record.progress?.picks)
    && record.progress.picks.some(Boolean)
    && (!record.answered || laterRound(record.progress.round) >= 2)).map(({ id }) => id);
}

/** A primeira pesquisa aberta que a pessoa ainda não respondeu, ou "". */
export function featuredSurveyId(views, answeredIds) {
  const featured = views.find((view) => view.status === "open" && !answeredIds.includes(view.id));
  return featured ? featured.id : "";
}

/** Depois de responder `currentId`: a primeira pesquisa sem resposta, fora ela. */
export function nextSurveyId(currentId, answeredIds, surveys = PHOTO_SURVEYS) {
  const next = surveys.find((survey) => survey.id !== currentId && !answeredIds.includes(survey.id));
  return next ? next.id : "";
}

// Rodadas (ICM 75, #350) ----------------------------------------------------

const isCount = (value) => Number.isInteger(value) && value >= 0;

/** O estado de quem não tem notícia de rodadas: é o de um servidor de antes delas. */
export const NO_ROUNDS = Object.freeze({ round: 0, progress: null, lastAnswered: null, open: false });

/**
 * O que o servidor disse sobre as rodadas, no sorteio ou na resposta: o número
 * da rodada devolvida (`round`), o progresso da pessoa (`progress`), a última
 * rodada que ela respondeu (`lastAnswered`) e se a rodada devolvida ainda está
 * sem resposta (`open`). Cada campo é conferido; o que vier torto vale como
 * não dito. Um servidor de antes das rodadas não manda nenhum deles: aí o
 * resultado é NO_ROUNDS e as telas ficam como eram.
 */
export function roundState(result) {
  const round = Number.isInteger(result?.round) && result.round >= 1 ? result.round : 0;
  if (!round) return NO_ROUNDS;
  const raw = result.progress;
  const progress = raw && typeof raw === "object" && isCount(raw.answeredRounds) && isCount(raw.seenPairs)
    && Number.isInteger(raw.totalPairs) && raw.totalPairs > 0
    ? {
      answeredRounds: raw.answeredRounds,
      seenPairs: Math.min(raw.seenPairs, raw.totalPairs),
      totalPairs: raw.totalPairs,
      canContinue: raw.canContinue === true,
    }
    : null;
  const last = result.lastAnswered;
  const lastAnswered = last && typeof last === "object" && Number.isInteger(last.round) && last.round >= 1
    && last.response && typeof last.response === "object"
    ? { round: last.round, response: last.response }
    : null;
  return { round, progress, lastAnswered, open: !result.response };
}

/**
 * A rodada que a pessoa pode jogar agora nesta pesquisa, ou 0 quando não há
 * uma. Há quando a pesquisa está aberta (`status`) e o servidor disse que cabe
 * outra rodada, ou quando ele já emitiu uma rodada nova que ainda não tem
 * resposta. É o que decide se "Mais uma rodada" aparece, na resposta
 * registrada e na capa.
 */
export function nextRoundNumber(state, status) {
  const progress = state?.progress;
  if (status !== "open" || !progress) return 0;
  if (progress.canContinue && progress.seenPairs < progress.totalPairs) return progress.answeredRounds + 1;
  return state.open && state.lastAnswered ? state.round : 0;
}

const REGISTERED_HINT = "Obrigado por participar. Sua resposta está registrada e não pode ser trocada nesta pesquisa.";
const ROUND_REGISTERED_HINT = "A escolha desta rodada está registrada e não pode ser trocada.";

/**
 * Os textos da resposta registrada: o texto de apoio (`hint`), a linha dos
 * confrontos (`line`) e a rodada que "Mais uma rodada" abre (`next`, 0 sem o
 * botão). Com rodada por jogar, a linha conta quantos confrontos a pessoa já
 * viu, com os números do servidor; vistos todos, diz isso. Sem notícia de
 * rodadas, ou com a pesquisa fora da janela, o texto é o de antes das
 * rodadas, sem linha e sem botão.
 */
export function registeredCopy(state, status) {
  const progress = state?.progress;
  const next = nextRoundNumber(state, status);
  const allSeen = Boolean(progress) && progress.seenPairs >= progress.totalPairs;
  if (!progress || status !== "open" || (!next && !allSeen)) return { hint: REGISTERED_HINT, line: "", next: 0 };
  return {
    hint: ROUND_REGISTERED_HINT,
    line: allSeen ? "Você viu todos os confrontos desta pesquisa." : `Você já viu ${progress.seenPairs} de ${progress.totalPairs} confrontos.`,
    next: allSeen ? 0 : next,
  };
}

/**
 * O destaque da capa, nesta ordem: a pesquisa que ficou pela metade neste
 * aparelho (`resume`); a primeira aberta que a pessoa ainda não respondeu
 * (`start`); a primeira em que ainda há rodada por jogar (`more`, com o número
 * da rodada); nenhuma. `rounds` é o que o servidor disse de cada pesquisa, por
 * código (um Map de roundState): a capa só o tem para as pesquisas que este
 * aparelho sabe respondidas.
 */
export function coverFeature(views, { pendingId = "", answeredIds = [], rounds = new Map() } = {}) {
  if (pendingId && views.some((view) => view.id === pendingId && view.status === "open")) return { id: pendingId, mode: "resume", round: 0 };
  const unanswered = featuredSurveyId(views, answeredIds);
  if (unanswered) return { id: unanswered, mode: "start", round: 0 };
  for (const view of views) {
    const round = nextRoundNumber(rounds.get(view.id), view.status);
    if (round) return { id: view.id, mode: "more", round };
  }
  return { id: "", mode: "", round: 0 };
}

// Rodada contínua e resultado da pessoa (ICM 76, #354) -----------------------

/**
 * O que vem depois de confirmar uma rodada. `next`: a rodada seguinte abre
 * sozinha, porque a pesquisa está aberta e ainda há confronto por ver.
 * `result`: o servidor conhece rodadas e não há outra para abrir, então a
 * tela vai para o resultado. `done`: servidor de antes das rodadas; a tela é
 * a resposta registrada de sempre.
 */
export function afterConfirm(state, status) {
  if (!state?.round) return "done";
  return nextRoundNumber(state, status) ? "next" : "result";
}

/**
 * Ao abrir uma pesquisa já respondida, sem toque, a tela é o resultado mesmo
 * que o servidor tenha uma rodada emitida e ainda sem resposta: só quem já
 * escolheu carta nela neste aparelho volta direto para o voto. Assim abrir a
 * página nunca leva a pessoa a uma rodada que ela não começou.
 */
export function resultOnOpen(state, { auto = false, hasPicks = false } = {}) {
  return auto && Boolean(state?.lastAnswered) && state.open === true && !hasPicks;
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
const RANK_SIZE = 5;

/**
 * O resultado prévio na tela: a primeira colocada (`first`), as seguintes até
 * completar cinco (`rest`), e as linhas de rodadas e confrontos. `result` é o
 * que `GET …/result` devolveu; `state`, o roundState do último sorteio ou
 * resposta; `known` diz se a carta existe no catálogo do app. Carta que o app
 * não conhece não entra, e o que vier torto vale como resultado vazio.
 */
export function resultSummary(result, state, known = () => true) {
  const ranking = Array.isArray(result?.ranking) ? result.ranking : [];
  const ids = [];
  for (const entry of ranking) {
    const id = entry?.cardId;
    if (typeof id === "string" && known(id) && !ids.includes(id)) ids.push(id);
    if (ids.length === RANK_SIZE) break;
  }
  const answered = isCount(result?.answeredRounds) ? result.answeredRounds : (state?.progress?.answeredRounds ?? 0);
  const progress = state?.progress;
  const seen = progress
    ? progress.seenPairs >= progress.totalPairs
      ? "Você viu todos os confrontos desta pesquisa."
      : `Você viu ${progress.seenPairs} de ${progress.totalPairs} confrontos.`
    : "";
  return {
    first: ids[0] || "",
    rest: ids.slice(1),
    answeredRounds: answered,
    roundsLine: answered ? `${plural(answered, "rodada respondida", "rodadas respondidas")}.` : "",
    seenLine: seen,
  };
}
