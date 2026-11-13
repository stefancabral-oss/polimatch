// Smoke da borda: faz só GET contra um nginx que serve o dist e confere
// compressão, cache, 404 de arquivo ausente, robots, sitemap, ícones e que
// nenhuma referência local volta como HTML. O dist lido aqui precisa ser o
// mesmo que o servidor está servindo (no CI, copiado de dentro do container).
//
// Uso: node app/scripts/smoke-nginx.mjs [url] [--dist caminho/do/dist]
// A URL também pode vir de POLIMATCH_NGINX_URL (padrão http://127.0.0.1:8080/).
import { existsSync, readdirSync, statSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectLocalReferences } from "./verify-public-refs.mjs";

const args = process.argv.slice(2);
const distFlag = args.indexOf("--dist");
const distDir = path.resolve(distFlag >= 0 ? args[distFlag + 1] : fileURLToPath(new URL("../dist/", import.meta.url)));
const positional = args.filter((arg, index) => !arg.startsWith("--") && (distFlag < 0 || index !== distFlag + 1));
const baseUrl = new URL(positional[0] ?? process.env.POLIMATCH_NGINX_URL ?? "http://127.0.0.1:8080/");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EXPECTED_ICONS = ["/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

function get(urlPath, headers = {}) {
  const url = new URL(urlPath.replace(/^\//, ""), baseUrl);
  const client = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.get(url, { headers: { "accept-encoding": "identity", ...headers } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on("error", reject);
    });
    request.setTimeout(10000, () => request.destroy(new Error(`tempo esgotado em ${url}`)));
    request.on("error", reject);
  });
}

const header = (response, name) => String(response.headers[name] ?? "");
const describe = (response) => `${response.status} ${header(response, "content-type") || "sem content-type"}`;

function filesBelow(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(full) : [full];
  }).sort();
}

const toUrlPath = (file) => `/${path.relative(distDir, file).split(path.sep).map(encodeURIComponent).join("/")}`;

const { htmlFiles, references } = collectLocalReferences(distDir);
if (!htmlFiles.length) {
  console.error(`Nenhum HTML encontrado em ${distDir}. Informe o dist servido com --dist.`);
  process.exit(1);
}

const assetRefs = [...new Set(references.map(({ urlPath }) => urlPath).filter((urlPath) => urlPath.startsWith("/assets/")))].sort();
const textAssets = assetRefs.filter((urlPath) => /\.(?:js|css)$/.test(urlPath));
const compressibleAssets = textAssets.filter((urlPath) => {
  const file = path.join(distDir, urlPath);
  return existsSync(file) && statSync(file).size >= 1024;
});
const largestSvg = filesBelow(distDir)
  .filter((file) => file.endsWith(".svg"))
  .map((file) => ({ file, size: statSync(file).size }))
  .filter(({ size }) => size >= 1024)
  .sort((a, b) => b.size - a.size)[0];
const firstImage = (directory) => filesBelow(path.join(distDir, directory)).find((file) => /\.(?:jpe?g|png|webp)$/i.test(file));
const mainScript = assetRefs.find((urlPath) => /^\/assets\/main-[^/]+\.js$/.test(urlPath));
const random = Math.random().toString(36).slice(2, 10);

const checks = [];
const check = (name, run) => checks.push({ name, run });

check("/ responde HTML com Cache-Control no-cache", async () => {
  const response = await get("/");
  const failures = [];
  if (response.status !== 200 || !header(response, "content-type").startsWith("text/html")) failures.push(`esperado 200 text/html, veio ${describe(response)}`);
  if (!/\bno-cache\b/.test(header(response, "cache-control"))) failures.push(`cache-control "${header(response, "cache-control")}" sem no-cache`);
  return failures;
});

check(`páginas HTML (${htmlFiles.length}) respondem com Cache-Control no-cache`, async () => {
  const failures = [];
  for (const name of htmlFiles) {
    const response = await get(`/${name}`);
    if (response.status !== 200 || !header(response, "content-type").startsWith("text/html")) failures.push(`/${name}: ${describe(response)}`);
    else if (!/\bno-cache\b/.test(header(response, "cache-control"))) failures.push(`/${name}: cache-control "${header(response, "cache-control")}"`);
  }
  return failures;
});

check(`JS e CSS com hash (${compressibleAssets.length} de ${textAssets.length} acima de 1 KB) saem com gzip e Vary`, async () => {
  const failures = [];
  if (!mainScript) failures.push("o index.html não referencia /assets/main-*.js");
  if (!compressibleAssets.length) failures.push("nenhum JS ou CSS com hash acima de 1 KB para conferir");
  for (const urlPath of compressibleAssets) {
    const response = await get(urlPath, { "accept-encoding": "gzip" });
    if (response.status !== 200) failures.push(`${urlPath}: ${describe(response)}`);
    else if (header(response, "content-encoding") !== "gzip") failures.push(`${urlPath}: content-encoding "${header(response, "content-encoding")}"`);
    else if (!/accept-encoding/i.test(header(response, "vary"))) failures.push(`${urlPath}: vary "${header(response, "vary")}"`);
  }
  return failures;
});

check(`assets com hash (${assetRefs.length}) têm cache de um ano e immutable`, async () => {
  const failures = [];
  for (const urlPath of assetRefs) {
    const response = await get(urlPath);
    const cacheControl = header(response, "cache-control");
    if (response.status !== 200) failures.push(`${urlPath}: ${describe(response)}`);
    else if (!/\bimmutable\b/.test(cacheControl) || !/\bmax-age=31536000\b/.test(cacheControl)) failures.push(`${urlPath}: cache-control "${cacheControl}"`);
  }
  return failures;
});

check("SVG acima de 1 KB sai com gzip", async () => {
  if (!largestSvg) return ["nenhum SVG acima de 1 KB no dist"];
  const urlPath = toUrlPath(largestSvg.file);
  const response = await get(urlPath, { "accept-encoding": "gzip" });
  return response.status === 200 && header(response, "content-encoding") === "gzip" ? [] : [`${urlPath}: ${describe(response)}, content-encoding "${header(response, "content-encoding")}"`];
});

check("arquivo estático ausente responde 404, nunca o index.html", async () => {
  const missing = [
    `/assets/nao-existe-${random}.js`,
    `/assets/nao-existe-${random}.css`,
    `/assets/nao-existe-${random}`,
    `/icons/nao-existe-${random}.png`,
    `/portraits/nao-existe-${random}.jpg`,
    `/chromas/nao-existe-${random}.webp`,
    `/nao-existe-${random}.html`,
    `/nao-existe-${random}.txt`,
    `/nao-existe-${random}.xml`,
    `/nao-existe-${random}.json`,
  ];
  if (mainScript) missing.push(`/pasta-${random}${mainScript}`);
  const failures = [];
  for (const urlPath of missing) {
    const response = await get(urlPath);
    if (response.status !== 404) failures.push(`${urlPath}: ${describe(response)}`);
  }
  return failures;
});

check("robots.txt responde text/plain e aponta o sitemap", async () => {
  const response = await get("/robots.txt");
  const failures = [];
  if (response.status !== 200 || !header(response, "content-type").startsWith("text/plain")) failures.push(`esperado 200 text/plain, veio ${describe(response)}`);
  if (!response.body.toString("utf8").includes("Sitemap: https://polimatch.com.br/sitemap.xml")) failures.push("robots.txt sem a linha Sitemap canônica");
  return failures;
});

check("sitemap.xml responde XML com urlset", async () => {
  const response = await get("/sitemap.xml");
  const failures = [];
  if (response.status !== 200 || !/^(?:text|application)\/xml\b/.test(header(response, "content-type"))) failures.push(`esperado 200 XML, veio ${describe(response)}`);
  if (!response.body.toString("utf8").includes("<urlset")) failures.push("sitemap.xml sem <urlset>");
  return failures;
});

check("ícones do PWA respondem image/png de verdade", async () => {
  const pngRefs = references.map(({ urlPath }) => urlPath).filter((urlPath) => urlPath.endsWith(".png"));
  const failures = [];
  for (const urlPath of [...new Set([...EXPECTED_ICONS, ...pngRefs])].sort()) {
    const response = await get(urlPath);
    if (response.status !== 200 || header(response, "content-type") !== "image/png") failures.push(`${urlPath}: ${describe(response)}`);
    else if (!response.body.subarray(0, 8).equals(PNG_SIGNATURE)) failures.push(`${urlPath}: corpo não é PNG`);
  }
  return failures;
});

check(`referências locais (${references.length}) de dist/*.html e do manifesto existem e não voltam como HTML`, async () => {
  const failures = [];
  for (const { source, ref, urlPath } of references) {
    const response = await get(urlPath);
    const expectsHtml = urlPath.endsWith("/") || urlPath.toLowerCase().endsWith(".html");
    const isHtml = header(response, "content-type").startsWith("text/html");
    if (response.status !== 200) failures.push(`${source} → ${ref}: ${describe(response)}`);
    else if (isHtml !== expectsHtml) failures.push(`${source} → ${ref}: ${describe(response)}`);
  }
  return failures;
});

check("service worker e manifesto revalidam a cada visita", async () => {
  const failures = [];
  const sw = await get("/sw.js");
  if (sw.status !== 200 || !/javascript/.test(header(sw, "content-type"))) failures.push(`/sw.js: ${describe(sw)}`);
  if (!/\bno-store\b/.test(header(sw, "cache-control"))) failures.push(`/sw.js: cache-control "${header(sw, "cache-control")}"`);
  const manifest = await get("/manifest.webmanifest");
  if (manifest.status !== 200 || header(manifest, "content-type") !== "application/manifest+json") failures.push(`/manifest.webmanifest: ${describe(manifest)}`);
  if (!/\bno-cache\b/.test(header(manifest, "cache-control"))) failures.push(`/manifest.webmanifest: cache-control "${header(manifest, "cache-control")}"`);
  return failures;
});

check("retratos e Chromas têm cache curto, sem immutable", async () => {
  const failures = [];
  for (const directory of ["portraits", "chromas"]) {
    const file = firstImage(directory);
    if (!file) {
      failures.push(`nenhuma imagem em dist/${directory}`);
      continue;
    }
    const urlPath = toUrlPath(file);
    const response = await get(urlPath);
    const cacheControl = header(response, "cache-control");
    if (response.status !== 200 || !header(response, "content-type").startsWith("image/")) failures.push(`${urlPath}: ${describe(response)}`);
    else if (!/\bmax-age=86400\b/.test(cacheControl) || /\bimmutable\b/.test(cacheControl)) failures.push(`${urlPath}: cache-control "${cacheControl}"`);
  }
  return failures;
});

check("caminho sem extensão continua abrindo o app com no-cache", async () => {
  const response = await get(`/rota-${random}`);
  return response.status === 200 && header(response, "content-type").startsWith("text/html") && /\bno-cache\b/.test(header(response, "cache-control"))
    ? []
    : [`/rota-${random}: ${describe(response)}, cache-control "${header(response, "cache-control")}"`];
});

let failed = 0;
for (const { name, run } of checks) {
  let failures;
  try {
    failures = await run();
  } catch (error) {
    failures = [error.message];
  }
  if (failures.length) {
    failed += 1;
    console.error(`FALHOU ${name}`);
    for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`);
    if (failures.length > 20) console.error(`  - e mais ${failures.length - 20}`);
  } else {
    console.log(`ok ${name}`);
  }
}

console.log(`\nsmoke-nginx em ${baseUrl.href} com ${distDir}: ${checks.length - failed} de ${checks.length} verificações passaram`);
if (failed) process.exit(1);
