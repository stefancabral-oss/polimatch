import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import ARTS from "./political-chromas.json" with { type: "json" };
import ROSTER from "../../shared/presidential-roster.json" with { type: "json" };
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";

// As 20 cartas "Políticos 2026" são o que a capa publica. Este teste prende o
// catálogo delas ao elenco e cada arquivo ao manifesto do estágio 29: carta
// que some, que é trocada ou que perde um tamanho faz o teste falhar. Os
// roteiros de navegador só carregam as cartas sorteadas em cada execução.

const evidence = JSON.parse(readFileSync(new URL("../../stages/29_political_chromas/output/manifest.json", import.meta.url), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("as vinte cartas de política batem com o elenco, com as artes de origem e com os arquivos publicados", () => {
  const ids = ROSTER.categories.find((category) => category.id === "politicos").members.map((member) => member.id);
  assert.equal(ARTS.length, 20);
  assert.deepEqual(ARTS.map((art) => art.id), ids);
  assert.equal(new Set(ARTS.map((art) => art.id)).size, 20);
  for (const art of ARTS) {
    const person = ROSTER.people.find((item) => item.id === art.id);
    const proof = evidence.find((item) => item.id === art.id);
    assert.equal(art.name, person.name);
    assert.equal(hash(readFileSync(new URL(`../../${proof.master}`, import.meta.url))), art.masterSha256);
    assert.equal(hash(readFileSync(new URL(`../public${person.photo.path}`, import.meta.url))), person.photo.sha256);
    for (const variant of proof.variants) {
      const bytes = readFileSync(new URL(`../public${variant.src}`, import.meta.url));
      assert.equal(hash(bytes), variant.sha256);
      assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
      assert.ok(bytes.length < 600000);
      assert.equal(variant.width / variant.height, 5 / 7);
    }
    // O que a página pede (`src` e `srcset`) é o que o manifesto conferiu.
    const published = proof.variants.map((variant) => variant.src).sort();
    const requested = art.srcset.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]).sort();
    assert.deepEqual(requested, published, art.id);
    assert.ok(requested.includes(art.src), art.id);
  }
});

test("a pesquisa de política usa exatamente as cartas do catálogo", () => {
  const survey = PHOTO_SURVEYS.find((item) => item.id === "politica-2026-01");
  assert.deepEqual([...survey.cardIds].sort(), ARTS.map((art) => art.id).sort());
});
