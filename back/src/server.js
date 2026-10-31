import { createGoogleIdentityVerifier } from "./google-auth.js";
import { createHttpApp } from "./http-app.js";
import { createLogger, logLevelFromEnvironment } from "./logger.js";
import { closeHttpServer, installProcessGuards } from "./process-guards.js";
import { EMBEDDED_RELEASE_REVISION } from "./release-identity.js";
import { createTopicStore } from "./topic-store.js";

const PORT = Number(process.env.PORT) || 3001;
const logger = createLogger({
  level: logLevelFromEnvironment(),
  base: { service: "polimatch-api", rev: EMBEDDED_RELEASE_REVISION || null },
});

let server = null;
let store = null;
const guards = installProcessGuards({
  logger,
  async close() {
    await closeHttpServer(server);
    await store?.close();
  },
});

try {
  store = createTopicStore(undefined, { logger });
  const googleIdentity = createGoogleIdentityVerifier();
  const app = createHttpApp({ store, googleIdentity, logger });

  const migration = await store.init();
  logger.info({ event: "database_ready", migration });

  server = app.listen(PORT, "0.0.0.0", () => {
    logger.info({ event: "listening", port: PORT });
  });
  server.on("error", (error) => {
    logger.fatal({ event: "server_error", err: error });
    guards.shutdown("server_error", 1);
  });
} catch (error) {
  logger.fatal({ event: "boot_failed", err: error });
  await guards.shutdown("boot_failed", 1);
}
