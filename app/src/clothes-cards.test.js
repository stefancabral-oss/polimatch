import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import CARDS from "./clothes-cards.json" with { type: "json" };
import ARTS from "./political-chromas.json" with { type: "json" };
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";

// As 16 cartas da demonstração de roupas (ICM 73, #345) são o que a pesquisa
// "roupas-demo-01" publica. Este teste prende o catálogo delas à pesquisa e
// cada arquivo ao manifesto do estágio 73: carta que some, que é trocada, que
// perde um tamanho ou que sobra na pasta faz o teste falhar. Os roteiros de
// navegador só carregam as cartas que aparecem em cada execução.

const evidence = JSON.parse(readFileSync(new URL("../../stages/73_clothes_demo/output/manifest.json", import.meta.url), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const survey = PHOTO_SURVEYS.find((item) => item.id === "roupas-demo-01");

test("as dezesseis cartas de roupas batem com a pesquisa, com as artes de origem e com os arquivos publicados", () => {
  assert.equal(CARDS.length, 16);
  assert.equal(new Set(CARDS.map((card) => card.id)).size, 16);
  assert.deepEqual(CARDS.map((card) => card.id).sort(), [...survey.cardIds].sort(), "o catálogo tem exatamente as cartas da pesquisa");
  assert.equal(evidence.length, 16);
  assert.deepEqual(evidence.map((item) => item.id).sort(), CARDS.map((card) => card.id).sort(), "catálogo e manifesto listam as mesmas cartas");
  for (const card of CARDS) {
    const proof = evidence.find((item) => item.id === card.id);
    assert.ok(card.name.length > 0, card.id);
    assert.equal(card.name, proof.name, card.id);
    assert.equal(card.masterSha256, proof.masterSha256, card.id);
    assert.equal(hash(readFileSync(new URL(`../../${proof.master}`, import.meta.url))), card.masterSha256, card.id);
    assert.ok(proof.variants.length > 0, card.id);
    for (const variant of proof.variants) {
      assert.match(variant.src, /^\/chromas\/roupas\/[^/]+\.webp$/, card.id);
      const bytes = readFileSync(new URL(`../public${variant.src}`, import.meta.url));
      assert.equal(hash(bytes), variant.sha256, variant.src);
      assert.equal(bytes.subarray(8, 12).toString(), "WEBP", variant.src);
      assert.ok(bytes.length < 600000, variant.src);
      assert.equal(variant.width / variant.height, 5 / 7, variant.src);
    }
    // O que a página pede (`src` e `srcset`) é o que o manifesto conferiu.
    const published = proof.variants.map((variant) => variant.src).sort();
    const requested = card.srcset.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]).sort();
    assert.deepEqual(requested, published, card.id);
    assert.ok(requested.includes(card.src), card.id);
    assert.equal(card.width / card.height, 5 / 7, card.id);
  }
});

test("a pasta publicada das cartas de roupas só tem os arquivos do manifesto", () => {
  const listed = evidence.flatMap((item) => item.variants.map((variant) => variant.src)).sort();
  assert.equal(new Set(listed).size, listed.length, "nenhum arquivo aparece duas vezes no manifesto");
  // O .DS_Store é do Finder do macOS e o Git ignora: não é arquivo publicado.
  const present = readdirSync(new URL("../public/chromas/roupas/", import.meta.url))
    .filter((name) => name !== ".DS_Store")
    .map((name) => `/chromas/roupas/${name}`)
    .sort();
  assert.deepEqual(present, listed);
});

test("as cartas de roupas e as de política não repetem código", () => {
  // A página junta os dois catálogos num só: um código repetido trocaria uma carta pela outra.
  const political = new Set(ARTS.map((art) => art.id));
  assert.deepEqual(CARDS.map((card) => card.id).filter((id) => political.has(id)), []);
});
