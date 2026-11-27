import "./install-error-reporter.js";
import "./photo-survey.css";
import "./site-menu.css";
import CELEBRITIES from "./celebrity-cards.json" with { type: "json" };
import CLOTHES from "./clothes-cards.json" with { type: "json" };
import ARTS from "./political-chromas.json" with { type: "json" };
import { PHOTO_SURVEYS, photoSurveyById } from "../../shared/photo-survey.js";
import { formatCpf } from "../../shared/registration.js";
import { signInWithGoogleCredential } from "./account-session.js";
import { drawPhotoSurvey, loadMyProfile, loadPhotoSurvey, loadPhotoSurveyResult, registerCpf, respondPhotoSurvey } from "./api.js";
import { googleClientId, mountGoogleButton } from "./google-login.js";
import { safeStorage } from "./safe-storage.js";
import {
  NO_ROUNDS,
  PHOTO_SURVEY_STORAGE_KEY,
  afterConfirm,
  answeredElsewhere,
  answeredSurveyIds,
  chooseChampion,
  coverFeature,
  entryCardIdsFor,
  finalTitleFor,
  goBack,
  identityTag,
  inProgressSurveyIds,
  nextRoundNumber,
  nextSurveyId,
  pickCard,
  progressView,
  readSavedProgress,
  registeredCopy,
  responseBody,
  restoreProgress,
  resultOnOpen,
  resultSummary,
  roundState,
  sameGroups,
  sampleCards,
  savedProgressText,
  surveyIdFromSearch,
} from "./photo-survey-flow.js";
import {
  EMPTY_REGISTRATION_FORM,
  caretAfterDigits,
  registrationBody,
  registrationFormMarkup,
  registrationProblem,
  registrationRefusal,
  signInMarkup,
} from "./registration-view.js";
import { feedEntries, profileState } from "./profile-view.js";
import { CHOICE_LABELS, RESULT_LABELS, shareChoice, shareImage, sharePlan, sharePreviewMarkup } from "./share-choice.js";
import { accountKind, menuButtonMarkup, mountSiteMenu, upcomingSectionMarkup } from "./site-menu.js";

// Pesquisa por foto (ICM 68, #324), que desde a ICM 69 (#331) é a capa do
// site. Abrir esta página não grava nada: o sorteio nasce no toque em
// "Começar", e a resposta só vai para o servidor na confirmação. Até lá as
// escolhas ficam neste aparelho. Depois de registrada, o aparelho guarda só
// que a pessoa respondeu: a escolha vem sempre do servidor.
//
// Desde a ICM 71 (#336) só responde quem entrou com Google e tem cadastro com
// CPF. Esta página não cria mais jogador sem conta: sem a conta, "Começar"
// leva à entrada; com a conta e sem cadastro, ao formulário. Quem decide se
// falta o cadastro é o servidor, no pedido de sorteio.
//
// Desde a ICM 70 (#334) há mais de uma pesquisa. `/` é a capa: a entrada da
// pesquisa em destaque e, abaixo, as outras. `/?p=<código>` abre uma pesquisa.
// Ir de uma à outra é navegação comum, com recarga: tudo aqui vale para uma
// pesquisa por vez, a de `surveyId`.
//
// Desde a ICM 75 (#350) a pesquisa tem rodadas: depois de responder, a pessoa
// pode jogar outra, com outros grupos, enquanto houver confronto entre cartas
// que ela ainda não viu. Quem monta cada rodada e diz se cabe outra é o
// servidor. Um servidor de antes das rodadas não diz nada disso, e as telas
// ficam como eram.
//
// Desde a ICM 76 (#354, decisão 0008) as rodadas seguem sem perguntar: ao
// confirmar, a tela diz "Rodada registrada" e a seguinte abre sozinha
// (sorteio com `next: true`), enquanto houver confronto por ver e a pesquisa
// estiver aberta; senão, a tela vai para o resultado da pessoa. Abrir a página
// de uma pesquisa já respondida, sem toque, mostra o resultado com "Continuar
// votando": abrir a página nunca emite rodada. Quem entrou com Google vê na
// capa o feed das pesquisas, que só lê (as pesquisas e o perfil da conta).

const IDENTITY_KEY = "polimatch:v3:recovery-key";
const GRID_SIZES = "(max-width: 440px) 45vw, 198px";
const ADVANCE_MS = 220;
// Quanto tempo, no mínimo, o aviso "Rodada registrada" fica na tela.
const REGISTERED_MS = 900;
const GRID_TIMEOUT_MS = 12000;

const root = document.querySelector("#photo-survey");
// As cartas de todas as pesquisas: as de política, as de famosos (ICM 74, #348)
// e as de roupas (ICM 73, #345). Dos três catálogos a página só lê o que os
// três têm: `id`, `name`, `src`, `srcset`, `width` e `height`.
const artById = new Map([...ARTS, ...CELEBRITIES, ...CLOTHES].map((art) => [art.id, art]));

// A pesquisa na tela. Na capa é a pesquisa em destaque; "" quando não há uma.
let surveyId = "";
let definition = PHOTO_SURVEYS[0];
// A capa: o endereço sem `?p=`. Abaixo da entrada vêm as listas de pesquisas.
let atHome = false;
// O que a capa leu: as visões públicas das pesquisas.
let homeViews = [];
// A identidade com que a capa foi montada.
let homeKey = "";
// O destaque da capa de quem não entrou: "start", a primeira aberta; "" sem
// nenhuma. Desde a ICM 76 (#354) quem entrou vê o feed, e os destaques de
// quem tinha resposta ("resume", "more") saíram da capa.
let homeMode = "";
// O leque da entrada é sorteado uma vez por pesquisa e por visita.
const fans = new Map();

function useSurvey(id) {
  surveyId = id;
  definition = photoSurveyById(id) || PHOTO_SURVEYS[0];
}

function entryCards() {
  if (!fans.has(surveyId)) fans.set(surveyId, sampleCards(entryCardIdsFor(definition).filter((id) => artById.has(id)), 3));
  return fans.get(surveyId);
}

let survey = null;
let identity = "";
let progress = null;
let response = null;
// O que o servidor disse das rodadas no último sorteio ou na última resposta:
// o número da rodada na tela, o progresso da pessoa e a última rodada que ela
// respondeu. NO_ROUNDS quando ele não disse nada.
let rounds = NO_ROUNDS;
// O resultado da pessoa na tela (ICM 76, #354): o que `GET …/result` devolveu,
// ou null enquanto não chega; `resultFailed` quando a leitura falhou.
let resultData = null;
let resultFailed = false;
let view = "loading";
let notice = "";
let busy = false;
// A confirmação foi enviada e não se sabe se chegou: até saber, não dá para trocar.
let uncertain = false;
// A entrada está mostrando o aviso de conta trocada, à espera do toque.
let switched = false;
let epoch = 0;
let gridToken = 0;
let advanceTimer = 0;
// Cresce a cada "Tentar de novo" das cartas: muda o endereço das imagens.
let imageRetry = 0;

const escapeText = (value = "") => String(value).replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
);
const cardName = (id) => artById.get(id)?.name || "";
// O que vem do servidor só vale como número pequeno; senão, vale a definição do app.
const count = (value, fallback) => (Number.isInteger(value) && value > 0 && value <= 64 ? value : fallback);
const drawSize = () => count(survey?.drawSize, definition.drawSize);
const groupSize = () => count(survey?.groupSize, definition.groupSize);
const screens = () => Math.max(1, Math.round(drawSize() / groupSize()));
const WORDS = { 2: "duas", 3: "três", 4: "quatro", 5: "cinco", 6: "seis" };
const inWords = (number) => WORDS[number] || String(number);
const subject = () => (typeof survey?.subject === "string" && survey.subject) || definition.subject;
const kicker = () => `${subject()} · ${drawSize()} cartas`;
// Da segunda rodada em diante, o número da rodada toma o lugar da contagem de cartas.
const roundKicker = (round) => `${subject()} · Rodada ${round}`;
const question = () => (typeof survey?.question === "string" && survey.question) || definition.question;
// A observação da pesquisa, quando ela tem uma. As de política não têm; as de
// famosos e de roupas têm.
const surveyNote = () => (typeof survey?.note === "string" && survey.note) || definition.note;
// As cartas desta pesquisa levam foto com crédito? Então a entrada aponta para a página de créditos.
const hasPhotoCredits = () => definition.cardIds.some((id) => Boolean(artById.get(id)?.photo));

/**
 * Lê direto do navegador. O safeStorage devolve primeiro o que esta aba
 * gravou, e aqui interessa o que vale agora, inclusive o que outra aba mudou.
 */
function readStored(key) {
  try {
    const value = window.localStorage.getItem(key);
    if (value) return value;
    return safeStorage.persistent ? "" : safeStorage.get(key) || "";
  } catch {
    return safeStorage.get(key) || "";
  }
}

const savedRecord = () => readSavedProgress(readStored(PHOTO_SURVEY_STORAGE_KEY), surveyId);

/** Há uma conta Google neste aparelho. Se ela tem cadastro, só o servidor sabe. */
const signedIn = () => accountKind(readStored(IDENTITY_KEY)) === "google";

/** Esquece a sessão que o servidor não reconhece mais, se ela ainda é a que está guardada. */
function forgetDeadSession(key) {
  if (key && readStored(IDENTITY_KEY) === key) safeStorage.remove(IDENTITY_KEY);
}

// Numa rodada nova em andamento o aparelho guarda as duas coisas: que a pessoa
// já respondeu esta pesquisa (as rodadas anteriores) e as escolhas da rodada
// que ainda não foi confirmada.
function persist() {
  const text = savedProgressText(readStored(PHOTO_SURVEY_STORAGE_KEY), surveyId, {
    identity: identityTag(identity),
    progress,
    answered: Boolean(response) || Boolean(rounds.lastAnswered),
  });
  safeStorage.set(PHOTO_SURVEY_STORAGE_KEY, text);
}

function forgetSaved() {
  safeStorage.set(PHOTO_SURVEY_STORAGE_KEY, savedProgressText(readStored(PHOTO_SURVEY_STORAGE_KEY), surveyId, {}));
}

/** Há ao menos uma escolha desta identidade guardada neste aparelho. */
function hasSavedPicks() {
  const saved = savedRecord();
  return Boolean(saved && saved.identity === identityTag(identity) && Array.isArray(saved.progress?.picks) && saved.progress.picks.some(Boolean));
}

/** Há escolha desta identidade guardada para este mesmo sorteio. */
function hasSavedPicksFor(groups) {
  const saved = savedRecord();
  return hasSavedPicks() && sameGroups(saved.progress.groups, groups);
}

/** Quem já começou nesta identidade tem sorteio emitido: retomar não grava nada novo. */
function resumable() {
  const key = readStored(IDENTITY_KEY);
  const saved = savedRecord();
  return Boolean(key && saved && saved.identity === identityTag(key) && (saved.progress || saved.answered));
}

// Marcação ------------------------------------------------------------------

/**
 * Endereços da arte de uma carta. Depois de uma falha, a nova tentativa pede
 * outro endereço: uma imagem com o mesmo endereço entraria na fila do pedido
 * que ficou pendurado e nunca chegaria.
 */
function artSources(id) {
  const art = artById.get(id);
  if (!imageRetry) return { src: art.src, srcset: art.srcset };
  const again = (url) => `${url}${url.includes("?") ? "&" : "?"}r=${imageRetry}`;
  const srcset = art.srcset.split(",").map((candidate) => {
    const [url, ...descriptor] = candidate.trim().split(/\s+/);
    return [again(url), ...descriptor].join(" ");
  }).join(", ");
  return { src: again(art.src), srcset };
}

function cardImage(id, sizes) {
  const art = artById.get(id);
  const { src, srcset } = artSources(id);
  return `<img src="${escapeText(src)}" srcset="${escapeText(srcset)}" sizes="${sizes}" width="${art.width}" height="${art.height}" alt="" decoding="async" draggable="false">`;
}

const staticCard = (id, sizes, label = "") => `<span class="ps-card"${label ? ` role="img" aria-label="${escapeText(label)}"` : ' aria-hidden="true"'}>${cardImage(id, sizes)}</span>`;

const choiceCard = (id, selectedId) => `<button class="ps-card" type="button" data-card="${escapeText(id)}" aria-pressed="${id === selectedId}" aria-label="Escolher ${escapeText(cardName(id))}" disabled>${cardImage(id, GRID_SIZES)}</button>`;

const choiceGrid = (cards, selectedId) => `<div class="ps-grid${selectedId ? " has-choice" : ""}" data-ready="false">${cards.map((id) => choiceCard(id, selectedId)).join("")}</div>`;

// `notice` é HTML montado aqui: só recebe textos fixos e trechos já escapados.
const noticeMarkup = () => `<p class="ps-notice" id="ps-notice" role="alert"${notice ? "" : " hidden"}>${notice}</p>`;

const offlineMarkup = () => `<p class="ps-notice" id="ps-offline" role="status"${navigator.onLine === false ? "" : " hidden"}>Você está sem conexão. Suas escolhas continuam neste aparelho.</p>`;

const footHint = (text) => (safeStorage.persistent ? text : "Este navegador não salva o progresso: mantenha esta aba aberta até confirmar.");

// `fit`: a tela tem a altura exata da janela e a carta escolhida ocupa o que sobra.
function shell({ step, filled = null, mainClass = "", body, focus = false, fit = false }) {
  gridToken += 1;
  // Uma tela nova fecha a prévia da imagem, que é da tela anterior.
  closeSharePreview();
  const segments = screens() + 1;
  const bar = filled === null
    ? ""
    : `<div class="ps-bar" aria-hidden="true">${Array.from({ length: segments }, (_, index) => `<i${index < filled ? ' class="is-on"' : ""}></i>`).join("")}</div>`;
  // Fora do voto, o canto traz o menu e o rótulo de etapa fica só para o
  // leitor de tela. No voto, na final e na confirmação não há menu.
  const withMenu = view !== "play";
  root.innerHTML = `<div class="ps-shell${fit ? " ps-shell--fit" : ""}" data-view="${view}">
    <header class="ps-top"><a class="ps-brand" href="./" aria-label="PoliMatch, início">Poli<b>Match</b></a><span class="ps-step${withMenu ? " ps-step--quiet" : ""}" id="ps-step">${escapeText(step)}</span>${withMenu ? menuButtonMarkup() : ""}</header>
    ${bar}
    <main class="ps-main ${mainClass}" aria-labelledby="ps-title">${body}</main>
  </div>`;
  armGrid();
  if (focus) {
    window.scrollTo(0, 0);
    root.querySelector("#ps-title")?.focus({ preventScroll: true });
  }
}

// Os avisos ficam logo abaixo do título: aparecem sem rolar, em qualquer tela.
// O título leva a etapa como descrição, para o leitor de tela dizer "Tela 2 de 4".
// `note` é a observação da pesquisa, só na entrada: um texto discreto sob o texto de apoio.
// `credits` põe, ao lado da nota, o caminho para a página de créditos das fotos (ICM 74, #348).
const heading = (eyebrow, title, hint, note = "", credits = false) => `<p class="ps-kicker">${escapeText(eyebrow)}</p><h1 class="ps-title" id="ps-title" tabindex="-1" aria-describedby="ps-step">${escapeText(title)}</h1><p class="ps-hint">${escapeText(hint)}</p>${note || credits ? `<p class="ps-note">${escapeText(note)}${credits ? `${note ? " " : ""}<a href="./creditos.html">Ver os créditos</a>` : ""}</p>` : ""}${noticeMarkup()}${offlineMarkup()}`;

// O cabeçalho da resposta registrada: a frase dos confrontos segue o texto de
// apoio, no mesmo parágrafo, para não custar uma linha a mais em tela pequena.
const registeredHeading = (eyebrow, title, copy) => `<p class="ps-kicker">${escapeText(eyebrow)}</p><h1 class="ps-title" id="ps-title" tabindex="-1" aria-describedby="ps-step">${escapeText(title)}</h1><p class="ps-hint">${escapeText(copy.hint)}${copy.line ? ` <span id="ps-seen">${escapeText(copy.line)}</span>` : ""}</p>${noticeMarkup()}${offlineMarkup()}`;

const MENU_LINK = '<button class="ps-link" data-action="menu" type="button">Abrir o menu</button>';
const ALL_SURVEYS_LINK = '<a class="ps-btn ps-btn--ghost" href="./">Ver pesquisas</a>';

/**
 * Depois de responder. Havendo outra pesquisa que esta identidade ainda não
 * respondeu neste aparelho, o botão convida para a próxima. Os dois levam à
 * capa: é ela que sabe quais estão abertas e qual fica em destaque.
 */
function nextLink() {
  const answered = answeredSurveyIds(readStored(PHOTO_SURVEY_STORAGE_KEY), identityTag(readStored(IDENTITY_KEY)));
  return nextSurveyId(surveyId, answered) ? '<a class="ps-btn ps-btn--ghost" href="./">Próxima pesquisa</a>' : ALL_SURVEYS_LINK;
}
const retryButton = (action, label = "Tentar de novo") => `<button class="ps-link" data-action="${action}" type="button">${label}</button>`;

// Telas ---------------------------------------------------------------------

const STATUS_TAG = { open: ["Aberta", " pm-tag--open"], scheduled: ["Em breve", ""], closed: ["Fechada", ""] };
const surveyHref = (id) => `./?p=${encodeURIComponent(id)}`;

// O que vem do servidor (pergunta, assunto) entra sempre escapado.
function surveyRow(view) {
  const base = photoSurveyById(view.id);
  const [tag, modifier] = Object.hasOwn(STATUS_TAG, view.status) ? STATUS_TAG[view.status] : STATUS_TAG.closed;
  const title = (typeof view.question === "string" && view.question) || base.question;
  const topic = (typeof view.subject === "string" && view.subject) || base.subject;
  return `<a class="ps-survey" href="${surveyHref(view.id)}"><span class="ps-survey-text"><b>${escapeText(title)}</b><small>${escapeText(topic)} · ${count(view.drawSize, base.drawSize)} cartas</small></span><em class="pm-tag${modifier}">${tag}</em></a>`;
}

/**
 * As listas da capa de quem não entrou: as outras pesquisas e, quando há
 * anúncio, as que vêm. Cada bloco só sai se tem o que mostrar; sem nenhum, o
 * texto é vazio e a área das listas some (`.ps-home:empty`).
 */
function homeSections() {
  const others = homeViews.filter((view) => view.id !== surveyId);
  return [
    others.length ? `<p class="ps-label ps-home-label">Mais pesquisas</p>${others.map(surveyRow).join("")}` : "",
    upcomingSectionMarkup(),
  ].join("");
}

// O botão e o texto de apoio da entrada, conforme o destaque da capa. Fora da
// capa, e na capa com uma pesquisa por responder, vale o convite de sempre.
const ENTRY_COPY = Object.freeze({
  resume: Object.freeze({ label: "Continuar", hint: "Você parou no meio. Continue de onde parou.", action: "start" }),
  start: Object.freeze({ label: "Começar", hint: "Leva menos de um minuto.", action: "start" }),
});

/**
 * A entrada de uma pesquisa. Na capa ela é a da pesquisa em destaque e leva
 * as listas embaixo; sem destaque (tudo respondido, ou nada aberto), só o
 * título e as listas.
 */
function renderEntry({ pending = "", action = "", label = "", focus = false } = {}) {
  const mode = atHome && Object.hasOwn(ENTRY_COPY, homeMode) ? homeMode : "start";
  const copy = ENTRY_COPY[mode];
  const featured = surveyId
    ? `${heading(kicker(), question(), copy.hint, surveyNote(), hasPhotoCredits())}
      <div class="ps-fan" aria-hidden="true">${entryCards().map((id) => staticCard(id, "176px")).join("")}</div>
      <div class="ps-cta"><button class="ps-btn" id="ps-action" data-action="${action || copy.action}" type="button"${pending ? " disabled" : ""}>${escapeText(pending || label || copy.label)}</button>
        <p class="ps-muted ps-cta-note">${signedIn() ? "Sua escolha só é registrada quando você confirmar." : "Para responder, entre com Google e cadastre o CPF."}</p></div>`
    : heading("Pesquisas", homeViews.some((view) => view.status === "open") ? "Você respondeu todas as pesquisas abertas." : "Nenhuma pesquisa aberta agora.", "Quando abrir outra, ela aparece aqui.");
  shell({
    step: "Pesquisa",
    mainClass: `ps-main--entry${atHome ? " ps-main--home" : ""}`,
    focus,
    body: `${featured}${atHome ? `<div class="ps-home">${homeSections()}</div>` : '<p class="ps-more"><a class="ps-link" href="./">Todas as pesquisas</a></p>'}`,
  });
}

/** Quem retoma, ou pede outra rodada, não vê a entrada de novo: vê a tela de voto se formando. */
function renderOpening(hint = "Abrindo de onde você parou…") {
  shell({
    step: "Pesquisa",
    filled: 0,
    mainClass: "ps-main--play",
    body: `${heading(kicker(), question(), hint)}
      <div class="ps-grid" data-ready="false" aria-hidden="true">${Array.from({ length: groupSize() }, () => '<span class="ps-card"></span>').join("")}</div>`,
  });
}

// "Ver meu resultado" (ICM 76, #354): à mão durante o voto, na confirmação e
// depois de cada rodada, assim que a pessoa tem ao menos uma rodada respondida.
const RESULT_LINK = '<button class="ps-link ps-result-link" data-action="result" type="button">Ver meu resultado</button>';
const hasResult = () => Boolean(rounds.lastAnswered) || (rounds.progress?.answeredRounds ?? 0) > 0;

function renderPlay({ focus = false, sending = false } = {}) {
  const current = progressView(progress);
  const total = screens();
  // Da segunda rodada em diante a etapa e o rótulo de cima dizem a rodada. A
  // primeira fica como sempre foi.
  const later = rounds.round >= 2;
  const stepLabel = (text) => (later ? `Rodada ${rounds.round} · ${text}` : text);
  if (current.kind === "vote") {
    shell({
      step: stepLabel(`Tela ${current.screen + 1} de ${current.screens}`),
      filled: current.screen + 1,
      mainClass: "ps-main--play",
      focus,
      body: `${heading(later ? roundKicker(rounds.round) : kicker(), question(), "Toque em uma carta.")}
        ${choiceGrid(current.cards, current.selectedId)}
        <div class="ps-foot">${current.screen > 0 ? '<button class="ps-link" data-action="back" type="button">← Voltar</button>' : ""}${hasResult() ? RESULT_LINK : `<span class="ps-muted">${footHint("Dá para voltar e trocar antes de terminar.")}</span>`}</div>`,
    });
    preload(progress.groups[current.screen + 1]);
    return;
  }
  if (current.kind === "final") {
    shell({
      step: stepLabel("Final"),
      filled: total + 1,
      mainClass: "ps-main--play",
      focus,
      body: `${heading(`As suas ${inWords(total)} escolhas`, finalTitleFor(definition), "Um toque decide.")}
        ${choiceGrid(current.cards, current.selectedId)}
        <div class="ps-foot"><button class="ps-link" data-action="back" type="button">← Voltar</button>${hasResult() ? RESULT_LINK : `<span class="ps-muted">${footHint("Você confirma na próxima tela.")}</span>`}</div>`,
    });
    return;
  }
  const locked = sending || uncertain;
  // Com rodadas, confirmar fecha a rodada, não a pesquisa: dá para jogar outra,
  // e o texto não pode dizer que não dá.
  const warning = rounds.round
    ? "Confira antes de registrar. Depois não dá para trocar a escolha desta rodada."
    : "Confira antes de registrar. Depois não dá para votar de novo nesta pesquisa.";
  shell({
    step: stepLabel("Confirmar"),
    filled: total + 1,
    mainClass: "ps-main--summary",
    fit: true,
    focus,
    body: `${heading("Sua escolha", cardName(current.championId), warning)}
      <div class="ps-hero">${staticCard(current.championId, "176px")}</div>
      <p class="ps-label">Também na final</p>
      <div class="ps-row">${current.otherIds.map((id) => staticCard(id, "84px", cardName(id))).join("")}</div>
      <div class="ps-stack ps-stack--pair">
        <button class="ps-btn" data-action="confirm" type="button"${sending ? " disabled" : ""}>${sending ? "Registrando…" : notice ? "Tentar de novo" : "Confirmar minha escolha"}</button>
        <button class="ps-btn ps-btn--ghost" data-action="back" type="button"${locked ? " disabled" : ""}>Voltar e trocar</button>${hasResult() && !locked ? RESULT_LINK : ""}
      </div>`,
  });
}

/**
 * A resposta registrada, como era antes das rodadas contínuas: a escolha, as
 * finalistas, o compartilhar e o caminho para as outras pesquisas. Desde a
 * ICM 76 (#354) ela só aparece com um servidor de antes das rodadas, quando a
 * pessoa sai da conta com a resposta na tela, ou quando o servidor recusa uma
 * resposta repetida e devolve a que valeu. "Mais uma rodada" saiu daqui: quem
 * continua votando faz isso pelo resultado.
 */
function renderDone({ focus = false } = {}) {
  view = "done";
  const picks = Array.isArray(response?.pickIds) ? response.pickIds.filter((id) => artById.has(id)) : [];
  const champion = artById.has(response?.championId) ? response.championId : "";
  const others = picks.filter((id) => id !== champion);
  const copy = registeredCopy(NO_ROUNDS, survey?.status);
  const shareButton = (ghost) => (champion
    ? `<button class="ps-btn${ghost ? " ps-btn--ghost" : ""}" data-action="share" type="button" aria-label="Compartilhar minha escolha" aria-busy="true" disabled>Compartilhar</button>`
    : "");
  const actions = `<div class="ps-stack ps-stack--pair">${shareButton(false)}${nextLink()}</div>`;
  shell({
    step: "Registrada",
    filled: screens() + 1,
    mainClass: "ps-main--summary",
    fit: true,
    focus,
    body: `${registeredHeading(response && rounds.round >= 2 ? `Escolha registrada · Rodada ${rounds.round}` : "Escolha registrada", champion ? cardName(champion) : "Sua resposta está registrada.", copy)}
      ${champion ? `<div class="ps-hero">${staticCard(champion, "176px")}</div>` : ""}
      ${others.length ? `<p class="ps-label">Também na final</p><div class="ps-row">${others.map((id) => staticCard(id, "84px", cardName(id))).join("")}</div>` : ""}
      ${actions}`,
  });
  prepareShare(champion, others);
}

/**
 * O aviso curto depois de confirmar uma rodada (ICM 76, #354): a rodada ficou
 * registrada e a seguinte está abrindo, sem toque. "Ver meu resultado" fica à
 * mão enquanto isso.
 */
function renderRegistered() {
  view = "registered";
  shell({
    step: "Registrada",
    filled: screens() + 1,
    mainClass: "ps-main--play ps-main--registered",
    focus: true,
    body: `${heading(roundKicker(rounds.round), "Rodada registrada", "Abrindo a próxima rodada…")}
      <div class="ps-grid" data-ready="false" aria-hidden="true">${Array.from({ length: groupSize() }, () => '<span class="ps-card"></span>').join("")}</div>
      <div class="ps-foot">${RESULT_LINK}</div>`,
  });
}

/** Dá para seguir votando: a pesquisa está aberta e há rodada pela metade, emitida ou por emitir. */
const canKeepVoting = () => survey?.status === "open" && (Boolean(progress) || Boolean(nextRoundNumber(rounds, survey.status)));

/**
 * O resultado prévio da pessoa nesta pesquisa (ICM 76, #354): a primeira
 * colocada grande, as seguintes em lista (até cinco ao todo), quantas rodadas
 * e quantos confrontos ela viu, "Continuar votando" quando cabe e
 * "Compartilhar", com a imagem de sempre: a primeira colocada e as seguintes.
 */
function renderResult({ focus = false } = {}) {
  view = "result";
  const summary = resultSummary(resultData, rounds, (id) => artById.has(id));
  const loading = !resultData && !resultFailed;
  const first = summary.first;
  const more = canKeepVoting();
  const title = loading ? "Seu resultado" : first ? cardName(first) : "Ainda sem resultado";
  const lines = [summary.roundsLine, summary.seenLine].filter(Boolean).join(" ");
  const hint = loading
    ? "Carregando…"
    : first
      ? `Sua primeira colocada até agora.${lines ? ` ${lines}` : ""}`
      : resultFailed ? "Não deu para carregar o seu resultado." : "Responda uma rodada para ver a sua primeira colocada.";
  const shareButton = first
    ? `<button class="ps-btn${more ? " ps-btn--ghost" : ""}" data-action="share" type="button" aria-label="Compartilhar meu resultado" aria-busy="true" disabled>Compartilhar</button>`
    : "";
  const actions = more
    ? `<div class="ps-stack ps-stack--pair"><button class="ps-btn" data-action="continue" type="button">Continuar votando</button>${shareButton}</div>`
    : `<div class="ps-stack ps-stack--pair">${shareButton}${nextLink()}</div>`;
  shell({
    step: "Resultado",
    mainClass: "ps-main--summary ps-main--result",
    focus,
    body: `${heading(`${subject()} · Seu resultado`, title, hint)}
      ${first ? `<div class="ps-hero">${staticCard(first, "176px")}</div>` : ""}
      ${summary.rest.length ? `<p class="ps-label">Depois dela</p><ol class="ps-rank">${summary.rest.map((id, index) => `<li>${staticCard(id, "44px")}<span class="ps-survey-text"><small>${index + 2}º lugar</small><b>${escapeText(cardName(id))}</b></span></li>`).join("")}</ol>` : ""}
      ${more ? '<p class="ps-more"><a class="ps-link" href="./">Outras pesquisas</a></p>' : ""}
      ${actions}`,
  });
  prepareShare(first, summary.rest.slice(0, 3));
}

/**
 * Abre o resultado e lê o ranking da pessoa no servidor. Só lê: nada aqui
 * grava. O aviso que estiver na tela continua (quem chama decide).
 */
async function openResult({ focus = true } = {}) {
  window.clearTimeout(advanceTimer);
  const run = ++epoch;
  busy = false;
  resultData = null;
  resultFailed = false;
  renderResult({ focus });
  const key = identity || readStored(IDENTITY_KEY);
  try {
    const data = await loadPhotoSurveyResult(surveyId, key);
    if (run !== epoch || view !== "result") return;
    resultData = data && typeof data === "object" ? data : { answeredRounds: 0, ranking: [] };
  } catch (error) {
    if (run !== epoch || view !== "result") return;
    resultFailed = true;
    notice = `${error.status === 429 ? "Muitas tentativas agora. Espere um pouco e tente de novo." : "Não conseguimos carregar o seu resultado agora."} ${retryButton("result")}`;
  }
  renderResult({ focus });
}

/** "Ver meu resultado": do voto, da confirmação ou do aviso de rodada registrada. */
function showResult() {
  if (!["play", "registered", "result"].includes(view) || (busy && view !== "registered")) return;
  if (view === "play" && uncertain) return;
  notice = "";
  openResult();
}

/**
 * "Continuar votando": volta para a rodada que está pela metade, ou pede a
 * seguinte. Pedir a seguinte com uma rodada emitida e sem resposta devolve
 * essa mesma: o toque repetido não emite duas.
 */
function continueVoting() {
  if (busy || view !== "result") return;
  notice = "";
  if (progress && survey?.status === "open") {
    view = "play";
    renderPlay({ focus: true });
    return;
  }
  start({ next: true });
}

// Compartilhar --------------------------------------------------------------

// A imagem com a escolha e as finalistas é montada quando a tela aparece, com
// as cartas que já estão na tela, e o botão libera quando ela fica pronta.
// Assim o toque chama o compartilhamento do aparelho na hora, como os
// navegadores exigem, já com a imagem. O toque só tem dois destinos: o
// compartilhamento do aparelho com a imagem, ou a prévia na tela. Se a imagem
// não sair no prazo, o botão libera mesmo assim e o toque abre a prévia, que
// espera a imagem ou oferece tentar de novo. O link só vai se a pessoa pedir.
const SHARE_PREPARE_MS = 8000;
const SHARE_LOCK_MS = 10000;
let shareFile = null;
// Cada preparação tem um número: o resultado de uma preparação antiga (a tela
// mudou, ou a pessoa pediu para tentar de novo) é ignorado.
let shareRun = 0;
let sharePreparing = false;
let shareChampion = "";
let shareOthers = [];
let shareLabels = CHOICE_LABELS;
let sharing = false;
let sharingTimer = 0;
// A prévia: a imagem na tela, para baixar, onde o aparelho não compartilha arquivo.
let sharePreview = null;
let sharePreviewUrl = "";

function prepareShare(champion, others = shareOthers) {
  const run = ++shareRun;
  shareFile = null;
  shareChampion = champion;
  shareOthers = others;
  sharePreparing = Boolean(champion);
  if (!champion) return;
  const art = artById.get(champion);
  const current = () => run === shareRun && (view === "done" || view === "result") && shareChampion === champion;
  const release = () => {
    const button = root.querySelector('[data-action="share"]');
    if (!current() || !button) return;
    button.dataset.ready = shareFile ? "true" : "text";
    button.disabled = false;
    button.removeAttribute("aria-busy");
  };
  // O prazo é desta preparação: outra tela não o apaga.
  const timer = window.setTimeout(release, SHARE_PREPARE_MS);
  // No resultado os rótulos falam da primeira colocada e das seguintes.
  shareLabels = view === "result" ? RESULT_LABELS : CHOICE_LABELS;
  shareImage({
    src: art.src,
    name: art.name,
    question: question(),
    labels: shareLabels,
    others: others.map((id) => ({ src: artById.get(id).src })),
    photos: [art, ...others.map((id) => artById.get(id))].map((card) => card.photo).filter(Boolean),
  }).then((file) => {
    window.clearTimeout(timer);
    if (!current()) return;
    sharePreparing = false;
    shareFile = file;
    release();
    // A prévia pode estar aberta à espera da imagem.
    if (sharePreviewOpen()) renderSharePreview();
  });
}

/** Trava contra o toque repetido, com saída: um compartilhamento que nunca responde não mata o botão. */
function lockShare() {
  sharing = true;
  window.clearTimeout(sharingTimer);
  sharingTimer = window.setTimeout(() => { sharing = false; }, SHARE_LOCK_MS);
  return () => {
    window.clearTimeout(sharingTimer);
    sharing = false;
  };
}

/** Só acontece no toque. Leva as escolhas da pessoa, nunca resultado somado. */
async function share() {
  const champion = shareChampion;
  if ((view !== "done" && view !== "result") || !artById.has(champion)) return;
  if (sharePlan(navigator, shareFile) === "preview") {
    openSharePreview();
    return;
  }
  if (sharing) return;
  const release = lockShare();
  const outcome = await shareChoice({ surveyId, name: cardName(champion), question: question(), file: shareFile });
  release();
  // O aparelho recusou o arquivo: a imagem continua sendo a entrega. Quem
  // compartilhou ou fechou a folha não vê nada a mais.
  if ((view === "done" || view === "result") && outcome === "failed") openSharePreview();
}

function sharePreviewOpen() {
  return Boolean(sharePreview?.hasAttribute("open"));
}

function releaseSharePreviewUrl() {
  if (sharePreviewUrl) URL.revokeObjectURL(sharePreviewUrl);
  sharePreviewUrl = "";
}

/** Desenha a prévia conforme a imagem: pronta, a caminho ou sem sair. */
function renderSharePreview() {
  releaseSharePreviewUrl();
  if (shareFile) sharePreviewUrl = URL.createObjectURL(shareFile);
  sharePreview.innerHTML = sharePreviewMarkup({
    state: shareFile ? "ready" : sharePreparing ? "preparing" : "failed",
    url: sharePreviewUrl,
    name: cardName(shareChampion),
    others: shareOthers.map(cardName),
    othersLabel: shareLabels === RESULT_LABELS ? "Depois dela" : "Também na final",
    canShareLink: typeof navigator.share === "function",
  });
  sharePreview.focus({ preventScroll: true });
}

function openSharePreview() {
  if (!artById.has(shareChampion) || sharePreviewOpen()) return;
  if (!sharePreview) {
    sharePreview = document.createElement("dialog");
    sharePreview.className = "ps-share";
    sharePreview.setAttribute("aria-label", "Imagem para compartilhar");
    sharePreview.tabIndex = -1;
    document.body.append(sharePreview);
    sharePreview.addEventListener("close", sharePreviewClosed);
    sharePreview.addEventListener("click", (event) => {
      const action = event.target.closest("[data-share]")?.dataset.share;
      if (action === "close") closeSharePreview();
      else if (action === "link") shareLink();
      else if (action === "retry") {
        prepareShare(shareChampion);
        renderSharePreview();
      }
    });
    // Sem `showModal` o navegador não fecha no Esc: o Esc é ouvido no documento.
    if (typeof sharePreview.showModal !== "function") {
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeSharePreview();
      });
    }
  }
  // A imagem não saiu e ninguém está montando: o toque tenta de novo.
  if (!shareFile && !sharePreparing) prepareShare(shareChampion);
  // Sem `showModal` (Safari antes do 15.4) a prévia abre pelo atributo.
  if (typeof sharePreview.showModal === "function") sharePreview.showModal();
  else sharePreview.setAttribute("open", "");
  renderSharePreview();
}

/** Solta a imagem da prévia. Pode rodar duas vezes: o evento de fechar do navegador chega um instante depois. */
function sharePreviewClosed() {
  const wasShown = Boolean(sharePreview.innerHTML);
  releaseSharePreviewUrl();
  sharePreview.innerHTML = "";
  if (wasShown) root.querySelector('[data-action="share"]')?.focus({ preventScroll: true });
}

function closeSharePreview() {
  if (!sharePreviewOpen()) return;
  if (typeof sharePreview.close === "function") sharePreview.close();
  else sharePreview.removeAttribute("open");
  // O navegador avisa do fechamento num instante seguinte: a imagem sai já.
  sharePreviewClosed();
}

/** O segundo botão da prévia: o link da pesquisa, pelo aparelho ou copiado. */
async function shareLink() {
  const champion = shareChampion;
  if (sharing || !artById.has(champion)) return;
  const release = lockShare();
  const outcome = await shareChoice({ surveyId, name: cardName(champion), question: question(), file: null });
  release();
  const text = {
    copied: "Link copiado. Cole onde quiser compartilhar.",
    unavailable: "Este navegador não copia por aqui. O endereço é polimatch.com.br.",
    failed: "Não deu para compartilhar o link agora. Tente de novo.",
  }[outcome];
  const target = sharePreview?.querySelector("#ps-share-notice");
  if (!text || !target) return;
  target.textContent = text;
  target.hidden = false;
}

function renderStopped(kind, { focus = false } = {}) {
  view = kind;
  const copy = {
    closed: ["Fechada", "Esta pesquisa está fechada.", "Ela não recebe mais respostas."],
    scheduled: ["Em breve", "Esta pesquisa ainda não abriu.", "Volte quando ela estiver aberta."],
    unavailable: ["Pesquisa", "Esta pesquisa não está disponível.", "Volte mais tarde."],
  }[kind];
  shell({
    step: copy[0],
    mainClass: "ps-main--entry",
    focus,
    body: `${heading("Pesquisa", copy[1], copy[2])}${atHome ? "" : `<div class="ps-stack">${ALL_SURVEYS_LINK}</div>`}`,
  });
}

const renderClosed = (status, options) => renderStopped(status === "scheduled" ? "scheduled" : "closed", options);

// Imagens -------------------------------------------------------------------

function imageSettled(image) {
  if (image.complete) return image.naturalWidth > 0 ? Promise.resolve() : Promise.reject(new Error("imagem"));
  return new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", () => reject(new Error("imagem")), { once: true });
  });
}

/**
 * Libera o toque só quando as quatro cartas da tela estão visíveis. Carta
 * que falha ou que não chega no prazo trava a tela inteira, com saída.
 */
function armGrid() {
  const grid = root.querySelector(".ps-grid");
  if (!grid || !grid.querySelector("button")) return;
  const token = gridToken;
  let timer = 0;
  const deadline = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("prazo")), GRID_TIMEOUT_MS);
  });
  Promise.race([Promise.all([...grid.querySelectorAll("img")].map(imageSettled)), deadline]).then(
    () => {
      window.clearTimeout(timer);
      if (token !== gridToken) return;
      grid.dataset.ready = "true";
      for (const button of grid.querySelectorAll("button")) button.disabled = false;
    },
    () => {
      window.clearTimeout(timer);
      if (token !== gridToken) return;
      notice = `Não conseguimos carregar as cartas.${navigator.onLine === false ? " Confira a conexão." : ""} ${retryButton("reload-cards")}`;
      const target = root.querySelector("#ps-notice");
      target.innerHTML = notice;
      target.hidden = false;
    },
  );
}

function preload(cardIds = []) {
  for (const id of cardIds) {
    if (!artById.has(id)) continue;
    const { src, srcset } = artSources(id);
    const image = new Image();
    image.decoding = "async";
    image.sizes = GRID_SIZES;
    image.srcset = srcset;
    image.src = src;
  }
}

// Ações ---------------------------------------------------------------------

const validGroups = (groups) => Array.isArray(groups) && groups.length > 0
  && groups.every((group) => Array.isArray(group) && group.length > 0 && group.every((id) => artById.has(id)));

/**
 * A pesquisa parou com uma rodada nova pela metade: a tela volta para a
 * última rodada que a pessoa respondeu, que continua valendo, e o aviso diz o
 * que aconteceu com a rodada que não foi confirmada.
 */
function showLastAnswered(text = "") {
  response = rounds.lastAnswered.response;
  rounds = { ...rounds, round: rounds.lastAnswered.round, open: false };
  progress = null;
  persist();
  notice = text;
  openResult();
}

/**
 * O que o sorteio devolveu. `next` diz que a pessoa pediu outra rodada: se o
 * servidor devolveu a última respondida, não havia rodada para abrir.
 */
function applyDraw(result, { next = false, auto = false } = {}) {
  survey = result?.survey || survey;
  rounds = roundState(result);
  const groups = result?.draw?.groups;
  if (result?.response) {
    response = result.response;
    progress = null;
    persist();
    // Vistos todos os confrontos, o resultado diz. Com a pesquisa fora da
    // janela ele não diz por que a rodada não abriu: o aviso diz.
    if (next && survey?.status !== "open") notice = "Esta pesquisa fechou. Não dá para jogar outra rodada.";
    // Um servidor de antes das rodadas não tem resultado: vale a tela de antes.
    if (rounds.round) openResult();
    else renderDone({ focus: true });
    return;
  }
  if (survey?.status !== "open") {
    if (rounds.lastAnswered) {
      showLastAnswered(survey?.status === "closed" && hasSavedPicks()
        ? "A pesquisa fechou antes de você confirmar a rodada nova. A escolha dela não foi registrada."
        : "");
      return;
    }
    // Quem tinha escolhas neste aparelho precisa saber que elas não chegaram a valer.
    if (survey?.status === "closed" && hasSavedPicks()) notice = "A pesquisa fechou antes de você confirmar. Sua escolha não foi registrada.";
    renderClosed(survey?.status, { focus: true });
    return;
  }
  if (!validGroups(groups)) {
    notice = "Atualize a página para abrir esta pesquisa.";
    renderStopped("unavailable", { focus: true });
    return;
  }
  // Abrir uma pesquisa já respondida, sem toque, mostra o resultado, mesmo com
  // uma rodada emitida e ainda não tocada: só quem já escolheu carta nela
  // volta direto para o voto. O toque em "Continuar votando" abre essa rodada.
  if (resultOnOpen(rounds, { auto, hasPicks: hasSavedPicksFor(groups) })) {
    response = rounds.lastAnswered.response;
    progress = null;
    persist();
    openResult();
    return;
  }
  // As escolhas salvas só voltam se o sorteio for o mesmo, da mesma rodada,
  // seja qual for a identidade.
  progress = restoreProgress(savedRecord()?.progress, groups, undefined, rounds.round);
  response = null;
  persist();
  view = "play";
  renderPlay({ focus: true });
}

function sessionNotice() {
  // Com conta Google a saída é sair e entrar de novo; sem conta, entrar.
  const way = accountKind(readStored(IDENTITY_KEY)) === "google" ? "Abra o menu, saia da conta e entre de novo." : "Abra o menu e entre com Google.";
  return `Sua sessão precisa ser recuperada. ${way} ${MENU_LINK}`;
}

/**
 * A entrada com o aviso de conta trocada. Sem conta nenhuma no aparelho, o
 * toque leva à entrada com Google, e o texto diz isso. `recorded`: a confirmação
 * que viajava quando a conta mudou chegou e foi registrada na conta de antes;
 * se a pessoa saiu da conta, vê a tela de registrada.
 */
function renderSwitched({ recorded = false } = {}) {
  const signedOut = !readStored(IDENTITY_KEY);
  if (signedOut && recorded) {
    // A pessoa acabou de responder: a tela de registrada, sem convite para
    // responder outra vez como visitante.
    switched = false;
    response = null;
    notice = "Você saiu da conta neste aparelho. A resposta que você confirmou foi registrada.";
    renderDone({ focus: true });
    return;
  }
  notice = [
    signedOut ? "Você saiu da conta neste aparelho." : "Sua conta mudou.",
    recorded ? "A resposta que você confirmou foi registrada na conta anterior." : "",
    signedOut ? "Toque em Começar para entrar de novo." : "Toque em Continuar para seguir com a conta atual.",
  ].filter(Boolean).join(" ");
  renderEntry({ label: signedOut ? "Começar" : "Continuar", focus: true });
}

/** A conta desta aba deixou de ser a que está salva: recomeça com a atual, com um toque. */
function identityChanged() {
  const wasDone = view === "done" || view === "result" || view === "registered";
  epoch += 1;
  busy = false;
  uncertain = false;
  window.clearTimeout(advanceTimer);
  identity = "";
  progress = null;
  response = null;
  rounds = NO_ROUNDS;
  // Com a pesquisa parada não há entrada para oferecer: a página reabre e
  // mostra a resposta da conta atual, se houver.
  if (survey && survey.status !== "open") {
    switched = false;
    init();
    return;
  }
  // Quem estava vendo a própria resposta e saiu da conta não é convidado a
  // responder de novo como visitante.
  if (wasDone && !readStored(IDENTITY_KEY)) {
    switched = false;
    notice = "Você saiu da conta neste aparelho. A sua resposta continua registrada.";
    renderDone({ focus: true });
    return;
  }
  view = "entry";
  switched = true;
  renderSwitched();
}

/**
 * A conta mudou enquanto a confirmação viajava, e a resposta foi registrada
 * na conta de antes. O aparelho guarda que aquela conta respondeu, e a pessoa
 * lê que a resposta valeu. Se a conta já voltou a ser a de antes, a tela
 * mostra a resposta.
 */
function recordedBeforeSwitch(key, result) {
  if (!result?.response) return;
  if (identity === key) {
    // A conta trocou e voltou enquanto a confirmação viajava: a resposta é
    // desta conta. Vale mais que o sorteio pedido na volta, que saiu do
    // servidor antes de a confirmação chegar.
    epoch += 1;
    busy = false;
    uncertain = false;
    switched = false;
    window.clearTimeout(advanceTimer);
    survey = result.survey || survey;
    response = result.response;
    rounds = roundState(result);
    progress = null;
    notice = "";
    persist();
    if (rounds.round) openResult();
    else renderDone({ focus: true });
    return;
  }
  const saved = savedRecord();
  if (saved?.identity === identityTag(key)) {
    safeStorage.set(PHOTO_SURVEY_STORAGE_KEY, savedProgressText(readStored(PHOTO_SURVEY_STORAGE_KEY), surveyId, {
      identity: saved.identity,
      progress: null,
      answered: true,
    }));
  }
  if (switched && view === "entry" && !busy) renderSwitched({ recorded: true });
}

/** Põe a pesquisa no endereço, para a recarga voltar a ela e não à capa. */
function leaveHome() {
  if (!atHome) return;
  atHome = false;
  try {
    window.history.replaceState(null, "", surveyHref(surveyId));
  } catch {
    // Sem histórico (página aberta de um arquivo, por exemplo) a pesquisa segue nesta visita.
  }
}

/**
 * Abre ou retoma a pesquisa. `auto` é a retomada sem toque (abrir a página ou
 * outra aba confirmar): nela nunca se cria jogador nem se troca de identidade.
 * `next` é o toque em "Mais uma rodada": o pedido de sorteio leva o pedido da
 * rodada seguinte. Só um toque manda `next`; a retomada e a capa, nunca.
 */
async function start({ auto = false, retried = false, fromGate = false, next = false, hold = 0 } = {}) {
  if (busy || !surveyId) return;
  leaveHome();
  busy = true;
  notice = "";
  uncertain = false;
  switched = false;
  const run = ++epoch;
  const key = readStored(IDENTITY_KEY);
  if (!key && auto) {
    busy = false;
    init();
    return;
  }
  // Sem conta Google não há sorteio. A retomada sem toque fica na entrada da
  // pesquisa, à espera do toque. Quem tocou vai para a entrada com Google,
  // mas só se a pesquisa segue aberta: a tela pode estar parada há muito
  // tempo, e ninguém faz cadastro para descobrir depois que ela fechou.
  if (accountKind(key) !== "google") {
    if (auto) {
      busy = false;
      openSurvey({ resume: false });
      return;
    }
    view = "entry";
    renderEntry({ pending: "Abrindo…" });
    try {
      survey = await loadPhotoSurvey(surveyId);
    } catch (error) {
      if (run !== epoch) return;
      busy = false;
      failStart(error);
      return;
    }
    if (run !== epoch) return;
    busy = false;
    if (survey?.status !== "open") {
      renderClosed(survey?.status, { focus: true });
      return;
    }
    // A pessoa pode ter entrado pelo menu enquanto a pesquisa era lida.
    if (signedIn()) start();
    else openGate("signin");
    return;
  }
  if (fromGate) renderGate();
  else if (hold) {
    // O aviso "Rodada registrada" já está na tela e fica até o sorteio chegar.
  } else {
    view = "entry";
    if (next) renderOpening("Abrindo a rodada nova…");
    else if (resumable()) renderOpening();
    else renderEntry({ pending: "Abrindo…" });
  }
  identity = key;
  let result;
  const startedAt = Date.now();
  // O aviso de rodada registrada fica ao menos `hold` ms, para dar para ler.
  const held = async () => {
    const left = hold - (Date.now() - startedAt);
    if (left > 0) await new Promise((resolve) => { window.setTimeout(resolve, left); });
  };
  try {
    result = await drawPhotoSurvey(surveyId, key, { next });
  } catch (error) {
    await held();
    if (run !== epoch) return;
    busy = false;
    if (error.status === 403 && error.code === "CPF_REGISTRATION_REQUIRED") {
      // A conta ainda não tem cadastro. Sem toque, a entrada da pesquisa.
      identity = "";
      if (auto) {
        openSurvey({ resume: false });
        return;
      }
      // Com o toque, o formulário, mas só se a pesquisa segue aberta: o
      // servidor recusa pela falta do cadastro antes de olhar se ela fechou,
      // e ninguém faz o cadastro para descobrir isso depois.
      busy = true;
      try {
        survey = await loadPhotoSurvey(surveyId);
      } catch {
        // Sem essa leitura o formulário abre assim mesmo: o sorteio confere depois.
      }
      if (run !== epoch) return;
      busy = false;
      if (survey && survey.status !== "open") renderClosed(survey.status, { focus: true });
      else openGate("form");
      return;
    }
    if (error.status === 401 && readStored(IDENTITY_KEY) !== key) {
      // A identidade mudou no meio do pedido. Sem toque, só o aviso. O pedido
      // de outra rodada era da conta de antes: não é repetido para a atual.
      if (auto || retried || next) identityChanged();
      else start({ retried: true, fromGate });
      return;
    }
    if (error.status === 401 && !(survey && survey.status !== "open")) {
      // A sessão venceu ou foi encerrada no servidor. O aparelho esquece a
      // chave morta e a pessoa entra de novo: repetir o pedido com ela daria
      // sempre a mesma recusa. As escolhas guardadas neste aparelho ficam, e
      // voltam se o sorteio da conta for o mesmo.
      forgetDeadSession(key);
      identity = "";
      if (auto) {
        view = "entry";
        notice = "Sua sessão venceu. Toque em Começar para entrar de novo.";
        renderEntry({ focus: true });
      } else {
        openGate("signin", "Sua sessão venceu. Entre de novo para continuar.");
      }
      return;
    }
    // Com a resposta na tela, a falha de "Mais uma rodada" não a tira de lá.
    if (next && response) failNext(error);
    else failStart(error);
    return;
  }
  await held();
  if (run !== epoch) return;
  busy = false;
  applyDraw(result, { next, auto });
}

/**
 * A rodada nova não abriu (depois de confirmar, ou no toque em "Continuar
 * votando"): a tela vai para o resultado, com o motivo. "Continuar votando"
 * fica lá para tentar de novo, e repetir o pedido não emite duas rodadas: com
 * uma rodada emitida e sem resposta, o servidor devolve essa. Um servidor de
 * antes das rodadas não chega aqui.
 */
function failNext(error) {
  if (error.status === 404) {
    renderStopped("unavailable", { focus: true });
    return;
  }
  if (error.status === 409 && error.code === "PHOTO_SURVEY_CLOSED") {
    stoppedByServer(error);
    notice = "Esta pesquisa fechou. Não dá para jogar outra rodada.";
  } else if (error.status === 429) {
    notice = "Muitas tentativas agora. Espere um pouco e tente de novo.";
  } else if (error.status === 0 && navigator.onLine === false) {
    notice = "Não conseguimos abrir a rodada nova. Confira a conexão e tente de novo.";
  } else {
    notice = "Não conseguimos abrir a rodada nova agora. Tente de novo em instantes.";
  }
  if (rounds.round) openResult();
  else renderDone({ focus: true });
}

/**
 * O servidor recusou porque a pesquisa parou depois de esta página ser
 * aberta. A página guarda isso: quem troca de conta em seguida vê a pesquisa
 * parada, não a entrada.
 */
function stoppedByServer(error) {
  survey = { ...(survey || {}), status: error.body?.current?.status === "scheduled" ? "scheduled" : "closed" };
}

function failStart(error) {
  if (error.status === 404) {
    renderStopped("unavailable", { focus: true });
    return;
  }
  if (error.status === 409 && error.code === "PHOTO_SURVEY_CLOSED") {
    stoppedByServer(error);
    renderClosed(error.body?.current?.status, { focus: true });
    return;
  }
  if (error.status === 401) {
    // Só chega aqui com a pesquisa parada (a sessão vencida de uma pesquisa
    // aberta é tratada em start): não há o que recuperar, vale a tela de fechada.
    renderClosed(survey?.status, { focus: true });
    return;
  }
  const busyServer = error.status === 429 ? "Muitas tentativas agora. Espere um pouco e tente de novo." : "";
  if (survey && survey.status !== "open") {
    // A pesquisa não está aberta e não deu para conferir se há resposta desta
    // identidade: a pessoa fica na tela de fechada, sem entrada para começar e
    // sem ler que nada foi registrado.
    notice = `${busyServer || "Não conseguimos conferir agora se há uma resposta sua nesta pesquisa."} ${retryButton("init")}`;
    renderClosed(survey.status, { focus: true });
    return;
  }
  const saved = resumable() ? savedRecord() : null;
  if (saved?.answered) {
    // Quem já respondeu não volta para a entrada só porque o servidor não respondeu.
    response = null;
    // A nova tentativa refaz a abertura, sem toque de rodada: quem respondeu
    // vê o resultado, e nenhuma rodada nasce dela.
    notice = `${busyServer || "Não conseguimos falar com o servidor para mostrar a sua escolha."} ${retryButton("init")}`;
    renderDone({ focus: true });
    return;
  }
  notice = busyServer || (saved
    ? "Não conseguimos abrir a pesquisa agora. Suas escolhas continuam neste aparelho."
    : "Não conseguimos abrir a pesquisa agora. Nenhuma escolha foi registrada.");
  renderEntry({ label: "Tentar de novo", focus: true });
}

async function submit() {
  const body = responseBody(progress, rounds.round);
  if (busy || !body || view !== "play") return;
  busy = true;
  notice = "";
  const run = ++epoch;
  const key = identity;
  renderPlay({ sending: true });
  let result;
  try {
    result = await respondPhotoSurvey(surveyId, key, body);
  } catch (error) {
    if (run !== epoch) return;
    busy = false;
    failSubmit(error, key);
    return;
  }
  if (run !== epoch) {
    recordedBeforeSwitch(key, result);
    return;
  }
  busy = false;
  uncertain = false;
  survey = result?.survey || survey;
  response = result?.response || null;
  rounds = roundState(result);
  progress = null;
  persist();
  const after = afterConfirm(response ? rounds : NO_ROUNDS, survey?.status);
  if (after === "done") renderDone({ focus: true });
  else if (after === "result") openResult();
  else {
    // A rodada seguinte abre sozinha: o aviso fica um instante e o sorteio
    // pede a rodada seguinte. Foi a pessoa quem confirmou: é o toque dela.
    renderRegistered();
    start({ next: true, hold: REGISTERED_MS });
  }
}

function failSubmit(error, key) {
  if (error.status === 403 && error.code === "CPF_REGISTRATION_REQUIRED") {
    // A conta ficou sem cadastro no meio do caminho. As escolhas continuam
    // neste aparelho e voltam depois do cadastro, se o sorteio for o mesmo.
    uncertain = false;
    openGate("form", "Falta o cadastro para registrar a sua escolha. As suas escolhas continuam neste aparelho.");
    return;
  }
  if (error.status === 409 && error.code === "PHOTO_SURVEY_ALREADY_ANSWERED" && error.body?.current) {
    uncertain = false;
    response = error.body.current;
    progress = null;
    // A recusa traz a resposta que valeu, sem o progresso: a tela mostra a
    // resposta e não oferece outra rodada. Abrir a pesquisa de novo oferece.
    const answeredRound = rounds.round;
    rounds = { ...NO_ROUNDS, round: answeredRound };
    persist();
    notice = answeredRound >= 2
      ? "Você já tinha respondido esta rodada. Vale a primeira resposta, que é esta."
      : "Você já tinha respondido esta pesquisa. Vale a primeira resposta, que é esta.";
    renderDone({ focus: true });
    return;
  }
  if (error.status === 409 && error.code === "PHOTO_SURVEY_CLOSED") {
    uncertain = false;
    stoppedByServer(error);
    if (rounds.lastAnswered) {
      // As rodadas anteriores continuam registradas: só esta não chegou a valer.
      showLastAnswered("A pesquisa fechou antes de a sua confirmação chegar. A escolha desta rodada não foi registrada.");
      return;
    }
    notice = "A pesquisa fechou antes de a sua confirmação chegar. Sua escolha não foi registrada.";
    renderClosed(error.body?.current?.status, { focus: true });
    return;
  }
  if (error.status === 404) {
    uncertain = false;
    renderStopped("unavailable", { focus: true });
    return;
  }
  // Sem resposta, ou com falha do servidor, não dá para saber se foi gravada.
  // Até o servidor dizer o que tem guardado, a escolha fica travada: trocar
  // agora poderia mostrar uma escolha e registrar outra. Uma recusa que não
  // chega a olhar a resposta guardada (limite de requisições, sessão) não
  // desfaz a dúvida; `uncertain` só volta a falso onde o servidor respondeu
  // sobre ela.
  if (error.status === 0 || error.status >= 500) {
    uncertain = true;
    notice = "Não deu para saber se a sua resposta chegou. Toque em Tentar de novo para conferir: nada é registrado duas vezes.";
    renderPlay({ focus: true });
    return;
  }
  if (error.status === 401) {
    if (readStored(IDENTITY_KEY) !== key) {
      identityChanged();
      return;
    }
    notice = sessionNotice();
    renderPlay({ focus: true });
    return;
  }
  if (error.code === "PHOTO_SURVEY_RESPONSE_INVALID" && error.body?.current?.reason === "answer-id") {
    // O recibo foi recusado, e o servidor só chega a essa recusa quando não
    // tem resposta guardada deste jogador: um recibo novo resolve.
    uncertain = false;
    progress = { ...progress, answerId: crypto.randomUUID() };
    persist();
    notice = "Não conseguimos registrar agora. Sua escolha continua aqui.";
    renderPlay({ focus: true });
    return;
  }
  if (error.code === "PHOTO_SURVEY_RESPONSE_INVALID" || error.code === "PHOTO_SURVEY_DRAW_REQUIRED") {
    // A resposta não bate com o sorteio guardado no servidor (o jogador ativo
    // da conta pode ter mudado): busca o sorteio de novo e recomeça com ele.
    uncertain = false;
    progress = null;
    forgetSaved();
    start().then(() => {
      if (view !== "play") return;
      notice = "Não deu para registrar com as cartas que estavam na tela. Estas são as cartas da sua conta: escolha de novo.";
      renderPlay({ focus: true });
    });
    return;
  }
  notice = error.status === 429
    ? "Muitas tentativas agora. Espere um pouco e tente de novo."
    : "Não conseguimos registrar agora. Sua escolha continua aqui.";
  renderPlay({ focus: true });
}

function choose(cardId, button) {
  if (busy || view !== "play" || button.disabled) return;
  const current = progressView(progress);
  const next = current.kind === "vote" ? pickCard(progress, cardId) : current.kind === "final" ? chooseChampion(progress, cardId) : progress;
  if (next === progress) return;
  busy = true;
  notice = "";
  progress = next;
  persist();
  const grid = button.closest(".ps-grid");
  grid.classList.add("has-choice");
  for (const card of grid.querySelectorAll("button")) card.setAttribute("aria-pressed", String(card === button));
  const run = epoch;
  advanceTimer = window.setTimeout(() => {
    if (run !== epoch) return;
    busy = false;
    renderPlay({ focus: true });
  }, ADVANCE_MS);
}

function back() {
  if (busy || uncertain || view !== "play") return;
  notice = "";
  progress = goBack(progress);
  persist();
  renderPlay({ focus: true });
}

function init() {
  const requested = surveyIdFromSearch(window.location.search);
  atHome = !requested;
  if (!requested) return openHome();
  useSurvey(requested);
  return openSurvey();
}

const unreachableNotice = (error) => (error.status !== 0
  ? "O servidor não respondeu como esperado. Tente de novo em instantes."
  : navigator.onLine === false
    ? "Não conseguimos falar com o servidor. Confira a conexão."
    : "Não conseguimos falar com o servidor agora. Tente de novo em instantes.");

/**
 * A capa. Quem entrou com Google vê o feed (ICM 76, #354). Para quem não
 * entrou, a capa é a de sempre: lê a definição de cada pesquisa (uma leitura
 * por pesquisa, sem identidade), destaca a primeira aberta e lista as outras.
 * Nada aqui grava, e a capa nunca emite rodada.
 */
async function openHome() {
  view = "loading";
  notice = "";
  survey = null;
  identity = "";
  const key = readStored(IDENTITY_KEY);
  homeKey = key;
  homeMode = "";
  homeViews = [];
  // Só uma conta Google responde. O que este aparelho guardou de uma chave
  // sem conta não vale como "respondida" nem como "pela metade": a capa
  // convida a entrar, em vez de dizer que não há o que responder.
  if (accountKind(key) === "google") {
    openFeed(key);
    return;
  }
  useSurvey(PHOTO_SURVEYS[0].id);
  renderEntry({ pending: "Carregando…" });
  const run = ++epoch;
  const results = await Promise.all(PHOTO_SURVEYS.map((item) => loadPhotoSurvey(item.id).then((value) => ({ value }), (error) => ({ error }))));
  if (run !== epoch) return;
  // Uma pesquisa que o servidor não conhece (404) só some da lista. Qualquer
  // outra falha deixa a capa sem saber o que está aberto: em vez de mostrar
  // uma lista pela metade, ela pede para tentar de novo.
  const failure = results.find((result) => result.error && result.error.status !== 404)?.error;
  if (failure) {
    view = "entry";
    notice = unreachableNotice(failure);
    renderEntry({ action: "init", label: "Tentar de novo" });
    return;
  }
  homeViews = results.filter((result) => result.value && photoSurveyById(result.value.id)).map((result) => result.value);
  if (!homeViews.length) {
    useSurvey("");
    renderStopped("unavailable");
    return;
  }
  const choice = coverFeature(homeViews);
  homeMode = choice.mode;
  useSurvey(choice.id);
  survey = homeViews.find((item) => item.id === choice.id) || null;
  view = "entry";
  renderEntry();
}

// Feed (ICM 76, #354) --------------------------------------------------------

// O que o feed leu: o perfil da conta (para a primeira colocada de cada
// pesquisa) e o que este aparelho sabe de respondidas e de pela metade.
let feedProfile = null;
let feedAnswered = [];
let feedPending = [];
// A carta que ilustra o cartão de uma pesquisa ainda sem resultado: sorteada
// uma vez por visita, da lista que pode ilustrar a entrada dela.
const feedFaces = new Map();

function feedFace(id) {
  if (!feedFaces.has(id)) feedFaces.set(id, sampleCards(entryCardIdsFor(photoSurveyById(id)).filter((card) => artById.has(card)), 1)[0] || "");
  return feedFaces.get(id);
}

// O que vem do servidor (pergunta, assunto) entra sempre escapado.
function feedCard(entry) {
  const base = photoSurveyById(entry.id);
  const remote = homeViews.find((item) => item.id === entry.id) || {};
  const title = (typeof remote.question === "string" && remote.question) || base.question;
  const topic = (typeof remote.subject === "string" && remote.subject) || base.subject;
  const [tag, modifier] = Object.hasOwn(STATUS_TAG, entry.status) ? STATUS_TAG[entry.status] : STATUS_TAG.closed;
  const face = entry.firstCardId || feedFace(entry.id);
  return `<a class="ps-feed-card" href="${surveyHref(entry.id)}" data-survey="${escapeText(entry.id)}">${face ? staticCard(face, "84px") : '<span class="ps-card" aria-hidden="true"></span>'}<span class="ps-feed-text"><small><span>${escapeText(topic)}</span><em class="pm-tag${modifier}">${tag}</em></small><b>${escapeText(title)}</b>${entry.firstCardId ? `<span class="ps-feed-first">Seu 1º lugar: <strong>${escapeText(cardName(entry.firstCardId))}</strong></span>` : ""}<span class="ps-feed-go">${escapeText(entry.label)} <i aria-hidden="true">›</i></span></span></a>`;
}

/**
 * A capa de quem entrou com Google: as pesquisas em cartões, uma embaixo da
 * outra, com o estado e, nas respondidas, a primeira colocada da pessoa.
 */
function renderFeed({ pending = false, retry = false, focus = false } = {}) {
  view = "entry";
  const entries = pending || retry ? [] : feedEntries(homeViews, {
    firstPlaces: feedProfile?.firstPlaces,
    answeredIds: feedAnswered,
    pendingIds: feedPending,
  });
  const hint = pending
    ? "Carregando…"
    : retry ? "Não deu para carregar as pesquisas." : entries.length ? "Vote nas abertas e veja a sua primeira colocada em cada uma." : "Nenhuma pesquisa aberta agora. Quando abrir outra, ela aparece aqui.";
  shell({
    step: "Pesquisas",
    mainClass: "ps-main--entry ps-main--feed",
    focus,
    body: `${heading("Pesquisas", "Suas pesquisas", hint)}
      ${entries.length ? `<div class="ps-feed">${entries.map(feedCard).join("")}</div>` : ""}
      ${retry ? '<div class="ps-cta"><button class="ps-btn" id="ps-action" data-action="init" type="button">Tentar de novo</button></div>' : ""}
      <div class="ps-home">${upcomingSectionMarkup()}</div>`,
  });
}

/**
 * Lê as pesquisas (sem identidade) e o perfil da conta, que traz a primeira
 * colocada de cada pesquisa respondida: um pedido só, em vez de um por
 * pesquisa. Os dois só leem; a capa não grava nada e não emite rodada.
 */
async function openFeed(key) {
  const tag = identityTag(key);
  const saved = readStored(PHOTO_SURVEY_STORAGE_KEY);
  feedAnswered = answeredSurveyIds(saved, tag);
  feedPending = inProgressSurveyIds(saved, tag);
  feedProfile = null;
  useSurvey("");
  renderFeed({ pending: true });
  const run = ++epoch;
  const [results, profile] = await Promise.all([
    Promise.all(PHOTO_SURVEYS.map((item) => loadPhotoSurvey(item.id).then((value) => ({ value }), (error) => ({ error })))),
    // Sem o perfil o feed sai assim mesmo, sem a primeira colocada.
    loadMyProfile(key).catch(() => null),
  ]);
  if (run !== epoch) return;
  const failure = results.find((result) => result.error && result.error.status !== 404)?.error;
  if (failure) {
    notice = unreachableNotice(failure);
    renderFeed({ retry: true });
    return;
  }
  homeViews = results.filter((result) => result.value && photoSurveyById(result.value.id)).map((result) => result.value);
  feedProfile = profile ? profileState(profile, (id) => artById.has(id)) : null;
  renderFeed();
}

/** A capa foi montada para outra identidade: refaz, sem gravar nada. */
function refreshHome() {
  if (!atHome || busy || view !== "entry" || readStored(IDENTITY_KEY) === homeKey) return false;
  init();
  return true;
}

/**
 * A página de uma pesquisa. `resume: false` é para quem não pode retomar sem
 * toque (sem conta, ou com conta sem cadastro): só lê a pesquisa e mostra a
 * entrada, ou a tela de parada.
 */
async function openSurvey({ resume = true } = {}) {
  view = "loading";
  notice = "";
  const account = signedIn();
  // Quem já começou nesta conta vai direto ao sorteio, que também diz se a
  // pesquisa continua aberta.
  if (resume && account && resumable()) {
    start({ auto: true });
    return;
  }
  renderEntry({ pending: "Carregando…" });
  const run = ++epoch;
  try {
    survey = await loadPhotoSurvey(surveyId);
  } catch (error) {
    if (run !== epoch) return;
    if (error.status === 404) {
      renderStopped("unavailable");
      return;
    }
    view = "entry";
    notice = unreachableNotice(error);
    renderEntry({ action: "init", label: "Tentar de novo" });
    return;
  }
  if (run !== epoch) return;
  if (survey?.status !== "open") {
    // Fechada: quem já respondeu com a conta deste aparelho ainda vê a
    // própria resposta. Com a pesquisa fechada o sorteio não grava nada.
    if (resume && account && survey?.status === "closed") {
      start({ auto: true });
      return;
    }
    renderClosed(survey?.status);
    return;
  }
  view = "entry";
  renderEntry();
}

// Cadastro ------------------------------------------------------------------

// A entrada com Google e o formulário de cadastro (ICM 71, #336) ficam entre
// o toque em "Começar" e o sorteio. `gateStep` diz qual das duas telas vale.
// O que a pessoa preenche fica só na memória desta página.
let gateStep = "signin";
let form = { ...EMPTY_REGISTRATION_FORM };
// A sessão para a qual o formulário foi aberto. Quando a conta do aparelho
// deixa de ser essa, o que estava preenchido é apagado: o CPF de uma pessoa
// não aparece para a próxima conta que entra nesta aba.
let formOwner = "";
// O campo da última recusa: fica marcado e recebe o foco.
let invalidField = "";

const FIELD_TARGETS = Object.freeze({
  cpf: "#ps-cpf",
  ageRange: 'button[data-field="ageRange"]',
  gender: 'button[data-field="gender"]',
  state: "#ps-state",
  consent: "#ps-consent",
});

function renderGate({ focus = false, mount = true } = {}) {
  view = "gate";
  if (gateStep === "form") {
    const target = focus && Object.hasOwn(FIELD_TARGETS, invalidField) ? FIELD_TARGETS[invalidField] : "";
    shell({
      step: "Cadastro",
      mainClass: "ps-main--entry",
      focus: focus && !target,
      body: `${heading("Cadastro", "Faça seu voto contar", "Um CPF, uma pessoa. Só o resultado somado aparece, nunca o seu nome.")}${registrationFormMarkup({ form, busy, invalid: invalidField })}`,
    });
    if (target) {
      // O aviso fica no topo, à vista; o foco vai para o campo que ele cita.
      window.scrollTo(0, 0);
      root.querySelector(target)?.focus({ preventScroll: true });
    }
    return;
  }
  const googleReady = Boolean(googleClientId());
  shell({
    step: "Entrar",
    mainClass: "ps-main--entry",
    focus,
    body: `${heading("Para responder", "Entre para responder", "Um CPF, uma pessoa. Entre com Google e faça o seu cadastro.")}${signInMarkup({ googleReady, busy })}`,
  });
  if (mount && googleReady && !busy) mountGateGoogle();
}

/** Abre a entrada ou o formulário. Nada aqui fala com o servidor. */
function openGate(step, text = "") {
  epoch += 1;
  busy = false;
  uncertain = false;
  window.clearTimeout(advanceTimer);
  identity = "";
  // O formulário é de uma sessão. Voltar para a entrada, ou abrir o
  // formulário para outra sessão, apaga o que estava preenchido.
  const key = readStored(IDENTITY_KEY);
  if (step !== "form" || formOwner !== key) form = { ...EMPTY_REGISTRATION_FORM };
  formOwner = step === "form" ? key : "";
  invalidField = "";
  gateStep = step;
  notice = text;
  renderGate({ focus: true });
}

async function mountGateGoogle() {
  const slot = root.querySelector("#ps-google");
  if (!slot) return;
  try {
    await mountGoogleButton(slot, { callback: gateSignIn });
  } catch (error) {
    if (view !== "gate" || gateStep !== "signin" || !slot.isConnected) return;
    notice = `${escapeText(error.message || "Não foi possível abrir o Google agora.")} ${retryButton("gate-retry", "Tentar carregar o Google de novo")}`;
    renderGate({ mount: false });
    root.querySelector("#ps-google")?.replaceChildren();
  }
}

/** O botão do Google devolveu a credencial: troca pela sessão e segue para o sorteio. */
async function gateSignIn(response) {
  if (!response?.credential || busy || view !== "gate") return;
  busy = true;
  notice = "";
  const run = ++epoch;
  renderGate();
  try {
    await signInWithGoogleCredential(response.credential);
  } catch (error) {
    if (run !== epoch) return;
    busy = false;
    notice = error.status === 0 ? "Não conseguimos falar com o servidor. Tente de novo." : "Não foi possível entrar agora. Tente de novo.";
    renderGate({ focus: true });
    return;
  }
  if (run !== epoch) return;
  busy = false;
  // O Google só guarda um destino para a credencial por página. Se o botão
  // tocado foi o do menu, ele ficaria aberto e desatualizado por cima da tela.
  siteMenu.close();
  // Com a conta no aparelho, o pedido de sorteio diz se falta o cadastro.
  start({ fromGate: true });
}

/** A pessoa voltou a mexer no formulário: o aviso da tentativa anterior sai da tela. */
function clearFormNotice() {
  if (view !== "gate" || (!notice && !invalidField)) return;
  notice = "";
  invalidField = "";
  const target = root.querySelector("#ps-notice");
  if (target) target.hidden = true;
  for (const marked of root.querySelectorAll('#ps-register [aria-describedby="ps-notice"]')) {
    marked.removeAttribute("aria-invalid");
    marked.removeAttribute("aria-describedby");
  }
}

function chooseOption(chip) {
  const { field, value } = chip.dataset;
  if (busy || view !== "gate" || !["ageRange", "gender"].includes(field)) return;
  clearFormNotice();
  form = { ...form, [field]: value };
  for (const other of chip.parentElement.querySelectorAll("button[data-field]")) other.setAttribute("aria-pressed", String(other === chip));
}

async function submitRegistration() {
  if (busy || view !== "gate" || gateStep !== "form") return;
  // A conta do aparelho pode ter mudado sem aviso (outra aba, antes de o
  // evento chegar). O que está preenchido é de quem abriu o formulário: nada
  // é enviado na sessão de outra conta, e a tela se acerta com a conta atual.
  if (readStored(IDENTITY_KEY) !== formOwner) {
    gateIdentityMoved();
    return;
  }
  const problem = registrationProblem(form);
  if (problem) {
    notice = problem.text;
    invalidField = problem.field;
    renderGate({ focus: true });
    return;
  }
  const key = readStored(IDENTITY_KEY);
  busy = true;
  notice = "";
  invalidField = "";
  const run = ++epoch;
  renderGate();
  try {
    await registerCpf(key, registrationBody(form));
  } catch (error) {
    if (run !== epoch) return;
    busy = false;
    const refusal = registrationRefusal(error);
    if (refusal.next === "signin") {
      // Uma sessão que o servidor não reconhece mais sai do aparelho: senão,
      // qualquer volta a esta aba tentaria seguir com ela. A entrada abre com
      // o formulário vazio, porque a próxima conta pode ser de outra pessoa.
      if (error.status === 401) forgetDeadSession(key);
      openGate("signin", refusal.text);
      return;
    }
    if (refusal.next === "form") {
      notice = refusal.text;
      invalidField = refusal.field;
      renderGate({ focus: true });
      return;
    }
  }
  if (run !== epoch) return;
  busy = false;
  // Enviado, o CPF sai da memória da página.
  form = { ...EMPTY_REGISTRATION_FORM };
  start({ fromGate: true });
}

/**
 * A conta do aparelho mudou com a entrada ou o formulário na tela (pelo menu,
 * ou em outra aba). Entrou: o sorteio diz se falta o cadastro. Saiu: volta
 * para a entrada.
 */
function gateIdentityMoved() {
  if (busy) return;
  const key = readStored(IDENTITY_KEY);
  if (accountKind(key) !== "google") {
    if (gateStep === "form") openGate("signin", "Você saiu da conta neste aparelho. Entre de novo para fazer o cadastro.");
    return;
  }
  if (gateStep === "form" && key === formOwner) return;
  // Entrou uma conta (ou outra conta, com o formulário na tela): o que estava
  // preenchido não é dela, e o sorteio diz se ela já tem cadastro.
  form = { ...EMPTY_REGISTRATION_FORM };
  formOwner = "";
  invalidField = "";
  gateStep = "signin";
  start({ fromGate: true });
}

root.addEventListener("input", (event) => {
  const input = event.target;
  if (input.id !== "ps-cpf") return;
  const end = typeof input.selectionStart === "number" ? input.selectionStart : input.value.length;
  const digitsBefore = input.value.slice(0, end).replace(/\D/g, "").length;
  const masked = formatCpf(input.value);
  if (input.value !== masked) {
    input.value = masked;
    // Reescrever o campo levaria o cursor para o fim: ele volta para depois
    // dos mesmos dígitos, para dar para corrigir um número no meio.
    const caret = caretAfterDigits(masked, digitsBefore);
    try {
      input.setSelectionRange(caret, caret);
    } catch {
      // Sem controle do cursor, ele fica onde o navegador puser.
    }
  }
  form = { ...form, cpf: masked };
  clearFormNotice();
});

root.addEventListener("change", (event) => {
  if (event.target.id === "ps-state") form = { ...form, state: event.target.value };
  else if (event.target.id === "ps-consent") form = { ...form, consent: event.target.checked };
  else return;
  clearFormNotice();
});

root.addEventListener("submit", (event) => {
  if (event.target.id !== "ps-register") return;
  event.preventDefault();
  submitRegistration();
});

root.addEventListener("click", (event) => {
  const card = event.target.closest("button[data-card]");
  if (card) {
    choose(card.dataset.card, card);
    return;
  }
  const chip = event.target.closest("button[data-field]");
  if (chip) {
    chooseOption(chip);
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "start") start();
  else if (action === "result") showResult();
  else if (action === "continue") continueVoting();
  else if (action === "gate-retry" && view === "gate" && !busy) {
    notice = "";
    renderGate();
  }
  else if (action === "init") init();
  else if (action === "back") back();
  else if (action === "confirm") submit();
  else if (action === "share") share();
  else if (action === "menu") siteMenu.open(event.target.closest("[data-action]"));
  else if (action === "reload-cards" && view === "play" && !busy) {
    notice = "";
    imageRetry += 1;
    renderPlay({ focus: true });
  }
});

/**
 * Acerta a tela de voto com o que outra aba desta identidade deixou guardado.
 * Lê o armazenamento como está agora, não o valor de um evento que pode ter
 * chegado atrasado.
 */
function followOtherTab() {
  if (view !== "play") return;
  const saved = savedRecord();
  if (!saved || saved.identity !== identityTag(identity)) return;
  // Outra aba confirmou a resposta: esta busca a resposta no servidor em vez
  // de seguir com a tela de voto. Numa rodada nova o registro já diz que a
  // pessoa respondeu antes: o sinal é ele não guardar mais escolha pela
  // metade, ou já guardar as escolhas de uma rodada mais nova que a desta aba.
  if (answeredElsewhere(saved, rounds.round)) {
    epoch += 1;
    busy = false;
    uncertain = false;
    window.clearTimeout(advanceTimer);
    progress = null;
    start({ auto: true });
    return;
  }
  // Outra aba avançou ou trocou uma escolha no mesmo sorteio: esta acompanha,
  // em vez de ficar numa tela antiga. Um aviso que esteja na tela continua.
  if (busy || uncertain || !progress || !saved.progress || !sameGroups(saved.progress.groups, progress.groups)) return;
  const next = restoreProgress(saved.progress, progress.groups, undefined, rounds.round);
  if (JSON.stringify(next) === JSON.stringify(progress)) return;
  progress = next;
  renderPlay({ focus: true });
}

window.addEventListener("storage", (event) => {
  if (event.key === IDENTITY_KEY || event.key === null) {
    if (view === "gate") gateIdentityMoved();
    else if (identity && readStored(IDENTITY_KEY) !== identity && view !== "unavailable") identityChanged();
    else refreshHome();
    return;
  }
  if (event.key === PHOTO_SURVEY_STORAGE_KEY) followOtherTab();
});

/**
 * A pessoa entrou ou saiu da conta pelo menu, nesta aba. Com uma identidade
 * em uso, vale o mesmo caminho da troca feita em outra aba. Sem identidade em
 * uso (a entrada, antes do primeiro toque), a página reabre: o aviso de cota
 * sai e o próximo toque já vale para a conta.
 */
function identityUpdated() {
  if (view === "gate") {
    gateIdentityMoved();
    return;
  }
  if (identity && view !== "unavailable" && readStored(IDENTITY_KEY) !== identity) {
    identityChanged();
    return;
  }
  if (!identity && !busy && ["entry", "done", "result", "closed", "scheduled"].includes(view)) init();
}

const siteMenu = mountSiteMenu({ current: () => (atHome ? "home" : surveyId), onIdentityChange: identityUpdated });

// A troca feita nesta mesma aba por outro caminho (voltar pelo histórico com a
// conta já trocada) não gera evento de armazenamento: confere ao voltar a aparecer.
// Uma aba congelada também não recebe o que a outra guardou: confere junto.
function recheckIdentity() {
  if (view === "gate") {
    gateIdentityMoved();
    return;
  }
  if (identity && view !== "unavailable" && readStored(IDENTITY_KEY) !== identity) {
    identityChanged();
    return;
  }
  if (refreshHome()) return;
  followOtherTab();
}
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  // A capa que volta do histórico pode estar velha: a pessoa respondeu uma
  // pesquisa e tocou em voltar. Refaz, sem gravar nada.
  if (atHome && !busy && view === "entry") init();
  else recheckIdentity();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") recheckIdentity();
});

for (const name of ["online", "offline"]) {
  window.addEventListener(name, () => {
    const target = root.querySelector("#ps-offline");
    if (target) target.hidden = navigator.onLine !== false;
  });
}

// O sw.js não intercepta nada: só limpa caches de versões antigas.
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));

init();
