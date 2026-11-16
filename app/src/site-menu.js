import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { IDENTITY_KEY, readIdentityKey as readKey, signInWithGoogleCredential } from "./account-session.js";
import { endSession } from "./api.js";
import { googleClientId, mountGoogleButton } from "./google-login.js";
import { safeStorage } from "./safe-storage.js";

// Menu do site (ICM 69, #331). Abrir o menu não grava nada: ele só lê a chave
// do aparelho para saber se há uma conta Google. Entrar e sair usam as rotas
// que a capa antiga já usava.

const GOOGLE_SESSION_PREFIX = "pms_";

/** Próximas pesquisas, na ordem da decisão 0002. São só anúncio: sem página, data nem cartas. */
export const UPCOMING_SURVEYS = Object.freeze(["Famosos e influenciadores", "Roupas"]);

const escapeText = (value = "") => String(value).replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
);

const MENU_ICON = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14"/></svg>';
const CLOSE_ICON = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15"/></svg>';

/**
 * A sessão Google começa com `pms_`; a chave de quem responde sem conta, com
 * `pm2_`. O prefixo basta para o menu, sem consultar o servidor.
 */
export function accountKind(key) {
  const value = String(key ?? "").trim();
  if (!value) return "none";
  return value.startsWith(GOOGLE_SESSION_PREFIX) ? "google" : "anonymous";
}

export const menuButtonMarkup = () => `<button class="pm-menu-btn" type="button" data-action="menu" aria-haspopup="dialog" aria-label="Abrir menu">${MENU_ICON}</button>`;

export const upcomingMarkup = () => UPCOMING_SURVEYS
  .map((name) => `<div class="pm-item is-soon"><span>${escapeText(name)}</span><em class="pm-tag">Em breve</em></div>`)
  .join("");

function accountMarkup({ account, googleReady, busy, error }) {
  const alert = error ? `<p class="pm-error" role="alert">${escapeText(error)}</p>` : "";
  if (account === "google") {
    return `<div class="pm-account">${alert}<p class="pm-account-state" role="status">Você entrou com Google.</p>
      <button class="ps-btn ps-btn--ghost" type="button" data-menu="signout"${busy ? " disabled" : ""}>${busy ? "Saindo…" : "Sair da conta"}</button></div>`;
  }
  if (!googleReady) return "";
  return `<div class="pm-account">${alert}<div class="pm-google${busy ? " is-busy" : ""}" id="pm-google"><span>${busy ? "Confirmando…" : "Carregando Google…"}</span></div>
    <p class="pm-account-hint">Para responder, entre e cadastre o CPF.</p></div>`;
}

/**
 * A marcação do painel. `account` é o resultado de `accountKind`; `current`
 * diz onde a pessoa está: `"home"`, `"how"` ou o código de uma pesquisa.
 * `surveys` são as pesquisas, na ordem da capa; cada uma tem endereço próprio.
 */
export function menuMarkup({ account = "none", googleReady = false, busy = false, error = "", current = "", surveys = PHOTO_SURVEYS } = {}) {
  const here = (page) => (current === page ? ' aria-current="page"' : "");
  const surveyLinks = surveys
    .map((survey) => `<a class="pm-item" href="./?p=${encodeURIComponent(survey.id)}"${here(survey.id)}><span>${escapeText(survey.question)}</span><small class="pm-sub">${escapeText(survey.subject)}</small></a>`)
    .join("");
  return `<div class="pm-menu-top"><a class="ps-brand" href="./" aria-label="PoliMatch, início">Poli<b>Match</b></a><button class="pm-menu-btn" type="button" data-menu="close" aria-label="Fechar menu">${CLOSE_ICON}</button></div>
    <p class="pm-group">Pesquisas</p>
    ${surveyLinks}
    ${upcomingMarkup()}
    <p class="pm-group">PoliMatch</p>
    <a class="pm-item" href="./"${here("home")}><span>Início</span><i aria-hidden="true">›</i></a>
    <a class="pm-item" href="./como-funciona.html"${here("how")}><span>Como funciona</span><i aria-hidden="true">›</i></a>
    ${accountMarkup({ account, googleReady, busy, error })}`;
}

/**
 * Monta o menu dentro de `host` e devolve como abri-lo. `onIdentityChange` é
 * chamada depois de a pessoa entrar ou sair, com a chave do aparelho já
 * atualizada.
 */
export function mountSiteMenu({ host = document.body, current = "", onIdentityChange = () => {} } = {}) {
  // `current` pode ser um valor ou uma função: a página da pesquisa troca de
  // pesquisa sem recarregar.
  const currentPage = () => (typeof current === "function" ? current() : current);
  const dialog = document.createElement("dialog");
  dialog.className = "pm-menu";
  dialog.setAttribute("aria-label", "Menu");
  // O foco entra no painel, não no primeiro item: nada aparece destacado ao abrir.
  dialog.tabIndex = -1;
  host.append(dialog);
  const state = { busy: false, error: "" };
  let opener = null;
  // Sem `showModal` (Safari antes do 15.4) o painel abre pelo atributo: perde
  // o foco preso, mas continua sendo a saída de quem precisa entrar na conta.
  const modal = typeof dialog.showModal === "function" && typeof dialog.close === "function";
  const isOpen = () => dialog.hasAttribute("open");

  function render() {
    const account = accountKind(readKey());
    const googleReady = Boolean(googleClientId());
    dialog.innerHTML = menuMarkup({ account, googleReady, busy: state.busy, error: state.error, current: currentPage() });
    // Trocar o conteúdo leva embora o elemento que tinha o foco: ele volta ao painel.
    if (isOpen() && !dialog.contains(document.activeElement)) dialog.focus({ preventScroll: true });
    if (account !== "google" && googleReady && !state.busy) mountGoogle();
  }

  async function mountGoogle() {
    const slot = dialog.querySelector("#pm-google");
    if (!slot) return;
    try {
      await mountGoogleButton(slot, { callback: signIn });
    } catch (error) {
      if (!isOpen() || !slot.isConnected) return;
      slot.innerHTML = `<button class="ps-link" type="button" data-menu="retry-google">Tentar carregar o Google de novo</button>`;
      state.error = error.message || "Não foi possível abrir o Google agora.";
      const alert = document.createElement("p");
      alert.className = "pm-error";
      alert.setAttribute("role", "alert");
      alert.textContent = state.error;
      slot.before(alert);
    }
  }

  async function signIn(response) {
    if (!response?.credential || state.busy) return;
    state.busy = true;
    state.error = "";
    render();
    try {
      await signInWithGoogleCredential(response.credential);
    } catch (error) {
      state.busy = false;
      state.error = error.status === 0 ? "Não conseguimos falar com o servidor. Tente de novo." : "Não foi possível entrar agora. Tente de novo.";
      render();
      return;
    }
    state.busy = false;
    render();
    onIdentityChange();
  }

  async function signOut() {
    if (state.busy) return;
    state.busy = true;
    state.error = "";
    render();
    const key = readKey();
    try {
      await endSession(key);
    } catch (error) {
      // Sessão que o servidor já não reconhece não tem o que revogar: o
      // aparelho esquece mesmo assim. Com qualquer outra falha a sessão fica,
      // para não sobrar uma sessão viva sem ninguém para encerrá-la.
      if (error.status !== 401) {
        state.busy = false;
        state.error = error.status === 0 ? "Não conseguimos falar com o servidor. Você continua na conta." : "Não foi possível sair agora. Tente de novo.";
        render();
        return;
      }
    }
    // Só esquece a sessão que acabou de encerrar: outra aba pode ter entrado
    // de novo enquanto o servidor respondia.
    if (readKey() === key) safeStorage.remove(IDENTITY_KEY);
    state.busy = false;
    render();
    onIdentityChange();
  }

  function open(trigger = null) {
    if (isOpen()) return;
    opener = trigger;
    state.error = "";
    render();
    if (modal) dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.focus({ preventScroll: true });
  }

  function closed() {
    // O botão que abriu pode ter saído da tela enquanto o menu estava aberto.
    const target = opener?.isConnected ? opener : document.querySelector('[data-action="menu"]') || document.querySelector("h1");
    target?.focus({ preventScroll: true });
    opener = null;
  }

  function close() {
    if (!isOpen()) return;
    if (modal) dialog.close();
    else {
      dialog.removeAttribute("open");
      closed();
    }
  }

  dialog.addEventListener("close", closed);
  // Sem `showModal` o navegador não fecha no Esc nem prende o foco: o Esc é
  // ouvido no documento, onde quer que o foco esteja.
  if (!modal) {
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) close();
    });
  }

  dialog.addEventListener("click", (event) => {
    const action = event.target.closest("[data-menu]")?.dataset.menu;
    if (action === "close") close();
    else if (action === "signout") signOut();
    else if (action === "retry-google") {
      state.error = "";
      render();
    } else if (event.target.closest("a[href]")) close();
  });

  // A outra aba entrou ou saiu: o menu aberto acompanha.
  window.addEventListener("storage", (event) => {
    if ((event.key === IDENTITY_KEY || event.key === null) && isOpen() && !state.busy) render();
  });

  return { open, close };
}
