import { endSession, exchangeGoogleCredential } from "./api.js";
import { googleClientId, mountGoogleButton } from "./google-login.js";
import { safeStorage } from "./safe-storage.js";

// Menu do site (ICM 69, #331). Abrir o menu não grava nada: ele só lê a chave
// do aparelho para saber se há uma conta Google. Entrar e sair usam as rotas
// que a capa antiga já usava.

const IDENTITY_KEY = "polimatch:v3:recovery-key";
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
    return `<div class="pm-account">${alert}<p class="pm-account-state">Você entrou com Google.</p>
      <button class="ps-btn ps-btn--ghost" type="button" data-menu="signout"${busy ? " disabled" : ""}>${busy ? "Saindo…" : "Sair da conta"}</button></div>`;
  }
  if (!googleReady) return "";
  return `<div class="pm-account">${alert}<div class="pm-google${busy ? " is-busy" : ""}" id="pm-google"><span>${busy ? "Confirmando…" : "Carregando Google…"}</span></div>
    <p class="pm-account-hint">Para a sua resposta valer em qualquer aparelho.</p></div>`;
}

/**
 * A marcação do painel. `account` é o resultado de `accountKind`; `current`
 * diz em que página a pessoa está (`"survey"` ou `"how"`).
 */
export function menuMarkup({ account = "none", googleReady = false, busy = false, error = "", current = "" } = {}) {
  const here = (page) => (current === page ? ' aria-current="page"' : "");
  return `<div class="pm-menu-top"><a class="ps-brand" href="./" aria-label="PoliMatch, início">Poli<b>Match</b></a><button class="pm-menu-btn" type="button" data-menu="close" aria-label="Fechar menu">${CLOSE_ICON}</button></div>
    <p class="pm-group">Pesquisas</p>
    <a class="pm-item" href="./"${here("survey")}><span>Política</span><em class="pm-tag pm-tag--open">Aberta</em></a>
    ${upcomingMarkup()}
    <p class="pm-group">PoliMatch</p>
    <a class="pm-item" href="./como-funciona.html"${here("how")}><span>Como funciona</span><i aria-hidden="true">›</i></a>
    ${accountMarkup({ account, googleReady, busy, error })}`;
}

function readKey() {
  try {
    return window.localStorage.getItem(IDENTITY_KEY) || safeStorage.get(IDENTITY_KEY) || "";
  } catch {
    return safeStorage.get(IDENTITY_KEY) || "";
  }
}

/**
 * Monta o menu dentro de `host` e devolve como abri-lo. `onIdentityChange` é
 * chamada depois de a pessoa entrar ou sair, com a chave do aparelho já
 * atualizada.
 */
export function mountSiteMenu({ host = document.body, current = "", onIdentityChange = () => {} } = {}) {
  const dialog = document.createElement("dialog");
  dialog.className = "pm-menu";
  dialog.setAttribute("aria-label", "Menu");
  // O foco entra no painel, não no primeiro item: nada aparece destacado ao abrir.
  dialog.tabIndex = -1;
  host.append(dialog);
  const state = { busy: false, error: "" };
  let opener = null;

  function render() {
    const account = accountKind(readKey());
    const googleReady = Boolean(googleClientId());
    dialog.innerHTML = menuMarkup({ account, googleReady, busy: state.busy, error: state.error, current });
    if (account !== "google" && googleReady && !state.busy) mountGoogle();
  }

  async function mountGoogle() {
    const slot = dialog.querySelector("#pm-google");
    if (!slot) return;
    try {
      await mountGoogleButton(slot, { callback: signIn });
    } catch (error) {
      if (!dialog.open || !slot.isConnected) return;
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
      // A chave de quem respondia sem conta vai junto: o servidor liga as
      // escolhas dela à conta.
      const result = await exchangeGoogleCredential(response.credential, readKey());
      safeStorage.set(IDENTITY_KEY, result.sessionToken);
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
    try {
      await endSession(readKey());
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
    safeStorage.remove(IDENTITY_KEY);
    state.busy = false;
    render();
    onIdentityChange();
  }

  function open(trigger = null) {
    if (dialog.open) return;
    opener = trigger;
    state.error = "";
    render();
    dialog.showModal();
    dialog.focus({ preventScroll: true });
  }

  function close() {
    if (dialog.open) dialog.close();
  }

  dialog.addEventListener("close", () => {
    if (opener?.isConnected) opener.focus();
    else document.querySelector('[data-action="menu"]')?.focus();
    opener = null;
  });

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
    if ((event.key === IDENTITY_KEY || event.key === null) && dialog.open && !state.busy) render();
  });

  return { open, close };
}
