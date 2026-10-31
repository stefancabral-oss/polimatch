import { createGoogleIdentityVerifier } from "./google-auth.js";
import { createHttpApp } from "./http-app.js";
import { createTopicStore } from "./topic-store.js";

const PORT = Number(process.env.PORT) || 3001;
const store = createTopicStore();
const googleIdentity = createGoogleIdentityVerifier();
const app = createHttpApp({ store, googleIdentity });

let migration;
try {
  migration = await store.init();
} catch (error) {
  // Sem esquema confirmado a API não escuta: o healthcheck falha e nada é gravado.
  console.error("Inicialização do PostgreSQL interrompida; API encerrada sem atender", {
    code: error.code,
    message: error.message,
  });
  await store.close().catch(() => {});
  process.exit(1);
}
console.log("PostgreSQL Eleições 2026 inicializado", migration);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`PoliMatch API em http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} recebido; encerrando API`);
  server.close(async () => {
    await store.close();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
