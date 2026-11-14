import "./install-error-reporter.js";
import "./photo-survey.css";
import ARTS from "./political-chromas.json" with { type: "json" };
import { photoSurveyById } from "../../shared/photo-survey.js";
import { createPlayer, drawPhotoSurvey, loadPhotoSurvey, respondPhotoSurvey } from "./api.js";
import { safeStorage } from "./safe-storage.js";
import {
  IDENTITY_NOTICE_COPY,
  identityNoticeFromError,
  isPlayerIssuanceLimit,
  quotaResetSentence,
} from "./identity-notice.js";
import {
  PHOTO_SURVEY_ID,
  PHOTO_SURVEY_STORAGE_KEY,
  chooseChampion,
  goBack,
  identityTag,
  pickCard,
  progressView,
  readSavedProgress,
  responseBody,
  restoreProgress,
  sampleCards,
  savedProgressText,
} from "./photo-survey-flow.js";

// Pesquisa por foto (ICM 68, #324). Abrir esta página não grava nada: o
// jogador e o sorteio nascem no toque em "Começar", e a resposta só vai para o
// servidor na confirmação. Até lá as escolhas ficam neste aparelho. Depois de
// registrada, o aparelho guarda só que a pessoa respondeu: a escolha vem
// sempre do servidor.

const IDENTITY_KEY = "polimatch:v3:recovery-key";
const SUBJECT = "Política";
const GRID_SIZES = "(max-width: 440px) 45vw, 198px";
const ADVANCE_MS = 220;
const GRID_TIMEOUT_MS = 12000;

const root = document.querySelector("#photo-survey");
const definition = photoSurveyById(PHOTO_SURVEY_ID);
const artById = new Map(ARTS.map((art) => [art.id, art]));
const entryCards = sampleCards(definition.cardIds.filter((id) => artById.has(id)), 3);

let survey = null;
let identity = "";
let progress = null;
let response = null;
let view = "loading";
let notice = "";
let busy = false;
// A confirmação foi enviada e não se sabe se chegou: até saber, não dá para trocar.
let uncertain = false;
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
const kicker = () => `${SUBJECT} · ${drawSize()} cartas`;
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

const savedRecord = () => readSavedProgress(readStored(PHOTO_SURVEY_STORAGE_KEY), PHOTO_SURVEY_ID);

function persist() {
  const text = savedProgressText(readStored(PHOTO_SURVEY_STORAGE_KEY), PHOTO_SURVEY_ID, {
    identity: identityTag(identity),
    progress,
    answered: Boolean(response),
  });
  safeStorage.set(PHOTO_SURVEY_STORAGE_KEY, text);
}

function forgetSaved() {
  safeStorage.set(PHOTO_SURVEY_STORAGE_KEY, savedProgressText(readStored(PHOTO_SURVEY_STORAGE_KEY), PHOTO_SURVEY_ID, {}));
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

function shell({ step, filled = null, mainClass = "", body, focus = false }) {
  gridToken += 1;
  const segments = screens() + 1;
  const bar = filled === null
    ? ""
    : `<div class="ps-bar" aria-hidden="true">${Array.from({ length: segments }, (_, index) => `<i${index < filled ? ' class="is-on"' : ""}></i>`).join("")}</div>`;
  root.innerHTML = `<div class="ps-shell" data-view="${view}">
    <header class="ps-top"><a class="ps-brand" href="./" aria-label="PoliMatch, página inicial">Poli<b>Match</b></a><span class="ps-step" id="ps-step">${escapeText(step)}</span></header>
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

const HOME_LINK = '<a href="./">Ir para o início</a>';
const retryButton = (action, label = "Tentar de novo") => `<button class="ps-link" data-action="${action}" type="button">${label}</button>`;

// Telas ---------------------------------------------------------------------

function renderEntry({ pending = "", action = "start", label = "Começar", focus = false } = {}) {
  const total = screens();
  shell({
    step: "Pesquisa",
    mainClass: "ps-main--entry",
    focus,
    body: `${heading(kicker(), question(), "Leva menos de um minuto.")}
      <div class="ps-fan" aria-hidden="true">${entryCards.map((id) => staticCard(id, "176px")).join("")}</div>
      <ul class="ps-list">
        <li><b>${total}</b><span>telas com ${escapeText(inWords(groupSize()))} cartas, um toque em cada.</span></li>
        <li><b>1</b><span>final com as suas ${escapeText(inWords(total))} escolhidas.</span></li>
        <li><b>✓</b><span>Sua escolha só é registrada quando você confirmar.</span></li>
      </ul>
      <div class="ps-stack"><button class="ps-btn" id="ps-action" data-action="${action}" type="button"${pending ? " disabled" : ""}>${escapeText(pending || label)}</button></div>`,
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
    focus,
    body: `${heading("Escolha registrada", champion ? cardName(champion) : "Sua resposta está registrada.", "Obrigado por participar. Sua resposta está registrada e não pode ser trocada nesta pesquisa.")}
      ${champion ? `<div class="ps-hero">${staticCard(champion, "176px")}</div>` : ""}
      ${others.length ? `<p class="ps-label">Suas finalistas</p><div class="ps-row">${others.map((id) => staticCard(id, "84px", cardName(id))).join("")}</div>` : ""}
      <div class="ps-stack"><a class="ps-btn ps-btn--ghost" href="./">Ir para o início</a></div>`,
  });
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
    body: `${heading("Pesquisa", copy[1], copy[2])}
      <div class="ps-stack"><a class="ps-btn ps-btn--ghost" href="./">Ir para o início</a></div>`,
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
      notice = `Não conseguimos carregar as cartas. Confira a conexão. ${retryButton("reload-cards")}`;
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
  return `Sua sessão precisa ser recuperada. Volte ao início, entre de novo e abra esta pesquisa outra vez. ${HOME_LINK}`;
}

/** A conta desta aba deixou de ser a que está salva: recomeça com a atual, com um toque. */
function identityChanged() {
  epoch += 1;
  busy = false;
  uncertain = false;
  window.clearTimeout(advanceTimer);
  identity = "";
  progress = null;
  response = null;
  view = "entry";
  notice = "Sua conta mudou. Toque em Continuar para seguir com a conta atual.";
  renderEntry({ label: "Continuar", focus: true });
}

/**
 * Abre ou retoma a pesquisa. `auto` é a retomada sem toque (abrir a página ou
 * outra aba confirmar): nela nunca se cria jogador nem se troca de identidade.
 */
async function start({ auto = false, retried = false } = {}) {
  if (busy) return;
  busy = true;
  notice = "";
  uncertain = false;
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
      const player = await createPlayer();
      if (run !== epoch) return;
      // Outra aba pode ter criado o jogador enquanto esta esperava: vale o que já está salvo.
      key = readStored(IDENTITY_KEY) || player.recoveryKey;
      if (key === player.recoveryKey) safeStorage.set(IDENTITY_KEY, key);
    }
    identity = key;
    result = await drawPhotoSurvey(PHOTO_SURVEY_ID, key);
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

function failStart(error) {
  if (error.status === 404) {
    renderStopped("unavailable", { focus: true });
    return;
  }
  if (error.status === 409 && error.code === "PHOTO_SURVEY_CLOSED") {
    renderClosed(error.body?.current?.status, { focus: true });
    return;
  }
  if (isPlayerIssuanceLimit(error)) {
    notice = `${escapeText(IDENTITY_NOTICE_COPY.quotaHeading)} Entre com Google na página inicial para responder agora. ${escapeText(quotaResetSentence(identityNoticeFromError(error).retryAt))} ${HOME_LINK}`;
    renderEntry({ focus: true });
    return;
  }
  if (error.status === 401) {
    notice = sessionNotice();
    renderEntry({ label: "Tentar de novo", focus: true });
    return;
  }
  const busyServer = error.status === 429 ? "Muitas tentativas agora. Espere um pouco e tente de novo." : "";
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
    result = await respondPhotoSurvey(PHOTO_SURVEY_ID, key, body);
  } catch (error) {
    if (run !== epoch) return;
    busy = false;
    failSubmit(error, key);
    return;
  }
  if (run !== epoch) return;
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
    renderClosed(error.body?.current?.status, { focus: true });
    return;
  }
  if (error.status === 404) {
    renderStopped("unavailable", { focus: true });
    return;
  }
  // Sem resposta, ou com falha do servidor, não dá para saber se foi gravada.
  // Até a nova tentativa responder, a escolha fica travada: trocar agora poderia
  // mostrar uma escolha e registrar outra.
  if (error.status === 0 || error.status >= 500) {
    uncertain = true;
    notice = "Não deu para saber se a sua resposta chegou. Toque em Tentar de novo para conferir: nada é registrado duas vezes.";
    renderPlay({ focus: true });
    return;
  }
  uncertain = false;
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
    // O recibo foi recusado: um recibo novo resolve, as escolhas continuam.
    progress = { ...progress, answerId: crypto.randomUUID() };
    persist();
    notice = "Não conseguimos registrar agora. Sua escolha continua aqui.";
    renderPlay({ focus: true });
    return;
  }
  if (error.code === "PHOTO_SURVEY_RESPONSE_INVALID" || error.code === "PHOTO_SURVEY_DRAW_REQUIRED") {
    // A resposta não bate com o sorteio guardado no servidor (o jogador ativo
    // da conta pode ter mudado): busca o sorteio de novo e recomeça com ele.
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

async function init() {
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
    survey = await loadPhotoSurvey(PHOTO_SURVEY_ID);
  } catch (error) {
    if (run !== epoch) return;
    if (error.status === 404) {
      renderStopped("unavailable");
      return;
    }
    view = "entry";
    notice = error.status === 0
      ? "Não conseguimos falar com o servidor. Confira a conexão."
      : "O servidor não respondeu como esperado. Tente de novo em instantes.";
    renderEntry({ action: "init", label: "Tentar de novo" });
    return;
  }
  if (run !== epoch) return;
  if (survey?.status !== "open") {
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
  else if (action === "reload-cards" && view === "play" && !busy) {
    notice = "";
    imageRetry += 1;
    renderPlay({ focus: true });
  }
});

window.addEventListener("storage", (event) => {
  if (event.key === IDENTITY_KEY || event.key === null) {
    if (identity && readStored(IDENTITY_KEY) !== identity && view !== "unavailable") identityChanged();
    return;
  }
  // Outra aba deste aparelho confirmou a resposta desta identidade: esta aba
  // busca a resposta no servidor em vez de seguir com a tela de voto.
  if (event.key === PHOTO_SURVEY_STORAGE_KEY && view === "play") {
    const saved = readSavedProgress(event.newValue, PHOTO_SURVEY_ID);
    if (saved?.answered && saved.identity === identityTag(identity)) {
      epoch += 1;
      busy = false;
      uncertain = false;
      window.clearTimeout(advanceTimer);
      progress = null;
      start({ auto: true });
    }
  }
});

// A troca feita nesta mesma aba (ir ao início, entrar com Google e voltar pelo
// histórico) não gera evento de armazenamento: confere ao voltar a aparecer.
function recheckIdentity() {
  if (identity && view !== "unavailable" && readStored(IDENTITY_KEY) !== identity) identityChanged();
}
window.addEventListener("pageshow", (event) => {
  if (event.persisted) recheckIdentity();
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

init();
