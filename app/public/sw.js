// O app é online-only: este service worker existe só para a instalação do PWA.
// Não há listener de fetch, então as requisições vão direto à rede e ao cache
// HTTP, sem passar pelo worker. O activate apaga caches de versões anteriores.
const VERSION = "polimatch-eleicoes-2026-v2";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

void VERSION;
