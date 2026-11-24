import "./install-error-reporter.js";
import "./photo-survey.css";
import "./site-menu.css";
import CLOTHES from "./clothes-cards.json" with { type: "json" };
import ARTS from "./political-chromas.json" with { type: "json" };
import { PHOTO_SURVEYS, photoSurveyById } from "../../shared/photo-survey.js";
import { formatCpf } from "../../shared/registration.js";
import { signInWithGoogleCredential } from "./account-session.js";
import { drawPhotoSurvey, loadPhotoSurvey, registerCpf, respondPhotoSurvey } from "./api.js";
import { googleClientId, mountGoogleButton } from "./google-login.js";
import { safeStorage } from "./safe-storage.js";
import {
  PHOTO_SURVEY_STORAGE_KEY,
  answeredSurveyIds,
  chooseChampion,
  entryCardIdsFor,
  featuredSurveyId,
  finalTitleFor,
  goBack,
  identityTag,
  inProgressSurveyId,
  nextSurveyId,
  pickCard,
  progressView,
  readSavedProgress,
  responseBody,
  restoreProgress,
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
import { shareChoice, shareImage, sharePlan, sharePreviewMarkup } from "./share-choice.js";
import { accountKind, menuButtonMarkup, mountSiteMenu, upcomingMarkup } from "./site-menu.js";

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

const IDENTITY_KEY = "polimatch:v3:recovery-key";
const GRID_SIZES = "(max-width: 440px) 45vw, 198px";
const ADVANCE_MS = 220;
const GRID_TIMEOUT_MS = 12000;

const root = document.querySelector("#photo-survey");
// As cartas de todas as pesquisas: as de política e as de roupas (ICM 73, #345).
const artById = new Map([...ARTS, ...CLOTHES].map((art) => [art.id, art]));

// A pesquisa na tela. Na capa é a pesquisa em destaque; "" quando não há uma.
let surveyId = "";
let definition = PHOTO_SURVEYS[0];
// A capa: o endereço sem `?p=`. Abaixo da entrada vêm as listas de pesquisas.
let atHome = false;
// O que a capa leu: as visões públicas das pesquisas e, para as que esta
// identidade já respondeu, a resposta (null enquanto não chega).
let homeViews = [];
const homeChoices = new Map();
// A identidade com que a capa foi montada, e se o destaque é uma pesquisa que
// a pessoa deixou pela metade neste aparelho.
let homeKey = "";
let homeResume = false;
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
const question = () => (typeof survey?.question === "string" && survey.question) || definition.question;
// A observação da pesquisa, quando ela tem uma. As de política não têm.
const surveyNote = () => (typeof survey?.note === "string" && survey.note) || definition.note;

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

function persist() {
  const text = savedProgressText(readStored(PHOTO_SURVEY_STORAGE_KEY), surveyId, {
    identity: identityTag(identity),
    progress,
    answered: Boolean(response),
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
const heading = (eyebrow, title, hint, note = "") => `<p class="ps-kicker">${escapeText(eyebrow)}</p><h1 class="ps-title" id="ps-title" tabindex="-1" aria-describedby="ps-step">${escapeText(title)}</h1><p class="ps-hint">${escapeText(hint)}</p>${note ? `<p class="ps-note">${escapeText(note)}</p>` : ""}${noticeMarkup()}${offlineMarkup()}`;

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

function choiceRow(id) {
  const base = photoSurveyById(id);
  const answer = homeChoices.get(id);
  const champion = artById.has(answer?.championId) ? answer.championId : "";
  return `<a class="ps-pick" href="${surveyHref(id)}" data-survey="${escapeText(id)}">${champion ? staticCard(champion, "44px") : '<span class="ps-card" aria-hidden="true"></span>'}<span class="ps-survey-text"><small>${escapeText(base.subject)} · ${escapeText(base.question)}</small><b>${champion ? escapeText(cardName(champion)) : "Ver a sua escolha"}</b></span><i aria-hidden="true">›</i></a>`;
}

/** As listas da capa: o que a pessoa já escolheu, as outras pesquisas e as que vêm. */
function homeSections() {
  const chosen = homeViews.filter((view) => homeChoices.has(view.id));
  const others = homeViews.filter((view) => view.id !== surveyId && !homeChoices.has(view.id));
  return `${chosen.length ? `<p class="ps-label ps-home-label">Suas escolhas</p>${chosen.map((view) => choiceRow(view.id)).join("")}` : ""}
    ${others.length ? `<p class="ps-label ps-home-label">Mais pesquisas</p>${others.map(surveyRow).join("")}` : ""}
    <p class="ps-label ps-home-label">Em breve</p>${upcomingMarkup()}`;
}

/**
 * A entrada de uma pesquisa. Na capa ela é a da pesquisa em destaque e leva
 * as listas embaixo; sem destaque (tudo respondido, ou nada aberto), só o
 * título e as listas.
 */
function renderEntry({ pending = "", action = "start", label = atHome && homeResume ? "Continuar" : "Começar", focus = false } = {}) {
  const featured = surveyId
    ? `${heading(kicker(), question(), atHome && homeResume ? "Você parou no meio. Continue de onde parou." : "Leva menos de um minuto.", surveyNote())}
      <div class="ps-fan" aria-hidden="true">${entryCards().map((id) => staticCard(id, "176px")).join("")}</div>
      <div class="ps-cta"><button class="ps-btn" id="ps-action" data-action="${action}" type="button"${pending ? " disabled" : ""}>${escapeText(pending || label)}</button>
        <p class="ps-muted ps-cta-note">${signedIn() ? "Sua escolha só é registrada quando você confirmar." : "Para responder, entre com Google e cadastre o CPF."}</p></div>`
    : heading("Pesquisas", homeViews.some((view) => view.status === "open") ? "Você respondeu todas as pesquisas abertas." : "Nenhuma pesquisa aberta agora.", "Quando abrir outra, ela aparece aqui.");
  shell({
    step: "Pesquisa",
    mainClass: `ps-main--entry${atHome ? " ps-main--home" : ""}`,
    focus,
    body: `${featured}${atHome ? `<div class="ps-home">${homeSections()}</div>` : '<p class="ps-more"><a class="ps-link" href="./">Todas as pesquisas</a></p>'}`,
  });
}

/** Quem retoma não vê a entrada de novo: vê a tela de voto se formando. */
function renderOpening() {
  shell({
    step: "Pesquisa",
    filled: 0,
    mainClass: "ps-main--play",
    body: `${heading(kicker(), question(), "Abrindo de onde você parou…")}
      <div class="ps-grid" data-ready="false" aria-hidden="true">${Array.from({ length: groupSize() }, () => '<span class="ps-card"></span>').join("")}</div>`,
  });
}

function renderPlay({ focus = false, sending = false } = {}) {
  const current = progressView(progress);
  const total = screens();
  if (current.kind === "vote") {
    shell({
      step: `Tela ${current.screen + 1} de ${current.screens}`,
      filled: current.screen + 1,
      mainClass: "ps-main--play",
      focus,
      body: `${heading(kicker(), question(), "Toque em uma carta.")}
        ${choiceGrid(current.cards, current.selectedId)}
        <div class="ps-foot">${current.screen > 0 ? '<button class="ps-link" data-action="back" type="button">← Voltar</button>' : ""}<span class="ps-muted">${footHint("Dá para voltar e trocar antes de terminar.")}</span></div>`,
    });
    preload(progress.groups[current.screen + 1]);
    return;
  }
  if (current.kind === "final") {
    shell({
      step: "Final",
      filled: total + 1,
      mainClass: "ps-main--play",
      focus,
      body: `${heading(`As suas ${inWords(total)} escolhas`, finalTitleFor(definition), "Um toque decide.")}
        ${choiceGrid(current.cards, current.selectedId)}
        <div class="ps-foot"><button class="ps-link" data-action="back" type="button">← Voltar</button><span class="ps-muted">${footHint("Você confirma na próxima tela.")}</span></div>`,
    });
    return;
  }
  const locked = sending || uncertain;
  shell({
    step: "Confirmar",
    filled: total + 1,
    mainClass: "ps-main--summary",
    fit: true,
    focus,
    body: `${heading("Sua escolha", cardName(current.championId), "Confira antes de registrar. Depois não dá para votar de novo nesta pesquisa.")}
      <div class="ps-hero">${staticCard(current.championId, "176px")}</div>
      <p class="ps-label">Também na final</p>
      <div class="ps-row">${current.otherIds.map((id) => staticCard(id, "84px", cardName(id))).join("")}</div>
      <div class="ps-stack ps-stack--pair">
        <button class="ps-btn" data-action="confirm" type="button"${sending ? " disabled" : ""}>${sending ? "Registrando…" : notice ? "Tentar de novo" : "Confirmar minha escolha"}</button>
        <button class="ps-btn ps-btn--ghost" data-action="back" type="button"${locked ? " disabled" : ""}>Voltar e trocar</button>
      </div>`,
  });
}

function renderDone({ focus = false } = {}) {
  view = "done";
  const picks = Array.isArray(response?.pickIds) ? response.pickIds.filter((id) => artById.has(id)) : [];
  const champion = artById.has(response?.championId) ? response.championId : "";
  const others = picks.filter((id) => id !== champion);
  shell({
    step: "Registrada",
    filled: screens() + 1,
    mainClass: "ps-main--summary",
    fit: true,
    focus,
    body: `${heading("Escolha registrada", champion ? cardName(champion) : "Sua resposta está registrada.", "Obrigado por participar. Sua resposta está registrada e não pode ser trocada nesta pesquisa.")}
      ${champion ? `<div class="ps-hero">${staticCard(champion, "176px")}</div>` : ""}
      ${others.length ? `<p class="ps-label">Também na final</p><div class="ps-row">${others.map((id) => staticCard(id, "84px", cardName(id))).join("")}</div>` : ""}
      <div class="ps-stack ps-stack--pair">${champion ? '<button class="ps-btn" data-action="share" type="button" aria-label="Compartilhar minha escolha" aria-busy="true" disabled>Compartilhar</button>' : ""}${nextLink()}</div>`,
  });
  prepareShare(champion, others);
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
  const current = () => run === shareRun && view === "done" && response?.championId === champion;
  const release = () => {
    const button = root.querySelector('[data-action="share"]');
    if (!current() || !button) return;
    button.dataset.ready = shareFile ? "true" : "text";
    button.disabled = false;
    button.removeAttribute("aria-busy");
  };
  // O prazo é desta preparação: outra tela não o apaga.
  const timer = window.setTimeout(release, SHARE_PREPARE_MS);
  shareImage({
    src: art.src,
    name: art.name,
    question: question(),
    others: others.map((id) => ({ src: artById.get(id).src })),
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
  const champion = response?.championId;
  if (view !== "done" || !artById.has(champion)) return;
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
  if (view === "done" && outcome === "failed") openSharePreview();
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
    canShareLink: typeof navigator.share === "function",
  });
  sharePreview.focus({ preventScroll: true });
}

function openSharePreview() {
  if (!artById.has(response?.championId) || sharePreviewOpen()) return;
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
  const champion = response?.championId;
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

function applyDraw(result) {
  survey = result?.survey || survey;
  const groups = result?.draw?.groups;
  if (result?.response) {
    response = result.response;
    progress = null;
    persist();
    renderDone({ focus: true });
    return;
  }
  if (survey?.status !== "open") {
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
  // As escolhas salvas só voltam se o sorteio for o mesmo, seja qual for a identidade.
  progress = restoreProgress(savedRecord()?.progress, groups);
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
  const wasDone = view === "done";
  epoch += 1;
  busy = false;
  uncertain = false;
  window.clearTimeout(advanceTimer);
  identity = "";
  progress = null;
  response = null;
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
    progress = null;
    notice = "";
    persist();
    renderDone({ focus: true });
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

/**
 * Abre ou retoma a pesquisa. `auto` é a retomada sem toque (abrir a página ou
 * outra aba confirmar): nela nunca se cria jogador nem se troca de identidade.
 */
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

async function start({ auto = false, retried = false, fromGate = false } = {}) {
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
  else {
    view = "entry";
    if (resumable()) renderOpening();
    else renderEntry({ pending: "Abrindo…" });
  }
  identity = key;
  let result;
  try {
    result = await drawPhotoSurvey(surveyId, key);
  } catch (error) {
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
      // A identidade mudou no meio do pedido. Sem toque, só o aviso.
      if (auto || retried) identityChanged();
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
    failStart(error);
    return;
  }
  if (run !== epoch) return;
  busy = false;
  applyDraw(result);
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
    notice = `${busyServer || "Não conseguimos falar com o servidor para mostrar a sua escolha."} ${retryButton("start")}`;
    renderDone({ focus: true });
    return;
  }
  notice = busyServer || (saved
    ? "Não conseguimos abrir a pesquisa agora. Suas escolhas continuam neste aparelho."
    : "Não conseguimos abrir a pesquisa agora. Nenhuma escolha foi registrada.");
  renderEntry({ label: "Tentar de novo", focus: true });
}

async function submit() {
  const body = responseBody(progress);
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
  progress = null;
  persist();
  renderDone({ focus: true });
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
    persist();
    notice = "Você já tinha respondido esta pesquisa. Vale a primeira resposta, que é esta.";
    renderDone({ focus: true });
    return;
  }
  if (error.status === 409 && error.code === "PHOTO_SURVEY_CLOSED") {
    uncertain = false;
    stoppedByServer(error);
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
 * A capa. Lê a definição de cada pesquisa (uma leitura por pesquisa, sem
 * identidade) e escolhe o destaque. Só para o que este aparelho sabe
 * respondido, ou para uma pesquisa já fechada, busca a resposta da pessoa:
 * nesses dois casos o pedido de sorteio não grava nada.
 */
async function openHome() {
  view = "loading";
  notice = "";
  survey = null;
  identity = "";
  const key = readStored(IDENTITY_KEY);
  // Só uma conta Google responde. O que este aparelho guardou de uma chave
  // sem conta não vale como "respondida" nem como "pela metade": a capa
  // convida a entrar, em vez de dizer que não há o que responder.
  const account = accountKind(key) === "google";
  const tag = identityTag(key);
  const saved = readStored(PHOTO_SURVEY_STORAGE_KEY);
  const answered = account ? answeredSurveyIds(saved, tag) : [];
  const pending = account ? inProgressSurveyId(saved, tag) : "";
  homeKey = key;
  homeResume = false;
  homeViews = [];
  homeChoices.clear();
  useSurvey(pending || nextSurveyId("", answered) || PHOTO_SURVEYS[0].id);
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
  for (const id of answered) if (homeViews.some((item) => item.id === id)) homeChoices.set(id, null);
  // A pesquisa que ficou pela metade vem primeiro, se ainda estiver aberta.
  homeResume = homeViews.some((item) => item.id === pending && item.status === "open");
  const featured = homeResume ? pending : featuredSurveyId(homeViews, answered);
  useSurvey(featured);
  survey = homeViews.find((item) => item.id === featured) || null;
  view = "entry";
  renderEntry();
  // Só uma conta Google pode ter resposta para mostrar: sem ela o servidor recusa.
  if (accountKind(key) !== "google") return;
  const wanted = homeViews.filter((item) => homeChoices.has(item.id) || item.status === "closed").map((item) => item.id);
  await Promise.all(wanted.map(async (id) => {
    try {
      const result = await drawPhotoSurvey(id, key);
      // A capa pode ter sido refeita para outra identidade enquanto isto viajava.
      if (run === epoch && result?.response) homeChoices.set(id, result.response);
    } catch {
      // Sem a resposta, a linha fica sem a carta e leva à tela da pesquisa.
    }
  }));
  // Só as listas são refeitas: o destaque e o foco ficam como estão.
  const lists = root.querySelector(".ps-home");
  if (run === epoch && atHome && view === "entry" && lists) lists.innerHTML = homeSections();
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
      body: `${heading("Cadastro", "Faça seu voto contar", "Um CPF, um voto. Só o resultado somado aparece, nunca o seu nome.")}${registrationFormMarkup({ form, busy, invalid: invalidField })}`,
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
    body: `${heading("Para responder", "Entre para responder", "Um CPF, um voto. Entre com Google e faça o seu cadastro.")}${signInMarkup({ googleReady, busy })}`,
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
  // de seguir com a tela de voto.
  if (saved.answered) {
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
  const next = restoreProgress(saved.progress, progress.groups);
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
  if (!identity && !busy && ["entry", "done", "closed", "scheduled"].includes(view)) init();
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
