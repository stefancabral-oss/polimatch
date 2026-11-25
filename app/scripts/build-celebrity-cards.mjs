// Cartas da pesquisa de famosos e influenciadores (ICM 74, #348).
//
// Cada carta é uma fotografia de licença livre, tirada da Wikimedia Commons,
// dentro de uma moldura desenhada aqui, por código, igual para todas. A
// fotografia não é editada: só é posicionada e recortada pela janela da
// moldura e redimensionada com a carta. Não há retrato gerado nem editado por
// IA. Este roteiro, que desenha a moldura e monta a carta, foi escrito por um
// agente de IA (CREDITS.md, "Cartas de famosos — estágio 74").
//
// Entradas, as duas no repositório:
//   stages/74_celebrity_survey/output/sources.json   quem aparece, de onde veio
//                                                    cada foto, autor, licença
//                                                    e o enquadramento
//   stages/74_celebrity_survey/output/sources/       os arquivos como foram
//                                                    baixados, sem alteração
//
// Saídas: o desenho de origem de cada carta (SVG, que aponta para a foto), os
// dois tamanhos publicados (WebP), o catálogo do app, o manifesto do estágio
// com o hash de cada arquivo, a página de créditos e a folha de conferência.
//
// Uso, a partir de app/:  node scripts/build-celebrity-cards.mjs
// Precisa do Chromium do Playwright e do `cwebp` no PATH. Os arquivos gravados
// saíram do Chromium headless shell 1187 e do cwebp 1.6.0. O texto das cartas é
// desenhado com a Helvetica Neue instalada no macOS; a fonte não vai para o
// repositório nem para o site, só a imagem pronta. Em outra máquina o texto
// pode sair diferente: o resultado é conferido pelos hashes gravados, não
// refeito no CI.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CREDIT, FONT, HEIGHT, INK, NAME, STAGE, TEXT_WIDTH, WIDTH, cardSvg, creditLine, creditsPage, licenseAddress, placement } from "./celebrity-cards-lib.mjs";

const EDITION = "famosos-v1";
const VERSION = "v01";

const repo = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const SOURCES_JSON = repo(`${STAGE}/output/sources.json`);
const SOURCES_DIR = repo(`${STAGE}/output/sources`);
const MASTERS_DIR = repo(`${STAGE}/output/masters`);
const PUBLIC_DIR = repo("app/public/chromas/famosos");
const CATALOG = repo("app/src/celebrity-cards.json");
const MANIFEST = repo(`${STAGE}/output/manifest.json`);
const SHEET = repo(`${STAGE}/references/cartas-famosos.jpg`);
const CREDITS_PAGE = repo("app/creditos.html");

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const TOOL = "moldura e montagem por código (app/scripts/build-celebrity-cards.mjs), escrito por agente de IA; fotografia sem edição por IA, só posicionada, recortada pela janela e redimensionada";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

// ---------------------------------------------------------------------------
// Geração

const cards = JSON.parse(readFileSync(SOURCES_JSON, "utf8"));
if (new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error("código de carta repetido em sources.json");
for (const card of cards) {
  if (card.licenseUrl !== licenseAddress(card.license)) throw new Error(`${card.id}: o endereço da licença não é o da ${card.license}`);
}

mkdirSync(MASTERS_DIR, { recursive: true });
mkdirSync(PUBLIC_DIR, { recursive: true });
for (const name of readdirSync(MASTERS_DIR)) rmSync(join(MASTERS_DIR, name));
for (const name of readdirSync(PUBLIC_DIR)) rmSync(join(PUBLIC_DIR, name));

const work = mkdtempSync(join(tmpdir(), "famosos-"));
// CELEBRITY_CARDS_CHROMIUM aponta para outro Chromium quando o do Playwright
// instalado não está na máquina.
const browser = await chromium.launch(process.env.CELEBRITY_CARDS_CHROMIUM ? { executablePath: process.env.CELEBRITY_CARDS_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
await page.setContent("<!doctype html><html><body></body></html>");

// O tamanho da foto, como o navegador a desenha (já com a orientação do arquivo).
const imageSize = (dataUrl) => page.evaluate(async (url) => {
  const image = new Image();
  image.src = url;
  await image.decode();
  return [image.naturalWidth, image.naturalHeight];
}, dataUrl);

// O maior tamanho de letra, até o padrão, em que o texto cabe na placa.
const fitted = (text, { size, weight, spacing }, minimum = 1) => page.evaluate(({ text, size, weight, spacing, font, limit }) => {
  const context = document.createElement("canvas").getContext("2d");
  const widthAt = (value) => {
    context.font = `${weight} ${value}px ${font}`;
    return context.measureText(text).width + spacing * Math.max(0, text.length - 1);
  };
  let value = size;
  while (value > 1 && widthAt(value) > limit) value -= 1;
  return value;
}, { text, size, weight, spacing, font: FONT, limit: TEXT_WIDTH }).then((value) => {
  if (value < minimum) throw new Error(`"${text}" não cabe na placa nem com letra ${minimum}: encurte o nome mostrado do autor`);
  return value;
});

const catalog = [];
const manifest = [];
const rendered = [];

for (const card of cards) {
  const sourcePath = join(SOURCES_DIR, card.file);
  const sourceBytes = readFileSync(sourcePath);
  const mime = MIME[extname(card.file).toLowerCase()];
  if (!mime) throw new Error(`${card.id}: tipo de arquivo não aceito (${card.file})`);
  const dataUrl = `data:${mime};base64,${sourceBytes.toString("base64")}`;
  const [width, height] = await imageSize(dataUrl);
  const place = placement(card, width, height);
  const sizes = {
    name: await fitted(card.name, NAME),
    credit: await fitted(creditLine(card).toUpperCase(), CREDIT, CREDIT.minimum),
  };

  // O desenho de origem aponta para a foto pelo caminho; para desenhar, a foto entra embutida.
  const svg = cardSvg(card, place, sizes, `../sources/${card.file}`);
  const masterPath = join(MASTERS_DIR, `${card.id}.svg`);
  writeFileSync(masterPath, svg);
  const masterSha256 = sha256(readFileSync(masterPath));
  const drawable = cardSvg(card, place, sizes, dataUrl);
  rendered.push(drawable);

  await page.setContent(`<!doctype html><html><body style="margin:0;background:${INK}">${drawable}</body></html>`);
  await page.waitForFunction(() => document.querySelector("image").getBBox().width > 0);
  await page.evaluate(async () => { const probe = new Image(); probe.src = document.querySelector("image").getAttribute("href"); await probe.decode(); });
  const png = join(work, `${card.id}.png`);
  await page.screenshot({ path: png, type: "png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });

  // O nome do arquivo publicado muda quando muda o desenho ou a foto.
  const stamp = sha256(Buffer.concat([readFileSync(masterPath), sourceBytes])).slice(0, 8);
  const base = `${card.id}-${VERSION}-${stamp}`;
  const variants = [[WIDTH, HEIGHT], [WIDTH / 2, HEIGHT / 2]].map(([variantWidth, variantHeight]) => {
    const file = `${base}-${variantWidth}.webp`;
    execFileSync("cwebp", ["-quiet", "-q", "88", "-m", "6", "-sharp_yuv", "-resize", String(variantWidth), String(variantHeight), png, "-o", join(PUBLIC_DIR, file)]);
    return { src: `/chromas/famosos/${file}`, width: variantWidth, height: variantHeight, sha256: sha256(readFileSync(join(PUBLIC_DIR, file))) };
  }).sort((left, right) => left.width - right.width);

  catalog.push({
    id: card.id,
    name: card.name,
    src: variants[0].src,
    srcset: variants.map((variant) => `${variant.src} ${variant.width}w`).join(", "),
    width: WIDTH,
    height: HEIGHT,
    edition: EDITION,
    stamp,
    photo: { author: card.authorShown, license: card.license, licenseUrl: card.licenseUrl, page: card.commons.page },
  });
  manifest.push({
    id: card.id,
    name: card.name,
    master: `${STAGE}/output/masters/${card.id}.svg`,
    masterSha256,
    stamp,
    source: {
      file: `${STAGE}/output/sources/${card.file}`,
      sha256: sha256(sourceBytes),
      bytes: sourceBytes.length,
      width,
      height,
      commons: card.commons,
      download: card.download,
      origin: card.origin,
      wikidata: card.wikidata,
      authorShown: card.authorShown,
      license: card.license,
      licenseUrl: card.licenseUrl,
    },
    credit: creditLine(card),
    changes: "recorte pela janela da moldura e redimensionamento; a foto não foi editada",
    crop: card.crop,
    placement: place,
    textSizes: sizes,
    aiEdited: false,
    tool: TOOL,
    variants,
  });
}

// Folha de conferência: todas as cartas lado a lado, como referência do estágio.
const columns = 5;
await page.setViewportSize({ width: 24 + columns * (265 + 24), height: 400 });
await page.setContent(`<!doctype html><html><body style="margin:0;padding:24px;background:#f3f4f6;display:grid;grid-template-columns:repeat(${columns},265px);gap:24px;justify-content:center">
  ${rendered.map((svg, index) => `<div style="width:265px;height:371px;border-radius:10px;overflow:hidden;box-shadow:0 8px 20px rgba(16,24,40,.14)"><div style="width:${WIDTH}px;height:${HEIGHT}px;transform:scale(.25);transform-origin:0 0">${svg.replace(/id="(window|panel)"/g, `id="$1-${index}"`).replace(/url\(#(window|panel)\)/g, `url(#$1-${index})`)}</div></div>`).join("\n  ")}
</body></html>`);
await page.waitForFunction(() => [...document.querySelectorAll("image")].every((image) => image.getBBox().width > 0));
await page.waitForTimeout(400);
mkdirSync(dirname(SHEET), { recursive: true });
await page.screenshot({ path: SHEET, type: "jpeg", quality: 84, fullPage: true });
await browser.close();
rmSync(work, { recursive: true, force: true });

writeFileSync(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`);
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(CREDITS_PAGE, creditsPage(cards));
console.log(`${catalog.length} cartas geradas em ${PUBLIC_DIR}`);
