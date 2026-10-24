import "./presidential.css";
import "./tcg-card.css";
import { installInauguralChromas } from './inaugural-chromas.js';
import { presidentialChroma } from './political-chromas.js';
import COVER_CHROMAS from './cover-chromas.json';
import ROSTER from "../../shared/presidential-roster.json";
import {
  categoryPeople,
  supportLabel,
  validatePresidentialRoster,
} from "../../shared/presidential-curation.js";
import {
  ApiError,
  createPlayer,
  loadPlayerRanking,
  submitRoundVote,
} from "./api.js";
import { confirmedVoteData } from "./vote-response.js";
import { selectOrderedCard } from "./ordered-selection.js";
import { createSoundController } from "./sound.js";
import { installChromaMotion } from "./chroma-motion.js";
import {
  tcgCardMarkup as baseTcgCardMarkup,
  portraitMarkup,
  escapeCardText as e,
} from "./tcg-card.js";
import {
  categoryDistribution,
  freshPresidentialRound,
  restoredPresidentialSession,
  PRESIDENTIAL_SESSION_LENGTH as TOTAL,
  PRESIDENTIAL_STORAGE_KEY,
} from "./presidential-session.js";

function tcgCardMarkup(person, options = {}) {
  return baseTcgCardMarkup(person, { ...options, chroma: presidentialChroma(person.id) });
}

validatePresidentialRoster(ROSTER);
const root = document.querySelector("#presidential-app");
installInauguralChromas(root);
const sound = createSoundController();
const byId = new Map(ROSTER.people.map((p) => [p.id, p]));
const identityKey = "polimatch:v3:recovery-key";
let recoveryKey = "",
  epoch = 0,
  busy = false,
  ready = false,
  retryAt = 0;
let category = ROSTER.categories[0],
  people = categoryPeople(ROSTER, category.id),
  session,
  ranking = [],
  personalDuels = 0,
  playerVersion = 0;
let activeView = "lobby",
  storageFailed = false,
  restoreFocus = null;
let saved = {};
let identityPromise;
let rosterAll = false;
try {
  saved = JSON.parse(localStorage.getItem(PRESIDENTIAL_STORAGE_KEY) || "{}");
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) saved = {};
} catch {
  storageFailed = true;
}

function writeStorage() {
  if (!session || !recoveryKey) return;
  saved[category.id] = { ...session, identity: recoveryKey };
  try {
    localStorage.setItem(PRESIDENTIAL_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    storageFailed = true;
  }
  root.querySelector("#storage-notice").hidden = !storageFailed;
}

const coverChromas = new Map(COVER_CHROMAS.map(art => [art.id, art]));
const initialPreview = [
  "nikolas-ferreira",
  "janja",
  "flavio-bolsonaro",
  "lula",
].map((id) => coverChromas.get(id) || byId.get(id));
root.innerHTML = `<div class="presidential-shell">
 <div class="race-scroll-area">
 <header class="race-header"><a class="race-brand" href="./"><img src="./brand/symbol-flat.svg" alt=""><span>PoliMatch</span></a><span class="race-edition">Edição · 2026</span><button class="race-icon" id="race-sound" aria-label="Ativar som" type="button">♪</button></header>
 <main>
  <section id="race-lobby" class="race-lobby">
   <div class="race-intro"><p class="race-eyebrow">SEU BARALHO. SUA OPINIÃO.</p><h1>A corrida ganhou<br><em>novas cartas.</em></h1><p>Quem você leva para o seu ranking? Escolha duas pessoas por rodada. A primeira vem antes. As outras duas ficam empatadas.</p><button class="race-primary" id="race-start" type="button">Entrar na arena <span aria-hidden="true">↗</span></button><div class="race-stats"><span><b>${ROSTER.people.length}</b> pessoas</span><span><b>6</b> categorias</span><span><b>10</b> rodadas por partida</span></div></div>
   <div class="race-showcase" aria-label="Prévia das cartas Chroma"><span class="showcase-orbit" aria-hidden="true"></span>${initialPreview.map((p, i) => `<div class="showcase-card showcase-card-${i}">${baseTcgCardMarkup(p, { decorative: true, category: "Corrida presidencial", chroma: coverChromas.get(p.id) || presidentialChroma(p.id) })}</div>`).join("")}<span class="showcase-seal" aria-hidden="true">✦ CHROMA MALAQUITA</span></div>
  </section>
  <section class="race-categories" aria-labelledby="categories-title"><div class="section-top"><div><p class="race-eyebrow">ESCOLHA SUA MESA</p><h2 id="categories-title">Cada universo, um duelo.</h2></div><button id="race-show-roster" class="race-text-button" type="button">Ver todo o elenco ↗</button></div><div class="category-grid">${ROSTER.categories
    .map((c, i) => {
      const d = categoryDistribution(c);
      return `<button type="button" data-category="${c.id}" class="category-tile${i === 0 ? " is-active" : ""}" aria-pressed="${i === 0}"><span class="category-number">0${i + 1}</span><strong>${e(c.name)}</strong><span>${d.unique} cartas</span><b aria-hidden="true">↗</b></button>`;
    })
    .join("")}</div></section>
  <section id="race-arena" class="race-arena" hidden aria-labelledby="arena-title"><div class="arena-top"><button class="race-text-button" id="race-back" type="button">‹ Voltar</button><span id="category-name"></span><span id="race-progress" class="race-progress"></span></div><div class="arena-heading"><div><p class="race-eyebrow">A ORDEM É SUA</p><h1 id="arena-title">Escolha duas cartas.</h1></div><p id="selection-prompt">Primeiro, a sua preferida.</p></div><div class="race-progress-track" aria-hidden="true"><span id="race-progress-fill"></span></div><div class="race-table" id="race-table"></div><div class="race-feedback"><p id="race-status" role="status" aria-live="polite"></p><button class="race-primary" id="race-next" type="button" hidden>Próxima mesa <span aria-hidden="true">→</span></button><button class="race-primary" id="race-retry" type="button" hidden>Tentar confirmar novamente</button></div><p class="race-scoring">1ª escolha <b>+24</b><span>◆</span>2ª escolha <b>+8</b><span>◆</span>Outras duas <b>−16 cada</b></p></section>
  <section id="race-finish" class="race-finish" hidden><p class="race-eyebrow">PARTIDA CONCLUÍDA</p><h1>Seu baralho.<br><em>Do seu jeito.</em></h1><p>As dez rodadas foram confirmadas. Seu histórico continua salvo no servidor.</p><div id="finish-podium" class="finish-podium"></div><div class="finish-actions"><button id="finish-ranking" class="race-primary" type="button">Ver meu ranking</button><button id="race-share" class="race-secondary" type="button">Compartilhar</button><button id="race-restart" class="race-text-button" type="button">Jogar outra partida ↗</button></div><p id="share-status" role="status"></p><textarea id="share-fallback" aria-label="Texto para compartilhar" readonly hidden></textarea></section>
  <section id="race-roster" class="race-roster" hidden aria-labelledby="roster-title"><div class="section-top"><div><p class="race-eyebrow">CONHEÇA AS CARTAS</p><h1 id="roster-title">Elenco da corrida.</h1></div><button class="race-text-button" id="roster-back" type="button">‹ Voltar</button></div><label class="race-search">Buscar pessoa<input type="search" id="roster-search" placeholder="Nome da pessoa…" autocomplete="off"></label><button id="roster-all" class="race-text-button" type="button" aria-pressed="false">Ver todas as ${ROSTER.people.length} cartas ↗</button><p id="roster-count"></p><div class="roster-grid" id="roster-grid"></div></section>
  <section id="race-ranking" class="race-ranking" hidden aria-labelledby="ranking-title"><div class="section-top"><div><p class="race-eyebrow">SÓ AS SUAS ESCOLHAS</p><h1 id="ranking-title">Seu ranking.</h1></div><button class="race-text-button" id="ranking-back" type="button">‹ Voltar</button></div><p id="ranking-note"></p><ol id="ranking-list"></ol></section>
  <p id="connection-notice" class="race-notice" role="status" hidden>Você está sem conexão. Reconecte para confirmar suas escolhas.</p><p id="storage-notice" class="race-notice" hidden>Este navegador não permite salvar a partida aqui. As escolhas confirmadas continuam no servidor; mantenha esta aba aberta para continuar.</p><p id="race-error" class="race-notice" role="alert" hidden></p>
 </main>
 <footer class="race-footer"><span>PoliMatch · Corrida presidencial</span><span>Jogo pessoal. Não é pesquisa eleitoral.<br>Algumas cartas usam retratos artísticos com IA.</span><a href="./quem-disse-isso.html">Quem disse isso? ↗</a></footer>
 </div>
 <nav class="race-nav" aria-label="Navegação dos duelos"><a href="./">⌂<span>Início</span></a><button type="button" id="nav-play" aria-current="page">◇<span>Duelos</span></button><button type="button" id="nav-roster">▦<span>Elenco</span></button><button type="button" id="nav-ranking">▥<span>Meu ranking</span></button></nav>
 <dialog id="race-profile" class="race-profile"><button type="button" id="profile-close" class="race-icon" aria-label="Fechar perfil">×</button><div id="profile-content"></div></dialog>
</div>`;

const $ = (selector) => root.querySelector(selector);
function status(message) {
  $("#race-status").textContent = message;
}
function showError(message = "") {
  $("#race-error").hidden = !message;
  $("#race-error").textContent = message;
}
function currentIdentity() {
  return `${epoch}:${category.id}:${recoveryKey}`;
}
function moveTo(view) {
  activeView = view;
  for (const name of ["lobby", "arena", "finish", "roster", "ranking"])
    $("#race-" + name).hidden = name !== view;
  $(".race-categories").hidden = !["lobby", "roster"].includes(view);
  for (const [id, value] of [
    ["nav-play", ["lobby", "arena", "finish"].includes(view)],
    ["nav-roster", view === "roster"],
    ["nav-ranking", view === "ranking"],
  ]) {
    if (value) $("#" + id).setAttribute("aria-current", "page");
    else $("#" + id).removeAttribute("aria-current");
  }
  $(".race-scroll-area").scrollTo({ top: 0, behavior: "auto" });
  const heading = $("#race-" + view).querySelector("h1,h2");
  if (heading) {
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }
}
function startNewRound() {
  const previous = session?.candidateIds || [],
    completed = session?.completed || 0;
  session = {
    ...freshPresidentialRound(people, {
      queue: session?.queue || [],
      previous,
    }),
    completed,
    confirmed: false,
  };
  writeStorage();
  mountTable();
  patchTable();
}
function mountTable() {
  $("#race-table").innerHTML = session.candidateIds
    .map(
      (id) =>
        `<article class="race-card-wrap">${tcgCardMarkup(byId.get(id), { category: category.name })}<button class="race-profile-trigger" type="button" data-profile="${id}" aria-label="Conhecer ${e(byId.get(id).name)}"><svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.5v.5"/></svg> Conhecer</button></article>`,
    )
    .join("");
  installChromaMotion($("#race-table"));
}
function patchTable() {
  if (!session) return;
  const locked =
    busy ||
    Boolean(session.pending) ||
    session.confirmed ||
    !ready ||
    !navigator.onLine;
  for (const button of root.querySelectorAll("[data-card]")) {
    const order = session.selectionIds.indexOf(button.dataset.card) + 1;
    button.setAttribute("aria-disabled", String(locked));
    button.setAttribute("aria-pressed", String(order > 0));
    button.setAttribute(
      "aria-label",
      `${byId.get(button.dataset.card).name}${session.confirmed ? (order ? `, ${order}ª escolha confirmada` : ", não escolhida") : order ? ", primeira escolha. Toque para desmarcar" : `, escolher em ${session.selectionIds.length ? "segundo" : "primeiro"} lugar`}${button.classList.contains('tcg-card--inaugural') ? ', retrato artístico com IA' : ''}`,
    );
    button.classList.toggle("is-muted", session.confirmed && !order);
    const badge = button.querySelector(".tcg-choice");
    badge.hidden = !order;
    badge.textContent = order ? `${order}º` : "";
    const outcome = button.querySelector(".tcg-outcome");
    outcome.hidden = !session.confirmed;
    outcome.textContent =
      order === 1
        ? "1ª escolha · +24"
        : order === 2
          ? "2ª escolha · +8"
          : "Não escolhida · −16";
  }
  $("#selection-prompt").textContent = busy
    ? "Confirmando suas duas escolhas…"
    : session.confirmed
      ? "Rodada confirmada."
      : session.pending
        ? "Sua confirmação está pendente."
        : session.selectionIds.length
          ? "Agora, a sua segunda escolha."
          : "Primeiro, a sua preferida.";
  $("#race-progress").textContent = `${session.completed} / ${TOTAL}`;
  $("#race-progress-fill").style.width =
    `${(session.completed / TOTAL) * 100}%`;
  $("#race-next").hidden = !session.confirmed || !ready;
  $("#race-next").textContent =
    session.completed === TOTAL ? "Ver meu fechamento →" : "Próxima mesa →";
  $("#race-retry").hidden = !session.pending || busy;
  $("#race-retry").disabled = !navigator.onLine || Date.now() < retryAt;
  $("#connection-notice").hidden = navigator.onLine;
  for (const button of root.querySelectorAll("[data-category],#race-restart"))
    button.disabled = busy || Boolean(session.pending);
}
async function ensureIdentity(topicId) {
  if (!identityPromise)
    identityPromise = (async () => {
      try {
        recoveryKey = localStorage.getItem(identityKey) || "";
      } catch {
        storageFailed = true;
      }
      if (!recoveryKey) {
        const player = await createPlayer();
        recoveryKey = player.recoveryKey;
        try {
          localStorage.setItem(identityKey, recoveryKey);
        } catch {
          storageFailed = true;
        }
      }
      return recoveryKey;
    })().catch((error) => {
      identityPromise = null;
      throw error;
    });
  const key = await identityPromise;
  return loadPlayerRanking(key, topicId);
}
async function loadCategory(id, { play = false } = {}) {
  if (busy || session?.pending) {
    showError("Confirme a rodada pendente antes de trocar de categoria.");
    return;
  }
  const next = ROSTER.categories.find((c) => c.id === id);
  if (!next) return;
  epoch++;
  category = next;
  people = categoryPeople(ROSTER, id);
  ready = false;
  ranking = [];
  showError();
  patchTable();
  $("#race-table").setAttribute("aria-busy", "true");
  status("Preparando as cartas desta categoria…");
  for (const tile of root.querySelectorAll("[data-category]")) {
    const chosen = tile.dataset.category === id;
    tile.classList.toggle("is-active", chosen);
    tile.setAttribute("aria-pressed", String(chosen));
  }
  $("#category-name").textContent = category.name;
  const requestEpoch = epoch;
  try {
    const personal = await ensureIdentity(next.topicId);
    if (requestEpoch !== epoch) return;
    ranking = personal.ranking;
    personalDuels = personal.duels;
    playerVersion = personal.version;
    const stored =
      saved[id]?.identity === recoveryKey
        ? restoredPresidentialSession(saved[id], people, {
            topicId: next.topicId,
          })
        : null;
    session = stored || {
      ...freshPresidentialRound(people),
      completed: 0,
      confirmed: false,
    };
    ready = true;
    mountTable();
    patchTable();
    writeStorage();
    $("#race-table").setAttribute("aria-busy", "false");
    status("");
    if (activeView === "ranking") renderRanking();
    if (play) {
      moveTo(
        session.completed === TOTAL && session.confirmed ? "finish" : "arena",
      );
      if (activeView === "finish") renderFinish();
    }
    if (session.pending)
      status(
        "Uma confirmação está pendente. Tente novamente para verificar a mesma rodada.",
      );
  } catch (error) {
    if (requestEpoch !== epoch) return;
    $("#race-table").setAttribute("aria-busy", "false");
    showError(
      error.status === 401
        ? "Sua sessão precisa ser recuperada. Volte ao início e entre novamente para continuar com seu histórico."
        : error.message || "Não foi possível carregar seu jogo.",
    );
    $("#race-start").textContent = "Tentar conectar novamente ↗";
  }
}
async function choose(id) {
  if (
    !ready ||
    !navigator.onLine ||
    busy ||
    session.pending ||
    session.confirmed
  )
    return;
  const selected = selectOrderedCard(
    session.selectionIds,
    id,
    session.candidateIds,
  );
  session.selectionIds = selected.selectionIds;
  sound.play("choose");
  writeStorage();
  patchTable();
  if (!selected.complete) {
    status(
      selected.selectionIds.length
        ? "Primeira escolha marcada. Escolha a segunda ou toque de novo para desmarcar."
        : "Escolha desmarcada.",
    );
    return;
  }
  session.pending = {
    roundId: session.roundId,
    winnerId: session.selectionIds[0],
    candidateIds: [...session.candidateIds],
    selectionIds: [...session.selectionIds],
    playerVersion,
    personalDuels,
    topicId: category.topicId,
  };
  writeStorage();
  await confirmPending();
}
async function confirmPending() {
  if (busy || !session?.pending || !navigator.onLine || Date.now() < retryAt)
    return;
  busy = true;
  showError();
  patchTable();
  status("Confirmando suas escolhas…");
  const identity = currentIdentity(),
    attempt = structuredClone(session.pending);
  try {
    const response = await submitRoundVote(
      attempt.roundId,
      attempt.winnerId,
      attempt.candidateIds,
      attempt.topicId,
      {
        recoveryKey,
        version: attempt.playerVersion,
        selectionIds: attempt.selectionIds,
      },
    );
    if (identity !== currentIdentity()) return;
    const confirmed = confirmedVoteData(response, people, attempt, {
      personalDuels: attempt.personalDuels,
      playerVersion: attempt.playerVersion,
    });
    ranking = confirmed.personalRanking;
    personalDuels = confirmed.personalDuels;
    playerVersion = confirmed.playerVersion;
    session.pending = null;
    session.confirmed = true;
    session.completed = Math.min(TOTAL, session.completed + 1);
    writeStorage();
    sound.play("confirm");
    status("Duas escolhas confirmadas. A sua ordem já está no ranking.");
  } catch (error) {
    if (identity !== currentIdentity()) return;
    sound.play("error");
    if (error.status === 409 && error.code === "PLAYER_VERSION_CONFLICT") {
      try {
        const personal = await loadPlayerRanking(recoveryKey, category.topicId);
        if (identity !== currentIdentity()) return;
        session.pending.playerVersion = personal.version;
        writeStorage();
      } catch {}
    }
    if (error.status === 429) {
      retryAt = Date.now() + Math.max(1, error.retryAfterSeconds || 60) * 1000;
      setTimeout(
        () => {
          if (identity === currentIdentity()) patchTable();
        },
        Math.max(1, error.retryAfterSeconds || 60) * 1000,
      );
    }
    if (error.status === 401)
      showError(
        "Sua sessão expirou. Volte ao início e entre novamente para recuperar sua conta; esta rodada foi preservada.",
      );
    status(
      error instanceof ApiError && error.status > 0
        ? `${error.message}. A rodada foi preservada.`
        : "Não conseguimos confirmar a resposta. Tente novamente: a mesma rodada será verificada, sem duplicar sua escolha.",
    );
  } finally {
    if (identity === currentIdentity()) {
      busy = false;
      patchTable();
    }
  }
}
function renderRoster(query = "") {
  const normalized = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const filtered = (rosterAll ? ROSTER.people : people).filter((p) =>
    p.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .includes(normalized),
  );
  $("#roster-count").textContent =
    `${filtered.length} pessoas · ${rosterAll ? "Todo o elenco" : category.name}`;
  $("#roster-all").setAttribute("aria-pressed", String(rosterAll));
  $("#roster-grid").innerHTML =
    filtered
      .map(
        (p) =>
          `<button type="button" class="roster-person" data-profile="${p.id}"><span class="portrait-thumb">${portraitMarkup(p.photo, { loading: "lazy" })}</span><span><strong>${e(p.name)}</strong><small>${e(supportLabel(p, rosterAll ? null : category.id))}</small></span><b aria-hidden="true">↗</b></button>`,
      )
      .join("") || "<p>Nenhuma pessoa encontrada.</p>";
}
function renderRanking() {
  if (!ready) {
    $("#ranking-note").textContent =
      "Conecte para carregar seu ranking desta categoria.";
    $("#ranking-list").innerHTML = "";
    return;
  }
  const played = ranking.filter((p) => p.decisions > 0);
  $("#ranking-note").textContent =
    `${category.name} · ${personalDuels} rodadas confirmadas. Este ranking representa apenas as suas escolhas.`;
  $("#ranking-list").innerHTML =
    played
      .map(
        (p) =>
          `<li><span>${p.rank ?? "—"}</span><span class="portrait-thumb">${portraitMarkup(byId.get(p.id)?.photo)}</span><strong>${e(byId.get(p.id)?.name || p.name)}</strong><span>${p.elo} <small>pontos</small></span></li>`,
      )
      .join("") ||
    "<li>Você ainda não confirmou escolhas nesta categoria.</li>";
}
function renderFinish() {
  renderRanking();
  $("#finish-podium").innerHTML = ranking
    .filter((p) => p.decisions > 0)
    .slice(0, 3)
    .map(
      (p) =>
        `<div>${tcgCardMarkup(byId.get(p.id), { decorative: true, category: category.name })}<span>${p.rank ?? "—"}º no seu ranking</span></div>`,
    )
    .join("");
}
function showProfile(id, trigger) {
  const p = byId.get(id);
  if (!p) return;
  restoreFocus = trigger;
  sound.play("profile");
  const profileCategory = rosterAll ? null : category.id;
  const sources = p.memberships.filter(
    (m) => !profileCategory || m.category === profileCategory,
  );
  $("#profile-content").innerHTML =
    `<div class="profile-tcg">${tcgCardMarkup(p, { decorative: true, category: rosterAll ? "Corrida presidencial" : category.name })}</div><div class="profile-information"><p class="race-eyebrow">NA CURADORIA</p><h2 id="profile-heading">${e(p.name)}</h2><p>${e(supportLabel(p, profileCategory))}</p><p>Apoio documentado na curadoria de ${ROSTER.curationDate.split("-").reverse().join("/")}. Não representa posição exclusiva nem pesquisa eleitoral.</p><h3>Confira a participação</h3>${sources.map((m) => `<a class="profile-source" target="_blank" rel="noopener noreferrer" href="${e(m.sourceUrl)}">Fonte do apoio a ${m.support === "lula" ? "Lula" : "Flávio"} ↗</a>`).join("")}<h3>Fotografia</h3><a class="profile-source" target="_blank" rel="noopener noreferrer" href="${e(p.photo.sourceUrl)}">Origem da imagem ↗</a><p class="photo-credit">${e(p.photo.credit)}</p></div>`;
  $("#race-profile").setAttribute("aria-labelledby", "profile-heading");
  $("#race-profile").showModal();
  $("#profile-close").focus();
}
async function share() {
  const top = ranking
    .filter((p) => p.decisions > 0)
    .slice(0, 3)
    .map((p) => byId.get(p.id)?.name)
    .join(", ");
  const text = `Completei dez rodadas de ${category.name} no PoliMatch. Meu pódio: ${top}. Jogue também: ${new URL("duelos-da-corrida.html", location.href).href}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Meu baralho — PoliMatch", text });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      $("#share-status").textContent = "Texto copiado para compartilhar.";
      return;
    }
  } catch (error) {
    if (error.name === "AbortError") return;
  }
  $("#share-fallback").hidden = false;
  $("#share-fallback").value = text;
  $("#share-fallback").focus();
  $("#share-fallback").select();
  $("#share-status").textContent = "Copie este texto para compartilhar.";
}

root.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.card) {
    choose(button.dataset.card);
    return;
  }
  if (button.dataset.profile) {
    showProfile(button.dataset.profile, button);
    return;
  }
  if (button.dataset.category) {
    sound.play("navigation");
    rosterAll = false;
    loadCategory(button.dataset.category, {
      play: activeView !== "roster",
    }).then(() => {
      if (activeView === "roster") renderRoster($("#roster-search").value);
    });
    return;
  }
  switch (button.id) {
    case "race-start":
    case "nav-play":
      if (!ready) {
        loadCategory(category.id, { play: true });
        return;
      }
      moveTo(
        session.completed === TOTAL && session.confirmed ? "finish" : "arena",
      );
      if (activeView === "finish") renderFinish();
      break;
    case "race-back":
      moveTo("lobby");
      break;
    case "race-next":
      if (!ready || !session.confirmed) return;
      if (session.completed === TOTAL) {
        renderFinish();
        moveTo("finish");
        sound.play("leader");
      } else {
        startNewRound();
        status("");
        sound.play("shuffle");
      }
      break;
    case "race-retry":
      confirmPending();
      break;
    case "race-show-roster":
      rosterAll = true;
      renderRoster();
      moveTo("roster");
      break;
    case "roster-all":
      rosterAll = true;
      renderRoster($("#roster-search").value);
      break;
    case "nav-roster":
      renderRoster();
      moveTo("roster");
      break;
    case "roster-back":
    case "ranking-back":
      moveTo(
        session?.completed === TOTAL && session.confirmed ? "finish" : "lobby",
      );
      break;
    case "nav-ranking":
    case "finish-ranking":
      renderRanking();
      moveTo("ranking");
      break;
    case "race-share":
      share();
      break;
    case "race-restart":
      if (!ready || busy || session.pending) return;
      session = {
        ...freshPresidentialRound(people),
        completed: 0,
        confirmed: false,
      };
      writeStorage();
      mountTable();
      patchTable();
      status("");
      moveTo("arena");
      break;
    case "profile-close":
      $("#race-profile").close();
      break;
    case "race-sound":
      sound.setEnabled(!sound.enabled);
      button.setAttribute(
        "aria-label",
        sound.enabled ? "Desativar som" : "Ativar som",
      );
      button.setAttribute("aria-pressed", String(sound.enabled));
      if (sound.enabled) sound.play("soundOn");
      break;
  }
});
$("#race-profile").addEventListener(
  "close",
  () => restoreFocus?.isConnected && restoreFocus.focus(),
);
$("#roster-search").addEventListener("input", (event) =>
  renderRoster(event.target.value),
);
window.addEventListener("offline", () => patchTable());
window.addEventListener("online", () => {
  patchTable();
  if (session?.pending)
    status("Conexão restabelecida. Confirme novamente a rodada pendente.");
});
window.addEventListener("storage", (event) => {
  if (event.key === identityKey && event.newValue !== recoveryKey) {
    epoch++;
    ready = false;
    busy = false;
    showError(
      "Sua conta mudou em outra aba. Recarregue esta página para continuar com a sessão correta.",
    );
    patchTable();
  }
});
$("#race-sound").setAttribute(
  "aria-label",
  sound.enabled ? "Desativar som" : "Ativar som",
);
$("#race-sound").setAttribute("aria-pressed", String(sound.enabled));
installChromaMotion($(".race-showcase"));
loadCategory(category.id);
