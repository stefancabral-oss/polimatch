import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import CARDS from "./celebrity-cards.json" with { type: "json" };
import CLOTHES from "./clothes-cards.json" with { type: "json" };
import ARTS from "./political-chromas.json" with { type: "json" };
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";

// As cartas da pesquisa de famosos (ICM 74, #348) são fotografias de licença
// livre dentro de uma moldura desenhada por código. Este teste prende, uns aos
// outros, a pesquisa "famosos-01", o catálogo do app, o manifesto do estágio,
// a lista de origem (sources.json), as fotos como foram baixadas, os desenhos
// de origem, os arquivos publicados e a página de créditos: código, nome,
// autor, licença, endereço de origem, hash e os dois tamanhos de cada carta.
//
// O que ele não prova: que a foto é da pessoa que o nome diz, que a licença
// declarada na Wikimedia Commons é verdadeira, nem que cada WebP é o desenho
// do seu SVG (isso só se confere gerando de novo, e o texto depende da fonte
// da máquina). Quem trocar uma foto e, junto, os hashes dela passa por aqui;
// quem vê é a revisão do PR.

const STAGE = "stages/74_celebrity_survey";
const at = (path) => new URL(`../../${path}`, import.meta.url);
const evidence = JSON.parse(readFileSync(at(`${STAGE}/output/manifest.json`), "utf8"));
const sources = JSON.parse(readFileSync(at(`${STAGE}/output/sources.json`), "utf8"));
const creditsPage = readFileSync(new URL("../creditos.html", import.meta.url), "utf8");
const hash = (bytes, kind = "sha256") => createHash(kind).update(bytes).digest("hex");
const survey = PHOTO_SURVEYS.find((item) => item.id === "famosos-01");
// Os dois tamanhos publicados de toda carta, do menor para o maior.
const SIZES = [[530, 742], [1060, 1484]];
// Licenças aceitas: as que permitem reutilizar e adaptar, com ou sem a exigência de crédito.
const LICENSE = /^(CC BY(-SA)? [1-4]\.\d( [a-z]{2})?|CC0|Public domain)$/;
// A data em que as cartas foram montadas: ninguém com menos de 18 anos nesse dia.
const ADULT_BY = "2008-11-24";
// O .DS_Store é do Finder do macOS e o Git ignora: não é arquivo do estágio.
const filesIn = (url) => readdirSync(url).filter((name) => name !== ".DS_Store").sort();
const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

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

    // A foto no repositório é a que o manifesto conferiu.
    assert.equal(proof.source.file, `${STAGE}/output/sources/${origin.file}`, card.id);
    const photo = readFileSync(at(proof.source.file));
    assert.equal(hash(photo), proof.source.sha256, `${card.id}: hash da foto`);
    assert.equal(photo.length, proof.source.bytes, card.id);
    // Quando o arquivo baixado é o original, ele é igual, byte a byte, ao que a Wikimedia Commons informa.
    assert.match(origin.download.kind, /^(arquivo original|miniatura de 1280 px gerada pela Wikimedia)$/, card.id);
    if (origin.download.kind === "arquivo original") assert.equal(hash(photo, "sha1"), origin.commons.originalSha1, `${card.id}: o arquivo é o original da Commons`);
    assert.match(origin.commons.originalSha1, /^[0-9a-f]{40}$/, card.id);
    assert.deepEqual(proof.source.commons, origin.commons, card.id);
    assert.deepEqual(proof.source.download, origin.download, card.id);

    // De onde veio, de quem é e com que licença.
    assert.ok(origin.commons.title.startsWith("File:"), card.id);
    assert.ok(origin.commons.page.startsWith("https://commons.wikimedia.org/wiki/File:"), card.id);
    assert.ok(origin.commons.originalUrl.startsWith("https://upload.wikimedia.org/wikipedia/commons/"), card.id);
    assert.match(origin.download.url, /^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//, card.id);
    assert.ok(!origin.download.url.includes("?") && !origin.commons.originalUrl.includes("?"), `${card.id}: endereço sem parâmetros`);
    assert.ok(origin.author.length > 0 && origin.authorShown.length > 0, `${card.id}: autor`);
    assert.match(origin.license, LICENSE, `${card.id}: licença aceita`);
    assert.ok(origin.licenseUrl.startsWith("https://creativecommons.org/"), `${card.id}: endereço da licença`);
    assert.equal(proof.credit, `Foto: ${origin.authorShown} · ${origin.license}`, card.id);
    assert.deepEqual(card.photo, { author: origin.authorShown, license: origin.license, licenseUrl: origin.licenseUrl, page: origin.commons.page }, `${card.id}: o catálogo repete o crédito`);
    assert.deepEqual([proof.source.author, proof.source.authorShown, proof.source.license, proof.source.licenseUrl], [origin.author, origin.authorShown, origin.license, origin.licenseUrl], card.id);

    // Só adultos: a data de nascimento registrada é a da Wikidata.
    assert.match(origin.wikidata.id, /^Q\d+$/, card.id);
    assert.match(origin.wikidata.born, /^\d{4}-\d{2}-\d{2}$/, `${card.id}: data de nascimento`);
    assert.ok(origin.wikidata.born <= ADULT_BY, `${card.id}: tinha 18 anos ou mais em 24/11/2026`);

    // O desenho de origem aponta para a foto desta carta e traz o nome e o crédito.
    assert.equal(proof.master, `${STAGE}/output/masters/${card.id}.svg`, card.id);
    const master = readFileSync(at(proof.master));
    assert.equal(hash(master), proof.masterSha256, card.id);
    const drawing = master.toString("utf8");
    assert.ok(drawing.includes(`<title>${escapeHtml(card.name)} — `), `${card.id}: o desenho de origem é o desta carta`);
    assert.ok(drawing.includes(`<image href="../sources/${origin.file}" `), `${card.id}: o desenho usa a foto desta carta`);
    assert.ok(drawing.includes(`>${escapeHtml(card.name)}</text>`), `${card.id}: nome na placa`);
    assert.ok(drawing.includes(`>${escapeHtml(proof.credit.toUpperCase())}</text>`), `${card.id}: crédito da foto na carta`);
    // A foto não é editada, e o manifesto diz como a carta foi montada.
    assert.equal(proof.aiEdited, false, card.id);
    assert.ok(typeof proof.tool === "string" && proof.tool.includes("agente de IA") && proof.tool.includes("sem edição por IA"), `${card.id}: o manifesto diz como a carta foi feita`);
    // A foto cobre a janela inteira da moldura.
    assert.ok(proof.placement.x <= 70 && proof.placement.y <= 150, `${card.id}: a foto começa antes da janela`);
    assert.ok(proof.placement.x + proof.placement.width >= 990 && proof.placement.y + proof.placement.height >= 1150, `${card.id}: a foto cobre a janela`);

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
});

test("a página de créditos traz o autor, a licença e a origem de cada foto", () => {
  for (const origin of sources) {
    const line = `<li><b>${escapeHtml(origin.name)}</b><span>Foto de <a href="${escapeHtml(origin.commons.page)}" rel="noopener">${escapeHtml(origin.authorShown)}</a>, licença <a href="${escapeHtml(origin.licenseUrl)}" rel="noopener license">${escapeHtml(origin.license)}</a>.</span></li>`;
    assert.ok(creditsPage.includes(line), `${origin.id}: linha de crédito na página`);
  }
  assert.equal(creditsPage.match(/<li><b>/g).length, sources.length, "uma linha por carta, nenhuma a mais");
  assert.ok(creditsPage.includes("Nenhuma foto foi editada por IA."));
  // As cartas feitas de foto com licença de compartilhar pela mesma licença dizem isso.
  for (const origin of sources.filter((item) => /BY-SA/.test(item.license))) {
    assert.match(creditsPage, new RegExp(`(A carta|As cartas) de [^<]*${escapeHtml(origin.name)}[^<]* nos termos da mesma licença da foto`), origin.id);
  }
});

test("as cartas de famosos não repetem código de carta de outra pesquisa", () => {
  // A página junta os catálogos num só: um código repetido trocaria uma carta pela outra.
  const taken = new Set([...ARTS, ...CLOTHES].map((art) => art.id));
  assert.deepEqual(CARDS.map((card) => card.id).filter((id) => taken.has(id)), []);
});
