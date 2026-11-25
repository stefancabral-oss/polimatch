import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import test from "node:test";
import {
  PHOTO_SURVEYS,
  definePhotoSurvey,
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
  assert.equal(PHOTO_SURVEYS[0], SURVEY);
  assert.equal(SURVEY.id, "politica-2026-01");
  assert.equal(SURVEY.subject, "Política");
  assert.equal(SURVEY.question, "Quem você prefere?");
  assert.equal(SURVEY.note, "", "as pesquisas de política não têm observação");
  assert.equal(SURVEY.people, true, "as cartas de política são pessoas");
  assert.equal(SURVEY.cardIds.length, 20);
  assert.equal(new Set(SURVEY.cardIds).size, 20);
  assert.deepEqual(SURVEY.cardIds, [...SURVEY.cardIds].sort());
  assert.equal(SURVEY.drawSize, 16);
  assert.equal(SURVEY.groupSize, 4);
  assert.ok(Object.isFrozen(SURVEY) && Object.isFrozen(SURVEY.cardIds));
  assert.equal(photoSurveyById("nao-existe"), null);
  assert.equal(photoSurveyById(undefined), null);
});

test("a segunda pesquisa faz outra pergunta sobre as mesmas 20 cartas", () => {
  const second = photoSurveyById("politica-2026-02");
  assert.equal(PHOTO_SURVEYS[1], second);
  assert.equal(second.subject, "Política");
  assert.equal(second.question, "Em quem você confia mais?");
  assert.equal(second.note, "");
  assert.equal(second.people, true);
  assert.deepEqual(second.cardIds, SURVEY.cardIds);
  assert.equal(second.drawSize, 16);
  assert.equal(second.groupSize, 4);
  assert.equal(second.opensAt, null);
  assert.equal(second.closesAt, null);
  assert.ok(Object.isFrozen(second) && Object.isFrozen(second.cardIds));
});

test("a terceira pesquisa é a de famosos, com 20 cartas de pessoas e sorteio de 16", () => {
  const celebrities = photoSurveyById("famosos-01");
  assert.equal(PHOTO_SURVEYS.length, 4);
  assert.deepEqual(PHOTO_SURVEYS.map((survey) => survey.id), ["politica-2026-01", "politica-2026-02", "famosos-01", "roupas-demo-01"], "a ordem é a da capa");
  assert.equal(PHOTO_SURVEYS[2], celebrities, "depois das duas de política e antes da de roupas");
  assert.equal(celebrities.subject, "Famosos");
  assert.equal(celebrities.question, "De quem você é mais fã?");
  assert.equal(celebrities.note, "Fotos de licença livre.");
  assert.equal(celebrities.people, true, "as cartas de famosos são pessoas");
  // Quem está na lista pode mudar; o que não muda é a forma dela.
  assert.equal(celebrities.cardIds.length, 20);
  assert.equal(new Set(celebrities.cardIds).size, 20, "nenhuma carta repetida");
  assert.deepEqual(celebrities.cardIds, [...celebrities.cardIds].sort());
  for (const id of celebrities.cardIds) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, id);
  assert.equal(celebrities.drawSize, 16);
  assert.equal(celebrities.groupSize, 4);
  assert.equal(celebrities.opensAt, null);
  assert.equal(celebrities.closesAt, null, "sem data para fechar");
  assert.ok(Object.isFrozen(celebrities) && Object.isFrozen(celebrities.cardIds));
  for (const other of PHOTO_SURVEYS.filter((survey) => survey !== celebrities)) {
    assert.ok(celebrities.cardIds.every((id) => !other.cardIds.includes(id)), `nenhuma carta em comum com ${other.id}`);
  }

  // Sorteio de 16 em 20, como na política. Vale também com o gerador que o servidor usa.
  for (const generator of [seededRandomInt(74), (limit) => randomInt(limit)]) {
    const shown = drawCards(celebrities, generator);
    assert.equal(shown.length, 16);
    assert.equal(new Set(shown).size, 16);
    assert.ok(shown.every((id) => celebrities.cardIds.includes(id)));
    const groups = drawGroups(shown, celebrities.groupSize);
    assert.deepEqual(groups.map((group) => group.length), [4, 4, 4, 4]);
    const pickIds = groups.map((group) => group[2]);
    assert.equal(validateBracket(celebrities, shown, { pickIds, championId: pickIds[0] }).ok, true);
    // Uma carta de outra pesquisa não entra numa resposta desta.
    const foreign = [SURVEY.cardIds[0], ...pickIds.slice(1)];
    assert.equal(validateBracket(celebrities, shown, { pickIds: foreign, championId: pickIds[1] }).reason, "pick-outside-group");
  }
  // Em muitos sorteios, as 20 cartas aparecem: nenhuma fica sempre de fora.
  const generator = seededRandomInt(2026);
  const seen = new Set();
  for (let round = 0; round < 200; round += 1) for (const id of drawCards(celebrities, generator)) seen.add(id);
  assert.equal(seen.size, 20);
});

test("a quarta pesquisa é a demonstração de roupas, com 16 cartas que todo mundo vê", () => {
  const clothes = photoSurveyById("roupas-demo-01");
  assert.equal(PHOTO_SURVEYS[3], clothes, "depois das de política e da de famosos: a ordem é a da capa");
  assert.equal(clothes.subject, "Roupas");
  assert.equal(clothes.question, "Qual você usaria?");
  assert.equal(clothes.note, "Peças de demonstração, desenhadas com IA pelo PoliMatch.");
  assert.equal(clothes.people, false, "as cartas de roupa não são pessoas");
  assert.deepEqual(clothes.cardIds, [
    "camiseta-cacto", "camiseta-chama", "camiseta-flor", "camiseta-montanha", "camiseta-olho", "camiseta-onda",
    "camiseta-pipa", "camiseta-planeta", "camiseta-raio", "camiseta-sem-pressa", "camiseta-sol", "camiseta-xadrez",
    "moletom-arco", "moletom-estrela", "moletom-folha", "moletom-lua",
  ]);
  assert.equal(clothes.drawSize, 16);
  assert.equal(clothes.groupSize, 4);
  assert.equal(clothes.opensAt, null);
  assert.equal(clothes.closesAt, null);
  assert.ok(Object.isFrozen(clothes) && Object.isFrozen(clothes.cardIds));
  assert.ok(clothes.cardIds.every((id) => !SURVEY.cardIds.includes(id)), "nenhuma carta em comum com as de política");

  // Sorteio de 16 em 16: só embaralha. Vale também com o gerador que o servidor usa.
  for (const generator of [seededRandomInt(73), (limit) => randomInt(limit)]) {
    const shown = drawCards(clothes, generator);
    assert.deepEqual([...shown].sort(), clothes.cardIds, "todas as cartas aparecem, uma vez cada");
    const groups = drawGroups(shown, clothes.groupSize);
    assert.equal(groups.length, 4);
    const pickIds = groups.map((group) => group[1]);
    assert.equal(validateBracket(clothes, shown, { pickIds, championId: pickIds[3] }).ok, true);
  }
});

test("a definição diz se as cartas são pessoas: verdadeiro em política e famosos, falso em roupas", () => {
  assert.deepEqual(
    PHOTO_SURVEYS.map((survey) => [survey.id, survey.people]),
    [["politica-2026-01", true], ["politica-2026-02", true], ["famosos-01", true], ["roupas-demo-01", false]],
  );
  const base = { id: "teste-01", subject: "Teste", question: "Qual?", cardIds: ["a", "b", "c", "d"], drawSize: 4, groupSize: 4 };
  // Sem dizer nada, as cartas não são pessoas.
  const plain = definePhotoSurvey(base);
  assert.equal(plain.people, false);
  assert.equal(plain.note, "");
  assert.ok(Object.isFrozen(plain));
  assert.equal(definePhotoSurvey({ ...base, people: true }).people, true);
  assert.equal(definePhotoSurvey({ ...base, people: false }).people, false);
  // Só verdadeiro ou falso: um texto ou um número não viram "pessoas" por engano.
  for (const value of ["sim", "true", 1, 0, null, {}, []]) {
    assert.throws(() => definePhotoSurvey({ ...base, people: value }), /pesquisa teste-01: "people" precisa ser verdadeiro ou falso/, JSON.stringify(value));
  }
  // As outras conferências da definição continuam valendo.
  assert.throws(() => definePhotoSurvey({ ...base, note: 7 }), /a observação precisa ser texto/);
  assert.throws(() => definePhotoSurvey({ ...base, cardIds: ["a", "a", "b", "c"] }), /carta repetida/);
  assert.throws(() => definePhotoSurvey({ ...base, drawSize: 3 }), /não fecha em telas de 4/);
  assert.throws(() => definePhotoSurvey({ ...base, question: "" }), /falta o assunto ou a pergunta/);
});

test("cada pesquisa tem código, assunto e pergunta próprios", () => {
  assert.equal(new Set(PHOTO_SURVEYS.map((survey) => survey.id)).size, PHOTO_SURVEYS.length);
  assert.equal(new Set(PHOTO_SURVEYS.map((survey) => survey.question)).size, PHOTO_SURVEYS.length);
  for (const survey of PHOTO_SURVEYS) {
    assert.match(survey.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, survey.id);
    assert.ok(survey.subject.length > 0 && survey.question.endsWith("?"), survey.id);
    assert.equal(typeof survey.note, "string", survey.id);
    assert.equal(typeof survey.people, "boolean", survey.id);
  }
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

// As frequências por carta e por posição, sozinhas, aceitariam um sorteio com
// padrão fixo (rodar o conjunto ordenado, por exemplo). Pares e vizinhos não.
test("o sorteio não tem padrão fixo: pares de cartas e as duas primeiras posições variam", () => {
  const randomInt = seededRandomInt(424242);
  const rounds = 20000;
  const together = new Map();
  const firstTwo = new Map();
  const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
  for (let round = 0; round < rounds; round += 1) {
    const shown = drawCards(SURVEY, randomInt);
    bump(firstTwo, `${shown[0]}>${shown[1]}`);
    const sorted = [...shown].sort();
    for (let left = 0; left < sorted.length; left += 1) {
      for (let right = left + 1; right < sorted.length; right += 1) bump(together, `${sorted[left]}|${sorted[right]}`);
    }
  }
  // Duas cartas quaisquer saem juntas com probabilidade (16·15)/(20·19) ≈ 0,632.
  assert.equal(together.size, 190, "todos os pares de cartas aparecem juntos");
  for (const [pair, count] of together) {
    const share = count / rounds;
    assert.ok(share > 0.6 && share < 0.665, `${pair} juntas em ${share}`);
  }
  // As 380 ordens possíveis para as duas primeiras posições aparecem, cada uma perto de 1/380.
  assert.equal(firstTwo.size, 380, "todas as ordens das duas primeiras posições aparecem");
  for (const [order, count] of firstTwo) {
    assert.ok(count > 20 && count < 95, `${order} apareceu ${count} vezes`);
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
    "cardIds", "closesAt", "drawSize", "groupSize", "id", "note", "opensAt", "question", "screens", "status", "subject",
  ]);
  assert.equal(view.subject, "Política");
  assert.equal(view.note, "");
  assert.equal(publicPhotoSurvey(photoSurveyById("roupas-demo-01"), new Date("2026-11-23T12:00:00Z")).note, "Peças de demonstração, desenhadas com IA pelo PoliMatch.");
  const celebrities = publicPhotoSurvey(photoSurveyById("famosos-01"), new Date("2026-11-24T12:00:00Z"));
  assert.equal(celebrities.note, "Fotos de licença livre.");
  assert.deepEqual([celebrities.subject, celebrities.cardIds.length, celebrities.drawSize, celebrities.screens, celebrities.status], ["Famosos", 20, 16, 4, "open"]);
  // `people` fica na definição: a visão pública não muda de formato por causa dele.
  assert.deepEqual(Object.keys(celebrities).sort(), Object.keys(view).sort());
  assert.ok(!("people" in view) && !("people" in celebrities));
  // Uma definição montada à mão, sem observação, sai com a observação vazia.
  assert.equal(publicPhotoSurvey({ ...SURVEY, note: undefined }, new Date("2026-11-13T12:00:00Z")).note, "");
  assert.equal(view.screens, 4);
  assert.deepEqual(view.cardIds, SURVEY.cardIds);
  assert.notEqual(view.cardIds, SURVEY.cardIds, "a lista devolvida é uma cópia");
});
