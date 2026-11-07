import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import config from "../vite.config.js";
import {
  SHARE_IMAGE_PATH,
  SHARE_IMAGE_URL,
  canonicalPageUrl,
  htmlEntries,
  probeStatic,
  validateEntries,
  validateSharePreview,
} from "../scripts/share-preview.mjs";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const publicDir = path.join(appRoot, "public");
const readSource = (entry) => readFileSync(path.join(appRoot, entry.file), "utf8");

test("o build confere a prévia sem tirar a checagem de referências da borda", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.match(packageJson.scripts.build, /vite build && .*node scripts\/verify-share-preview\.mjs && node scripts\/verify-public-refs\.mjs$/);
});

test("as quatro páginas públicas são as entradas do build", () => {
  assert.deepEqual(
    htmlEntries(config).map((entry) => entry.file),
    ["duelos-da-corrida.html", "fato-ou-fake.html", "index.html", "quem-disse-isso.html"],
  );
});

test("as URLs canônicas coincidem com o sitemap da borda, sem reescrevê-lo", () => {
  const sitemap = readFileSync(path.join(publicDir, "sitemap.xml"), "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
  assert.deepEqual(locations, htmlEntries(config).map((entry) => canonicalPageUrl(entry.file)).sort());
});

test("a imagem de preview é a apresentação de marca já publicada, não um retrato", () => {
  assert.equal(SHARE_IMAGE_PATH, "/brand/logo-volumetric.png");
  assert.equal(SHARE_IMAGE_URL, "https://polimatch.com.br/brand/logo-volumetric.png");
  assert.doesNotMatch(SHARE_IMAGE_PATH, /portraits|chromas|presidential/);
  assert.equal(canonicalPageUrl("index.html"), "https://polimatch.com.br/");
  assert.equal(canonicalPageUrl("quem-disse-isso.html"), "https://polimatch.com.br/quem-disse-isso.html");
});

test("cada entrada do build traz a prévia no HTML inicial e a imagem existe em public", () => {
  assert.deepEqual(validateEntries(htmlEntries(config), readSource, publicDir), []);
});

test("uma entrada nova sem Open Graph faz o teste de build falhar", () => {
  const html = `<!doctype html><html lang="pt-BR"><head><meta name="description" content="Página nova."><title>Página nova</title></head><body><script type="module" src="/src/nova.js"></script></body></html>`;
  const errors = validateSharePreview(html, { file: "nova.html", assetRoot: publicDir });
  assert.ok(errors.some((error) => error.includes("og:image")));
  assert.ok(errors.some((error) => error.includes("og:title")));
  assert.ok(errors.some((error) => error.includes("twitter:card")));
});

test("og:image relativa ou fora do build não vale como prévia", () => {
  const html = `<!doctype html><html lang="pt-BR"><head>
    <title>PoliMatch</title>
    <meta name="description" content="PoliMatch">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="pt_BR">
    <meta property="og:site_name" content="PoliMatch">
    <meta property="og:title" content="PoliMatch">
    <meta property="og:description" content="PoliMatch">
    <meta property="og:url" content="/duelos-da-corrida.html">
    <meta property="og:image" content="/brand/logo-volumetric.png">
    <meta property="og:image:type" content="image/png">
    <meta property="og:image:width" content="1600">
    <meta property="og:image:height" content="1000">
    <meta property="og:image:alt" content="PoliMatch">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="PoliMatch">
    <meta name="twitter:description" content="PoliMatch">
    <meta name="twitter:image" content="/brand/logo-volumetric.png">
  </head><body></body></html>`;
  const errors = validateSharePreview(html, { file: "duelos-da-corrida.html", assetRoot: publicDir });
  assert.ok(errors.some((error) => error.includes("og:url")));
  assert.ok(errors.some((error) => error.includes("og:image")));
});

test("o arquivo de preview responde 200 image/png no servidor local", async () => {
  const image = await probeStatic(publicDir, SHARE_IMAGE_PATH);
  assert.equal(image.status, 200);
  assert.match(image.contentType, /^image\/png\b/);
  assert.equal(image.bytes.length, 604325);
  const missing = await probeStatic(publicDir, "/brand/inexistente.png");
  assert.equal(missing.status, 404);
  assert.match(missing.contentType, /^text\/plain\b/);
});
