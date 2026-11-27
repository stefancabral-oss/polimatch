// Feed da capa e perfil (ICM 76, #354, decisão 0008). Regras puras, usadas pela
// capa (photo-survey-page.js), por "Meu perfil" (my-profile-page.js) e pelo
// perfil público (public-profile-page.js).

import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { isValidHandle, normalizeHandle } from "../../shared/profile.js";

export const PROFILE_ORIGIN = "https://polimatch.com.br";

/** O endereço público do perfil, que a pessoa copia. */
export const profileLink = (handle) => `${PROFILE_ORIGIN}/perfil.html?u=${encodeURIComponent(normalizeHandle(handle))}`;

/** O nome de perfil pedido no endereço (`?u=`), já normalizado, ou "" se não vale. */
export function handleFromSearch(search) {
  const handle = normalizeHandle(new URLSearchParams(typeof search === "string" ? search : "").get("u") || "");
  return isValidHandle(handle) ? handle : "";
}

const knownSurvey = (id) => PHOTO_SURVEYS.some((survey) => survey.id === id);

/**
 * O perfil da conta como a tela usa. Cada campo é conferido; o que vier torto
 * vale como não dito. `firstPlaces` vira um Map de pesquisa para carta, só com
 * pesquisas que o app conhece e cartas que `known` reconhece.
 */
export function profileState(raw, known = () => true) {
  const surveys = Array.isArray(raw?.surveys) ? raw.surveys.filter((id) => typeof id === "string" && knownSurvey(id)) : [];
  const firstPlaces = new Map();
  for (const entry of Array.isArray(raw?.firstPlaces) ? raw.firstPlaces : []) {
    if (knownSurvey(entry?.surveyId) && typeof entry.cardId === "string" && known(entry.cardId) && !firstPlaces.has(entry.surveyId)) {
      firstPlaces.set(entry.surveyId, entry.cardId);
    }
  }
  return {
    enabled: raw?.enabled === true,
    handle: typeof raw?.handle === "string" ? normalizeHandle(raw.handle) : "",
    consentVersion: typeof raw?.consentVersion === "string" ? raw.consentVersion : "",
    surveys: [...new Set(surveys)],
    firstPlaces,
    canEnable: raw?.canEnable === true,
  };
}

/**
 * Os cartões do feed, na ordem de `views` (a de PHOTO_SURVEYS). Entram as
 * pesquisas abertas e as que a pessoa já respondeu, mesmo fechadas: o
 * resultado dela continua lá. `firstPlaces` (Map) vem do servidor;
 * `answeredIds` e `pendingIds` são o que este aparelho sabe. O rótulo é
 * "Continuar" para quem tem escolha pela metade neste aparelho numa pesquisa
 * aberta, "Ver meu resultado" para quem respondeu, e "Começar" para o resto.
 */
export function feedEntries(views, { firstPlaces = new Map(), answeredIds = [], pendingIds = [] } = {}) {
  return (Array.isArray(views) ? views : [])
    .map((view) => {
      const open = view.status === "open";
      const firstCardId = firstPlaces.get(view.id) || "";
      const answered = Boolean(firstCardId) || answeredIds.includes(view.id);
      const pending = open && pendingIds.includes(view.id);
      const label = pending ? "Continuar" : answered ? "Ver meu resultado" : open ? "Começar" : "";
      return { id: view.id, status: view.status, label, firstCardId };
    })
    .filter((entry) => entry.label);
}

/**
 * O endereço do cartão do feed. "Ver meu resultado" com a primeira colocada
 * dada pelo servidor leva ao resultado (`ver=resultado`), também noutro
 * aparelho, sem registro local. Sem ela (só este aparelho sabe que a pessoa
 * respondeu, como com um servidor de antes das rodadas) e nos outros
 * rótulos, a página da pesquisa, como sempre.
 */
export function feedHref(entry) {
  const base = `./?p=${encodeURIComponent(entry.id)}`;
  return entry.label === "Ver meu resultado" && entry.firstCardId ? `${base}&ver=resultado` : base;
}

/** A versão do perfil que vai para o servidor ao ligar ou ao salvar as marcações. */
export function enableBody({ handle, surveys, consent, consentVersion }) {
  const body = { enabled: true, handle: normalizeHandle(handle), surveys: [...surveys] };
  return consent ? { ...body, consentVersion } : body;
}

const HANDLE_TEXT = "Escolha um nome de perfil com 3 a 20 letras sem acento, números ou _. Alguns nomes são reservados.";
const CONSENT_TEXT = "Para ligar o perfil, marque o aceite.";
const HANDLE_LOCKED_TEXT = "Este perfil já tem um nome, e o nome de perfil não muda depois de escolhido. Confira o nome no campo e tente de novo.";

/** A frase do campo travado, com um nome já gravado. */
export const HANDLE_LOCKED_NOTE = "O nome de perfil não muda depois de escolhido.";
/** O aviso embaixo do campo, antes de ligar pela primeira vez. */
export const HANDLE_CHOOSE_NOTE = "Escolha com cuidado: o nome não muda depois.";

/** O aviso embaixo das marcações de um perfil ligado sem cadastro: ele só pode desligar. */
export const MARKS_NEED_REGISTRATION_NOTE = "Para mudar as marcações, falta o cadastro com CPF.";

/**
 * Depois da recusa `handle-locked`, a tela busca o perfil de novo. Se ele já
 * está ligado (outra aba ligou), vale o que o servidor tem: o nome e as
 * marcações dele, com um aviso que não fala de campo, porque não há campo.
 * Se continua desligado, a tela mantém o que a pessoa preencheu e mostra o
 * nome gravado no campo travado. `keepForm` diz se o preenchido fica.
 */
export function handleLockedOutcome(profile) {
  if (profile?.enabled && profile.handle) {
    return { keepForm: false, text: `Este perfil foi ligado em outra aba com o nome @${profile.handle}. Confira as marcações abaixo.` };
  }
  return { keepForm: true, text: HANDLE_LOCKED_TEXT };
}

/** O que falta antes de mandar o pedido de ligar, ou null. */
export function enableProblem({ handle, consent }) {
  if (!isValidHandle(handle)) return { field: "handle", text: HANDLE_TEXT };
  if (!consent) return { field: "consent", text: CONSENT_TEXT };
  return null;
}

/**
 * O texto de uma recusa do servidor e o que fazer em seguida: `field` é o
 * campo que recebe o foco; `next` é "register" quando falta o cadastro com
 * CPF, "signin" quando a sessão não vale mais, e "reload" quando a tela
 * precisa buscar o perfil de novo (o nome gravado não muda).
 */
export function profileRefusal(error) {
  const reason = error?.body?.current?.reason || error?.body?.reason || "";
  if (error?.status === 409 && error.code === "PROFILE_HANDLE_TAKEN") return { field: "handle", text: "Esse nome de perfil já está em uso. Escolha outro.", next: "" };
  if (error?.code === "PROFILE_CONSENT_REQUIRED") return { field: "consent", text: CONSENT_TEXT, next: "" };
  if (error?.code === "PROFILE_INVALID" && reason === "handle") return { field: "handle", text: HANDLE_TEXT, next: "" };
  // O nome já gravado não muda (outra aba pode ter ligado com outro nome):
  // a tela busca o perfil de novo e mostra o nome gravado.
  if (error?.code === "PROFILE_INVALID" && reason === "handle-locked") return { field: "", text: HANDLE_LOCKED_TEXT, next: "reload" };
  if (error?.code === "PROFILE_INVALID") return { field: "", text: "Não deu para salvar o perfil assim. Atualize a página e tente de novo.", next: "" };
  if (error?.status === 403 && error.code === "CPF_REGISTRATION_REQUIRED") return { field: "", text: "Para ligar o perfil, falta o cadastro com CPF.", next: "register" };
  if (error?.status === 401) return { field: "", text: "Sua sessão venceu. Abra o menu, saia da conta e entre de novo.", next: "signin" };
  if (error?.status === 429) return { field: "", text: "Muitas tentativas agora. Espere um pouco e tente de novo.", next: "" };
  if (error?.status === 0) return { field: "", text: "Não conseguimos falar com o servidor. Confira a conexão e tente de novo.", next: "" };
  return { field: "", text: "Não conseguimos salvar agora. Tente de novo em instantes.", next: "" };
}

/**
 * As cartas do perfil público, na ordem do servidor: uma por pesquisa, só
 * com cartas que o app conhece. O assunto e a pergunta são texto do servidor
 * e saem daqui como texto; quem põe na tela escapa.
 */
export function publicProfileCards(raw, known = () => true) {
  const seen = new Set();
  const cards = [];
  for (const entry of Array.isArray(raw?.surveys) ? raw.surveys : []) {
    if (typeof entry?.surveyId !== "string" || seen.has(entry.surveyId)) continue;
    if (typeof entry.cardId !== "string" || !known(entry.cardId)) continue;
    seen.add(entry.surveyId);
    cards.push({
      surveyId: entry.surveyId,
      cardId: entry.cardId,
      subject: typeof entry.subject === "string" ? entry.subject : "",
      question: typeof entry.question === "string" ? entry.question : "",
    });
  }
  return cards;
}
