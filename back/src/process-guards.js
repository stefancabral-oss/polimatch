// Política de falhas do processo da API:
// - unhandledRejection: registra com contexto e segue atendendo. A rejeição
//   não interrompe nenhuma pilha síncrona, e as rotas assíncronas já respondem
//   pelo tratamento de erros do Express 5. Healthcheck e orquestrador continuam
//   como rede de segurança se algo ficar realmente quebrado.
// - uncaughtException: o estado do processo deixa de ser confiável. Registra,
//   para de aceitar conexões, espera as requisições em andamento por um prazo
//   curto, fecha o pool e sai com código 1 para o orquestrador reiniciar.
// - SIGTERM/SIGINT: o mesmo encerramento ordenado, com código 0.
export const DEFAULT_FORCE_EXIT_MS = 8000;

export function installProcessGuards({
  processRef = process,
  logger,
  close = async () => {},
  exit = (code) => processRef.exit(code),
  forceExitMs = DEFAULT_FORCE_EXIT_MS,
} = {}) {
  let stopping = null;

  function shutdown(reason, exitCode) {
    if (stopping) return stopping;
    logger?.info?.({ event: "shutdown_started", reason, exitCode });
    // Se o loop esvaziar antes do exit explícito, o código já está certo.
    processRef.exitCode = exitCode;
    // Referenciado de propósito: um close() pendurado não pode virar saída 0.
    const forced = setTimeout(() => {
      logger?.error?.({ event: "shutdown_forced", reason, afterMs: forceExitMs });
      exit(exitCode || 1);
    }, forceExitMs);
    stopping = (async () => {
      try {
        await close();
        logger?.info?.({ event: "shutdown_completed", reason, exitCode });
      } catch (error) {
        logger?.error?.({ event: "shutdown_failed", reason, err: error });
        exitCode = exitCode || 1;
      } finally {
        clearTimeout(forced);
        exit(exitCode);
      }
    })();
    return stopping;
  }

  const onUnhandledRejection = (reason) => {
    logger?.error?.({ event: "unhandled_rejection", fatal: false, err: reason });
  };
  const onUncaughtException = (error, origin) => {
    logger?.fatal?.({ event: "uncaught_exception", fatal: true, origin, err: error });
    // Uma segunda exceção durante o encerramento não espera mais nada.
    if (stopping) return exit(1);
    shutdown("uncaughtException", 1);
  };
  const onSignal = (signal) => shutdown(signal, 0);

  processRef.on("unhandledRejection", onUnhandledRejection);
  processRef.on("uncaughtException", onUncaughtException);
  processRef.on("SIGTERM", onSignal);
  processRef.on("SIGINT", onSignal);

  return {
    shutdown,
    uninstall() {
      processRef.removeListener("unhandledRejection", onUnhandledRejection);
      processRef.removeListener("uncaughtException", onUncaughtException);
      processRef.removeListener("SIGTERM", onSignal);
      processRef.removeListener("SIGINT", onSignal);
    },
  };
}

export function closeHttpServer(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    // Conexões keep-alive ociosas não seguram o encerramento.
    server.closeIdleConnections?.();
  });
}
