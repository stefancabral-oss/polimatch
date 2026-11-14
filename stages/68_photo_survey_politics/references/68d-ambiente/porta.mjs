// Ambiente descartável da 68d: serve o build da página em doze portas (cada
// porta é uma "rede", duas por agente) e encaminha a API de cada rede, de
// outra origem, como em produção. Nada aqui fala com produção.
//
// Uso: node porta.mjs <pasta-do-build>
// Controle: GET http://127.0.0.1:3100/__controle?rede=4205&modo=fora
//   modos: aberta (padrão), fora (conexão derrubada), 502 (resposta de proxy
//   sem a API atrás), fechada (só na rede que tem a API fechada).
import http from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

// `resolve` tira barras dobradas e a barra final: sem isso a conferência de
// caminho abaixo recusava todos os arquivos.
const DIST = resolve(process.argv[2]);
const GATEWAY = 3100;
// Cada agente tem um banco e uma API, e duas redes: 420N e 421N.
const NETWORKS = new Map();
for (let agent = 1; agent <= 6; agent += 1) {
  const apis = { api: 3300 + agent, ...(agent === 6 ? { closedApi: 3316 } : {}) };
  NETWORKS.set(4200 + agent, apis);
  NETWORKS.set(4210 + agent, apis);
}
const modes = new Map();
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif", ".ico": "image/x-icon", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav",
};

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const relative = normalize(pathname === "/" ? "/index.html" : pathname);
  const file = join(DIST, relative);
  if (!file.startsWith(DIST + sep)) { res.writeHead(403).end(); return; }
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error("não é arquivo");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream", "Content-Length": stats.size, "Cache-Control": "no-store" });
    if (req.method === "HEAD") { res.end(); return; }
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("404");
  }
}

for (const port of NETWORKS.keys()) http.createServer(serveStatic).listen(port, "127.0.0.1");

function networkOf(req) {
  try {
    return Number(new URL(req.headers.origin).port);
  } catch {
    return 0;
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/__controle") {
    const port = Number(url.searchParams.get("rede"));
    const mode = url.searchParams.get("modo");
    if (port && mode) {
      const network = NETWORKS.get(port);
      const valid = network && (["aberta", "fora", "502"].includes(mode) || (mode === "fechada" && network.closedApi));
      if (!valid) { res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ erro: "rede ou modo inválido" })); return; }
      modes.set(port, mode);
    }
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(Object.fromEntries([...NETWORKS.keys()].map((key) => [key, modes.get(key) || "aberta"]))));
    return;
  }
  const port = networkOf(req);
  const network = NETWORKS.get(port);
  if (!network) { res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ erro: "chamada sem Origin de uma rede do ensaio" })); return; }
  const mode = modes.get(port) || "aberta";
  if (mode === "fora") { req.socket.destroy(); return; }
  if (mode === "502") { res.writeHead(502, { "Content-Type": "text/html" }).end("<h1>502 Bad Gateway</h1>"); return; }
  const target = mode === "fechada" ? network.closedApi : network.api;
  const upstream = http.request({
    host: "127.0.0.1",
    port: target,
    method: req.method,
    path: req.url,
    headers: { ...req.headers, host: `127.0.0.1:${target}`, "x-forwarded-for": `10.68.${port - 4200}.1` },
  }, (answer) => {
    res.writeHead(answer.statusCode, answer.headers);
    answer.pipe(res);
  });
  upstream.on("error", () => res.destroy());
  req.pipe(upstream);
}).listen(GATEWAY, "127.0.0.1");

console.log(`redes: ${[...NETWORKS.keys()].join(", ")}; API em http://127.0.0.1:${GATEWAY}`);
