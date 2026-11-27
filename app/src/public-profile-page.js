import "./install-error-reporter.js";
import "./photo-survey.css";
import "./site-menu.css";
import CELEBRITIES from "./celebrity-cards.json" with { type: "json" };
import CLOTHES from "./clothes-cards.json" with { type: "json" };
import ARTS from "./political-chromas.json" with { type: "json" };
import { loadPublicProfile } from "./api.js";
import { handleFromSearch, publicProfileCards } from "./profile-view.js";
import { mountSiteMenu } from "./site-menu.js";

// Perfil público (ICM 76, #354, decisão 0008): `perfil.html?u=<nome>`. Mostra
// o nome de perfil e, como no Instagram, uma grade de fotos: a primeira
// colocada de cada pesquisa que a pessoa marcou, com o assunto embaixo. Não
// precisa de conta e não grava nada. A página pede para não ser indexada.
// Perfil desligado e nome que não existe têm a mesma mensagem, para não dizer
// a quem procura se um nome de perfil existe.

const main = document.querySelector("#pf-main");
const artById = new Map([...ARTS, ...CELEBRITIES, ...CLOTHES].map((art) => [art.id, art]));
const NOT_FOUND = "Perfil não encontrado.";

const escapeText = (value = "") => String(value).replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
);

function cardImage(id) {
  const art = artById.get(id);
  return `<span class="ps-card" role="img" aria-label="${escapeText(art.name)}"><img src="${escapeText(art.src)}" srcset="${escapeText(art.srcset)}" sizes="(max-width: 440px) 30vw, 132px" width="${art.width}" height="${art.height}" alt="" decoding="async" draggable="false"></span>`;
}

function render({ kicker = "Perfil", title, hint = "", body = "", focus = true }) {
  main.innerHTML = `<p class="ps-kicker">${escapeText(kicker)}</p><h1 class="ps-title" id="ps-title" tabindex="-1">${escapeText(title)}</h1>${hint ? `<p class="ps-hint">${escapeText(hint)}</p>` : ""}${body}`;
  if (focus) main.querySelector("#ps-title")?.focus({ preventScroll: true });
}

const CTA = '<div class="ps-stack"><a class="ps-btn" href="./">Responder as pesquisas</a></div>';

function notFound() {
  document.title = "Perfil não encontrado — PoliMatch";
  render({ title: NOT_FOUND, hint: "Confira o link que você recebeu.", body: CTA });
}

async function open() {
  const handle = handleFromSearch(window.location.search);
  // Um nome que não vale nem é pedido ao servidor: a mensagem é a mesma.
  if (!handle) {
    notFound();
    return;
  }
  render({ title: "Carregando…", focus: false });
  let profile;
  try {
    profile = await loadPublicProfile(handle);
  } catch (error) {
    if (error.status === 404) {
      notFound();
      return;
    }
    render({
      title: "Não deu para abrir este perfil.",
      hint: "Tente de novo em instantes.",
      body: '<div class="ps-stack"><button class="ps-btn" type="button" data-action="retry">Tentar de novo</button></div>',
    });
    return;
  }
  const cards = publicProfileCards(profile, (id) => artById.has(id));
  const name = typeof profile?.handle === "string" && profile.handle ? profile.handle : handle;
  document.title = `${name} — PoliMatch`;
  const grid = cards.length
    ? `<ul class="ps-profile-grid">${cards.map((card) => `<li>${cardImage(card.cardId)}<small>${escapeText(card.subject)}</small></li>`).join("")}</ul>`
    : "";
  render({
    title: name,
    hint: cards.length
      ? "A primeira colocada nas pesquisas que esta pessoa escolheu mostrar."
      : "Este perfil ainda não mostra nenhuma pesquisa.",
    body: `${grid}${CTA}`,
  });
}

const menu = mountSiteMenu({ current: "public-profile" });

document.addEventListener("click", (event) => {
  const trigger = event.target.closest('[data-action="menu"]');
  if (trigger) {
    menu.open(trigger);
    return;
  }
  if (event.target.closest('[data-action="retry"]')) open();
});

open();
