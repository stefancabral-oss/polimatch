import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import CARDS from "./clothes-cards.json" with { type: "json" };
import ARTS from "./political-chromas.json" with { type: "json" };
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";

// As 16 cartas da demonstração de roupas (ICM 73, #345) são o que a pesquisa
// "roupas-demo-01" publica. Este teste prende, uns aos outros, a pesquisa, o
// catálogo do app, o manifesto do estágio 73, os desenhos de origem e os
// arquivos publicados: código, nome, caminho, hash, tamanho e os dois
// tamanhos de cada carta. Carta que some, que troca de desenho com outra, que
// perde um tamanho ou que sobra numa das pastas faz o teste falhar.
//
// O que ele não prova: que cada WebP é o desenho do seu SVG. Isso só se
// confere gerando de novo, e o texto das cartas depende da fonte da máquina.
// Quem trocar um WebP e, junto, o hash dele no manifesto passa por aqui; quem
// vê é a revisão do PR. Os roteiros de navegador só carregam as cartas que
// aparecem em cada execução.

const evidence = JSON.parse(readFileSync(new URL("../../stages/73_clothes_demo/output/manifest.json", import.meta.url), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const survey = PHOTO_SURVEYS.find((item) => item.id === "roupas-demo-01");
// Os dois tamanhos publicados de toda carta, do menor para o maior.
const SIZES = [[530, 742], [1060, 1484]];
// O .DS_Store é do Finder do macOS e o Git ignora: não é arquivo do estágio.
const filesIn = (folder) => readdirSync(new URL(folder, import.meta.url)).filter((name) => name !== ".DS_Store").sort();

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

test("as dezesseis cartas de roupas batem com a pesquisa, com os desenhos de origem e com os arquivos publicados", () => {
  assert.equal(CARDS.length, 16);
  assert.equal(new Set(CARDS.map((card) => card.id)).size, 16);
  assert.deepEqual(CARDS.map((card) => card.id).sort(), [...survey.cardIds].sort(), "o catálogo tem exatamente as cartas da pesquisa");
  assert.deepEqual(evidence.map((item) => item.id), CARDS.map((card) => card.id), "catálogo e manifesto listam as mesmas cartas, na mesma ordem");
  assert.equal(new Set(CARDS.map((card) => card.name)).size, 16, "nenhum nome se repete");
  for (const card of CARDS) {
    const proof = evidence.find((item) => item.id === card.id);
    assert.ok(card.name.length > 0, card.id);
    assert.equal(card.name, proof.name, card.id);
    // A arte foi feita com IA: catálogo e manifesto dizem isso (CREDITS.md).
    assert.equal(card.aiAssisted, true, card.id);
    assert.equal(proof.aiAssisted, true, card.id);
    assert.equal(card.drawnByCode, true, card.id);

    // O desenho de origem é o arquivo com o código da carta, e traz o nome dela.
    assert.equal(proof.master, `stages/73_clothes_demo/output/masters/${card.id}.svg`, card.id);
    const master = readFileSync(new URL(`../../${proof.master}`, import.meta.url));
    assert.equal(hash(master), card.masterSha256, card.id);
    assert.equal(card.masterSha256, proof.masterSha256, card.id);
    const drawing = master.toString("utf8");
    assert.ok(drawing.includes(`<title>${card.name} — `), `${card.id}: o desenho de origem é o desta carta`);
    // O aviso de demonstração e a declaração de IA estão no desenho de toda carta.
    assert.ok(drawing.includes(">DEMO</text>"), `${card.id}: selo "DEMO"`);
    assert.ok(drawing.includes(">PEÇA DE DEMONSTRAÇÃO · ARTE COM IA</text>"), `${card.id}: legenda de demonstração e de IA`);
    assert.equal(card.edition, "roupas-demo-v1", card.id);
    assert.ok(typeof proof.tool === "string" && proof.tool.includes("agente de IA"), `${card.id}: o manifesto diz como a arte foi feita`);

    // Dois tamanhos, com o código da carta e o começo do hash do desenho no nome.
    assert.deepEqual(proof.variants.map((variant) => [variant.width, variant.height]), SIZES, card.id);
    for (const variant of proof.variants) {
      assert.equal(variant.src, `/chromas/roupas/${card.id}-v01-${card.masterSha256.slice(0, 8)}-${variant.width}.webp`, card.id);
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

test("as pastas das cartas de roupas só têm os arquivos do manifesto", () => {
  const listed = evidence.flatMap((item) => item.variants.map((variant) => variant.src)).sort();
  assert.equal(new Set(listed).size, listed.length, "nenhum arquivo aparece duas vezes no manifesto");
  assert.deepEqual(filesIn("../public/chromas/roupas/").map((name) => `/chromas/roupas/${name}`), listed);
  assert.deepEqual(filesIn("../../stages/73_clothes_demo/output/masters/"), evidence.map((item) => `${item.id}.svg`).sort());
});

test("as cartas de roupas e as de política não repetem código", () => {
  // A página junta os dois catálogos num só: um código repetido trocaria uma carta pela outra.
  const political = new Set(ARTS.map((art) => art.id));
  assert.deepEqual(CARDS.map((card) => card.id).filter((id) => political.has(id)), []);
});
