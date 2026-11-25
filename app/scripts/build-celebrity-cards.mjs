// Cartas da pesquisa de famosos e influenciadores (ICM 74, #348).
//
// Cada carta é uma fotografia de licença livre, tirada da Wikimedia Commons,
// dentro de uma moldura desenhada aqui, por código, igual para todas. A
// fotografia não é editada: só é posicionada e recortada pela janela da
// moldura e redimensionada com a carta. Não há retrato gerado nem editado por
// IA. Este roteiro, que desenha a moldura e monta a carta, foi escrito por um
// agente de IA (CREDITS.md, "Chromas e artes editadas").
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

const WIDTH = 1060;
const HEIGHT = 1484;
const EDITION = "famosos-v1";
const VERSION = "v01";
const STAGE = "stages/74_celebrity_survey";

const repo = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const SOURCES_JSON = repo(`${STAGE}/output/sources.json`);
const SOURCES_DIR = repo(`${STAGE}/output/sources`);
const MASTERS_DIR = repo(`${STAGE}/output/masters`);
const PUBLIC_DIR = repo("app/public/chromas/famosos");
const CATALOG = repo("app/src/celebrity-cards.json");
const MANIFEST = repo(`${STAGE}/output/manifest.json`);
const SHEET = repo(`${STAGE}/references/cartas-famosos.jpg`);
const CREDITS_PAGE = repo("app/creditos.html");

const PAPER = "#FBFAF7";
const GREEN = "#08805A";
const PANEL = "#D6DADC";
const INK = "#111418";
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// A janela da foto e a placa do nome: iguais em todas as cartas.
const WINDOW = { x: 70, y: 150, width: 920, height: 1000, radius: 28 };
const PLATE = { x: 70, y: 1170, width: 920, height: 244, radius: 28 };
const TEXT_WIDTH = 840;
const NAME = { size: 112, weight: 800, spacing: -2.5, baseline: 1300 };
const CREDIT = { size: 26, weight: 700, spacing: 3, baseline: 1372, minimum: 17 };
// Onde, dentro da janela, fica o ponto de foco da foto (o rosto).
const FOCUS_AT = { x: 0.5, y: 0.42 };

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const TOOL = "moldura e montagem por código (app/scripts/build-celebrity-cards.mjs), escrito por agente de IA; fotografia sem edição por IA, só posicionada, recortada pela janela e redimensionada";

const escapeXml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const round = (value) => Math.round(value * 100) / 100;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** A linha de crédito da carta: quem fez a foto e a licença, como a licença pede. */
const creditLine = (card) => `Foto: ${card.authorShown} · ${card.license}`;

/** Onde a foto inteira fica para o ponto de foco cair na janela, sem deixar a janela vazia. */
function placement(card, width, height) {
  const zoom = card.crop?.zoom ?? 1;
  if (!(zoom >= 1)) throw new Error(`${card.id}: o zoom precisa ser 1 ou mais`);
  const scale = Math.max(WINDOW.width / width, WINDOW.height / height) * zoom;
  const shownWidth = width * scale;
  const shownHeight = height * scale;
  const x = clamp(WINDOW.x + WINDOW.width * FOCUS_AT.x - (card.crop?.x ?? 0.5) * shownWidth, WINDOW.x + WINDOW.width - shownWidth, WINDOW.x);
  const y = clamp(WINDOW.y + WINDOW.height * FOCUS_AT.y - (card.crop?.y ?? 0.35) * shownHeight, WINDOW.y + WINDOW.height - shownHeight, WINDOW.y);
  return { x: round(x), y: round(y), width: round(shownWidth), height: round(shownHeight), scale: round(scale) };
}

function cardSvg(card, place, sizes, href) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" font-family="${FONT}">
  <title>${escapeXml(card.name)} — carta da pesquisa de famosos do PoliMatch</title>
  <defs>
    <clipPath id="window"><rect x="${WINDOW.x}" y="${WINDOW.y}" width="${WINDOW.width}" height="${WINDOW.height}" rx="${WINDOW.radius}"/></clipPath>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E6E9EA"/><stop offset="1" stop-color="${PANEL}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${INK}"/>
  <rect x="26" y="26" width="1008" height="1432" rx="34" fill="url(#panel)"/>
  <rect x="78" y="62" width="50" height="50" rx="12" fill="${GREEN}"/>
  <text x="103" y="100" font-size="36" font-weight="800" fill="#fff" text-anchor="middle">M</text>
  <text x="144" y="100" font-size="38" font-weight="700" fill="${INK}" letter-spacing="-0.5">PoliMatch</text>
  <rect x="${WINDOW.x}" y="${WINDOW.y}" width="${WINDOW.width}" height="${WINDOW.height}" rx="${WINDOW.radius}" fill="#B9C0C4"/>
  <image href="${escapeXml(href)}" x="${place.x}" y="${place.y}" width="${place.width}" height="${place.height}" preserveAspectRatio="none" clip-path="url(#window)"/>
  <rect x="${WINDOW.x}" y="${WINDOW.y}" width="${WINDOW.width}" height="${WINDOW.height}" rx="${WINDOW.radius}" fill="none" stroke="rgba(17,20,24,0.16)" stroke-width="2"/>
  <rect x="${PLATE.x}" y="${PLATE.y}" width="${PLATE.width}" height="${PLATE.height}" rx="${PLATE.radius}" fill="${PAPER}" stroke="rgba(17,20,24,0.10)" stroke-width="2"/>
  <text x="530" y="${NAME.baseline}" font-size="${sizes.name}" font-weight="${NAME.weight}" fill="${INK}" text-anchor="middle" letter-spacing="${NAME.spacing}">${escapeXml(card.name)}</text>
  <text x="530" y="${CREDIT.baseline}" font-size="${sizes.credit}" font-weight="${CREDIT.weight}" fill="#5B6470" text-anchor="middle" letter-spacing="${CREDIT.spacing}">${escapeXml(creditLine(card).toUpperCase())}</text>
</svg>
`;
}

/** A página de créditos: quem fez cada foto, a licença e o que foi mudado. Texto fixo, sem depender de script. */
function creditsPage(cards) {
  const shareAlike = cards.filter((card) => /\bBY-SA\b/.test(card.license));
  const item = (card) => `          <li><b>${escapeXml(card.name)}</b><span>Foto de <a href="${escapeXml(card.commons.page)}" rel="noopener">${escapeXml(card.authorShown)}</a>, licença <a href="${escapeXml(card.licenseUrl)}" rel="noopener license">${escapeXml(card.license)}</a>.</span></li>`;
  const description = "De quem é cada foto das cartas de famosos do PoliMatch, com a licença de cada uma.";
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:site_name" content="PoliMatch" />
    <meta property="og:title" content="Créditos das fotos — PoliMatch" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="https://polimatch.com.br/creditos.html" />
    <meta property="og:image" content="https://polimatch.com.br/brand/logo-volumetric.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1600" />
    <meta property="og:image:height" content="1000" />
    <meta property="og:image:alt" content="PoliMatch" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Créditos das fotos — PoliMatch" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="https://polimatch.com.br/brand/logo-volumetric.png" />
    <link rel="icon" href="./icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />
    <title>Créditos das fotos — PoliMatch</title>
  </head>
  <body>
    <!-- Página gerada por app/scripts/build-celebrity-cards.mjs a partir de stages/74_celebrity_survey/output/sources.json. Não editar à mão. -->
    <div class="ps-shell" data-view="credits">
      <header class="ps-top">
        <a class="ps-brand" href="./" aria-label="PoliMatch, início">Poli<b>Match</b></a>
        <button class="pm-menu-btn" type="button" data-action="menu" aria-haspopup="dialog" aria-label="Abrir menu"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" /></svg></button>
      </header>
      <main class="ps-main ps-main--entry" aria-labelledby="credits-title">
        <p class="ps-kicker">PoliMatch</p>
        <h1 class="ps-title" id="credits-title">Créditos das fotos</h1>
        <p class="ps-hint">As fotos das cartas de famosos vêm da Wikimedia Commons, com licença livre.</p>
        <ul class="ps-credits">
${cards.map(item).join("\n")}
        </ul>
        <p class="pm-note">Cada foto foi recortada e redimensionada para caber na carta, que leva o nome da pessoa e este crédito. Nenhuma foto foi editada por IA. A moldura é desenhada por código, escrito com IA.</p>
${shareAlike.length ? `        <p class="pm-note">${shareAlike.length === 1 ? "A carta" : "As cartas"} de ${escapeXml(new Intl.ListFormat("pt-BR").format(shareAlike.map((card) => card.name)))} ${shareAlike.length === 1 ? "pode ser reutilizada" : "podem ser reutilizadas"} nos termos da mesma licença da foto.</p>\n` : ""}        <p class="pm-note">A licença trata do direito de quem fez a foto. O PoliMatch não tem vínculo com as pessoas retratadas, e a presença de alguém aqui não indica apoio dela ao PoliMatch.</p>
        <div class="ps-stack"><a class="ps-btn" href="./">Voltar para as pesquisas</a></div>
      </main>
    </div>
    <script type="module" src="/src/credits-page.js"></script>
  </body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Geração

const cards = JSON.parse(readFileSync(SOURCES_JSON, "utf8"));
if (new Set(cards.map((card) => card.id)).size !== cards.length) throw new Error("código de carta repetido em sources.json");

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
      author: card.author,
      authorShown: card.authorShown,
      license: card.license,
      licenseUrl: card.licenseUrl,
      dateOnCommons: card.dateOnCommons,
      wikidata: card.wikidata,
    },
    credit: creditLine(card),
    changes: "recorte pela janela da moldura e redimensionamento; a foto não foi editada",
    placement: place,
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
