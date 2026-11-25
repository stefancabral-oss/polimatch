import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import CARDS from "./celebrity-cards.json" with { type: "json" };
import CLOTHES from "./clothes-cards.json" with { type: "json" };
import ARTS from "./political-chromas.json" with { type: "json" };
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { STAGE, creditLine, creditsPage, licenseAddress, placement, workTitle } from "../scripts/celebrity-cards-lib.mjs";

// As cartas da pesquisa de famosos (ICM 74, #348) são fotografias de licença
// livre dentro de uma moldura desenhada por código. Este teste prende, uns aos
// outros, a pesquisa "famosos-01", o catálogo do app, o manifesto do estágio,
// a lista de origem (sources.json), as fotos como foram baixadas, os desenhos
// de origem, os arquivos publicados e a página de créditos: código, nome,
// autor, licença, endereço de origem, enquadramento, hash e os dois tamanhos
// de cada carta.
//
// O que ele não prova, porque não fala com a rede nem desenha:
//   - que a foto é da pessoa que o nome diz, e que a licença declarada na
//     Wikimedia Commons é verdadeira;
//   - que cada WebP é o desenho do seu SVG. Quem trocar dois WebP e, junto,
//     os hashes deles no manifesto passa por aqui; quem vê é a revisão do PR;
//   - que uma miniatura de 1280 px é a da Wikimedia: dela só há o hash do
//     arquivo baixado, não o do original.

const at = (path) => new URL(`../../${path}`, import.meta.url);
const evidence = JSON.parse(readFileSync(at(`${STAGE}/output/manifest.json`), "utf8"));
const sources = JSON.parse(readFileSync(at(`${STAGE}/output/sources.json`), "utf8"));
const creditsHtml = readFileSync(new URL("../creditos.html", import.meta.url), "utf8");
const hash = (bytes, kind = "sha256") => createHash(kind).update(bytes).digest("hex");
const survey = PHOTO_SURVEYS.find((item) => item.id === "famosos-01");
// Os dois tamanhos publicados de toda carta, do menor para o maior.
const SIZES = [[530, 742], [1060, 1484]];
// A data em que as cartas foram montadas: ninguém com menos de 18 anos nesse dia.
const ADULT_BY = "2008-11-24";
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// O .DS_Store é do Finder do macOS e o Git ignora: não é arquivo do estágio.
const filesIn = (url) => readdirSync(url).filter((name) => name !== ".DS_Store").sort();
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
// O nome do arquivo, como a Commons o escreve no endereço.
const fileNameOf = (address) => decodeURIComponent(address.split("/").at(-1)).replaceAll("_", " ");

/** Largura e altura gravadas no próprio arquivo WebP. */
function webpSize(bytes) {
  const chunk = bytes.subarray(12, 16).toString();
  if (chunk === "VP8 ") return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
  if (chunk === "VP8L") {
    const bits = bytes.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  if (chunk === "VP8X") return [bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1];
  throw new Error(`WebP de formato desconhecido: ${chunk}`);
}

/** Largura e altura gravadas na própria foto (PNG ou JPEG). */
function photoSize(bytes) {
  if (bytes.subarray(1, 4).toString() === "PNG") return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("foto de tipo desconhecido");
  // JPEG: percorre os segmentos até o do quadro, que traz a altura e a largura.
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) throw new Error("JPEG inesperado");
    const marker = bytes[offset + 1];
    if (marker === 0xff) { offset += 1; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)];
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error("JPEG sem quadro");
}

test("as cartas de famosos batem com a pesquisa, com as fotos de origem e com os arquivos publicados", () => {
  assert.equal(CARDS.length, 20);
  assert.equal(new Set(CARDS.map((card) => card.id)).size, CARDS.length);
  assert.deepEqual(CARDS.map((card) => card.id).sort(), [...survey.cardIds].sort(), "o catálogo tem exatamente as cartas da pesquisa");
  assert.deepEqual(evidence.map((item) => item.id), CARDS.map((card) => card.id), "catálogo e manifesto listam as mesmas cartas, na mesma ordem");
  assert.deepEqual(sources.map((item) => item.id), CARDS.map((card) => card.id), "a lista de origem tem as mesmas cartas, na mesma ordem");
  assert.equal(new Set(CARDS.map((card) => card.name)).size, CARDS.length, "nenhum nome se repete");

  for (const card of CARDS) {
    const proof = evidence.find((item) => item.id === card.id);
    const origin = sources.find((item) => item.id === card.id);
    assert.ok(card.name.length > 0, card.id);
    assert.equal(card.name, proof.name, card.id);
    assert.equal(card.name, origin.name, card.id);
    assert.equal(card.edition, "famosos-v1", card.id);

    // O manifesto repete, sem mudar, o que a lista de origem diz.
    for (const key of ["commons", "download", "origin", "wikidata", "authorShown", "license", "licenseUrl"]) {
      assert.deepEqual(proof.source[key], origin[key], `${card.id}: ${key} igual na lista de origem e no manifesto`);
    }
    assert.deepEqual(proof.crop, origin.crop, `${card.id}: enquadramento`);

    // A foto no repositório é a que o manifesto conferiu, com o tamanho que ele diz.
    assert.equal(proof.source.file, `${STAGE}/output/sources/${origin.file}`, card.id);
    const photo = readFileSync(at(proof.source.file));
    assert.equal(hash(photo), proof.source.sha256, `${card.id}: hash da foto`);
    assert.equal(photo.length, proof.source.bytes, card.id);
    assert.deepEqual(photoSize(photo), [proof.source.width, proof.source.height], `${card.id}: tamanho da foto`);

    // Original ou miniatura: um original é igual, byte a byte, ao que a Commons informa; uma miniatura tem 1280 px e vem de um original mais largo.
    assert.match(origin.commons.originalSha1, /^[0-9a-f]{40}$/, card.id);
    assert.ok(origin.commons.originalUrl.startsWith("https://upload.wikimedia.org/wikipedia/commons/") && !origin.commons.originalUrl.includes("?"), card.id);
    if (origin.download.kind === "arquivo original") {
      assert.equal(hash(photo, "sha1"), origin.commons.originalSha1, `${card.id}: o arquivo é o original da Commons`);
      assert.deepEqual([proof.source.width, proof.source.height, proof.source.bytes], [origin.commons.originalWidth, origin.commons.originalHeight, origin.commons.originalBytes], card.id);
      assert.equal(origin.download.url, origin.commons.originalUrl, card.id);
    } else {
      assert.equal(origin.download.kind, "miniatura de 1280 px gerada pela Wikimedia", card.id);
      assert.equal(proof.source.width, 1280, `${card.id}: a miniatura tem 1280 px de largura`);
      assert.ok(origin.commons.originalWidth > 1280, `${card.id}: só há miniatura de original mais largo que 1280 px`);
      assert.match(origin.download.url, /^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\/thumb\/.+\/1280px-[^/?]+$/, card.id);
      assert.ok(origin.download.url.includes(`/${origin.commons.originalUrl.split("/").at(-1)}/1280px-`), `${card.id}: a miniatura é do mesmo arquivo`);
    }
    assert.match(origin.download.date, DAY, card.id);

    // De onde veio: a página e o endereço do original são os do arquivo que o título diz.
    assert.ok(origin.commons.title.startsWith("File:"), card.id);
    assert.ok(origin.commons.page.startsWith("https://commons.wikimedia.org/wiki/File:"), card.id);
    assert.equal(decodeURIComponent(origin.commons.page.split("/wiki/")[1]).replaceAll("_", " "), origin.commons.title, `${card.id}: a página é a do arquivo`);
    assert.equal(fileNameOf(origin.commons.originalUrl), origin.commons.title.slice("File:".length), `${card.id}: o endereço do original é o do arquivo`);

    // De quem é e com que licença. O nome mostrado é o que a Commons pede; quando não é, há uma nota dizendo por quê.
    assert.ok(origin.commons.author.length > 0 && origin.authorShown.length > 0, `${card.id}: autor`);
    if (origin.authorNote === undefined) assert.equal(origin.authorShown, origin.commons.attribution || origin.commons.author, `${card.id}: o crédito é o que a Commons informa`);
    else assert.ok(origin.authorNote.length > 20, `${card.id}: a nota explica o crédito diferente`);
    assert.equal(origin.licenseUrl, licenseAddress(origin.license), `${card.id}: o endereço é o da licença`);
    assert.equal(proof.credit, creditLine(origin), card.id);
    assert.equal(proof.credit, `Foto: ${origin.authorShown} · ${origin.license}`, card.id);
    assert.deepEqual(card.photo, { author: origin.authorShown, license: origin.license, licenseUrl: origin.licenseUrl, page: origin.commons.page }, `${card.id}: o catálogo repete o crédito`);
    assert.match(origin.commons.licenseReview, /^(revisada|pede revisão|sem categoria de revisão)$/, card.id);
    assert.equal(typeof origin.commons.personalityRightsWarning, "boolean", card.id);
    assert.match(origin.commons.seenOn, DAY, card.id);

    // A origem fora da Commons, quando há, e o que foi visto nela.
    if (origin.origin.kind === "quadro de vídeo do YouTube") {
      assert.match(origin.origin.url, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/, card.id);
      assert.equal(origin.origin.licenseSeen, "Creative Commons Attribution license (reuse allowed)", card.id);
      assert.ok(origin.origin.channel.length > 0, card.id);
      assert.match(origin.origin.seenOn, DAY, card.id);
    } else if (origin.origin.kind === "foto do Flickr") {
      assert.match(origin.origin.url, /^https:\/\/www\.flickr\.com\/photos\/[^/]+\/\d+\/$/, card.id);
      assert.equal(origin.origin.licenseSeen, origin.license, `${card.id}: a licença vista no Flickr é a da carta`);
      assert.match(origin.origin.seenOn, DAY, card.id);
    } else {
      assert.equal(origin.origin.kind, "obra própria declarada na Commons", card.id);
      assert.equal(origin.origin.url, origin.commons.page, card.id);
      assert.equal(origin.origin.licenseSeen, null, card.id);
    }

    // Só adultos: a data de nascimento registrada é a da Wikidata.
    assert.match(origin.wikidata.id, /^Q\d+$/, card.id);
    assert.match(origin.wikidata.born, DAY, `${card.id}: data de nascimento`);
    assert.ok(origin.wikidata.born <= ADULT_BY, `${card.id}: tinha 18 anos ou mais em 24/11/2026`);

    // O desenho de origem aponta para a foto desta carta, no lugar que o enquadramento dá, e traz o nome e o crédito.
    assert.equal(proof.master, `${STAGE}/output/masters/${card.id}.svg`, card.id);
    const master = readFileSync(at(proof.master));
    assert.equal(hash(master), proof.masterSha256, card.id);
    const drawing = master.toString("utf8");
    const place = placement(origin, proof.source.width, proof.source.height);
    assert.deepEqual(proof.placement, place, `${card.id}: o lugar da foto é o que o enquadramento dá`);
    assert.ok(drawing.includes(`<title>${escapeHtml(card.name)} — `), `${card.id}: o desenho de origem é o desta carta`);
    assert.ok(drawing.includes(`<image href="../sources/${origin.file}" x="${place.x}" y="${place.y}" width="${place.width}" height="${place.height}" `), `${card.id}: o desenho usa a foto desta carta, no lugar certo`);
    assert.ok(drawing.includes(` font-size="${proof.textSizes.name}" font-weight="800" fill="#111418" text-anchor="middle" letter-spacing="-2.5">${escapeHtml(card.name)}</text>`), `${card.id}: nome na placa`);
    assert.ok(drawing.includes(` font-size="${proof.textSizes.credit}" font-weight="700" fill="#5B6470" text-anchor="middle" letter-spacing="3">${escapeHtml(proof.credit.toUpperCase())}</text>`), `${card.id}: crédito da foto na carta`);
    assert.ok(proof.textSizes.name >= 60 && proof.textSizes.credit >= 17, `${card.id}: o texto não encolheu demais`);
    // A foto cobre a janela inteira da moldura.
    assert.ok(place.x <= 70 && place.y <= 150 && place.x + place.width >= 990 && place.y + place.height >= 1150, `${card.id}: a foto cobre a janela`);
    // A foto não é editada, e o manifesto diz como a carta foi montada.
    assert.equal(proof.aiEdited, false, card.id);
    assert.ok(typeof proof.tool === "string" && proof.tool.includes("agente de IA") && proof.tool.includes("sem edição por IA"), `${card.id}: o manifesto diz como a carta foi feita`);

    // Dois tamanhos; o nome do arquivo leva o código da carta e um carimbo do desenho e da foto.
    assert.equal(proof.stamp, hash(Buffer.concat([master, photo])).slice(0, 8), card.id);
    assert.equal(card.stamp, proof.stamp, card.id);
    assert.deepEqual(proof.variants.map((variant) => [variant.width, variant.height]), SIZES, card.id);
    for (const variant of proof.variants) {
      assert.equal(variant.src, `/chromas/famosos/${card.id}-v01-${proof.stamp}-${variant.width}.webp`, card.id);
      const bytes = readFileSync(new URL(`../public${variant.src}`, import.meta.url));
      assert.equal(hash(bytes), variant.sha256, variant.src);
      assert.equal(bytes.subarray(8, 12).toString(), "WEBP", variant.src);
      assert.ok(bytes.length < 600000, variant.src);
      assert.deepEqual(webpSize(bytes), [variant.width, variant.height], `${variant.src}: o tamanho do arquivo é o declarado`);
      assert.equal(variant.width / variant.height, 5 / 7, variant.src);
    }

    // O que a página pede (`src` e `srcset`) é o que o manifesto conferiu, com a largura certa em cada um.
    assert.equal(card.srcset, proof.variants.map((variant) => `${variant.src} ${variant.width}w`).join(", "), card.id);
    assert.equal(card.src, proof.variants[0].src, card.id);
    assert.deepEqual([card.width, card.height], SIZES[1], card.id);
  }
});

test("as pastas das cartas de famosos só têm os arquivos do manifesto", () => {
  const listed = evidence.flatMap((item) => item.variants.map((variant) => variant.src)).sort();
  assert.equal(new Set(listed).size, listed.length, "nenhum arquivo aparece duas vezes no manifesto");
  assert.deepEqual(filesIn(new URL("../public/chromas/famosos/", import.meta.url)).map((name) => `/chromas/famosos/${name}`), listed);
  assert.deepEqual(filesIn(at(`${STAGE}/output/masters/`)), evidence.map((item) => `${item.id}.svg`).sort());
  assert.deepEqual(filesIn(at(`${STAGE}/output/sources/`)), sources.map((item) => item.file).sort());
  assert.deepEqual(filesIn(at(`${STAGE}/output/`)), ["HANDOFF.md", "manifest.json", "masters", "sources", "sources.json", "verification.json"]);
});

test("a página de créditos é a que a lista de origem gera, com autor, licença, título e origem de cada foto", () => {
  // A página inteira: mexer num crédito, na frase do que foi mudado ou no aviso sem gerar de novo faz o teste falhar.
  assert.equal(creditsHtml, creditsPage(sources));
  for (const origin of sources) {
    const line = `<li><b>${escapeHtml(origin.name)}</b><span>Foto de <a href="${escapeHtml(origin.commons.page)}" rel="noopener">${escapeHtml(origin.authorShown)}</a>, licença <a href="${escapeHtml(origin.licenseUrl)}" rel="noopener license">${escapeHtml(origin.license)}</a>. Título na Wikimedia Commons: “${escapeHtml(workTitle(origin))}”.</span></li>`;
    assert.ok(creditsHtml.includes(line), `${origin.id}: linha de crédito na página`);
  }
  assert.equal(creditsHtml.match(/<li><b>/g).length, sources.length, "uma linha por carta, nenhuma a mais");
  assert.ok(creditsHtml.includes("Cada foto foi recortada e redimensionada"), "diz o que foi mudado");
  assert.ok(creditsHtml.includes("Nenhuma foto foi editada por IA."));
  assert.ok(creditsHtml.includes("não indica apoio dela ao PoliMatch"));
  // As cartas feitas de foto com licença de compartilhar pela mesma licença dizem isso.
  const shareAlike = sources.filter((item) => /BY-SA/.test(item.license));
  assert.ok(shareAlike.length > 0, "há cartas com licença de compartilhar pela mesma licença");
  for (const origin of shareAlike) {
    assert.match(creditsHtml, new RegExp(`(A carta|As cartas) de [^<]*${escapeHtml(origin.name)}[^<]* nos termos da mesma licença da foto`), origin.id);
  }
});

test("as contas do enquadramento e os textos de crédito", () => {
  // Foto do tamanho exato da janela: fica onde a janela está.
  assert.deepEqual(placement({ id: "x", crop: { x: 0.5, y: 0.5, zoom: 1 } }, 920, 1000), { x: 70, y: 150, width: 920, height: 1000, scale: 1 });
  // Foto mais larga que a janela: a altura manda, e o foco fora do alcance não deixa a janela vazia.
  assert.deepEqual(placement({ id: "x", crop: { x: 0, y: 0, zoom: 1 } }, 2000, 1000), { x: 70, y: 150, width: 2000, height: 1000, scale: 1 });
  assert.deepEqual(placement({ id: "x", crop: { x: 1, y: 1, zoom: 1 } }, 2000, 1000), { x: -1010, y: 150, width: 2000, height: 1000, scale: 1 });
  // Zoom menor que 1 deixaria a janela vazia.
  assert.throws(() => placement({ id: "x", crop: { x: 0.5, y: 0.5, zoom: 0.9 } }, 920, 1000), /zoom/);
  assert.equal(licenseAddress("CC BY 3.0"), "https://creativecommons.org/licenses/by/3.0");
  assert.equal(licenseAddress("CC BY-SA 4.0"), "https://creativecommons.org/licenses/by-sa/4.0");
  assert.equal(licenseAddress("CC0"), "https://creativecommons.org/publicdomain/zero/1.0");
  // Licença que não deixa adaptar ou vender não entra.
  assert.throws(() => licenseAddress("CC BY-NC 4.0"), /não aceita/);
  assert.throws(() => licenseAddress("CC BY-ND 4.0"), /não aceita/);
  assert.equal(workTitle({ commons: { title: "File:Uma foto (2024).JPG" } }), "Uma foto (2024)");
  assert.equal(creditLine({ authorShown: "Fulana", license: "CC BY 3.0" }), "Foto: Fulana · CC BY 3.0");
});

test("as cartas de famosos não repetem código de carta de outra pesquisa", () => {
  // A página junta os catálogos num só: um código repetido trocaria uma carta pela outra.
  const taken = new Set([...ARTS, ...CLOTHES].map((art) => art.id));
  assert.deepEqual(CARDS.map((card) => card.id).filter((id) => taken.has(id)), []);
});
