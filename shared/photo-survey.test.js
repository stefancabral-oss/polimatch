import assert from "node:assert/strict";
import test from "node:test";
import {
  PHOTO_SURVEYS,
  drawCards,
  drawGroups,
  photoSurveyById,
  photoSurveyStatus,
  publicPhotoSurvey,
  validateBracket,
} from "./photo-survey.js";

const SURVEY = photoSurveyById("politica-2026-01");

// Gerador com semente (mulberry32): o teste de uniformidade precisa ser
// reproduzível.
function seededRandomInt(seed) {
  let state = seed >>> 0;
  return (limit) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return Math.floor((((value ^ (value >>> 14)) >>> 0) / 4294967296) * limit);
  };
}

function validBracket(shownIds) {
  const groups = drawGroups(shownIds, SURVEY.groupSize);
  const pickIds = groups.map((group, index) => group[index % group.length]);
  return { groups, pickIds, championId: pickIds[2] };
}

test("a primeira pesquisa tem 20 cartas de política, sorteio de 16 e telas de 4", () => {
  assert.equal(PHOTO_SURVEYS.length, 1);
  assert.equal(SURVEY.id, "politica-2026-01");
  assert.equal(SURVEY.question, "Quem você prefere?");
  assert.equal(SURVEY.cardIds.length, 20);
  assert.equal(new Set(SURVEY.cardIds).size, 20);
  assert.deepEqual(SURVEY.cardIds, [...SURVEY.cardIds].sort());
  assert.equal(SURVEY.drawSize, 16);
  assert.equal(SURVEY.groupSize, 4);
  assert.ok(Object.isFrozen(SURVEY) && Object.isFrozen(SURVEY.cardIds));
  assert.equal(photoSurveyById("nao-existe"), null);
  assert.equal(photoSurveyById(undefined), null);
});

test("o sorteio devolve 16 cartas únicas do conjunto e não altera a definição", () => {
  const before = [...SURVEY.cardIds];
  const shown = drawCards(SURVEY, () => 0);
  assert.equal(shown.length, 16);
  assert.equal(new Set(shown).size, 16);
  assert.ok(shown.every((id) => SURVEY.cardIds.includes(id)));
  assert.deepEqual(SURVEY.cardIds, before);
  assert.deepEqual(shown, SURVEY.cardIds.slice(0, 16), "randomInt sempre 0 mantém a ordem do conjunto");
});

test("o sorteio é uniforme: cada carta entra e ocupa cada posição com a mesma frequência", () => {
  const randomInt = seededRandomInt(20261113);
  const rounds = 20000;
  const entered = new Map(SURVEY.cardIds.map((id) => [id, 0]));
  const position = new Map(SURVEY.cardIds.map((id) => [id, Array(SURVEY.drawSize).fill(0)]));
  for (let round = 0; round < rounds; round += 1) {
    drawCards(SURVEY, randomInt).forEach((id, index) => {
      entered.set(id, entered.get(id) + 1);
      position.get(id)[index] += 1;
    });
  }
  for (const id of SURVEY.cardIds) {
    const share = entered.get(id) / rounds;
    assert.ok(share > 0.78 && share < 0.82, `${id} entrou em ${share}`);
    for (const [index, count] of position.get(id).entries()) {
      const slotShare = count / rounds;
      assert.ok(slotShare > 0.04 && slotShare < 0.06, `${id} na posição ${index}: ${slotShare}`);
    }
  }
});

test("o sorteio recusa gerador que devolve valor fora do intervalo", () => {
  assert.throws(() => drawCards(SURVEY, () => 99), RangeError);
  assert.throws(() => drawCards(SURVEY, () => -1), RangeError);
  assert.throws(() => drawCards(SURVEY, () => 0.5), RangeError);
});

test("as telas são fatias de quatro na ordem do sorteio", () => {
  const shown = drawCards(SURVEY, seededRandomInt(7));
  const groups = drawGroups(shown, SURVEY.groupSize);
  assert.equal(groups.length, 4);
  assert.ok(groups.every((group) => group.length === 4));
  assert.deepEqual(groups.flat(), shown);
});

test("uma chave válida é aceita e devolvida normalizada", () => {
  const shown = drawCards(SURVEY, seededRandomInt(11));
  const { pickIds, championId } = validBracket(shown);
  assert.deepEqual(validateBracket(SURVEY, shown, { pickIds, championId }), { ok: true, pickIds, championId });
});

test("chave forjada é recusada com o motivo", () => {
  const shown = drawCards(SURVEY, seededRandomInt(13));
  const { groups, pickIds, championId } = validBracket(shown);
  const outside = SURVEY.cardIds.find((id) => !shown.includes(id));
  const reason = (shownIds, body) => validateBracket(SURVEY, shownIds, body).reason;

  assert.equal(reason(shown.slice(0, 15), { pickIds, championId }), "shown");
  assert.equal(reason([...shown.slice(0, 15), shown[0]], { pickIds, championId }), "shown");
  assert.equal(reason("abc", { pickIds, championId }), "shown");

  assert.equal(reason(shown, { pickIds: pickIds.slice(0, 3), championId }), "picks");
  assert.equal(reason(shown, { pickIds: "abcd", championId }), "picks");
  assert.equal(reason(shown, { pickIds: [pickIds[0], pickIds[1], pickIds[2], 7], championId }), "picks");
  assert.equal(reason(shown, undefined), "picks");

  // Escolha que existe no sorteio, mas pertence a outra tela.
  const swapped = [groups[1][0], pickIds[1], pickIds[2], pickIds[3]];
  assert.equal(reason(shown, { pickIds: swapped, championId: swapped[1] }), "pick-outside-group");
  assert.equal(reason(shown, { pickIds: [outside, pickIds[1], pickIds[2], pickIds[3]], championId }), "pick-outside-group");

  const notPicked = groups[0].find((id) => id !== pickIds[0]);
  assert.equal(reason(shown, { pickIds, championId: notPicked }), "champion");
  assert.equal(reason(shown, { pickIds, championId: undefined }), "champion");
});

test("a chave é validada contra o sorteio gravado, não contra o conjunto atual", () => {
  const shown = drawCards(SURVEY, seededRandomInt(17));
  const { pickIds, championId } = validBracket(shown);
  const withoutChampion = { ...SURVEY, cardIds: SURVEY.cardIds.filter((id) => id !== championId) };
  assert.equal(validateBracket(withoutChampion, shown, { pickIds, championId }).ok, true);
});

test("a janela define se a pesquisa está agendada, aberta ou fechada", () => {
  const windowed = { ...SURVEY, opensAt: "2026-11-20T03:00:00.000Z", closesAt: "2026-11-27T03:00:00.000Z" };
  assert.equal(photoSurveyStatus(windowed, new Date("2026-11-20T02:59:59.999Z")), "scheduled");
  assert.equal(photoSurveyStatus(windowed, new Date("2026-11-20T03:00:00.000Z")), "open");
  assert.equal(photoSurveyStatus(windowed, new Date("2026-11-27T02:59:59.999Z")), "open");
  assert.equal(photoSurveyStatus(windowed, new Date("2026-11-27T03:00:00.000Z")), "closed");
  assert.equal(photoSurveyStatus({ ...SURVEY, opensAt: null, closesAt: null }, new Date("2030-01-01T00:00:00Z")), "open");
  assert.throws(() => photoSurveyStatus(windowed, new Date("data inválida")), TypeError);
});

test("a visão pública traz só a definição e o estado, sem contagem de respostas", () => {
  const view = publicPhotoSurvey(SURVEY, new Date("2026-11-13T12:00:00Z"));
  assert.deepEqual(Object.keys(view).sort(), [
    "cardIds", "closesAt", "drawSize", "groupSize", "id", "opensAt", "question", "screens", "status",
  ]);
  assert.equal(view.screens, 4);
  assert.deepEqual(view.cardIds, SURVEY.cardIds);
  assert.notEqual(view.cardIds, SURVEY.cardIds, "a lista devolvida é uma cópia");
});
