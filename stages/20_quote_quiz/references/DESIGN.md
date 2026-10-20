# Direção aprovada
Stefan: “Escolher flávio e Flavio em cima é desnecessário.” / “Boa” / “Ok. efetiva assim”.
Referência visual aprovada na conversa: exec-5d5c23b5-26e1-4750-8494-dc55bec807c6.png.

- Malaquita como fundo; porcelana quente no painel de frase; ouro discreto.
- Duas cartas no mesmo plano, nome uma vez e carta toda clicável.
- Fotos documentais existentes, enquadradas por inteiro para evitar o corte do rosto de Lula visto na produção anterior.
- Fonte, data e contexto somente após responder; revelação explícita e próxima frase sem temporizador.
- Placar próprio: acertos, pontos e…28410 tokens truncated…code === "DAILY_EDITION_CLOSED"
        ? "Virou o dia em São Paulo. O novo baralho já está na mesa."
        : error.code === "DAILY_PREDICTION_REQUIRED"
          ? PREDICTION_REVEAL_COPY.requiredResume
        : "Seu outro acesso já avançou a rodada. Retomamos do próximo slot."
      : "Não conseguimos atualizar a rodada do dia. Recarregue para continuar.";
    render();
    sound.play(resynced ? "navigation" : "error");
    return;
  }
  const failure = voteFailureState(error);
  state.votePhase = failure.phase;
  state.voteAction = failure.action;
  state.retryAfterSeconds = failure.retryAfterSeconds;
  state.retryAt = failure.retryAt;

  // A versão pessoal ficou para trás porque uma rodada anterior chegou ao
  // servidor sem que a resposta voltasse. Realinhar aqui é o que impede o app
  // de recusar todo voto seguinte até alguém recarregar a página.
  if (error?.status === 409 && error?.code === "PLAYER_VERSION_CONFLICT") {
    const resynced = await resyncPlayer(attemptIdentity);
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return;
    state.result = resynced ? failure.message : "Não conseguimos alinhar seu ranking. Tente novamente.";
    // Um 409 acontece antes da gravação desta rodada. A escolha continua
    // pendente e reutiliza o mesmo roundId depois da versão ser atualizada.
    state.pendingWinnerId = winner.id;
    render();
    announceStatus(state.result);
    sound.play("error");
    return;
  }

  state.result = failure.message;
  render();
  scheduleRetryUnlock();
  announceStatus(state.result);
  sound.play("error");
}

function scheduleRetryUnlock() {
  clearTimeout(retryEnableTimer);
  const delay = state.retryAt - Date.now();
  if (delay <= 0) return;
  retryEnableTimer = setTimeout(() => render(), delay + 25);
}

async function restoreVoteSession() {
  if (state.busy || !state.pendingWinnerId || state.voteAction !== VOTE_ACTIONS.RESTORE_SESSION) return;
  const recoveryEpoch = Number(state.identityEpoch || 0);
  state.busy = true;
  state.votePhase = VOTE_PHASES.RESTORING_SESSION;
  state.voteAction = "";
  state.result = "Restabelecendo sua sessão…";
  state.resultTone = "";
  render();
  try {
    let recoveryKey = state.recoveryKey;
    if (state.sessionRecoveryMode !== "load") {
      const created = await createPlayer();
      if (Number(state.identityEpoch || 0) !== recoveryEpoch) return;
      if (!created?.recoveryKey) throw new TypeError("resposta de sessão inválida");
      recoveryKey = created.recoveryKey;
      state.recoveryKey = recoveryKey;
      state.sessionRecoveryMode = "load";
      localStorage.setItem("polimatch:v3:recovery-key", recoveryKey);
    }
    const restoringDailyVote = state.gameMode === "daily";
    const [personal, dailySession] = await Promise.all([
      loadPlayerRanking(recoveryKey),
      // O modo livre não depende da disponibilidade do serviço diário. Só uma
      // tentativa diária precisa restaurar ambos os estados em conjunto.
      restoringDailyVote ? loadDailySession(recoveryKey) : Promise.resolve(null),
    ]);
    if (Number(state.identityEpoch || 0) !== recoveryEpoch || state.recoveryKey !== recoveryKey) return;
    state.playerVersion = personal.version ?? 0;
    state.personalRanking = rankingForCatalog(personal, state.candidates);
    state.personalRankingPolicy = personal.rankingPolicy || null;
    state.personalDuels = Number(personal.duels) || 0;
    if (["warmup", "tiebreak"].includes(state.gameMode)) {
      const mode = state.gameMode;
      clearVoteTimers();
      resetPendingVoteForIdentityChange(state);
      await enterPairMode(mode);
      announceStatus("Sessão restabelecida. Uma nova rodada foi emitida para este jogo.");
      return;
    }
    if (dailySession) {
      const validatedDaily = validateDailySession(dailySession);
      const changedRound = dailySessionRoundChanged(state.dailySession, validatedDaily);
      if (state.gameMode === "daily" && changedRound) {
        installDailySession(validatedDaily);
        state.pendingWinnerId = "";
        state.busy = false;
        state.votePhase = VOTE_PHASES.READY;
        state.voteAction = "";
        state.sessionRecoveryMode = "";
        state.result = "A rodada do dia mudou enquanto a sessão era restabelecida.";
        render();
        return;
      }
      state.dailySession = validatedDaily;
    }
    state.busy = false;
    state.votePhase = VOTE_PHASES.RETRY_READY;
    state.voteAction = VOTE_ACTIONS.RETRY;
    state.sessionRecoveryMode = "";
    state.result = "Sessão restabelecida. Confirme novamente sua escolha.";
    render();
  } catch (error) {
    if (Number(state.identityEpoch || 0) !== recoveryEpoch) return;
    state.busy = false;
    const failure = voteFailureState(error);
    state.votePhase = failure.phase;
    state.voteAction = VOTE_ACTIONS.RESTORE_SESSION;
    state.retryAfterSeconds = failure.retryAfterSeconds;
    state.retryAt = failure.retryAt;
    state.result = failure.message;
    state.resultTone = "erro";
    render();
    scheduleRetryUnlock();
    sound.play("error");
  }
}

/** Relê o estado do jogador no servidor. Devolve `false` se nem isso deu. */
async function resyncPlayer(attemptIdentity) {
  try {
    const personal = await loadPlayerRanking(attemptIdentity.recoveryKey);
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return false;
    state.playerVersion = personal.version ?? state.playerVersion;
    state.personalRanking = rankingForCatalog(personal, state.candidates);
    state.personalRankingPolicy = personal.rankingPolicy || state.personalRankingPolicy;
    state.personalDuels = Number(personal.duels) || state.personalDuels;
    return true;
  } catch {
    return false;
  }
}

async function resyncDailyState(attemptIdentity) {
  try {
    const [personal, session] = await Promise.all([
      loadPlayerRanking(attemptIdentity.recoveryKey),
      loadDailySession(attemptIdentity.recoveryKey),
    ]);
    if (!isCurrentVoteIdentity(state, attemptIdentity)) return false;
    state.playerVersion = personal.version ?? state.playerVersion;
    state.personalRanking = rankingForCatalog(personal, state.candidates);
    state.personalRankingPolicy = personal.rankingPolicy || state.personalRankingPolicy;
    state.personalDuels = Number(personal.duels) || 0;
    state.pendingDailySession = null;
    installDailySession(session);
    return true;
  } catch {
    return false;
  }
}

function closeAuth() {
  state.authOpen = false;
  state.authError = "";
  state.authErrorKind = "";
  render();
}

async function refreshPredictionState() {
  if (state.predictionBusy) return;
  state.predictionBusy = true;
  render();
  const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  const resynced = await resyncDailyState(identity);
  if (!isCurrentVoteIdentity(state, identity)) return;
  state.predictionBusy = false;
  if (!resynced) state.predictionError = PREDICTION_REVEAL_COPY.refreshFailed;
  render();
}

function handleAppClick(event) {
  if (event.target === refs.modal && refs.modal.open) {
    refs.modal.close();
    return;
  }
  if (event.target.matches?.(".auth-overlay")) {
    closeAuth();
    return;
  }

  const button = event.target.closest?.("button");
  if (!button || !app.contains(button)) return;

  if (["close-modal", "close-modal-top"].includes(button.id)) {
    refs.modal.close();
    return;
  }
  if (button.id === "mirror-comparison") { loadMirrorComparison(); return; }
  if (["leave-pair", "leave-pair-status"].includes(button.id)) {
    if (state.busy || state.pendingWinnerId || state.pendingDiscard) return;
    state.warmupSkipped = true; enterDuel("daily"); return;
  }
  if (button.id === "retry-pair") { enterPairMode(state.gameMode); return; }
  if (button.id === "start-tiebreak") { enterPairMode("tiebreak"); return; }
  if (button.id === "retry-collection" || button.dataset.screen === "collection") { loadCollection(); return; }
  if (button.hasAttribute("data-discard")) { confirmDiscard(button.dataset.discard || null); return; }
  if (button.hasAttribute("data-discard-continue")) {
    if (state.pendingDiscard && state.discardError && !state.discardBusy) {
      finishDiscard("Sua escolha está confirmada. Não foi possível confirmar o descarte; ele pode ter sido registrado.");
    }
    return;
  }
  if (button.id === "account-button") {
    sound.play("navigation");
    state.authOpen = true;
    state.authError = "";
    state.authErrorKind = "";
    render();
    return;
  }
  if (["close-auth", "continue-anonymous"].includes(button.id)) {
    closeAuth();
    return;
  }
  if (button.id === "logout") {
    signOut();
    return;
  }
  if (button.id === "retry-google-provider") {
    state.authError = "";
    state.authErrorKind = "";
    render();
    return;
  }
  if (button.id === "sound-toggle") {
    if (state.soundEnabled) {
      sound.play("soundOff");
      state.soundEnabled = sound.setEnabled(false);
    } else {
      state.soundEnabled = sound.setEnabled(true);
      sound.play("soundOn");
    }
    renderHeader();
    // WebKit does not focus buttons on pointer activation; this preserves the
    // existing control contract without repairing focus after a DOM remount.
    button.focus();
    return;
  }
  if (button.id === "retry") {
    sound.play("navigation");
    initialize();
    return;
  }
  if (["start-election", "start-election-secondary"].includes(button.id)) {
    enterDuel("daily");
    return;
  }
  if (button.id === "open-ranking") {
    sound.play("navigation");
    state.screen = "ranking";
    state.result = "";
    state.resultTone = "";
    render();
    return;
  }
  if (button.id === "open-prediction-results" || button.id === "retry-prediction-results") {
    sound.play("navigation");
    openDailyPredictionResults();
    return;
  }
  if (button.id === "prediction-results-home") {
    sound.play("navigation");
    state.screen = "topics";
    state.predictionResultsError = "";
    render();
    return;
  }
  if (button.id === "continue-duels") {
    state.result = "";
    state.resultTone = "";
    enterDuel();
    return;
  }
  if (button.id === "start-free-mode" || button.id === "daily-loading-free") {
    state.result = "";
    state.resultTone = "";
    enterDuel("free");
    return;
  }
  if (button.id === "retry-daily") {
    enterDuel("daily");
    return;
  }
  if (button.id === "daily-open-ranking") {
    sound.play("navigation");
    state.screen = "ranking";
    state.rankingView = "personal";
    state.result = "";
    state.resultTone = "";
    render();
    return;
  }
  if (["retry-vote", "restore-session"].includes(button.id)) {
    const recovery = voteRecoveryControl(state);
    if (!recovery.visible || recovery.disabled || recovery.id !== button.id) return;
    const pendingCandidate = refs.slots.find(({ button: candidateButton }) => candidateButton.dataset.vote === state.pendingWinnerId);
    if (!pendingCandidate) return;
    // O controle de recuperação some quando a tentativa começa. Transfira o
    // foco antes para a carta persistente que continua representando a escolha.
    pendingCandidate.button.focus();
    if (state.voteAction === VOTE_ACTIONS.RESTORE_SESSION) restoreVoteSession();
    else vote(state.pendingWinnerId, { retry: true });
    return;
  }
  if (button.id === "retry-prediction") {
    answerDailyPrediction(null, { retry: true });
    return;
  }
  if (button.id === "refresh-prediction") {
    refreshPredictionState();
    return;
  }
  if (button.id === "skip-prediction") {
    answerDailyPrediction(null);
    return;
  }
  if (button.id === "skip-round") {
    if (state.busy || state.pendingWinnerId) return;
    sound.play("shuffle");
    state.result = "";
    state.resultTone = "";
    chooseNextRound();
    render();
    announceStatus("Nova rodada disponível");
    return;
  }
  if (button.id === "dismiss-coach") {
    sound.play("navigation");
    localStorage.setItem("polimatch:v4:round-coach", "seen");
    state.showCoach = false;
    refs.coachDialog.close();
    return;
  }
  if (button.id === "reveal-ranking") {
    state.rankingExpanded = true;
    renderRanking();
    return;
  }
  if (button.dataset.profile) {
    if (state.busy || state.pendingWinnerId || button.getAttribute("aria-disabled") === "true") return;
    showProfile(button.dataset.profile, button);
    return;
  }
  if (button.dataset.screen) {
    if (button.dataset.screen === "duel") enterDuel();
    else {
      sound.play("navigation");
      state.screen = button.dataset.screen;
      state.result = "";
      state.resultTone = "";
      render();
    }
    return;
  }
  if (button.dataset.rankingView) {
    sound.play("navigation");
    state.rankingView = button.dataset.rankingView;
    state.rankingQuery = "";
    state.rankingParty = "";
    state.rankingArea = "";
    state.rankingExpanded = false;
    renderRanking();
  }
}

function installEvents() {
  app.addEventListener("click", handleAppClick);
  app.addEventListener("input", (event) => {
    if (event.target.id !== "ranking-search") return;
    state.rankingQuery = event.target.value;
    renderRanking();
  });
  document.querySelector("#ranking-party")?.addEventListener("change", (event) => {
    state.rankingParty = event.target.value;
    state.rankingExpanded = false;
    render();
  });
  document.querySelector("#ranking-area")?.addEventListener("change", (event) => {
    state.rankingArea = event.target.value;
    state.rankingExpanded = false;
    render();
  });
  app.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.authOpen) closeAuth();
  });
  app.addEventListener("error", (event) => {
    if (event.target.matches?.(".candidate-card .portrait img")) markPortraitFailed(event.target);
  }, true);
  app.addEventListener("load", (event) => {
    if (event.target.matches?.(".candidate-card .portrait img")) markPortraitLoaded(event.target);
  }, true);
  refs.modal.addEventListener("close", () => {
    sound.play("dismiss");
    refs.slots.forEach(({ button }) => button.classList.remove("is-peeking"));
    const returnTarget = profileReturnTarget;
    const returnCandidateId = profileReturnCandidateId;
    profileReturnTarget = null;
    profileReturnCandidateId = "";
    const currentCandidateId = returnTarget?.dataset.profile || returnTarget?.dataset.vote || "";
    const active = document.activeElement;
    if (returnTarget?.isConnected && currentCandidateId === returnCandidateId
      && (active === document.body || active === returnTarget || refs.modal.contains(active))) {
      returnTarget.focus();
    }
  });
  refs.coachDialog.addEventListener("close", () => {
    localStorage.setItem("polimatch:v4:round-coach", "seen");
    state.showCoach = false;
    setTimeout(() => refs.slots[0]?.button.focus(), 0);
  });
  refs.slots.forEach(({ button }) => installPressGesture(button, {
    onTap: () => {
      if (button.getAttribute("aria-disabled") === "true") return;
      if (button.dataset.predict) answerDailyPrediction(button.dataset.predict);
      else if (button.dataset.vote) vote(button.dataset.vote);
    },
    onHold: () => {
      if (state.busy || state.pendingWinnerId || button.getAttribute("aria-disabled") === "true" || !button.dataset.vote) return;
      button.classList.add("is-peeking");
      try { navigator.vibrate?.(18); } catch {}
      showProfile(button.dataset.vote, button);
    },
  }));
}

function mountApp() {
  const template = document.createElement("template");
  template.innerHTML = appMarkup();
  app.replaceChildren(template.content.cloneNode(true));
  refs = captureRefs();
  renderCollection();
  installEvents();
  civicShell = createCivicShell({
    app,
    panel: refs.civicPanel,
    nav: refs.nav,
    sheet: refs.navMoreSheet,
    getScreen: () => state.screen,
    setScreen: (screen) => {
      state.screen = screen;
      state.result = "";
      state.resultTone = "";
      render();
    },
    getGameFeatures: () => state.gameFeatures,
    isReady: () => state.ready,
    announce: announceStatus,
    sound,
  });
}

async function mountAuthButton() {
  const element = refs.overlays.querySelector("#google-button");
  if (!element || !googleClientId()) return;
  try {
    await mountGoogleButton(element, { callback: handleGoogleCredential });
  } catch (error) {
    if (!state.authOpen) return;
    state.authError = error.message || "Não foi possível abrir o Google agora.";
    state.authErrorKind = "provider";
    render();
  }
}

async function handleGoogleCredential(response) {
  if (!response?.credential || state.authBusy) return;
  state.authBusy = true;
  state.authError = "";
  state.authErrorKind = "";
  render();
  let result;
  try {
    result = await exchangeGoogleCredential(response.credential, state.recoveryKey);
  } catch (error) {
    state.authBusy = false;
    state.authError = error.message || "Não foi possível salvar seu jogo agora.";
    state.authErrorKind = "credential";
    sound.play("error");
    render();
    return;
  }
  clearVoteTimers();
  resetPendingVoteForIdentityChange(state);
  localStorage.setItem("polimatch:v3:recovery-key", result.sessionToken);
  state.recoveryKey = result.sessionToken;
  state.account = result.account;
  state.authNotice = result.merge?.status === "combined"
    ? result.merge.dailyConflict
      ? `Suas ${result.merge.anonymousChoices} escolhas recentes foram reunidas ao histórico. Havia duas sessões para a rodada do dia; a sessão anônima recente continua ativa e a anterior permanece no histórico.`
      : `Suas ${result.merge.anonymousChoices} escolhas recentes foram reunidas ao histórico. A rodada do dia continua na sessão ${result.merge.activeDaily === "anonymous" ? "anônima recente" : "da conta"}.`
    : result.merge?.status === "alreadyCombined" ? "Suas escolhas já estavam reunidas; o acesso foi recuperado." : "";
  state.predictionResults = null;
  state.predictionResultsError = "";
  state.personalRanking = rankingForCatalog(result.player, state.candidates);
  state.personalRankingPolicy = result.player.rankingPolicy || state.personalRankingPolicy;
  state.playerVersion = result.player.version;
  state.personalDuels = Number(result.player.duels) || 0;
  state.gameMode = "daily";
  state.dailyLoading = true;
  state.authBusy = false;
  sound.play("confirm");
  render();
  // A identidade já foi confirmada e persistida. Uma indisponibilidade só do
  // serviço diário não pode desfazer o login nem bloquear ranking/modo livre.
  await refreshDailySession({ epoch: state.identityEpoch, recoveryKey: state.recoveryKey });
}

async function signOut() {
  if (state.authBusy) return;
  state.authBusy = true;
  state.authError = "";
  state.authErrorKind = "";
  render();
  try {
    await revokeSessionBeforeClearing(state.recoveryKey, {
      endSession,
      clearLocalSession: () => localStorage.removeItem("polimatch:v3:recovery-key"),
    });
    const player = await ensurePlayer();
    clearVoteTimers();
    resetPendingVoteForIdentityChange(state);
    state.recoveryKey = player.recoveryKey;
    state.account = null;
    state.authNotice = "";
    state.predictionResults = null;
    state.predictionResultsError = "";
    state.personalRanking = rankingForCatalog(player.personal, state.candidates);
    state.personalRankingPolicy = player.personal.rankingPolicy || state.personalRankingPolicy;
    state.playerVersion = player.personal.version;
    state.personalDuels = Number(player.personal.duels) || 0;
    state.gameMode = "daily";
    state.dailyLoading = true;
    state.authBusy = false;
    state.authOpen = false;
    state.result = "Você saiu. Um jogo novo começou neste aparelho.";
    state.resultTone = "";
    state.pendingWinnerId = "";
    state.roundId = crypto.randomUUID();
    render();
    announceStatus(state.result);
    // A sessão antiga já foi revogada e a identidade anônima já está ativa.
    // O diário tem retry próprio e jamais pode restaurar visualmente a conta.
    await refreshDailySession({ epoch: state.identityEpoch, recoveryKey: state.recoveryKey });
  } catch (error) {
    state.authBusy = false;
    state.authError = error.message || "Não foi possível sair agora.";
    state.authErrorKind = "session";
    render();
  }
}

async function ensurePlayer() {
  const storageKey = "polimatch:v3:recovery-key";
  let recoveryKey = localStorage.getItem(storageKey) || "";
  if (!recoveryKey) {
    const created = await createPlayer();
    recoveryKey = created.recoveryKey;
    localStorage.setItem(storageKey, recoveryKey);
  }
  try {
    return { recoveryKey, personal: await loadPlayerRanking(recoveryKey) };
  } catch (error) {
    // A chave é a única credencial do jogador e não é exibida em lugar nenhum:
    // descartá-la apaga o ranking pessoal para sempre. Só um 401 prova que ela
    // não vale mais. Qualquer outra falha — 500, 503, tempo esgotado, rede fora —
    // é passageira, e nesses casos a chave precisa sobreviver.
    if (error?.status !== 401) throw error;
    localStorage.removeItem(storageKey);
    const created = await createPlayer();
    localStorage.setItem(storageKey, created.recoveryKey);
    return { recoveryKey: created.recoveryKey, personal: await loadPlayerRanking(created.recoveryKey) };
  }
}

async function initialize() {
  state.error = "";
  state.ready = false;
  render();
  let identity = null;
  try {
    const capabilitiesRequest = loadCapabilities()
      .then(validateCapabilities)
      .catch(() => PERSONAL_ONLY_CAPABILITIES);
    const [candidates, player, capabilities, gameFeatures] = await Promise.all([loadCandidates(), ensurePlayer(), capabilitiesRequest, loadGameCapabilities().catch(() => ({}))]);
    state.gameFeatures = gameFeatures?.version === 1 ? gameFeatures : {};
    installCapabilities(capabilities);
    let snapshot = null;
    if (aggregateAvailable("global-ranking")) {
      try {
        snapshot = await loadRanking();
      } catch {
        installCapabilities(withAggregateScopeWithheld(state.capabilities, "global-ranking"));
      }
    }
    state.candidates = catalogForTopic(candidates);
    if (state.candidates.length < 4) throw new Error("O elenco ainda não está disponível");
    state.ranking = snapshot ? rankingForCatalog(snapshot, state.candidates) : [];
    state.globalDuels = snapshot ? Number(snapshot.duels) || 0 : 0;
    state.recoveryKey = player.recoveryKey;
    state.playerVersion = player.personal.version;
    state.personalRanking = rankingForCatalog(player.personal, state.candidates);
    state.personalRankingPolicy = player.personal.rankingPolicy || null;
    state.account = player.personal.account || null;
    state.personalDuels = Number(player.personal.duels) || 0;
    state.rankingView = "personal";
    state.gameMode = "daily";
    state.dailyLoading = true;
    state.pendingWinnerId = "";
    state.resultTone = "";
    state.ready = true;
    identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  } catch (error) {
    state.error = error.message || "Falha desconhecida";
  }
  render();
  // Deep link cívico aberto antes do jogo ficar pronto é resolvido agora, sem
  // interferir na rodada: o shell só troca `state.screen`.
  if (state.ready) civicShell?.start();
  // Catálogo, identidade e ranking pessoal são o núcleo do app. Agregados são
  // opcionais e fail-closed; sua ausência nunca derruba o jogo pessoal.
  if (identity) await refreshDailySession(identity);
}

function pairStatusContent() {
  const message = state.pairLoading ? "Preparando duas cartas…" : state.pairError || (state.gameMode === "warmup"
    ? "Aquecimento concluído. Agora vêm as dez escolhas do dia."
    : "Revisão concluída para os nomes observados do seu Top 5. Preferências próximas podem continuar empatadas; novas escolhas podem mudar esse retrato.");
  return `<section class="panel"><h1>${state.gameMode === "warmup" ? "Duelo rápido" : "Seu Top 5"}</h1><p role="status">${escapeHtml(message)}</p>${state.pairError ? '<button type="button" id="retry-pair">Tentar novamente</button>' : ""}<button type="button" id="leave-pair-status" class="primary">Ir para as dez escolhas</button></section>`;
}

async function enterPairMode(mode) {
  if (!state.gameFeatures.pairs || state.busy) return;
  const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  const loadEpoch = ++state.dailyLoadEpoch;
  state.selectionIds = [];
  state.screen = "duel"; state.gameMode = mode; state.pairLoading = true;
  state.pairError = ""; state.showCoach = false; state.round = []; render();
  try {
    const result = await gameRequest("/api/pair-round", identity.recoveryKey, { mode, topicId: "eleicoes-2026" });
    if (!isCurrentVoteIdentity(state, identity) || loadEpoch !== state.dailyLoadEpoch) return;
    if (!result || result.mode !== mode || !["active", "completed"].includes(result.status)
        || !Number.isSafeInteger(result.remaining) || result.remaining < 0) throw new Error("Rodada incompleta. Tente novamente.");
    state.pairRemaining = result.remaining;
    if (result.status === "active") {
      const ids = result.round?.candidateIds;
      if (!Array.isArray(ids) || ids.length !== 2 || new Set(ids).size !== 2 || !result.round.id
          || ids.some(id => !state.candidates.some(person => person.id === id))) throw new Error("Rodada divergente. Tente novamente.");
      state.round = ids.map(id => state.candidates.find(person => person.id === id));
      state.roundId = result.round.id; state.pendingWinnerId = ""; state.votePhase = VOTE_PHASES.READY;
      state.result = "Duas cartas. A escolha conta nos seus confrontos; o placar público só aparece quando autorizado.";
    } else if (mode === "warmup") state.warmupSkipped = true;
  } catch (error) {
    if (!isCurrentVoteIdentity(state, identity) || loadEpoch !== state.dailyLoadEpoch) return;
    state.pairError = error.message;
  }
  state.pairLoading = false; render();
}

function renderDiscard() {
  const panel = refs.panels.duel.querySelector("[data-discard-panel]");
  const pending = state.pendingDiscard;
  panel.hidden = !pending;
  if (!pending) { if (panel.textContent) panel.replaceChildren(); return; }
  if (panel.dataset.roundId !== pending.roundId) {
    panel.dataset.roundId = pending.roundId;
    // Only acknowledged presentations enter the optional-decision denominator.
    // Recording an offer must not block the person's confirmed primary choice.
    gameRequest("/api/discard-offer", state.recoveryKey, { roundId: pending.roundId }).catch(() => {});
    const button = (id, label) => '<button type="button" data-discard="' + escapeHtml(id || "") + '">' + escapeHtml(label) + '</button>';
    panel.innerHTML = '<h2>Quem você tira da mesa?</h2><p>Opcional. O descarte é registrado à parte e não muda o ranking.</p><p class="discard-status" role="status"></p><div class="discard-actions">' + pending.candidates.map(person => button(person.id, 'Descartar ' + (person.displayName || person.name))).join('') + button(null, 'Pular descarte') + '<button type="button" data-discard-continue hidden>Continuar sem confirmar descarte</button></div>';
  }
  panel.querySelector('.discard-status').textContent = state.discardError || (state.discardBusy ? 'Confirmando descarte…' : '');
  panel.querySelector('[data-discard-continue]').hidden = !state.discardError || state.discardBusy;
  for (const button of panel.querySelectorAll('[data-discard]')) {
    const same = (button.dataset.discard || null) === pending.attempted;
    button.setAttribute('aria-disabled', String(state.discardBusy || (Object.hasOwn(pending, 'attempted') && !same)));
  }
}

async function finishDiscard(message) {
  const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  const advance = advanceAfterDiscard;
  advanceAfterDiscard = null;
  state.pendingDiscard = null; state.discardBusy = false; state.discardError = "";
  renderDiscard();
  await advance?.();
  if (!isCurrentVoteIdentity(state, identity)) return;
  const visible = selector => [...refs.panels.duel.querySelectorAll(selector)].find(element => element.getClientRects().length > 0);
  const target = visible("[data-vote]") || visible("h1");
  if (target) { if (!target.matches("button")) target.tabIndex = -1; target.focus(); }
  announceStatus(message);
}

async function confirmDiscard(candidateId) {
  const pending = state.pendingDiscard;
  if (!pending || state.discardBusy) return;
  if (Object.hasOwn(pending, "attempted") && pending.attempted !== candidateId) return;
  pending.attempted = candidateId;
  const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  state.discardBusy = true; state.discardError = ""; renderDiscard();
  try {
    const result = await gameRequest("/api/round-discard", identity.recoveryKey, { roundId: pending.roundId, candidateId });
    if (!isCurrentVoteIdentity(state, identity) || state.pendingDiscard !== pending) return;
    if (result.roundId !== pending.roundId || result.candidateId !== candidateId || result.rankingEffect !== "none") throw new Error("Confirmação incompleta; repita a mesma decisão.");
    await finishDiscard(candidateId ? "Descarte registrado separadamente. Seu ranking foi preservado." : "Descarte pulado. Sua escolha está confirmada.");
  } catch (error) {
    if (!isCurrentVoteIdentity(state, identity) || state.pendingDiscard !== pending) return;
    state.discardBusy = false; state.discardError = error.message; renderDiscard();
  }
}

async function loadCollection() {
  if (!state.gameFeatures.collection || state.busy) return;
  const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  state.screen = "collection"; state.collectionLoading = true; state.collectionError = ""; render();
  try {
    const result = await gameRequest("/api/collection", identity.recoveryKey);
    if (!isCurrentVoteIdentity(state, identity)) return;
    if (!Array.isArray(result.items) || result.purchasable !== false) throw new Error("Inventário incompleto. Tente novamente.");
    state.collection = result.items;
  } catch (error) { if (isCurrentVoteIdentity(state, identity)) state.collectionError = error.message; }
  if (isCurrentVoteIdentity(state, identity)) { state.collectionLoading = false; render(); }
}

let capabilitiesRefreshId = 0;
async function refreshCapabilitiesOnResume() {
  const requestId = ++capabilitiesRefreshId;
  // Hide cached aggregate data while fresh server authorization is unknown.
  installCapabilities(PERSONAL_ONLY_CAPABILITIES);
  render();
  const fresh = await loadCapabilities().catch(() => PERSONAL_ONLY_CAPABILITIES);
  if (requestId !== capabilitiesRefreshId) return;
  installCapabilities(fresh);
  if (aggregateAvailable("global-ranking") && state.ready) {
    try {
      const snapshot = await loadRanking();
      if (requestId !== capabilitiesRefreshId || !aggregateAvailable("global-ranking")) return;
      state.ranking = rankingForCatalog(snapshot, state.candidates);
      state.globalDuels = Number(snapshot.duels) || 0;
    } catch {
      if (requestId !== capabilitiesRefreshId) return;
      installCapabilities(withAggregateScopeWithheld(state.capabilities, "global-ranking"));
    }
  }
  render();
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void refreshCapabilitiesOnResume();
});
window.addEventListener("focus", () => { void refreshCapabilitiesOnResume(); });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
mountApp();
initialize();

function mirrorComparisonContent() {
  return '<section class="mirror-comparison"><h2>' + MIRROR_COPY.heading + '</h2><p role="status" data-mirror-status></p><p data-mirror-sample></p><button type="button" id="mirror-comparison">' + MIRROR_COPY.action + '</button></section>';
}
function patchMirrorComparison() {
  const panel = refs.duelAux.querySelector('.mirror-comparison');
  if (!panel) return;
  const comparison = mirrorComparison?.comparison;
  const summary = comparison ? formatAggregateCopy(MIRROR_COPY.summary, comparison) : MIRROR_COPY.pending;
  const sample = comparison ? formatAggregateCopy(MIRROR_COPY.sample, { count: comparison.completedPlayers }) : "";
  panel.querySelector('[data-mirror-status]').textContent = mirrorComparisonLoading ? MIRROR_COPY.loading : mirrorComparisonError || summary;
  panel.querySelector('[data-mirror-sample]').textContent = sample;
  panel.querySelector('button').setAttribute('aria-disabled', String(mirrorComparisonLoading));
}
async function loadMirrorComparison() {
  if (mirrorComparisonLoading || !aggregateAvailable("mirror-comparison")) return;
  const identity = { epoch: state.identityEpoch, recoveryKey: state.recoveryKey };
  mirrorComparisonLoading = true; mirrorComparisonError = ""; render();
  try {
    const result = await gameRequest("/api/mirror-comparison", identity.recoveryKey);
    if (!isCurrentVoteIdentity(state, identity) || !aggregateAvailable("mirror-comparison")) return;
    if (!["pending", "published"].includes(result.status) || (result.status === "published" && (!result.comparison || !Number.isSafeInteger(result.comparison.aligned)))) throw new TypeError("Invalid closed comparison");
    mirrorComparison = result;
  } catch { if (isCurrentVoteIdentity(state, identity) && aggregateAvailable("mirror-comparison")) mirrorComparisonError = MIRROR_COPY.error; }
  finally { if (isCurrentVoteIdentity(state, identity)) { mirrorComparisonLoading = false; render(); } }
}
