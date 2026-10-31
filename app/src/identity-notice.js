/**
 * Recusas na criação do jogador anônimo, traduzidas para a interface.
 *
 * O servidor abre poucos jogadores anônimos por rede a cada dia editorial.
 * Atrás de CGNAT, Wi-Fi de escola ou de escritório, essa cota acaba com gente
 * de verdade. A recusa não é falha de conexão: tem mensagem própria, indica o
 * login Google (que não usa essa cota) e diz quando a rede volta a abrir jogos.
 */
export const PLAYER_ISSUANCE_LIMIT = "PLAYER_ISSUANCE_LIMIT";
export const QUOTA_TIME_ZONE = "America/Sao_Paulo";

export const IDENTITY_NOTICE_COPY = Object.freeze({
  quotaEyebrow: "Limite de jogos novos",
  quotaHeading: "Muitos jogos novos nesta rede hoje.",
  quotaBody: "Para proteger o ranking, cada rede abre poucos jogos anônimos por dia. Entre com Google para jogar agora e guardar seu histórico.",
  quotaGoogle: "Entrar com Google",
  quotaWithoutGoogle: "O acesso com Google ainda está sendo preparado.",
  quotaQuiz: "Quem disse isso? continua aberto, sem conta.",
  failureEyebrow: "Jogo não iniciado",
  failureHeading: "Não conseguimos começar seu jogo agora.",
  failureBody: "Nenhuma escolha foi registrada. Tente de novo em instantes; os quizzes continuam abertos.",
  failureRetry: "Tentar novamente",
  storageEyebrow: "Progresso só nesta aba",
  storageBody: "Seu navegador não permite salvar o progresso neste aparelho. As escolhas confirmadas ficam no servidor enquanto esta aba estiver aberta; entre com Google para guardá-las.",
});

export function isPlayerIssuanceLimit(error) {
  return Number(error?.status) === 429 && error?.code === PLAYER_ISSUANCE_LIMIT;
}

/** Guarda o motivo da recusa e, quando o servidor informa, o instante de liberação. */
export function identityNoticeFromError(error, now = Date.now()) {
  if (isPlayerIssuanceLimit(error)) {
    const seconds = Number(error.retryAfterSeconds);
    return {
      kind: "quota",
      retryAt: Number.isFinite(seconds) && seconds > 0 ? now + Math.ceil(seconds) * 1000 : null,
    };
  }
  return { kind: "failure", unreachable: Number(error?.status) === 0 };
}

/** Enquanto a rede não reabre, outra tentativa só gastaria uma requisição. */
export function quotaNoticeActive(notice, now = Date.now()) {
  return notice?.kind === "quota" && Number.isFinite(notice.retryAt) && now < notice.retryAt;
}

export function quotaResetLabel(retryAt, timeZone = QUOTA_TIME_ZONE) {
  if (!Number.isFinite(retryAt)) return "amanhã";
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(retryAt));
  return `às ${time} (horário de Brasília)`;
}

export function quotaResetSentence(retryAt, timeZone = QUOTA_TIME_ZONE) {
  return `Novos jogos anônimos nesta rede voltam a ser liberados ${quotaResetLabel(retryAt, timeZone)}.`;
}
