import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTO_SURVEY_ID,
  PHOTO_SURVEY_STORAGE_KEY,
  chooseChampion,
  freshProgress,
  goBack,
  identityTag,
  pickCard,
  progressView,
  readSavedProgress,
  responseBody,
  restoreProgress,
  sameGroups,
  sampleCards,
  savedProgressText,
} from "./photo-survey-flow.js";

const GROUPS = [
  ["a1", "a2", "a3", "a4"],
  ["b1", "b2", "b3", "b4"],
  ["c1", "c2", "c3", "c4"],
  ["d1", "d2", "d3", "d4"],
];
const UUID = "5f0c2c0e-8a55-4a52-9d6c-0d2b8a1f3c11";
const uuid = () => UUID;
const fresh = () => freshProgress(GROUPS, uuid);
const play = (progress, ...cardIds) => cardIds.reduce((current, id) => pickCard(current, id), progress);
const atFinal = () => play(fresh(), "a1", "b2", "c3", "d4");

test("a pesquisa da página e a chave de armazenamento são fixas", () => {
  assert.equal(PHOTO_SURVEY_ID, "politica-2026-01");
  assert.equal(PHOTO_SURVEY_STORAGE_KEY, "polimatch:photo-survey:v1");
});

test("as cartas da entrada são distintas, saem do conjunto e mudam com o sorteio", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  assert.deepEqual(sampleCards(ids, 3, () => 0), ["a", "b", "c"]);
  assert.deepEqual(sampleCards(ids, 3, (limit) => limit - 1), ["f", "a", "b"]);
  assert.deepEqual(sampleCards(ids, 9, () => 0), ids, "nunca devolve mais do que existe");
  assert.deepEqual(ids, ["a", "b", "c", "d", "e", "f"], "não altera a lista recebida");

  // mulberry32 com semente: o teste de frequência precisa ser reproduzível.
  let state = 20261113;
  const randomInt = (limit) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return Math.floor((((value ^ (value >>> 14)) >>> 0) / 4294967296) * limit);
  };
  const first = new Map(ids.map((id) => [id, 0]));
  for (let round = 0; round < 6000; round += 1) {
    const sample = sampleCards(ids, 3, randomInt);
    assert.equal(new Set(sample).size, 3);
    first.set(sample[0], first.get(sample[0]) + 1);
  }
  for (const [id, count] of first) assert.ok(count > 800 && count < 1200, `${id} abriu a entrada ${count} vezes`);
});

test("um progresso novo começa na primeira tela, sem escolha e com recibo próprio", () => {
  const progress = fresh();
  assert.deepEqual(progress, { groups: GROUPS, picks: [null, null, null, null], championId: null, answerId: UUID, step: 0 });
  assert.notEqual(progress.groups, GROUPS, "os grupos são copiados");
  assert.deepEqual(progressView(progress), { kind: "vote", screen: 0, screens: 4, cards: GROUPS[0], selectedId: null });
  assert.equal(responseBody(progress), null);
});

test("um toque escolhe e avança; depois da quarta tela vem a final", () => {
  let progress = pickCard(fresh(), "a3");
  assert.deepEqual(progress.picks, ["a3", null, null, null]);
  assert.deepEqual(progressView(progress), { kind: "vote", screen: 1, screens: 4, cards: GROUPS[1], selectedId: null });
  progress = play(progress, "b1", "c1", "d1");
  assert.deepEqual(progressView(progress), { kind: "final", cards: ["a3", "b1", "c1", "d1"], selectedId: null });
});

test("carta de outra tela ou de fora do sorteio não é aceita", () => {
  const progress = fresh();
  assert.equal(pickCard(progress, "b1"), progress);
  assert.equal(pickCard(progress, "zz"), progress);
  assert.equal(pickCard(progress, undefined), progress);
  const final = atFinal();
  assert.equal(pickCard(final, "a2"), final, "na final não se escolhe carta de tela");
  assert.equal(chooseChampion(final, "a2"), final, "a escolhida tem de ser uma das quatro");
  assert.equal(chooseChampion(progress, "a1"), progress, "fora da final não há escolhida");
});

test("a final escolhe entre as quatro e leva à confirmação", () => {
  const confirmed = chooseChampion(atFinal(), "c3");
  assert.equal(confirmed.championId, "c3");
  assert.deepEqual(progressView(confirmed), { kind: "confirm", championId: "c3", otherIds: ["a1", "b2", "d4"] });
  assert.deepEqual(responseBody(confirmed), { answerId: UUID, pickIds: ["a1", "b2", "c3", "d4"], championId: "c3" });
});

test("voltar anda uma tela por vez e para na primeira", () => {
  let progress = chooseChampion(atFinal(), "c3");
  progress = goBack(progress);
  assert.deepEqual(progressView(progress), { kind: "final", cards: ["a1", "b2", "c3", "d4"], selectedId: "c3" });
  progress = goBack(progress);
  assert.deepEqual(progressView(progress), { kind: "vote", screen: 3, screens: 4, cards: GROUPS[3], selectedId: "d4" });
  progress = goBack(goBack(goBack(progress)));
  assert.equal(progressView(progress).screen, 0);
  assert.equal(goBack(progress), progress, "na primeira tela não há para onde voltar");
});

test("trocar uma escolha volta direto para a final e mantém as outras", () => {
  let progress = goBack(goBack(atFinal()));
  assert.equal(progressView(progress).screen, 2);
  progress = pickCard(progress, "c1");
  assert.deepEqual(progress.picks, ["a1", "b2", "c1", "d4"]);
  assert.equal(progressView(progress).kind, "final");
});

test("tocar de novo na mesma carta só segue adiante", () => {
  const before = chooseChampion(atFinal(), "b2");
  const again = pickCard(goBack(goBack(before)), "d4");
  assert.deepEqual(again.picks, before.picks);
  assert.equal(again.championId, "b2", "a escolhida continua valendo");
  assert.equal(progressView(again).kind, "final");
});

test("trocar a carta que era a escolhida apaga a escolhida", () => {
  const before = chooseChampion(atFinal(), "d4");
  const changed = pickCard(goBack(goBack(before)), "d1");
  assert.deepEqual(changed.picks, ["a1", "b2", "c3", "d1"]);
  assert.equal(changed.championId, null);
  assert.equal(responseBody(changed), null);
});

test("trocar uma tela do começo antes de terminar segue para a primeira tela sem escolha", () => {
  let progress = play(fresh(), "a1", "b1");
  progress = pickCard(goBack(goBack(progress)), "a4");
  assert.deepEqual(progress.picks, ["a4", "b1", null, null]);
  assert.equal(progressView(progress).screen, 2);
});

test("as funções não alteram o progresso recebido", () => {
  const progress = Object.freeze({ ...fresh(), picks: Object.freeze([null, null, null, null]) });
  pickCard(progress, "a1");
  goBack(progress);
  assert.deepEqual(progress.picks, [null, null, null, null]);
});

test("grupos iguais são os mesmos ids na mesma ordem", () => {
  assert.equal(sameGroups(GROUPS, GROUPS.map((group) => [...group])), true);
  assert.equal(sameGroups(GROUPS, [GROUPS[1], GROUPS[0], GROUPS[2], GROUPS[3]]), false);
  assert.equal(sameGroups(GROUPS, GROUPS.slice(0, 3)), false);
  assert.equal(sameGroups(GROUPS, [["a2", "a1", "a3", "a4"], ...GROUPS.slice(1)]), false);
  assert.equal(sameGroups(GROUPS, null), false);
  assert.equal(sameGroups(GROUPS, "abcd"), false);
});

test("o progresso salvo volta quando o sorteio é o mesmo", () => {
  const saved = goBack(chooseChampion(atFinal(), "a1"));
  const restored = restoreProgress(JSON.parse(JSON.stringify(saved)), GROUPS, () => "outro");
  assert.deepEqual(restored, saved);
});

test("quem recarrega na confirmação volta para a confirmação", () => {
  const saved = chooseChampion(atFinal(), "b2");
  const restored = restoreProgress(JSON.parse(JSON.stringify(saved)), GROUPS, () => "outro");
  assert.deepEqual(restored, saved);
  assert.deepEqual(progressView(restored), { kind: "confirm", championId: "b2", otherIds: ["a1", "c3", "d4"] });
  // Sem escolhida válida não há confirmação para onde voltar.
  assert.equal(progressView(restoreProgress({ ...saved, championId: "a2" }, GROUPS, () => "outro")).kind, "final");
  assert.equal(progressView(restoreProgress({ ...saved, championId: null }, GROUPS, () => "outro")).kind, "final");
});

test("sorteio diferente, ou nada salvo, começa do zero com recibo novo", () => {
  const other = [GROUPS[3], GROUPS[2], GROUPS[1], GROUPS[0]];
  const next = "0b0f6f0a-1111-4222-8333-444455556666";
  assert.deepEqual(restoreProgress(atFinal(), other, () => next), freshProgress(other, () => next));
  for (const saved of [null, undefined, "x", 7, [], {}]) {
    assert.deepEqual(restoreProgress(saved, GROUPS, () => next), freshProgress(GROUPS, () => next));
  }
});

test("progresso salvo adulterado é consertado antes de valer", () => {
  const next = "0b0f6f0a-1111-4222-8333-444455556666";
  const base = { groups: GROUPS, answerId: UUID };
  // Escolha que não pertence à tela some, e a tela volta a ser a primeira sem escolha.
  const holed = restoreProgress({ ...base, picks: ["a1", "c1", "c2", "d1"], championId: "c2", step: 5 }, GROUPS, () => next);
  assert.deepEqual(holed, { groups: GROUPS, picks: ["a1", null, "c2", "d1"], championId: "c2", answerId: UUID, step: 1 });
  assert.equal(responseBody(holed), null, "com tela sem escolha não há resposta para enviar");
  // Escolhida que não está entre as quatro some, e a confirmação volta para a final.
  assert.deepEqual(
    restoreProgress({ ...base, picks: ["a1", "b1", "c1", "d1"], championId: "a2", step: 5 }, GROUPS, () => next),
    { groups: GROUPS, picks: ["a1", "b1", "c1", "d1"], championId: null, answerId: UUID, step: 4 },
  );
  // Tela fora do intervalo, lista de escolhas torta e recibo inválido.
  assert.deepEqual(
    restoreProgress({ groups: GROUPS, picks: ["a1"], championId: 3, step: 99, answerId: "não é uuid" }, GROUPS, () => next),
    { groups: GROUPS, picks: ["a1", null, null, null], championId: null, answerId: next, step: 1 },
  );
  assert.deepEqual(
    restoreProgress({ ...base, picks: ["a1", "b1", null, null], championId: null, step: -3 }, GROUPS, () => next),
    { groups: GROUPS, picks: ["a1", "b1", null, null], championId: null, answerId: UUID, step: 0 },
  );
  // Quem salvou numa tela de voto anterior continua nela.
  assert.equal(restoreProgress({ ...base, picks: ["a1", "b1", "c1", null], championId: null, step: 1 }, GROUPS, () => next).step, 1);
});

test("a marca da identidade não guarda a chave e muda quando a chave muda", () => {
  const key = `pm2_${"k".repeat(43)}`;
  const tag = identityTag(key);
  assert.match(tag, /^[0-9a-f]{8}$/);
  assert.equal(identityTag(key), tag);
  assert.notEqual(identityTag(`pm2_${"j".repeat(43)}`), tag);
  assert.equal(identityTag(""), "");
  assert.equal(identityTag(null), "");
});

test("o que vai para o armazenamento volta igual, por pesquisa", () => {
  const progress = chooseChampion(atFinal(), "a1");
  const text = savedProgressText(null, PHOTO_SURVEY_ID, { identity: "abc12345", progress });
  assert.deepEqual(readSavedProgress(text, PHOTO_SURVEY_ID), { identity: "abc12345", progress, answered: false });
  assert.equal(readSavedProgress(text, "outra-pesquisa"), null);

  const both = savedProgressText(text, "outra-pesquisa", { identity: "ffff0000", answered: true });
  assert.equal(readSavedProgress(both, PHOTO_SURVEY_ID).identity, "abc12345", "gravar uma pesquisa não apaga a outra");
  assert.deepEqual(readSavedProgress(both, "outra-pesquisa"), { identity: "ffff0000", progress: null, answered: true });

  for (const broken of [null, "", "{não é json", "[]", "7", JSON.stringify({ [PHOTO_SURVEY_ID]: "x" })]) {
    assert.equal(readSavedProgress(broken, PHOTO_SURVEY_ID), null);
  }
  assert.doesNotThrow(() => savedProgressText("{não é json", PHOTO_SURVEY_ID, { identity: "", progress: fresh() }));
});

test("depois de registrada, o aparelho guarda que respondeu, não em quem", () => {
  const text = savedProgressText(null, PHOTO_SURVEY_ID, { identity: "abc12345", answered: true });
  assert.deepEqual(JSON.parse(text), { [PHOTO_SURVEY_ID]: { identity: "abc12345", progress: null, answered: true } });
  // Um registro antigo com a resposta inteira conta como respondido e não devolve a escolha.
  const legacy = JSON.stringify({ [PHOTO_SURVEY_ID]: { identity: "abc12345", progress: null, response: { championId: "a1" } } });
  assert.deepEqual(readSavedProgress(legacy, PHOTO_SURVEY_ID), { identity: "abc12345", progress: null, answered: false });
  for (const value of ["true", 1, {}, null]) {
    const forged = JSON.stringify({ [PHOTO_SURVEY_ID]: { identity: "x", progress: null, answered: value } });
    assert.equal(readSavedProgress(forged, PHOTO_SURVEY_ID).answered, false);
  }
});
