// Cartas de roupa da demonstração (ICM 73, #345).
//
// As 16 peças são desenhadas aqui, por código: não há foto, modelo nem marca
// de terceiros. Este roteiro grava o desenho de origem de cada carta (SVG),
// gera os dois tamanhos publicados (WebP) e escreve o catálogo do app e o
// manifesto do estágio, com o hash de cada arquivo.
//
// O roteiro foi escrito por um agente de IA: por isso cada carta, o catálogo e
// o manifesto dizem "arte com IA" (CREDITS.md, "Chromas e artes editadas").
//
// Uso, a partir de app/:  node scripts/build-clothes-cards.mjs
// Precisa do Chromium do Playwright e do `cwebp` no PATH. O texto das cartas é
// desenhado com a Helvetica Neue instalada no macOS; a fonte não vai para o
// repositório nem para o site, só a imagem pronta. Em outra máquina o texto
// pode sair diferente: o resultado é conferido pelos hashes gravados, não
// refeito no CI.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const WIDTH = 1060;
const HEIGHT = 1484;
const EDITION = "roupas-demo-v1";
const VERSION = "v01";

const repo = (path) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const MASTERS_DIR = repo("stages/73_clothes_demo/output/masters");
const PUBLIC_DIR = repo("app/public/chromas/roupas");
const CATALOG = repo("app/src/clothes-cards.json");
const MANIFEST = repo("stages/73_clothes_demo/output/manifest.json");
const SHEET = repo("stages/73_clothes_demo/references/cartas-roupas.jpg");

const INK = "#16181C";
const CREAM = "#F1E9D8";
const PAPER = "#FBFAF7";
const GREEN = "#08805A";
const PANEL = "#D6DADC";
const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ---------------------------------------------------------------------------
// Cor

const channels = (hex) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
const toHex = (values) => `#${values.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
const mix = (hex, target, amount) => {
  const from = channels(hex);
  const to = channels(target);
  return toHex(from.map((value, index) => value + (to[index] - value) * amount));
};
const isDark = (hex) => {
  const [red, green, blue] = channels(hex);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue < 120;
};

// ---------------------------------------------------------------------------
// Estampas. Cada uma desenha em torno de (0, 0), numa caixa de ±160.

const wave = (y) => `<path d="M-150,${y} q25,-34 50,0 t50,0 t50,0 t50,0 t50,0 t50,0"/>`;
const sparkle = (x, y, size) => {
  const bend = size * 0.2;
  return `<path transform="translate(${x},${y})" d="M0,${-size} Q${bend},${-bend} ${size},0 Q${bend},${bend} 0,${size} Q${-bend},${bend} ${-size},0 Q${-bend},${-bend} 0,${-size} Z"/>`;
};
const starPoints = (outer, inner, cx = 0, cy = 0) => Array.from({ length: 10 }, (_, index) => {
  const radius = index % 2 === 0 ? outer : inner;
  const angle = (Math.PI / 5) * index - Math.PI / 2;
  return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
}).join(" ");

const PRINTS = {
  onda: () => `
    <circle cx="72" cy="-98" r="40" fill="#F2A93B"/>
    <g fill="none" stroke="${CREAM}" stroke-width="18" stroke-linecap="round">${wave(-20)}${wave(42)}${wave(104)}</g>`,

  sol: (body) => `
    <defs>
      <clipPath id="sun-clip"><circle r="142"/></clipPath>
      <linearGradient id="sun-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F4B13E"/><stop offset="0.55" stop-color="#E8644A"/><stop offset="1" stop-color="#BF4070"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#sun-clip)">
      <rect x="-142" y="-142" width="284" height="284" fill="url(#sun-fill)"/>
      <g fill="${body}">
        <rect x="-142" y="6" width="284" height="9"/><rect x="-142" y="36" width="284" height="14"/>
        <rect x="-142" y="72" width="284" height="20"/><rect x="-142" y="112" width="284" height="26"/>
      </g>
    </g>`,

  raio: () => `
    <polygon points="30,-160 -70,10 -5,10 -45,160 85,-35 15,-35 70,-160" fill="#F6D33C" stroke="#F6D33C" stroke-width="6" stroke-linejoin="round"/>`,

  cacto: () => `
    <circle cx="-98" cy="-112" r="34" fill="#E8644A"/>
    <g fill="none" stroke="#2F6B4A" stroke-linecap="round" stroke-linejoin="round">
      <path d="M0,128 V-108" stroke-width="64"/>
      <path d="M-10,42 H-86 V-36" stroke-width="40"/>
      <path d="M10,2 H86 V-66" stroke-width="40"/>
    </g>
    <g fill="none" stroke="#4A8F69" stroke-width="6" stroke-linecap="round">
      <path d="M-12,112 V-98"/><path d="M12,112 V-98"/>
    </g>
    <path d="M-150,156 H150" stroke="#2F6B4A" stroke-width="10" stroke-linecap="round"/>`,

  planeta: () => `
    <defs><clipPath id="planet-clip"><circle r="92"/></clipPath></defs>
    <g fill="${CREAM}"><circle cx="-124" cy="-112" r="7"/><circle cx="132" cy="-70" r="5"/><circle cx="104" cy="120" r="7"/><circle cx="-110" cy="104" r="5"/></g>
    <ellipse rx="160" ry="44" transform="rotate(-18)" fill="none" stroke="${CREAM}" stroke-width="12"/>
    <circle r="92" fill="#E8644A"/>
    <g clip-path="url(#planet-clip)" fill="none" stroke="#F2A93B" stroke-width="16">
      <path d="M-100,-34 Q0,-4 100,-42"/><path d="M-100,34 Q0,64 100,22"/>
    </g>
    <path d="M-160,0 A160,44 0 0 0 160,0" transform="rotate(-18)" fill="none" stroke="${CREAM}" stroke-width="12" stroke-linecap="round"/>`,

  olho: () => `
    <path d="M-155,0 Q0,-120 155,0 Q0,120 -155,0 Z" fill="${PAPER}" stroke="${INK}" stroke-width="14" stroke-linejoin="round"/>
    <circle r="58" fill="#2F6FB5"/><circle r="26" fill="${INK}"/><circle cx="-17" cy="-19" r="10" fill="#fff"/>
    <g stroke="${INK}" stroke-width="12" stroke-linecap="round">
      <path d="M0,-80 V-122"/><path d="M-62,-68 L-84,-104"/><path d="M62,-68 L84,-104"/>
      <path d="M-118,-46 L-144,-72"/><path d="M118,-46 L144,-72"/>
    </g>`,

  chama: () => `
    <path d="M0,-165 C82,-74 120,-12 120,46 C120,114 66,160 0,160 C-66,160 -120,114 -120,46 C-120,-12 -82,-74 0,-165 Z" fill="#E8482F"/>
    <path d="M0,-62 C50,-6 76,34 76,74 C76,122 42,152 0,152 C-42,152 -76,122 -76,74 C-76,34 -50,-6 0,-62 Z" fill="#F6B93B"/>
    <path d="M0,36 C24,62 38,82 38,104 C38,130 21,146 0,146 C-21,146 -38,130 -38,104 C-38,82 -24,62 0,36 Z" fill="#FBE9A6"/>`,

  montanha: () => `
    <circle cx="-62" cy="-74" r="46" fill="#F2A93B"/>
    <path d="M-155,92 L-55,-55 L-5,15 L55,-110 L155,92 Z" fill="${CREAM}" stroke="${CREAM}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M55,-110 L155,92 L84,92 L34,-14 Z" fill="#D2C5A9"/>
    <path d="M-55,-55 L-5,15 L-28,92 L-74,92 L-70,-6 Z" fill="#D2C5A9"/>
    <g stroke="${CREAM}" stroke-width="12" stroke-linecap="round"><path d="M-155,124 H155"/><path d="M-104,154 H104"/></g>`,

  pipa: () => `
    <path d="M0,104 C44,122 -40,146 4,168" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>
    <g fill="#E8644A" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
      <path d="M16,118 l22,-12 l-2,24 z"/><path d="M-12,140 l-22,-10 l4,24 z"/>
    </g>
    <g stroke="${INK}" stroke-width="9" stroke-linejoin="round">
      <path d="M0,-150 L94,-38 L0,-38 Z" fill="#E8644A"/>
      <path d="M0,-150 L-94,-38 L0,-38 Z" fill="${PAPER}"/>
      <path d="M-94,-38 L0,104 L0,-38 Z" fill="#2F6FB5"/>
      <path d="M94,-38 L0,104 L0,-38 Z" fill="#2F8A63"/>
    </g>`,

  flor: () => `
    <g fill="${PAPER}" stroke="${INK}" stroke-width="8">
      ${Array.from({ length: 8 }, (_, index) => `<ellipse cx="0" cy="-80" rx="34" ry="62" transform="rotate(${index * 45})"/>`).join("")}
    </g>
    <circle r="42" fill="#F3C63A" stroke="${INK}" stroke-width="8"/>`,

  xadrez: () => `
    <rect x="-146" y="-146" width="292" height="292" fill="${PAPER}"/>
    <g fill="${INK}">
      ${Array.from({ length: 16 }, (_, index) => {
        const column = index % 4;
        const row = Math.floor(index / 4);
        return (column + row) % 2 === 0 ? `<rect x="${-140 + column * 70}" y="${-140 + row * 70}" width="70" height="70"/>` : "";
      }).join("")}
    </g>
    <rect x="-146" y="-146" width="292" height="292" fill="none" stroke="${INK}" stroke-width="12"/>`,

  semPressa: () => `
    <g fill="${CREAM}" font-weight="900" text-anchor="middle">
      <text x="0" y="-22" font-size="124" letter-spacing="4">SEM</text>
      <text x="0" y="76" font-size="84" letter-spacing="3">PRESSA</text>
    </g>
    <path d="M-150,128 q25,-24 50,0 t50,0 t50,0 t50,0 t50,0 t50,0" fill="none" stroke="${CREAM}" stroke-width="11" stroke-linecap="round"/>`,

  estrela: () => `
    <polygon points="${starPoints(150, 62, 12, 12)}" fill="#E8644A"/>
    <polygon points="${starPoints(150, 62)}" fill="#1F2A44" stroke="#1F2A44" stroke-width="6" stroke-linejoin="round"/>
    <g fill="${PAPER}">${sparkle(-18, -8, 30)}${sparkle(40, 42, 14)}</g>`,

  arco: () => `
    <g fill="none" stroke-width="25" stroke-linecap="butt">
      ${[[146, "#C4603C"], [113, "#E3A63A"], [80, "#7C9A7E"], [47, "#2F6FB5"]]
        .map(([radius, color]) => `<path d="M${-radius},78 A${radius},${radius} 0 0 1 ${radius},78" stroke="${color}"/>`).join("")}
    </g>`,

  folha: (body) => `
    <g transform="rotate(18)">
      <path d="M0,-158 C95,-95 115,45 0,158 C-115,45 -95,-95 0,-158 Z" fill="${CREAM}"/>
      <g fill="none" stroke="${body}" stroke-width="9" stroke-linecap="round">
        <path d="M0,-118 V150"/>
        <path d="M0,-48 L46,-86"/><path d="M0,-48 L-46,-86"/>
        <path d="M0,12 L62,-34"/><path d="M0,12 L-62,-34"/>
        <path d="M0,72 L56,26"/><path d="M0,72 L-56,26"/>
      </g>
    </g>`,

  lua: () => `
    <defs><mask id="moon-cut"><rect x="-200" y="-200" width="400" height="400" fill="#fff"/><circle cx="50" cy="-30" r="106" fill="#000"/></mask></defs>
    <circle r="128" fill="#F6D98A" mask="url(#moon-cut)"/>
    <g fill="${PAPER}">${sparkle(66, -42, 30)}${sparkle(112, 28, 15)}${sparkle(28, 22, 12)}</g>`,
};

// ---------------------------------------------------------------------------
// As 16 peças. A ordem aqui é a ordem do catálogo.

const PIECES = [
  { id: "camiseta-onda", kind: "Camiseta", title: "Onda", body: "#1F2A44", print: "onda" },
  { id: "camiseta-sol", kind: "Camiseta", title: "Sol", body: "#EFE6D2", print: "sol" },
  { id: "camiseta-raio", kind: "Camiseta", title: "Raio", body: "#1B1C1F", print: "raio" },
  { id: "camiseta-cacto", kind: "Camiseta", title: "Cacto", body: "#DCC9A2", print: "cacto" },
  { id: "camiseta-planeta", kind: "Camiseta", title: "Planeta", body: "#2E2A3B", print: "planeta" },
  { id: "camiseta-olho", kind: "Camiseta", title: "Olho", body: "#F5F2EA", print: "olho" },
  { id: "camiseta-chama", kind: "Camiseta", title: "Chama", body: "#2A2B2F", print: "chama" },
  { id: "camiseta-montanha", kind: "Camiseta", title: "Montanha", body: "#2F4A3A", print: "montanha" },
  { id: "camiseta-pipa", kind: "Camiseta", title: "Pipa", body: "#F3C63A", print: "pipa" },
  { id: "camiseta-flor", kind: "Camiseta", title: "Flor", body: "#E9B9C4", print: "flor" },
  { id: "camiseta-xadrez", kind: "Camiseta", title: "Xadrez", body: "#F1EEE6", print: "xadrez" },
  { id: "camiseta-sem-pressa", kind: "Camiseta", title: "Sem Pressa", body: "#C4603C", print: "semPressa" },
  { id: "moletom-estrela", kind: "Moletom", title: "Estrela", body: "#BFC2C8", print: "estrela" },
  { id: "moletom-arco", kind: "Moletom", title: "Arco", body: "#EFE6D2", print: "arco" },
  { id: "moletom-folha", kind: "Moletom", title: "Folha", body: "#6B7048", print: "folha" },
  { id: "moletom-lua", kind: "Moletom", title: "Lua", body: "#1F2A44", print: "lua" },
];

// ---------------------------------------------------------------------------
// As duas silhuetas. Uma camiseta e um moletom, sempre no mesmo lugar e no
// mesmo tamanho: o que muda de uma carta para a outra é a cor e a estampa.

const mirror = (markup) => `${markup}<g transform="translate(${WIDTH},0) scale(-1,1)">${markup}</g>`;

function garmentTones(body) {
  const dark = isDark(body);
  return {
    shade: mix(body, "#000000", 0.34),
    rib: mix(body, "#000000", 0.08),
    seam: dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.16)",
    stitch: dark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.28)",
    edge: dark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.26)",
  };
}

function tee(body) {
  const tone = garmentTones(body);
  const outline = "M440,250 C468,330 592,330 620,250 L810,312 L952,548 L846,606 L778,500 L778,1066 Q530,1080 282,1066 L282,500 L214,606 L108,548 L250,312 Z";
  return {
    center: [530, 604],
    markup: `
    <g filter="url(#drop)">
      <path d="M440,250 C470,226 590,226 620,250 C592,330 468,330 440,250 Z" fill="${tone.shade}"/>
      <path d="${outline}" fill="${body}" stroke="${tone.edge}" stroke-width="3" stroke-linejoin="round"/>
    </g>
    <path d="${outline}" fill="url(#fold)"/>
    ${mirror(`<path d="M810,312 Q770,404 778,500" fill="none" stroke="${tone.seam}" stroke-width="3"/>
      <path d="M778,516 q-34,54 -22,128" fill="none" stroke="rgba(0,0,0,0.07)" stroke-width="14" stroke-linecap="round"/>
      <path d="M939,532 L842,585" fill="none" stroke="${tone.stitch}" stroke-width="3" stroke-dasharray="10 8"/>`)}
    <path d="M292,1042 Q530,1056 768,1042" fill="none" stroke="${tone.stitch}" stroke-width="3" stroke-dasharray="10 8"/>
    <path d="M440,250 C468,330 592,330 620,250" fill="none" stroke="${tone.shade}" stroke-width="30" stroke-linecap="round"/>
    <path d="M440,250 C468,330 592,330 620,250" fill="none" stroke="${tone.rib}" stroke-width="24" stroke-linecap="round"/>`,
  };
}

function sweatshirt(body) {
  const tone = garmentTones(body);
  const outline = "M444,250 C470,314 590,314 616,250 L820,318 L958,900 L872,916 L782,522 L782,1002 L278,1002 L278,522 L188,916 L102,900 L240,318 Z";
  return {
    center: [530, 612],
    markup: `
    <defs>
      <pattern id="rib" width="12" height="12" patternUnits="userSpaceOnUse">
        <rect width="12" height="12" fill="${tone.rib}"/>
        <path d="M6,0 V12" stroke="${tone.seam}" stroke-width="3"/>
      </pattern>
    </defs>
    <g filter="url(#drop)">
      <path d="M444,250 C472,228 588,228 616,250 C590,314 470,314 444,250 Z" fill="${tone.shade}"/>
      <path d="${outline}" fill="${body}" stroke="${tone.edge}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="286" y="1000" width="488" height="70" rx="10" fill="url(#rib)" stroke="${tone.edge}" stroke-width="3"/>
      ${mirror(`<path d="M958,898 L872,914 L878,984 L950,974 Z" fill="${tone.rib}" stroke="${tone.edge}" stroke-width="3" stroke-linejoin="round"/>`)}
    </g>
    <path d="${outline}" fill="url(#fold)"/>
    ${mirror(`<path d="M820,318 Q774,416 782,522" fill="none" stroke="${tone.seam}" stroke-width="3"/>
      <path d="M782,540 q-34,60 -22,150" fill="none" stroke="rgba(0,0,0,0.07)" stroke-width="14" stroke-linecap="round"/>
      <path d="M898,918 L903,978 M924,914 L928,975" fill="none" stroke="${tone.seam}" stroke-width="3"/>`)}
    <path d="M444,250 C470,314 590,314 616,250" fill="none" stroke="${tone.shade}" stroke-width="32" stroke-linecap="round"/>
    <path d="M444,250 C470,314 590,314 616,250" fill="none" stroke="${tone.rib}" stroke-width="26" stroke-linecap="round"/>`,
  };
}

// ---------------------------------------------------------------------------
// A carta. Moldura, marca, peça e placa do nome: iguais nas 16.

const escapeXml = (value) => String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);

function cardSvg(piece) {
  const garment = piece.kind === "Moletom" ? sweatshirt(piece.body) : tee(piece.body);
  const [centerX, centerY] = garment.center;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" font-family="${FONT}">
  <title>${escapeXml(`${piece.kind} ${piece.title}`)} — peça de demonstração do PoliMatch</title>
  <defs>
    <filter id="drop" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="20" stdDeviation="22" flood-color="#0B1220" flood-opacity="0.24"/>
    </filter>
    <linearGradient id="fold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#000" stop-opacity="0.16"/><stop offset="0.2" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.05"/><stop offset="0.8" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.16"/>
    </linearGradient>
    <linearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${mix(PANEL, "#ffffff", 0.35)}"/><stop offset="1" stop-color="${PANEL}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#111418"/>
  <rect x="26" y="26" width="1008" height="1432" rx="34" fill="url(#panel)"/>
  <rect x="78" y="76" width="50" height="50" rx="12" fill="${GREEN}"/>
  <text x="103" y="114" font-size="36" font-weight="800" fill="#fff" text-anchor="middle">M</text>
  <text x="144" y="114" font-size="38" font-weight="700" fill="#111418" letter-spacing="-0.5">PoliMatch</text>
  <rect x="800" y="70" width="184" height="62" rx="31" fill="#111418"/>
  <text x="894.5" y="114" font-size="36" font-weight="700" fill="#fff" text-anchor="middle" letter-spacing="5">DEMO</text>
  ${garment.markup}
  <g transform="translate(${centerX},${centerY}) scale(1.18)">${PRINTS[piece.print](piece.body)}</g>
  <rect x="70" y="1150" width="920" height="264" rx="28" fill="${PAPER}" stroke="rgba(17,20,24,0.10)" stroke-width="2"/>
  <text x="530" y="1222" font-size="34" font-weight="800" fill="${GREEN}" text-anchor="middle" letter-spacing="9">${escapeXml(piece.kind.toUpperCase())}</text>
  <text x="530" y="1332" font-size="112" font-weight="800" fill="#111418" text-anchor="middle" letter-spacing="-2.5">${escapeXml(piece.title)}</text>
  <text x="530" y="1386" font-size="26" font-weight="700" fill="#5B6470" text-anchor="middle" letter-spacing="4">PEÇA DE DEMONSTRAÇÃO · ARTE COM IA</text>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Geração

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

mkdirSync(MASTERS_DIR, { recursive: true });
mkdirSync(PUBLIC_DIR, { recursive: true });
for (const name of readdirSync(MASTERS_DIR)) rmSync(join(MASTERS_DIR, name));
for (const name of readdirSync(PUBLIC_DIR)) rmSync(join(PUBLIC_DIR, name));

const work = mkdtempSync(join(tmpdir(), "roupas-"));
// CLOTHES_CARDS_CHROMIUM aponta para outro Chromium quando o do Playwright
// instalado não está na máquina.
const browser = await chromium.launch(process.env.CLOTHES_CARDS_CHROMIUM ? { executablePath: process.env.CLOTHES_CARDS_CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
const catalog = [];
const manifest = [];

for (const piece of PIECES) {
  const svg = cardSvg(piece);
  const masterPath = join(MASTERS_DIR, `${piece.id}.svg`);
  writeFileSync(masterPath, svg);
  const masterSha256 = sha256(readFileSync(masterPath));

  await page.setContent(`<!doctype html><html><body style="margin:0;background:#111418">${svg}</body></html>`);
  const png = join(work, `${piece.id}.png`);
  await page.screenshot({ path: png, type: "png", clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });

  const base = `${piece.id}-${VERSION}-${masterSha256.slice(0, 8)}`;
  const variants = [[WIDTH, HEIGHT], [WIDTH / 2, HEIGHT / 2]].map(([width, height]) => {
    const file = `${base}-${width}.webp`;
    execFileSync("cwebp", ["-quiet", "-q", "90", "-m", "6", "-sharp_yuv", "-resize", String(width), String(height), png, "-o", join(PUBLIC_DIR, file)]);
    return { src: `/chromas/roupas/${file}`, width, height, sha256: sha256(readFileSync(join(PUBLIC_DIR, file))) };
  }).sort((left, right) => left.width - right.width);

  const name = `${piece.kind} ${piece.title}`;
  catalog.push({
    id: piece.id,
    name,
    src: variants[0].src,
    srcset: variants.map((variant) => `${variant.src} ${variant.width}w`).join(", "),
    width: WIDTH,
    height: HEIGHT,
    drawnByCode: true,
    aiAssisted: true,
    edition: EDITION,
    masterSha256,
  });
  manifest.push({
    id: piece.id,
    name,
    master: `stages/73_clothes_demo/output/masters/${piece.id}.svg`,
    masterSha256,
    aiAssisted: true,
    tool: "desenho por código (app/scripts/build-clothes-cards.mjs), escrito por agente de IA; sem foto e sem serviço de geração de imagem",
    variants,
  });
}

// Folha de conferência: as 16 cartas lado a lado, como referência do estágio.
await page.setViewportSize({ width: 1180, height: 1640 });
await page.setContent(`<!doctype html><html><body style="margin:0;padding:24px;background:#f3f4f6;display:grid;grid-template-columns:repeat(4,265px);gap:24px;justify-content:center">
  ${PIECES.map((piece) => `<div style="width:265px;height:371px;border-radius:10px;overflow:hidden;box-shadow:0 8px 20px rgba(16,24,40,.14)"><div style="width:${WIDTH}px;height:${HEIGHT}px;transform:scale(.25);transform-origin:0 0">${cardSvg(piece).replace(/id="([\w-]+)"/g, `id="${piece.id}-$1"`).replace(/url\(#([\w-]+)\)/g, `url(#${piece.id}-$1)`)}</div></div>`).join("")}
</body></html>`);
mkdirSync(fileURLToPath(new URL("./", `file://${SHEET}`)), { recursive: true });
await page.screenshot({ path: SHEET, type: "jpeg", quality: 86, fullPage: true });
await browser.close();
rmSync(work, { recursive: true, force: true });

writeFileSync(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`);
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${catalog.length} cartas geradas em ${PUBLIC_DIR}`);
