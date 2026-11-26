import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import test from "node:test";
import {
  PHOTO_SURVEYS,
  definePhotoSurvey,
  drawCards,
  drawGroups,
  drawRound,
  pairKey,
  photoSurveyById,
  photoSurveyStatus,
  publicPhotoSurvey,
  roundPairKeys,
  seenPairKeys,
  surveyProgress,
  totalPairCount,
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

// --- Rodadas (ICM 75, #350) ---

const CLOTHES = photoSurveyById("roupas-demo-01");
const FIRST_SCREEN_PAIRS = 6; // quatro cartas numa tela: seis duplas

// Duplas ainda não vistas dentro das telas de voto de um sorteio.
function newPairsInScreens(survey, shownIds, seen) {
  let count = 0;
  for (const group of drawGroups(shownIds, survey.groupSize)) {
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        if (!seen.has(pairKey(group[left], group[right]))) count += 1;
      }
    }
  }
  return count;
}

const allPairKeys = (survey) => survey.cardIds.flatMap((a, index) => survey.cardIds.slice(index + 1).map((b) => pairKey(a, b)));

// Uma pessoa responde todas as rodadas até não sobrar confronto. `choose`
// devolve a carta escolhida de uma tela. Confere, a cada rodada nova, o
// formato do sorteio e a dupla nova que ela precisa trazer.
function playToTheEnd(survey, randomInt, choose) {
  const total = totalPairCount(survey);
  const rounds = [];
  let seen = new Set();
  while (seen.size < total) {
    const shownIds = rounds.length === 0 ? drawCards(survey, randomInt) : drawRound(survey, seen, randomInt);
    assert.equal(shownIds.length, survey.drawSize);
    assert.equal(new Set(shownIds).size, survey.drawSize, "nenhuma carta repetida na rodada");
    assert.ok(shownIds.every((id) => survey.cardIds.includes(id)), "só cartas da pesquisa");
    if (rounds.length > 0) assert.ok(newPairsInScreens(survey, shownIds, seen) >= 1, `rodada ${rounds.length + 1} sem dupla nova numa tela`);
    const pickIds = drawGroups(shownIds, survey.groupSize).map((group) => choose(group));
    assert.equal(validateBracket(survey, shownIds, { pickIds, championId: pickIds[0] }).ok, true);
    rounds.push({ shownIds, pickIds });
    const before = seen.size;
    seen = seenPairKeys(survey, rounds);
    assert.ok(seen.size > before, "toda rodada respondida aumenta o que a pessoa já viu");
    assert.ok(rounds.length <= total, "a pesquisa termina");
  }
  assert.equal(seen.size, total);
  const progress = surveyProgress(survey, rounds, "open");
  assert.deepEqual(progress, { answeredRounds: rounds.length, seenPairs: total, totalPairs: total, canContinue: false });
  return rounds.length;
}

function roundCounts(survey, seeds, chooserFor) {
  const counts = [];
  for (let seed = 1; seed <= seeds; seed += 1) {
    const randomInt = seededRandomInt(seed);
    counts.push(playToTheEnd(survey, randomInt, chooserFor(survey, randomInt)));
  }
  counts.sort((left, right) => left - right);
  return { min: counts[0], median: counts[Math.floor(counts.length / 2)], max: counts.at(-1) };
}

// Escolha ao acaso em cada tela.
const randomChooser = (_survey, randomInt) => (group) => group[randomInt(group.length)];
// Uma pessoa com gosto fixo: escolhe sempre a carta de que mais gosta entre
// as quatro. As mesmas cartas voltam à final, que então traz menos duplas novas.
function fixedTasteChooser(survey, randomInt) {
  const order = drawCards({ ...survey, drawSize: survey.cardIds.length }, randomInt);
  const rank = new Map(order.map((id, index) => [id, index]));
  return (group) => group.reduce((best, id) => (rank.get(id) < rank.get(best) ? id : best));
}

test("a chave da dupla não depende da ordem das cartas", () => {
  assert.equal(pairKey("anitta", "xuxa"), pairKey("xuxa", "anitta"));
  assert.equal(pairKey("anitta", "xuxa"), "anitta|xuxa");
  assert.notEqual(pairKey("anitta", "xuxa"), pairKey("anitta", "iza"));
  for (const survey of PHOTO_SURVEYS) {
    assert.equal(new Set(allPairKeys(survey)).size, totalPairCount(survey), `${survey.id}: cada dupla tem a sua chave`);
  }
});

test("o total de confrontos é o de duplas das cartas atuais: 190 com 20 cartas, 120 com 16", () => {
  assert.equal(totalPairCount(SURVEY), 190);
  assert.equal(totalPairCount(photoSurveyById("famosos-01")), 190);
  assert.equal(totalPairCount(CLOTHES), 120);
  assert.equal(totalPairCount({ ...SURVEY, cardIds: SURVEY.cardIds.slice(1) }), 171, "uma carta a menos, 19 duplas a menos");
});

test("uma rodada respondida mostra as duplas de cada tela e as da final", () => {
  const shown = drawCards(SURVEY, seededRandomInt(75));
  const groups = drawGroups(shown, SURVEY.groupSize);
  const pickIds = groups.map((group, index) => group[index]);
  const keys = roundPairKeys(SURVEY, shown, pickIds);
  assert.ok(keys instanceof Set);
  // Quatro telas de seis duplas, mais as seis duplas da final, que são de telas diferentes.
  assert.equal(keys.size, 4 * FIRST_SCREEN_PAIRS + 6);
  for (const group of groups) {
    for (const a of group) for (const b of group) if (a !== b) assert.ok(keys.has(pairKey(a, b)), `${a} e ${b} estiveram na mesma tela`);
  }
  for (const a of pickIds) for (const b of pickIds) if (a !== b) assert.ok(keys.has(pairKey(a, b)), `${a} e ${b} estiveram na final`);
  // Cartas de telas diferentes que não foram à final juntas não se enfrentaram.
  const notPicked = groups.map((group, index) => group[(index + 1) % group.length]);
  assert.equal(keys.has(pairKey(notPicked[0], notPicked[1])), false);
  assert.equal(keys.has(pairKey(pickIds[0], notPicked[1])), false);
  // Não importa quem ganhou a final: as duplas são as mesmas.
  assert.deepEqual([...roundPairKeys(SURVEY, shown, [...pickIds].reverse())].sort(), [...keys].sort());
  // Sem as escolhidas, ficam só as telas. Entrada que não é lista não gera dupla.
  assert.equal(roundPairKeys(SURVEY, shown, []).size, 24);
  assert.equal(roundPairKeys(SURVEY, shown, undefined).size, 24);
  assert.equal(roundPairKeys(SURVEY, null, null).size, 0);
});

test("dupla com carta que saiu da pesquisa não conta, nem como vista nem no total", () => {
  const shown = drawCards(SURVEY, seededRandomInt(751));
  const groups = drawGroups(shown, SURVEY.groupSize);
  const pickIds = groups.map((group) => group[0]);
  // Sai uma carta que foi à final: perde as 3 duplas da tela dela e as 3 da final.
  const gone = pickIds[0];
  const smaller = { ...SURVEY, cardIds: SURVEY.cardIds.filter((id) => id !== gone) };
  const keys = roundPairKeys(smaller, shown, pickIds);
  assert.equal(keys.size, 30 - 6);
  assert.ok([...keys].every((key) => !key.split("|").includes(gone)));
  assert.equal(totalPairCount(smaller), 171);
  assert.deepEqual(surveyProgress(smaller, [{ shownIds: shown, pickIds }], "open"), { answeredRounds: 1, seenPairs: 24, totalPairs: 171, canContinue: true });
  // Uma carta de outra pesquisa numa lista não gera dupla.
  assert.equal(roundPairKeys(SURVEY, [...shown.slice(0, 15), "camiseta-sol"], pickIds.slice(0, 3)).size <= 30, true);
  assert.ok([...roundPairKeys(SURVEY, [...shown.slice(0, 15), "camiseta-sol"], [])].every((key) => !key.includes("camiseta-sol")));
});

test("o que a pessoa já viu é a união das rodadas respondidas", () => {
  assert.equal(seenPairKeys(SURVEY, []).size, 0);
  const randomInt = seededRandomInt(752);
  const first = drawCards(SURVEY, randomInt);
  const firstPicks = drawGroups(first, 4).map((group) => group[1]);
  const second = drawCards(SURVEY, randomInt);
  const secondPicks = drawGroups(second, 4).map((group) => group[2]);
  const one = roundPairKeys(SURVEY, first, firstPicks);
  const two = roundPairKeys(SURVEY, second, secondPicks);
  const both = seenPairKeys(SURVEY, [{ shownIds: first, pickIds: firstPicks }, { shownIds: second, pickIds: secondPicks }]);
  assert.deepEqual([...both].sort(), [...new Set([...one, ...two])].sort());
  assert.ok(both.size <= one.size + two.size);
  // A mesma rodada duas vezes não soma nada.
  assert.equal(seenPairKeys(SURVEY, [{ shownIds: first, pickIds: firstPicks }, { shownIds: first, pickIds: firstPicks }]).size, one.size);
});

test("o progresso diz quantas rodadas, quantos confrontos e se cabe rodada nova", () => {
  assert.deepEqual(surveyProgress(SURVEY, [], "open"), { answeredRounds: 0, seenPairs: 0, totalPairs: 190, canContinue: false }, "sem rodada respondida não há o que continuar");
  const shown = drawCards(SURVEY, seededRandomInt(753));
  const round = { shownIds: shown, pickIds: drawGroups(shown, 4).map((group) => group[3]) };
  assert.deepEqual(surveyProgress(SURVEY, [round], "open"), { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: true });
  // Fora da janela não há rodada nova, mas o que foi visto continua contado.
  for (const status of ["closed", "scheduled", undefined]) {
    assert.deepEqual(surveyProgress(SURVEY, [round], status), { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: false }, String(status));
  }
  // Com 16 cartas todo mundo vê todas, mas não todas as duplas: 30 de 120.
  const clothesShown = drawCards(CLOTHES, seededRandomInt(754));
  const clothesRound = { shownIds: clothesShown, pickIds: drawGroups(clothesShown, 4).map((group) => group[0]) };
  assert.deepEqual(surveyProgress(CLOTHES, [clothesRound], "open"), { answeredRounds: 1, seenPairs: 30, totalPairs: 120, canContinue: true });
});

test("a rodada nova tem o formato de um sorteio e não altera a definição nem o que foi visto", () => {
  for (const survey of [SURVEY, CLOTHES]) {
    const randomInt = seededRandomInt(755);
    const first = drawCards(survey, randomInt);
    const seen = seenPairKeys(survey, [{ shownIds: first, pickIds: drawGroups(first, 4).map((group) => group[0]) }]);
    const seenBefore = [...seen].sort();
    const cardsBefore = [...survey.cardIds];
    const shown = drawRound(survey, seen, randomInt);
    assert.equal(shown.length, survey.drawSize, survey.id);
    assert.equal(new Set(shown).size, survey.drawSize, survey.id);
    assert.ok(shown.every((id) => survey.cardIds.includes(id)), survey.id);
    assert.deepEqual(drawGroups(shown, survey.groupSize).map((group) => group.length), [4, 4, 4, 4], survey.id);
    assert.deepEqual([...seen].sort(), seenBefore, "o conjunto de duplas vistas não é alterado");
    assert.deepEqual(survey.cardIds, cardsBefore);
    // As duplas vistas também podem chegar como lista.
    const fromList = drawRound(survey, [...seen], seededRandomInt(756));
    assert.deepEqual(fromList, drawRound(survey, seen, seededRandomInt(756)));
    // Vale com o gerador que o servidor usa.
    const real = drawRound(survey, seen, (limit) => randomInt(limit));
    assert.equal(new Set(real).size, survey.drawSize);
    assert.ok(newPairsInScreens(survey, real, seen) >= 1);
  }
});

test("a segunda rodada dá prioridade às duplas novas: quase todas as duplas das telas são novas", () => {
  for (const survey of [SURVEY, CLOTHES]) {
    let plain = 0;
    let assembled = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const randomInt = seededRandomInt(seed);
      const first = drawCards(survey, randomInt);
      const seen = seenPairKeys(survey, [{ shownIds: first, pickIds: drawGroups(first, 4).map((group) => group[randomInt(4)]) }]);
      const fresh = newPairsInScreens(survey, drawRound(survey, seen, randomInt), seen);
      // Das 24 duplas das telas, o sorteio simples traz em média perto de 20 novas (20 cartas) ou 18 (16 cartas).
      assert.ok(fresh >= 22, `${survey.id}, semente ${seed}: ${fresh} duplas novas`);
      assembled += fresh;
      plain += newPairsInScreens(survey, drawCards(survey, randomInt), seen);
    }
    assert.ok(assembled > plain, `${survey.id}: a rodada montada traz mais duplas novas que o sorteio simples`);
  }
});

test("enquanto sobra uma dupla por ver, a rodada nova a coloca numa tela", () => {
  for (const survey of [SURVEY, CLOTHES]) {
    const keys = allPairKeys(survey);
    for (const missing of [keys[0], keys[37], keys.at(-1)]) {
      const seen = new Set(keys.filter((key) => key !== missing));
      for (let seed = 1; seed <= 25; seed += 1) {
        const shown = drawRound(survey, seen, seededRandomInt(seed));
        const [a, b] = missing.split("|");
        const together = drawGroups(shown, survey.groupSize).some((group) => group.includes(a) && group.includes(b));
        assert.ok(together, `${survey.id}: ${missing} ficou fora das telas com a semente ${seed}`);
        assert.equal(new Set(shown).size, survey.drawSize);
      }
    }
  }
});

// A garantia não depende da sorte: vale para qualquer gerador, inclusive um
// que devolve sempre o primeiro ou sempre o último valor, e para qualquer
// dupla que tenha sobrado.
test("a dupla que falta entra numa tela com qualquer gerador, para todas as duplas", () => {
  for (const survey of [SURVEY, CLOTHES]) {
    const keys = allPairKeys(survey);
    for (const [label, generator] of [["sempre zero", () => 0], ["sempre o último", (limit) => limit - 1]]) {
      for (const missing of keys) {
        const seen = new Set(keys);
        seen.delete(missing);
        const shown = drawRound(survey, seen, generator);
        const [a, b] = missing.split("|");
        const together = drawGroups(shown, survey.groupSize).some((group) => group.includes(a) && group.includes(b));
        assert.ok(together, `${survey.id}, gerador ${label}: ${missing} ficou fora das telas`);
        assert.equal(new Set(shown).size, survey.drawSize);
      }
    }
  }
  // Com várias duplas por ver, a rodada continua trazendo pelo menos uma.
  const keys = allPairKeys(SURVEY);
  for (let left = 0; left < keys.length; left += 7) {
    const seen = new Set(keys);
    for (const missing of [keys[left], keys[(left + 61) % keys.length], keys[(left + 122) % keys.length]]) seen.delete(missing);
    for (const generator of [() => 0, (limit) => limit - 1]) {
      assert.ok(newPairsInScreens(SURVEY, drawRound(SURVEY, seen, generator), seen) >= 1);
    }
  }
});

test("sem dupla por ver, a rodada nova é o sorteio simples", () => {
  for (const survey of [SURVEY, CLOTHES]) {
    const everything = new Set(allPairKeys(survey));
    assert.deepEqual(drawRound(survey, everything, seededRandomInt(757)), drawCards(survey, seededRandomInt(757)), survey.id);
  }
  // Duplas de cartas que saíram da pesquisa não contam como por ver.
  const smaller = { ...SURVEY, cardIds: SURVEY.cardIds.slice(0, 16) };
  const seen = new Set(allPairKeys(smaller));
  assert.deepEqual(drawRound(smaller, seen, seededRandomInt(758)), drawCards(smaller, seededRandomInt(758)));
});

test("a rodada nova recusa gerador que devolve valor fora do intervalo", () => {
  const seen = new Set();
  for (const bad of [() => 99, () => -1, () => 0.5, () => "0", () => Number.NaN]) {
    assert.throws(() => drawRound(SURVEY, seen, bad), RangeError);
    assert.throws(() => drawRound(SURVEY, new Set(allPairKeys(SURVEY)), bad), RangeError, "também no sorteio simples");
  }
});

// Simulação do critério de aceite: quem responde todas as rodadas vê todos os
// confrontos, em poucas rodadas. Os limites são o máximo medido em 500
// sementes mais duas rodadas de folga. Medido: com 20 cartas, de 8 a 10
// rodadas (mediana 9) escolhendo ao acaso e de 9 a 10 (mediana 10) com gosto
// fixo; com 16 cartas, de 5 a 7 (mediana 6) nos dois casos.
const SIMULATION_SEEDS = 500;
const ROUND_LIMITS = Object.freeze({ "politica-2026-01": 12, "roupas-demo-01": 9 });

for (const [label, chooserFor] of [["escolhendo ao acaso", randomChooser], ["com gosto fixo", fixedTasteChooser]]) {
  for (const survey of [SURVEY, CLOTHES]) {
    const shape = `${survey.cardIds.length} cartas, sorteio de ${survey.drawSize}`;
    test(`simulação, ${shape}, ${label}: toda pessoa vê todos os confrontos em poucas rodadas`, (t) => {
      const { min, median, max } = roundCounts(survey, SIMULATION_SEEDS, chooserFor);
      t.diagnostic(`${shape}, ${label}, ${SIMULATION_SEEDS} sementes: mínimo ${min}, mediana ${median}, máximo ${max} rodadas`);
      assert.ok(max <= ROUND_LIMITS[survey.id], `máximo de ${max} rodadas passa do limite de ${ROUND_LIMITS[survey.id]}`);
      // Trinta duplas por rodada é o teto: menos que isso de rodadas é impossível.
      assert.ok(min >= Math.ceil(totalPairCount(survey) / 30));
    });
  }
}
