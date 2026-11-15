import "./install-error-reporter.js";
import "./photo-survey.css";
import "./site-menu.css";
import ARTS from "./political-chromas.json" with { type: "json" };
import { PHOTO_SURVEYS, photoSurveyById } from "../../shared/photo-survey.js";
import { createPlayer, drawPhotoSurvey, loadPhotoSurvey, respondPhotoSurvey } from "./api.js";
import { safeStorage } from "./safe-storage.js";
import { identityNoticeFromError, isPlayerIssuanceLimit, quotaResetLabel } from "./identity-notice.js";
import {
  ENTRY_CARD_IDS,
  PHOTO_SURVEY_STORAGE_KEY,
  answeredSurveyIds,
  chooseChampion,
  featuredSurveyId,
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
import { shareChoice, shareImage } from "./share-choice.js";
import { accountKind, menuButtonMarkup, mountSiteMenu, upcomingMarkup } from "./site-menu.js";

// Pesquisa por foto (ICM 68, #324), que desde a ICM 69 (#331) é a capa do
// site. Abrir esta página não grava nada: o
// jogador e o sorteio nascem no toque em "Começar", e a resposta só vai para o
// servidor na confirmação. Até lá as escolhas ficam neste aparelho. Depois de
// registrada, o aparelho guarda só que a pessoa respondeu: a escolha vem
// sempre do servidor.
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
const artById = new Map(ARTS.map((art) => [art.id, art]));

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
  if (!fans.has(surveyId)) fans.set(surveyId, sampleCards(ENTRY_CARD_IDS.filter((id) => artById.has(id)), 3));
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
const heading = (eyebrow, title, hint) => `<p class="ps-kicker">${escapeText(eyebrow)}</p><h1 class="ps-title" id="ps-title" tabindex="-1" aria-describedby="ps-step">${escapeText(title)}</h1><p class="ps-hint">${escapeText(hint)}</p>${noticeMarkup()}${offlineMarkup()}`;

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
    ? `${heading(kicker(), question(), atHome && homeResume ? "Você parou no meio. Continue de onde parou." : "Leva menos de um minuto.")}
      <div class="ps-fan" aria-hidden="true">${entryCards().map((id) => staticCard(id, "176px")).join("")}</div>
      <div class="ps-cta"><button class="ps-btn" id="ps-action" data-action="${action}" type="button"${pending ? " disabled" : ""}>${escapeText(pending || label)}</button>
        <p class="ps-muted ps-cta-note">Sua escolha só é registrada quando você confirmar.</p></div>`
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
      body: `${heading(`As suas ${inWords(total)} escolhas`, "Entre elas, quem fica?", "Um toque decide.")}
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
      <p class="ps-label">Suas finalistas</p>
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
      ${others.length ? `<p class="ps-label">Suas finalistas</p><div class="ps-row">${others.map((id) => staticCard(id, "84px", cardName(id))).join("")}</div>` : ""}
      <div class="ps-stack ps-stack--pair">${champion ? '<button class="ps-btn" data-action="share" type="button">Compartilhar minha escolha</button>' : ""}${nextLink()}</div>`,
  });
  prepareShare(champion);
}

// Compartilhar --------------------------------------------------------------

// A imagem é montada quando a tela aparece. Assim o toque chama o
// compartilhamento do aparelho na hora, como os navegadores exigem; se a
// imagem ainda não está pronta, vai só o texto.
let shareFile = null;
let sharing = false;

function prepareShare(champion) {
  shareFile = null;
  if (!champion) return;
  const art = artById.get(champion);
  const largest = art.srcset.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]).pop() || art.src;
  shareImage({ src: largest, name: art.name, question: question() }).then((file) => {
    const button = root.querySelector('[data-action="share"]');
    if (view !== "done" || response?.championId !== champion || !button) return;
    shareFile = file;
    button.dataset.ready = file ? "true" : "text";
  });
}

/** Só acontece no toque. Leva a escolha da pessoa, nunca resultado somado. */
async function share() {
  const champion = response?.championId;
  if (view !== "done" || sharing || !artById.has(champion)) return;
  sharing = true;
  const outcome = await shareChoice({ surveyId, name: cardName(champion), question: question(), file: shareFile });
  sharing = false;
  if (view !== "done") return;
  const text = {
    copied: "Link copiado. Cole onde quiser compartilhar.",
    unavailable: "Este navegador não compartilha por aqui. O endereço é polimatch.com.br.",
    failed: "Não deu para compartilhar agora. Tente de novo.",
  }[outcome];
  // Compartilhou ou fechou a folha: nada a dizer, e o aviso que estiver na tela fica.
  if (!text) return;
  notice = text;
  const target = root.querySelector("#ps-notice");
  if (!target) return;
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
 * toque cria um jogador novo, e o texto diz isso. `recorded`: a confirmação
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
    signedOut ? "Toque em Começar para responder sem conta." : "Toque em Continuar para seguir com a conta atual.",
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

async function start({ auto = false, retried = false } = {}) {
  if (busy || !surveyId) return;
  leaveHome();
  busy = true;
  notice = "";
  uncertain = false;
  switched = false;
  const run = ++epoch;
  view = "entry";
  if (resumable()) renderOpening();
  else renderEntry({ pending: "Abrindo…" });
  let key = readStored(IDENTITY_KEY);
  if (!key && auto) {
    busy = false;
    init();
    return;
  }
  let result;
  try {
    if (!key) {
      // A entrada pode estar aberta há muito tempo. Antes de criar o jogador,
      // que gasta a cota de jogos novos da rede, confere se a pesquisa segue aberta.
      survey = await loadPhotoSurvey(surveyId);
      if (run !== epoch) return;
      if (survey?.status !== "open") {
        busy = false;
        renderClosed(survey?.status, { focus: true });
        return;
      }
      // A pessoa pode ter entrado com Google pelo menu enquanto a pesquisa
      // era lida: com a conta no aparelho não nasce jogador anônimo.
      key = readStored(IDENTITY_KEY);
      if (!key) {
        const player = await createPlayer();
        if (run !== epoch) return;
        // Outra aba pode ter criado o jogador enquanto esta esperava: vale o que já está salvo.
        key = readStored(IDENTITY_KEY) || player.recoveryKey;
        if (key === player.recoveryKey) safeStorage.set(IDENTITY_KEY, key);
      }
    }
    identity = key;
    result = await drawPhotoSurvey(surveyId, key);
  } catch (error) {
    if (run !== epoch) return;
    busy = false;
    if (error.status === 401 && readStored(IDENTITY_KEY) !== key) {
      // A identidade mudou no meio do pedido. Sem toque, só o aviso.
      if (auto || retried) identityChanged();
      else start({ retried: true });
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
  if (isPlayerIssuanceLimit(error)) {
    notice = `Muitas participações novas nesta rede hoje. Entre com Google no menu para responder agora. Novas participações nesta rede voltam a ser liberadas ${escapeText(quotaResetLabel(identityNoticeFromError(error).retryAt))}. ${MENU_LINK}`;
    renderEntry({ focus: true });
    return;
  }
  if (error.status === 401) {
    // Com a pesquisa fechada não há o que recuperar: vale a tela de fechada.
    if (survey && survey.status !== "open") {
      renderClosed(survey.status, { focus: true });
      return;
    }
    notice = sessionNotice();
    renderEntry({ label: "Tentar de novo", focus: true });
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
  const tag = identityTag(key);
  const saved = readStored(PHOTO_SURVEY_STORAGE_KEY);
  const answered = answeredSurveyIds(saved, tag);
  const pending = inProgressSurveyId(saved, tag);
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
  if (!key) return;
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

async function openSurvey() {
  view = "loading";
  notice = "";
  // Quem já começou nesta identidade vai direto ao sorteio, que também diz se
  // a pesquisa continua aberta.
  if (resumable()) {
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
    // Fechada: quem já respondeu com a identidade deste aparelho ainda vê a
    // própria resposta. Com a pesquisa fechada o sorteio não grava nada.
    if (survey?.status === "closed" && readStored(IDENTITY_KEY)) {
      start({ auto: true });
      return;
    }
    renderClosed(survey?.status);
    return;
  }
  view = "entry";
  renderEntry();
}

root.addEventListener("click", (event) => {
  const card = event.target.closest("button[data-card]");
  if (card) {
    choose(card.dataset.card, card);
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "start") start();
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
    if (identity && readStored(IDENTITY_KEY) !== identity && view !== "unavailable") identityChanged();
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
