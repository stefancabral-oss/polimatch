import "./install-error-reporter.js";
import "./photo-survey.css";
import "./site-menu.css";
import CELEBRITIES from "./celebrity-cards.json" with { type: "json" };
import CLOTHES from "./clothes-cards.json" with { type: "json" };
import ARTS from "./political-chromas.json" with { type: "json" };
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { PROFILE_CONSENT_TEXT, PROFILE_CONSENT_VERSION, normalizeHandle } from "../../shared/profile.js";
import { IDENTITY_KEY, readIdentityKey } from "./account-session.js";
import { loadMyProfile, saveMyProfile } from "./api.js";
import { enableBody, enableProblem, profileLink, profileRefusal, profileState } from "./profile-view.js";
import { accountKind, mountSiteMenu } from "./site-menu.js";

// "Meu perfil" (ICM 76, #354, decisão 0008). A versão do perfil que só a
// própria pessoa vê: ligado ou desligado, o nome de perfil, as pesquisas
// marcadas e, ligado, o link para copiar. O perfil nasce desligado e, ao
// ligar, nenhuma pesquisa vem marcada. Ligar pede o aceite próprio do perfil,
// com o texto por extenso; desligar não pede nada e vale na hora.
//
// Abrir a página só lê. Só os toques em "Ligar meu perfil", "Salvar
// marcações" e "Desligar" gravam.

const main = document.querySelector("#pf-main");
const artById = new Map([...ARTS, ...CELEBRITIES, ...CLOTHES].map((art) => [art.id, art]));
const REGISTER_HREF = `./?p=${encodeURIComponent(PHOTO_SURVEYS[0].id)}`;

const escapeText = (value = "") => String(value).replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
);

// `phase`: "loading", "signedout", "failed" ou "ready".
let phase = "loading";
let profile = null;
// O que a pessoa preenche fica só na memória desta página.
let form = { handle: "", surveys: new Set(), consent: false };
let busy = false;
// `notice` é texto de aviso (recusa ou falha); `done`, a confirmação do que foi salvo.
let notice = "";
let done = "";
let invalid = "";
let copied = "";
let run = 0;
// A sessão com que a página foi montada.
let owner = "";

const thumb = (id) => {
  const art = artById.get(id);
  return `<span class="ps-card" aria-hidden="true"><img src="${escapeText(art.src)}" srcset="${escapeText(art.srcset)}" sizes="40px" width="${art.width}" height="${art.height}" alt="" decoding="async" draggable="false"></span>`;
};

const noticeMarkup = () => `<p class="ps-notice" id="pf-notice" role="alert"${notice ? "" : " hidden"}>${escapeText(notice)}</p>`;
const doneMarkup = () => `<p class="ps-done-note" id="pf-done" role="status"${done ? "" : " hidden"}>${escapeText(done)}</p>`;

function head(title, hint) {
  return `<p class="ps-kicker">Meu perfil</p><h1 class="ps-title" id="ps-title" tabindex="-1">${escapeText(title)}</h1><p class="ps-hint">${escapeText(hint)}</p>${noticeMarkup()}${doneMarkup()}`;
}

/** As pesquisas para marcar, na ordem do site, com a primeira colocada da pessoa quando ela tem. */
function marksMarkup() {
  const rows = PHOTO_SURVEYS.map((survey) => {
    const first = profile.firstPlaces.get(survey.id) || "";
    const status = first
      ? `Seu 1º lugar: ${escapeText(artById.get(first).name)}`
      : "Você ainda não respondeu. Só aparece depois da primeira rodada.";
    return `<label class="ps-mark">${first ? thumb(first) : '<span class="ps-card" aria-hidden="true"></span>'}<span class="ps-survey-text"><small>${escapeText(survey.subject)}</small><b>${escapeText(survey.question)}</b><small>${status}</small></span><input type="checkbox" name="survey" value="${escapeText(survey.id)}"${form.surveys.has(survey.id) ? " checked" : ""}${busy ? " disabled" : ""}></label>`;
  }).join("");
  return `<fieldset class="ps-fieldset"><legend>Pesquisas no perfil</legend>${rows}</fieldset>`;
}

const consentMarkup = () => `<label class="ps-check"${invalid === "consent" ? ' aria-invalid="true"' : ""}><input type="checkbox" id="pf-consent"${form.consent ? " checked" : ""}${busy ? " disabled" : ""}${invalid === "consent" ? ' aria-describedby="pf-notice"' : ""}><span>${escapeText(PROFILE_CONSENT_TEXT)}</span></label>`;

function render({ focus = false, target = "" } = {}) {
  if (phase === "loading") {
    main.innerHTML = head("Meu perfil", "Carregando…");
  } else if (phase === "signedout") {
    main.innerHTML = `${head("Meu perfil", "Entre com Google pelo menu para ver e ligar o seu perfil.")}<div class="ps-stack"><button class="ps-btn" type="button" data-action="menu">Abrir o menu</button></div>`;
  } else if (phase === "failed") {
    main.innerHTML = `${head("Meu perfil", "Não deu para carregar o seu perfil.")}<div class="ps-stack"><button class="ps-btn" type="button" data-action="reload">Tentar de novo</button></div>`;
  } else if (!profile.enabled && !profile.canEnable) {
    main.innerHTML = `${head("Seu perfil está desligado", "Para ligar o perfil, falta o cadastro com CPF. Ele é feito na primeira vez que você responde uma pesquisa: abra uma e toque em Começar.")}<div class="ps-stack"><a class="ps-btn" href="${REGISTER_HREF}">Fazer o cadastro</a></div>`;
  } else if (!profile.enabled) {
    main.innerHTML = `${head("Seu perfil está desligado", "Ninguém vê as suas escolhas. Se você ligar, quem tiver o link vê a sua primeira colocada nas pesquisas que você marcar.")}
      <form class="ps-profile-form" id="pf-form" novalidate>
        <div class="ps-field"><label for="pf-handle">Nome de perfil</label>
          <div class="ps-handle"${invalid === "handle" ? ' aria-invalid="true"' : ""}><span aria-hidden="true">@</span><input id="pf-handle" name="handle" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20" value="${escapeText(form.handle)}"${busy ? " disabled" : ""}${invalid === "handle" ? ' aria-invalid="true" aria-describedby="pf-notice pf-handle-help"' : ' aria-describedby="pf-handle-help"'}></div>
          <small id="pf-handle-help">De 3 a 20 letras sem acento, números ou _. Aparece no link e no perfil.</small></div>
        ${marksMarkup()}
        ${consentMarkup()}
        <div class="ps-stack"><button class="ps-btn" type="submit"${busy ? " disabled" : ""}>${busy ? "Ligando…" : "Ligar meu perfil"}</button></div>
      </form>`;
  } else {
    const link = profileLink(profile.handle);
    const outdated = profile.consentVersion !== PROFILE_CONSENT_VERSION;
    main.innerHTML = `${head("Seu perfil está ligado", "Quem tiver o link vê a sua primeira colocada nas pesquisas marcadas. Pesquisa sem marca não aparece.")}
      <div class="ps-link-box"><output id="pf-link">${escapeText(link)}</output>
        <button class="ps-btn ps-btn--ghost" type="button" data-action="copy">Copiar link</button>
        <p class="ps-muted" id="pf-copied" role="status"${copied ? "" : " hidden"}>${escapeText(copied)}</p>
        <a class="ps-link" href="./perfil.html?u=${encodeURIComponent(profile.handle)}">Ver como os outros veem</a></div>
      <form class="ps-profile-form" id="pf-form" novalidate>
        ${marksMarkup()}
        ${outdated ? consentMarkup() : ""}
        <div class="ps-stack ps-stack--pair"><button class="ps-btn" type="submit"${busy ? " disabled" : ""}>${busy ? "Salvando…" : "Salvar marcações"}</button>
          <button class="ps-btn ps-btn--ghost" type="button" data-action="disable"${busy ? " disabled" : ""}>Desligar</button></div>
      </form>`;
  }
  if (target) {
    window.scrollTo(0, 0);
    main.querySelector(target)?.focus({ preventScroll: true });
  } else if (focus) {
    window.scrollTo(0, 0);
    main.querySelector("#ps-title")?.focus({ preventScroll: true });
  }
}

function useProfile(raw) {
  profile = profileState(raw, (id) => artById.has(id));
  form = { handle: profile.handle, surveys: new Set(profile.surveys), consent: false };
}

async function load() {
  const key = readIdentityKey();
  owner = key;
  const mine = ++run;
  busy = false;
  notice = "";
  done = "";
  invalid = "";
  copied = "";
  if (accountKind(key) !== "google") {
    phase = "signedout";
    render({ focus: true });
    return;
  }
  phase = "loading";
  render();
  try {
    const raw = await loadMyProfile(key);
    if (mine !== run) return;
    useProfile(raw);
    phase = "ready";
  } catch (error) {
    if (mine !== run) return;
    phase = "failed";
    notice = profileRefusal(error).text;
  }
  render({ focus: true });
}

async function save(body, doneText) {
  const key = readIdentityKey();
  if (key !== owner) {
    // A conta mudou em outra aba: nada é salvo na conta errada.
    load();
    return;
  }
  busy = true;
  notice = "";
  done = "";
  copied = "";
  const mine = ++run;
  render();
  try {
    const raw = await saveMyProfile(key, body);
    if (mine !== run) return;
    busy = false;
    invalid = "";
    useProfile(raw);
    done = doneText;
    render({ target: "#pf-done" });
  } catch (error) {
    if (mine !== run) return;
    busy = false;
    const refusal = profileRefusal(error);
    if (refusal.next === "register") profile = { ...profile, enabled: false, canEnable: false };
    notice = refusal.text;
    invalid = refusal.field;
    render({ target: refusal.field === "handle" ? "#pf-handle" : refusal.field === "consent" ? "#pf-consent" : "#ps-title" });
  }
}

function submit() {
  if (busy || phase !== "ready") return;
  if (profile.enabled) {
    const outdated = profile.consentVersion !== PROFILE_CONSENT_VERSION;
    if (outdated && !form.consent) {
      notice = enableProblem({ handle: profile.handle, consent: false }).text;
      invalid = "consent";
      done = "";
      render({ target: "#pf-consent" });
      return;
    }
    // Ligado, o aceite da versão atual já foi dado: ele vai de novo, porque o
    // servidor só aceita `enabled: true` com a versão atual do aceite.
    save(enableBody({ handle: profile.handle, surveys: [...form.surveys], consent: true, consentVersion: PROFILE_CONSENT_VERSION }), "Marcações salvas.");
    return;
  }
  const problem = enableProblem(form);
  if (problem) {
    // Sem aceite ou com nome inválido, nada vai para o servidor.
    notice = problem.text;
    invalid = problem.field;
    done = "";
    render({ target: problem.field === "handle" ? "#pf-handle" : "#pf-consent" });
    return;
  }
  save(enableBody({ handle: form.handle, surveys: [...form.surveys], consent: true, consentVersion: PROFILE_CONSENT_VERSION }), "Perfil ligado.");
}

async function copyLink() {
  const link = profileLink(profile.handle);
  let ok = false;
  try {
    await navigator.clipboard.writeText(link);
    ok = true;
  } catch {
    ok = false;
  }
  copied = ok ? "Link copiado." : "Este navegador não copiou. Selecione o endereço acima e copie.";
  const target = main.querySelector("#pf-copied");
  if (target) {
    target.textContent = copied;
    target.hidden = false;
  }
}

main.addEventListener("input", (event) => {
  if (event.target.id !== "pf-handle") return;
  form = { ...form, handle: normalizeHandle(event.target.value) };
});

main.addEventListener("change", (event) => {
  if (event.target.id === "pf-consent") form = { ...form, consent: event.target.checked };
  else if (event.target.name === "survey") {
    const surveys = new Set(form.surveys);
    if (event.target.checked) surveys.add(event.target.value);
    else surveys.delete(event.target.value);
    form = { ...form, surveys };
  }
});

main.addEventListener("submit", (event) => {
  if (event.target.id !== "pf-form") return;
  event.preventDefault();
  submit();
});

const menu = mountSiteMenu({ current: "profile", onIdentityChange: load });

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "menu") menu.open(event.target.closest("[data-action]"));
  else if (action === "reload") load();
  else if (action === "copy" && phase === "ready" && profile?.enabled) copyLink();
  else if (action === "disable" && !busy && phase === "ready" && profile?.enabled) save({ enabled: false }, "Perfil desligado. Ninguém mais vê as suas escolhas pelo link.");
});

// Outra aba entrou, saiu ou trocou de conta: a página acompanha, sem gravar nada.
window.addEventListener("storage", (event) => {
  if ((event.key === IDENTITY_KEY || event.key === null) && readIdentityKey() !== owner) load();
});

load();
