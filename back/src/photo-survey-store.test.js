import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  PHOTO_SURVEYS,
  drawGroups,
  pairKey,
  photoSurveyById,
  publicPhotoSurvey,
  seenPairKeys,
  totalPairCount,
} from "../../shared/photo-survey.js";
import { createPhotoSurveyMemoryDb } from "../test-support/photo-survey-memory-db.js";
import { createHttpApp } from "./http-app.js";
import { photoSurveyStore } from "./photo-survey-store.js";

// O store de verdade sobre um banco em memória. O que depende do PostgreSQL
// (travas, imutabilidade, pedidos simultâneos) é provado em
// back/scripts/photo-survey-smoke.mjs.

const NOW = new Date("2026-11-26T15:00:00.000Z");
const POLITICS = photoSurveyById("politica-2026-01");
const CLOTHES = photoSurveyById("roupas-demo-01");
const WINDOWED = Object.freeze({
  ...POLITICS,
  id: "teste-janela",
  opensAt: "2026-11-26T03:00:00.000Z",
  closesAt: "2026-11-27T03:00:00.000Z",
});
const BEFORE = new Date("2026-11-26T02:59:59.999Z");
const AFTER = new Date(WINDOWED.closesAt);

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

function setup({ surveys = [...PHOTO_SURVEYS, WINDOWED], seed = 75 } = {}) {
  const db = createPhotoSurveyMemoryDb();
  const clock = { now: NOW };
  const build = (list) => photoSurveyStore({
    pool: db.pool,
    findPlayer: db.findPlayer,
    requireRegistration: db.requireRegistration,
    clock: () => clock.now,
    surveys: list,
    randomInt: seededRandomInt(seed),
  });
  return { db, clock, build, store: build(surveys) };
}

const picksOf = (draw, offset = 0) => draw.groups.map((group, index) => group[(index + offset) % group.length]);
const rejectsWith = (promise, status, code, reason) => assert.rejects(promise, (error) => {
  assert.equal(error.code, code, error.message);
  assert.equal(error.status, status, error.message);
  if (reason !== undefined) assert.deepEqual(error.current, { reason }, error.message);
  return true;
});
const body = (player, surveyId, extra) => ({ recoveryKey: player.key, surveyId, answerId: randomUUID(), ...extra });
const freshPairsInScreens = (survey, groups, seen) => groups.reduce(
  (total, group) => total + group.reduce((sum, a, index) => sum + group.slice(index + 1).filter((b) => !seen.has(pairKey(a, b))).length, 0),
  0,
);

// Responde a rodada aberta devolvida por um sorteio e devolve o que foi gravado.
async function answer(store, player, surveyId, drawn, { offset = 0, withRound = true } = {}) {
  const pickIds = picksOf(drawn.draw, offset);
  return store.photoSurveyRespond(body(player, surveyId, {
    pickIds, championId: pickIds[0], ...(withRound ? { round: drawn.round } : {}),
  }));
}

// --- Quem não manda `next` nem `round`: o comportamento de antes das rodadas ---

test("sem next: a primeira chamada emite a rodada 1 e as seguintes devolvem o mesmo sorteio", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const first = await store.photoSurveyDraw(ana.key, POLITICS.id);
  assert.deepEqual(Object.keys(first), ["survey", "draw", "response", "round", "progress", "lastAnswered"]);
  assert.deepEqual(first.survey, publicPhotoSurvey(POLITICS, NOW));
  assert.deepEqual(Object.keys(first.draw), ["groups"]);
  assert.deepEqual(first.draw.groups.map((group) => group.length), [4, 4, 4, 4]);
  const shown = first.draw.groups.flat();
  assert.equal(new Set(shown).size, 16);
  assert.ok(shown.every((id) => POLITICS.cardIds.includes(id)));
  assert.equal(first.response, null);
  assert.equal(first.round, 1);
  assert.deepEqual(first.progress, { answeredRounds: 0, seenPairs: 0, totalPairs: 190, canContinue: false });
  assert.equal(first.lastAnswered, null, "sem rodada respondida não há última resposta");
  assert.deepEqual(await store.photoSurveyDraw(ana.key, POLITICS.id), first);
  assert.deepEqual(await store.photoSurveyDraw(ana.key, POLITICS.id, { now: NOW }), first);
  assert.deepEqual(db.counts(), { draws: 1, responses: 0, roundDraws: 0, roundResponses: 0 });
});

test("sem round: a resposta grava uma vez, repete sem gravar e recusa outra escolha", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const first = await store.photoSurveyDraw(ana.key, POLITICS.id);
  const pickIds = picksOf(first.draw, 1);
  const answerId = randomUUID();
  const request = { recoveryKey: ana.key, surveyId: POLITICS.id, answerId, pickIds, championId: pickIds[3] };
  const created = await store.photoSurveyRespond(request);
  assert.deepEqual(Object.keys(created), ["status", "survey", "draw", "response", "round", "progress", "lastAnswered"]);
  assert.equal(created.status, "created");
  assert.deepEqual(created.survey, first.survey);
  assert.deepEqual(created.draw, first.draw);
  assert.deepEqual(created.response, { answerId, pickIds, championId: pickIds[3], respondedAt: NOW.toISOString() });
  assert.equal(created.round, 1);
  assert.deepEqual(created.progress, { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: true });
  assert.deepEqual(created.lastAnswered, { round: 1, response: created.response });
  // Os campos que já existiam continuam com os mesmos valores.
  const { round: _round, progress: _progress, lastAnswered: _lastAnswered, ...before } = created;
  assert.deepEqual(before, {
    status: "created",
    survey: publicPhotoSurvey(POLITICS, NOW),
    draw: first.draw,
    response: { answerId, pickIds, championId: pickIds[3], respondedAt: NOW.toISOString() },
  });

  // O mesmo pedido de novo, e a mesma escolha com outro recibo: o recibo original.
  for (const repeat of [request, { ...request, answerId: randomUUID() }]) {
    const replay = await store.photoSurveyRespond(repeat);
    assert.deepEqual(replay, { ...created, status: "alreadyProcessed" });
  }
  // O recibo em maiúsculas é o mesmo recibo.
  assert.equal((await store.photoSurveyRespond({ ...request, answerId: answerId.toUpperCase() })).status, "alreadyProcessed");

  // Outra escolha, com recibo novo ou com o mesmo, não regrava.
  const other = picksOf(first.draw, 2);
  for (const receipt of [randomUUID(), answerId]) {
    await assert.rejects(store.photoSurveyRespond({ ...request, answerId: receipt, pickIds: other, championId: other[0] }), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "PHOTO_SURVEY_ALREADY_ANSWERED");
      assert.equal(error.message, "esta pesquisa já foi respondida");
      assert.deepEqual(error.current, created.response);
      return true;
    });
  }
  assert.deepEqual(db.counts(), { draws: 1, responses: 1, roundDraws: 0, roundResponses: 0 });

  // O sorteio passa a devolver a resposta, quantas vezes for pedido, sem rodada nova.
  for (let call = 0; call < 3; call += 1) {
    const seen = await store.photoSurveyDraw(ana.key, POLITICS.id);
    assert.deepEqual(seen, {
      survey: first.survey, draw: first.draw, response: created.response, round: 1, progress: created.progress,
      lastAnswered: { round: 1, response: created.response },
    });
  }
  assert.deepEqual(db.counts(), { draws: 1, responses: 1, roundDraws: 0, roundResponses: 0 });
});

test("sem round: as recusas de sempre, na ordem de sempre", async () => {
  const { db, store, clock } = setup();
  const ana = db.addPlayer();
  const picks = ["a", "b", "c", "d"];
  // Pesquisa que não existe e recibo malformado são conferidos antes da sessão.
  await rejectsWith(store.photoSurveyRespond(body({ key: "pms_nao-existe" }, "nao-existe", { pickIds: picks, championId: "a" })), 404, "PHOTO_SURVEY_NOT_FOUND");
  await rejectsWith(store.photoSurveyDraw("pms_nao-existe", "nao-existe"), 404, "PHOTO_SURVEY_NOT_FOUND");
  for (const answerId of [undefined, "", "abc", 7, `${randomUUID()}x`]) {
    await rejectsWith(store.photoSurveyRespond({ recoveryKey: "pms_nao-existe", surveyId: POLITICS.id, answerId, pickIds: picks, championId: "a" }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "answer-id");
  }
  await rejectsWith(store.photoSurveyDraw("pms_nao-existe", POLITICS.id), 401, undefined);
  await rejectsWith(store.photoSurveyRespond(body({ key: "pms_nao-existe" }, POLITICS.id, { pickIds: picks, championId: "a" })), 401, undefined);

  // Sem sorteio não há resposta.
  await assert.rejects(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: picks, championId: "a" })), (error) => {
    assert.deepEqual([error.status, error.code, error.message], [409, "PHOTO_SURVEY_DRAW_REQUIRED", "sorteio ainda não emitido"]);
    assert.equal(Object.hasOwn(error, "current"), false);
    return true;
  });

  // Resposta que não bate com o sorteio: 400 com o motivo, e nada gravado.
  const drawn = await store.photoSurveyDraw(ana.key, POLITICS.id);
  const valid = picksOf(drawn.draw);
  const outside = POLITICS.cardIds.find((id) => !drawn.draw.groups.flat().includes(id));
  const forged = [
    [{ pickIds: [outside, valid[1], valid[2], valid[3]], championId: valid[1] }, "pick-outside-group"],
    [{ pickIds: [drawn.draw.groups[1][0], valid[1], valid[2], valid[3]], championId: valid[1] }, "pick-outside-group"],
    [{ pickIds: valid, championId: drawn.draw.groups[0][1] }, "champion"],
    [{ pickIds: valid, championId: null }, "champion"],
    [{ pickIds: valid.slice(0, 3), championId: valid[0] }, "picks"],
    [{ pickIds: "abcd", championId: valid[0] }, "picks"],
    [{ pickIds: undefined, championId: undefined }, "picks"],
  ];
  for (const [attempt, reason] of forged) {
    await assert.rejects(store.photoSurveyRespond(body(ana, POLITICS.id, attempt)), (error) => {
      assert.deepEqual([error.status, error.code, error.message], [400, "PHOTO_SURVEY_RESPONSE_INVALID", "resposta não corresponde ao sorteio"]);
      assert.deepEqual(error.current, { reason });
      return true;
    });
  }
  assert.equal(db.counts().responses, 0);

  // Janela: sem sorteio não se entra fora dela; quem tem sorteio continua vendo o mesmo.
  const bia = db.addPlayer();
  clock.now = BEFORE;
  await assert.rejects(store.photoSurveyDraw(bia.key, WINDOWED.id), (error) => {
    assert.deepEqual([error.status, error.code, error.message], [409, "PHOTO_SURVEY_CLOSED", "pesquisa fechada"]);
    assert.deepEqual(error.current, { status: "scheduled" });
    return true;
  });
  clock.now = NOW;
  const windowed = await store.photoSurveyDraw(bia.key, WINDOWED.id);
  clock.now = AFTER;
  await assert.rejects(store.photoSurveyRespond(body(bia, WINDOWED.id, { pickIds: picksOf(windowed.draw), championId: picksOf(windowed.draw)[0] })), (error) => {
    assert.deepEqual([error.status, error.code], [409, "PHOTO_SURVEY_CLOSED"]);
    assert.deepEqual(error.current, { status: "closed" });
    return true;
  });
  const closed = await store.photoSurveyDraw(bia.key, WINDOWED.id);
  assert.deepEqual(closed.draw, windowed.draw);
  assert.equal(closed.survey.status, "closed");
  assert.equal(closed.response, null);
  await rejectsWith(store.photoSurveyDraw(db.addPlayer().key, WINDOWED.id), 409, "PHOTO_SURVEY_CLOSED");
});

test("a rodada 1 segue a identidade: vale a resposta mais antiga do jogador e dos anônimos ligados a ele", async () => {
  const { db, store, clock } = setup();
  const account = db.addPlayer();
  const visitor = db.addPlayer();
  const visitorDraw = await store.photoSurveyDraw(visitor.key, POLITICS.id);
  const visitorAnswer = await answer(store, visitor, POLITICS.id, visitorDraw, { withRound: false });
  clock.now = new Date(NOW.getTime() + 60_000);
  const accountDraw = await store.photoSurveyDraw(account.key, POLITICS.id);
  await answer(store, account, POLITICS.id, accountDraw, { offset: 1, withRound: false });
  db.link(visitor, account);
  const seen = await store.photoSurveyDraw(account.key, POLITICS.id);
  assert.deepEqual(seen.response, visitorAnswer.response);
  assert.deepEqual(seen.draw, visitorDraw.draw);
  assert.equal(seen.round, 1);
  const again = picksOf(seen.draw, 3);
  await rejectsWith(store.photoSurveyRespond(body(account, POLITICS.id, { pickIds: again, championId: again[0] })), 409, "PHOTO_SURVEY_ALREADY_ANSWERED");
});

test("pela rota, quem não manda os campos novos recebe os corpos de antes mais round, progress e lastAnswered", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const app = createHttpApp({
    store: { health: async () => {}, ...store },
    googleIdentity: { configured: false, verify: async () => ({ subject: "test" }) },
    env: { PHOTO_SURVEYS_ENABLED: "true" },
    clock: () => NOW,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const base = `http://127.0.0.1:${server.address().port}/api/photo-surveys/${POLITICS.id}`;
  const post = async (path, payload) => {
    const response = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ana.key}` },
      body: JSON.stringify(payload),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const drawn = await post("draw", {});
    assert.equal(drawn.status, 200);
    assert.deepEqual(Object.keys(drawn.body), ["survey", "draw", "response", "round", "progress", "lastAnswered"]);
    assert.deepEqual(drawn.body.survey, publicPhotoSurvey(POLITICS, NOW));
    assert.equal(drawn.body.response, null);
    assert.equal(drawn.body.round, 1);
    assert.deepEqual(drawn.body.progress, { answeredRounds: 0, seenPairs: 0, totalPairs: 190, canContinue: false });
    assert.equal(drawn.body.lastAnswered, null);
    assert.ok(Object.hasOwn(drawn.body, "lastAnswered"), "o campo vem sempre, mesmo vazio");

    const pickIds = picksOf(drawn.body.draw, 2);
    const answerId = randomUUID();
    const created = await post("response", { answerId, pickIds, championId: pickIds[1] });
    assert.equal(created.status, 200);
    const response = { answerId, pickIds, championId: pickIds[1], respondedAt: NOW.toISOString() };
    assert.deepEqual(created.body, {
      status: "created",
      survey: drawn.body.survey,
      draw: drawn.body.draw,
      response,
      round: 1,
      progress: { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: true },
      lastAnswered: { round: 1, response },
    });
    const replay = await post("response", { answerId, pickIds, championId: pickIds[1] });
    assert.deepEqual(replay, { status: 200, body: { ...created.body, status: "alreadyProcessed" } });

    const other = picksOf(drawn.body.draw, 3);
    const refused = await post("response", { answerId: randomUUID(), pickIds: other, championId: other[0] });
    assert.equal(refused.status, 409);
    const { requestId, ...rest } = refused.body;
    assert.ok(requestId);
    assert.deepEqual(rest, { error: "esta pesquisa já foi respondida", code: "PHOTO_SURVEY_ALREADY_ANSWERED", current: created.body.response });

    const invalid = await post("response", { answerId: "abc", pickIds, championId: pickIds[1] });
    assert.equal(invalid.status, 400);
    assert.deepEqual([invalid.body.error, invalid.body.code, invalid.body.current], ["resposta não corresponde ao sorteio", "PHOTO_SURVEY_RESPONSE_INVALID", { reason: "answer-id" }]);

    const afterwards = await post("draw", {});
    assert.deepEqual(afterwards.body, {
      survey: drawn.body.survey, draw: drawn.body.draw, response: created.body.response, round: 1, progress: created.body.progress,
      lastAnswered: { round: 1, response: created.body.response },
    });
    assert.deepEqual(db.counts(), { draws: 1, responses: 1, roundDraws: 0, roundResponses: 0 }, "sem next não nasce rodada nova");

    // Com a rodada 2 aberta, a resposta vem vazia e a última respondida é a rodada 1.
    const second = await post("draw", { next: true });
    assert.equal(second.status, 200);
    assert.equal(second.body.round, 2);
    assert.equal(second.body.response, null);
    assert.deepEqual(second.body.lastAnswered, { round: 1, response: created.body.response });
    const secondPicks = picksOf(second.body.draw, 1);
    const secondAnswer = await post("response", { answerId: randomUUID(), pickIds: secondPicks, championId: secondPicks[0], round: 2 });
    assert.equal(secondAnswer.status, 200);
    assert.deepEqual(secondAnswer.body.lastAnswered, { round: 2, response: secondAnswer.body.response });
    assert.deepEqual(db.counts(), { draws: 1, responses: 1, roundDraws: 1, roundResponses: 1 });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

// --- Rodadas ---

test("a rodada 2 só é emitida com next e depois de a rodada 1 ser respondida", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  // Sem rodada nenhuma, next emite a rodada 1, como sem next.
  const first = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  assert.equal(first.round, 1);
  assert.equal(first.response, null);
  // Com a rodada 1 aberta, next devolve a mesma rodada e não emite outra.
  assert.deepEqual(await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true }), first);
  assert.deepEqual(db.counts(), { draws: 1, responses: 0, roundDraws: 0, roundResponses: 0 });

  const answered = await answer(store, ana, POLITICS.id, first);
  assert.equal(answered.progress.canContinue, true);
  const seen = seenPairKeys(POLITICS, [{ shownIds: first.draw.groups.flat(), pickIds: answered.response.pickIds }]);

  const second = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  assert.deepEqual(Object.keys(second), ["survey", "draw", "response", "round", "progress", "lastAnswered"]);
  assert.equal(second.round, 2);
  assert.equal(second.response, null);
  assert.deepEqual(second.draw.groups.map((group) => group.length), [4, 4, 4, 4]);
  const shown = second.draw.groups.flat();
  assert.equal(new Set(shown).size, 16);
  assert.ok(shown.every((id) => POLITICS.cardIds.includes(id)));
  assert.ok(freshPairsInScreens(POLITICS, second.draw.groups, seen) >= 1, "a rodada nova traz dupla que a pessoa ainda não viu");
  assert.notDeepEqual(second.draw, first.draw);
  // Com rodada aberta, o progresso ainda é o das rodadas respondidas, e não cabe outra.
  assert.deepEqual(second.progress, { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: false });
  assert.deepEqual(second.lastAnswered, { round: 1, response: answered.response });
  assert.deepEqual(db.counts(), { draws: 1, responses: 1, roundDraws: 1, roundResponses: 0 });
  assert.deepEqual(db.rows("roundDraws")[0], { survey_id: POLITICS.id, player_id: ana.id, round: 2, shown_ids: shown, issued_at: NOW });
});

test("a rodada aberta volta igual, com next, com next falso e sem next", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  await answer(store, ana, POLITICS.id, await store.photoSurveyDraw(ana.key, POLITICS.id));
  // next falso é o mesmo que não mandar: devolve a rodada respondida e não emite outra.
  const still = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: false });
  assert.equal(still.round, 1);
  assert.notEqual(still.response, null);
  assert.equal(db.counts().roundDraws, 0);

  const second = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  for (const options of [{ next: true }, { next: false }, {}, undefined]) {
    assert.deepEqual(await store.photoSurveyDraw(ana.key, POLITICS.id, options), second, JSON.stringify(options));
  }
  assert.equal(db.counts().roundDraws, 1, "cinco pedidos, uma rodada emitida");
});

test("next precisa ser verdadeiro ou falso", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  for (const next of ["true", "false", 1, 0, null, {}, []]) {
    await assert.rejects(store.photoSurveyDraw(ana.key, POLITICS.id, { next }), (error) => {
      assert.deepEqual([error.status, error.code, error.message], [400, "PHOTO_SURVEY_DRAW_INVALID", "pedido de sorteio inválido"]);
      assert.deepEqual(error.current, { reason: "next" });
      return true;
    }, JSON.stringify(next));
  }
  assert.deepEqual(db.counts(), { draws: 0, responses: 0, roundDraws: 0, roundResponses: 0 });
  assert.deepEqual(db.statements, [], "a recusa vem antes de qualquer consulta");
});

test("uma resposta por rodada: grava, repete sem gravar e recusa outra escolha", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const first = await store.photoSurveyDraw(ana.key, POLITICS.id);
  const firstAnswer = await answer(store, ana, POLITICS.id, first);
  const second = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });

  const pickIds = picksOf(second.draw, 1);
  const request = { recoveryKey: ana.key, surveyId: POLITICS.id, answerId: randomUUID(), pickIds, championId: pickIds[2], round: 2 };
  const created = await store.photoSurveyRespond(request);
  assert.deepEqual(Object.keys(created), ["status", "survey", "draw", "response", "round", "progress", "lastAnswered"]);
  assert.equal(created.status, "created");
  assert.equal(created.round, 2);
  assert.deepEqual(created.draw, second.draw);
  assert.deepEqual(created.response, { answerId: request.answerId, pickIds, championId: pickIds[2], respondedAt: NOW.toISOString() });
  assert.equal(created.progress.answeredRounds, 2);
  assert.deepEqual(db.rows("roundResponses"), [{
    survey_id: POLITICS.id, player_id: ana.id, round: 2, answer_id: request.answerId,
    shown_ids: second.draw.groups.flat(), pick_ids: pickIds, champion_id: pickIds[2], responded_at: NOW,
  }]);

  // Repetição idempotente da rodada 2: com o mesmo recibo ou com outro, o recibo original.
  for (const repeat of [request, { ...request, answerId: randomUUID() }]) {
    assert.deepEqual(await store.photoSurveyRespond(repeat), { ...created, status: "alreadyProcessed" });
  }
  // Outra escolha para a rodada 2: recusada, com a resposta da rodada 2.
  const other = picksOf(second.draw, 3);
  await assert.rejects(store.photoSurveyRespond({ ...request, answerId: randomUUID(), pickIds: other, championId: other[0] }), (error) => {
    assert.deepEqual([error.status, error.code, error.message], [409, "PHOTO_SURVEY_ALREADY_ANSWERED", "esta rodada já foi respondida"]);
    assert.deepEqual(error.current, created.response);
    return true;
  });

  // A rodada 1 continua respondendo por ela mesma.
  const firstPicks = firstAnswer.response.pickIds;
  const replayFirst = await store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: firstPicks, championId: firstAnswer.response.championId, round: 1 }));
  assert.equal(replayFirst.status, "alreadyProcessed");
  assert.equal(replayFirst.round, 1);
  assert.deepEqual(replayFirst.response, firstAnswer.response);
  assert.deepEqual(replayFirst.draw, first.draw);
  assert.deepEqual(replayFirst.progress, created.progress, "o progresso é o da pessoa, não o da rodada");
  const otherFirst = picksOf(first.draw, 2);
  await assert.rejects(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: otherFirst, championId: otherFirst[0], round: 1 })), (error) => {
    assert.deepEqual([error.status, error.code, error.message], [409, "PHOTO_SURVEY_ALREADY_ANSWERED", "esta pesquisa já foi respondida"]);
    assert.deepEqual(error.current, firstAnswer.response);
    return true;
  });
  assert.deepEqual(db.counts(), { draws: 1, responses: 1, roundDraws: 1, roundResponses: 1 });
});

test("sem round, a resposta é sempre da rodada 1, mesmo com uma rodada nova aberta", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const first = await store.photoSurveyDraw(ana.key, POLITICS.id);
  const firstAnswer = await answer(store, ana, POLITICS.id, first, { withRound: false });
  const second = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  // Rodada 2 aberta: uma resposta sem round não é dela. É o que manda uma
  // aba antiga, que só conhece a rodada 1: a recusa é a de antes das rodadas,
  // e nada é gravado na rodada 2, mesmo que as escolhas coubessem no sorteio dela.
  const fitsSecond = second.draw.groups.map((group) => group[1]);
  await assert.rejects(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: fitsSecond, championId: fitsSecond[0] })), (error) => {
    assert.deepEqual([error.status, error.code], [409, "PHOTO_SURVEY_ALREADY_ANSWERED"]);
    assert.deepEqual(error.current, firstAnswer.response);
    return true;
  });
  assert.equal(db.counts().roundResponses, 0);
  const secondAnswer = await answer(store, ana, POLITICS.id, second, { offset: 1 });
  assert.equal(secondAnswer.status, "created");
  assert.equal(secondAnswer.round, 2);
  assert.equal(db.counts().roundResponses, 1);
  // Sem rodada aberta: a resposta sem round também é comparada com a rodada 1.
  const sameAsFirst = await store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: firstAnswer.response.pickIds, championId: firstAnswer.response.championId }));
  assert.equal(sameAsFirst.status, "alreadyProcessed");
  assert.equal(sameAsFirst.round, 1);
  assert.deepEqual(sameAsFirst.response, firstAnswer.response);
  await assert.rejects(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: secondAnswer.response.pickIds, championId: secondAnswer.response.championId })), (error) => {
    assert.deepEqual([error.status, error.code], [409, "PHOTO_SURVEY_ALREADY_ANSWERED"]);
    assert.deepEqual(error.current, firstAnswer.response);
    return true;
  });
  assert.deepEqual(db.counts(), { draws: 1, responses: 1, roundDraws: 1, roundResponses: 1 });
});

test("round que não existe, ou que não é um inteiro a partir de 1, é recusado sem gravar", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const picks = ["a", "b", "c", "d"];
  // Formato: conferido antes da sessão, como o recibo.
  for (const round of [0, -1, 1.5, "2", null, true, Number.NaN, Infinity, 2 ** 53, [2], {}]) {
    await rejectsWith(store.photoSurveyRespond(body({ key: "pms_nao-existe" }, POLITICS.id, { pickIds: picks, championId: "a", round })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "round");
  }
  assert.deepEqual(db.statements, []);

  // Sem rodada nenhuma, a rodada 1 pedida pelo número também não existe.
  await rejectsWith(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: picks, championId: "a", round: 1 })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "round");
  await rejectsWith(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: picks, championId: "a", round: 2 })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "round");

  const first = await store.photoSurveyDraw(ana.key, POLITICS.id);
  const valid = picksOf(first.draw);
  // Com a rodada 1 aberta, a 2 ainda não existe.
  await rejectsWith(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: valid, championId: valid[0], round: 2 })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "round");
  await answer(store, ana, POLITICS.id, first);
  // Com a rodada 1 respondida e sem sorteio da 2, a 2 continua não existindo.
  await rejectsWith(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: valid, championId: valid[0], round: 2 })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "round");
  const second = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  const secondPicks = picksOf(second.draw);
  for (const round of [3, 4, 1000]) {
    await rejectsWith(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: secondPicks, championId: secondPicks[0], round })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "round");
  }
  assert.deepEqual(db.counts(), { draws: 1, responses: 1, roundDraws: 1, roundResponses: 0 });
});

test("a resposta de cada rodada é conferida contra o sorteio daquela rodada", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const first = await store.photoSurveyDraw(ana.key, POLITICS.id);
  await answer(store, ana, POLITICS.id, first);
  const second = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  const valid = picksOf(second.draw);
  const outside = POLITICS.cardIds.find((id) => !second.draw.groups.flat().includes(id));
  // Uma carta que não está na tela da rodada 2, mesmo sendo da pesquisa.
  await rejectsWith(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: [outside, ...valid.slice(1)], championId: valid[1], round: 2 })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "pick-outside-group");
  // Uma carta da rodada 2 na tela errada.
  await rejectsWith(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: [second.draw.groups[1][0], ...valid.slice(1)], championId: valid[1], round: 2 })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "pick-outside-group");
  await rejectsWith(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: valid, championId: second.draw.groups[0][1], round: 2 })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "champion");
  await rejectsWith(store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: valid.slice(0, 3), championId: valid[0], round: 2 })), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "picks");
  assert.equal(db.counts().roundResponses, 0);
  assert.equal((await store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: valid, championId: valid[3], round: 2 }))).status, "created");
});

test("fora da janela não há rodada nova: next devolve a última rodada respondida", async () => {
  const { db, store, clock } = setup();
  const ana = db.addPlayer();
  const first = await store.photoSurveyDraw(ana.key, WINDOWED.id);
  const firstAnswer = await answer(store, ana, WINDOWED.id, first);
  assert.equal(firstAnswer.progress.canContinue, true);
  clock.now = AFTER;
  for (const options of [{ next: true }, {}]) {
    const closed = await store.photoSurveyDraw(ana.key, WINDOWED.id, options);
    assert.equal(closed.survey.status, "closed");
    assert.equal(closed.round, 1);
    assert.deepEqual(closed.response, firstAnswer.response);
    assert.deepEqual(closed.draw, first.draw);
    assert.deepEqual(closed.progress, { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: false });
  }
  assert.equal(db.counts().roundDraws, 0);
  // A repetição da resposta já gravada continua valendo depois do fechamento.
  const replay = await store.photoSurveyRespond(body(ana, WINDOWED.id, { pickIds: firstAnswer.response.pickIds, championId: firstAnswer.response.championId, round: 1 }));
  assert.equal(replay.status, "alreadyProcessed");

  // Rodada 2 emitida com a pesquisa aberta e ainda sem resposta quando ela fecha.
  clock.now = NOW;
  const second = await store.photoSurveyDraw(ana.key, WINDOWED.id, { next: true });
  assert.equal(second.round, 2);
  clock.now = AFTER;
  const stillOpen = await store.photoSurveyDraw(ana.key, WINDOWED.id, { next: true });
  assert.deepEqual(stillOpen.draw, second.draw, "quem tinha a rodada aberta continua vendo a mesma");
  assert.equal(stillOpen.round, 2);
  assert.equal(stillOpen.response, null);
  assert.equal(stillOpen.progress.canContinue, false);
  const picks = picksOf(second.draw);
  await assert.rejects(store.photoSurveyRespond(body(ana, WINDOWED.id, { pickIds: picks, championId: picks[0], round: 2 })), (error) => {
    assert.deepEqual([error.status, error.code], [409, "PHOTO_SURVEY_CLOSED"]);
    assert.deepEqual(error.current, { status: "closed" });
    return true;
  });
  assert.deepEqual(db.counts(), { draws: 1, responses: 1, roundDraws: 1, roundResponses: 0 });
  // Antes de a janela abrir também não há rodada nova.
  clock.now = BEFORE;
  assert.equal((await store.photoSurveyDraw(ana.key, WINDOWED.id, { next: true })).round, 2);
  assert.equal(db.counts().roundDraws, 1);
});

test("sem cadastro não há sorteio nem resposta, em rodada nenhuma", async () => {
  const { db, store } = setup();
  const visitor = db.addPlayer({ registered: false });
  const picks = ["a", "b", "c", "d"];
  for (const options of [undefined, {}, { next: true }, { next: false }]) {
    await rejectsWith(store.photoSurveyDraw(visitor.key, POLITICS.id, options), 403, "CPF_REGISTRATION_REQUIRED");
  }
  for (const round of [undefined, 1, 2]) {
    await rejectsWith(store.photoSurveyRespond(body(visitor, POLITICS.id, { pickIds: picks, championId: "a", ...(round ? { round } : {}) })), 403, "CPF_REGISTRATION_REQUIRED");
  }
  await rejectsWith(store.photoSurveyDraw("pms_nao-existe", POLITICS.id, { next: true }), 401, undefined);
  assert.deepEqual(db.counts(), { draws: 0, responses: 0, roundDraws: 0, roundResponses: 0 });

  // Quem perde o cadastro no meio do caminho não lê nem continua as rodadas que tinha.
  const { db: other, store: otherStore } = setup();
  const ana = other.addPlayer();
  await answer(otherStore, ana, POLITICS.id, await otherStore.photoSurveyDraw(ana.key, POLITICS.id));
  const second = await otherStore.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  const before = other.counts();
  other.unregister(ana);
  const secondPicks = picksOf(second.draw);
  for (const options of [{ next: true }, {}]) {
    await rejectsWith(otherStore.photoSurveyDraw(ana.key, POLITICS.id, options), 403, "CPF_REGISTRATION_REQUIRED");
  }
  await rejectsWith(otherStore.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: secondPicks, championId: secondPicks[0], round: 2 })), 403, "CPF_REGISTRATION_REQUIRED");
  assert.deepEqual(other.counts(), before);
});

test("lastAnswered é a última rodada que a pessoa respondeu: a devolvida, ou a anterior quando há rodada aberta", async () => {
  const { db, store, clock } = setup();
  const [ana, bia] = [db.addPlayer(), db.addPlayer()];
  // Sem rodada respondida: null, com a rodada 1 aberta e na recusa de nada.
  const first = await store.photoSurveyDraw(ana.key, WINDOWED.id);
  assert.equal(first.lastAnswered, null);
  assert.equal((await store.photoSurveyDraw(ana.key, WINDOWED.id, { next: true })).lastAnswered, null);

  // Rodada 1 respondida: é ela mesma, no sorteio e na resposta.
  const one = await answer(store, ana, WINDOWED.id, first);
  assert.deepEqual(one.lastAnswered, { round: 1, response: one.response });
  assert.deepEqual((await store.photoSurveyDraw(ana.key, WINDOWED.id)).lastAnswered, { round: 1, response: one.response });

  // Rodada 2 aberta: a resposta vem vazia e a última respondida é a rodada 1.
  const second = await store.photoSurveyDraw(ana.key, WINDOWED.id, { next: true });
  assert.equal(second.round, 2);
  assert.equal(second.response, null);
  assert.deepEqual(second.lastAnswered, { round: 1, response: one.response });
  assert.deepEqual(Object.keys(second.lastAnswered), ["round", "response"]);
  assert.deepEqual(Object.keys(second.lastAnswered.response), ["answerId", "pickIds", "championId", "respondedAt"]);
  assert.deepEqual((await store.photoSurveyDraw(ana.key, WINDOWED.id)).lastAnswered, second.lastAnswered, "sem next também");
  // A repetição da rodada 1 com a rodada 2 aberta também diz que a última respondida é a 1.
  const replayOpen = await store.photoSurveyRespond(body(ana, WINDOWED.id, { pickIds: one.response.pickIds, championId: one.response.championId, round: 1 }));
  assert.equal(replayOpen.status, "alreadyProcessed");
  assert.deepEqual(replayOpen.lastAnswered, { round: 1, response: one.response });

  // Rodada 2 respondida: passa a ser ela.
  const two = await answer(store, ana, WINDOWED.id, second, { offset: 1 });
  assert.equal(two.round, 2);
  assert.deepEqual(two.lastAnswered, { round: 2, response: two.response });
  assert.deepEqual((await store.photoSurveyDraw(ana.key, WINDOWED.id)).lastAnswered, { round: 2, response: two.response });
  // A repetição de uma rodada anterior devolve a resposta dela e, em
  // lastAnswered, a última que a pessoa respondeu.
  const replayOne = await store.photoSurveyRespond(body(ana, WINDOWED.id, { pickIds: one.response.pickIds, championId: one.response.championId, round: 1 }));
  assert.equal(replayOne.round, 1);
  assert.deepEqual(replayOne.response, one.response);
  assert.deepEqual(replayOne.lastAnswered, { round: 2, response: two.response });

  // Rodada 3 emitida e deixada aberta quando a pesquisa fecha: a última respondida continua sendo a 2.
  const third = await store.photoSurveyDraw(ana.key, WINDOWED.id, { next: true });
  assert.equal(third.round, 3);
  assert.deepEqual(third.lastAnswered, { round: 2, response: two.response });
  clock.now = AFTER;
  for (const options of [{}, { next: true }]) {
    const closed = await store.photoSurveyDraw(ana.key, WINDOWED.id, options);
    assert.equal(closed.survey.status, "closed");
    assert.equal(closed.round, 3);
    assert.equal(closed.response, null);
    assert.deepEqual(closed.lastAnswered, { round: 2, response: two.response });
  }
  clock.now = NOW;

  // É da pessoa que pede: as respostas de uma não aparecem para outra, nem em outra pesquisa dela.
  assert.equal((await store.photoSurveyDraw(bia.key, WINDOWED.id)).lastAnswered, null);
  assert.equal((await store.photoSurveyDraw(ana.key, POLITICS.id)).lastAnswered, null);

  // Na rodada 1 vale a identidade: a resposta mais antiga do jogador e dos anônimos ligados a ele.
  const visitor = db.addPlayer();
  const visitorAnswer = await answer(store, visitor, POLITICS.id, await store.photoSurveyDraw(visitor.key, POLITICS.id));
  db.link(visitor, bia);
  assert.deepEqual((await store.photoSurveyDraw(bia.key, POLITICS.id)).lastAnswered, { round: 1, response: visitorAnswer.response });
});

test("o recibo é único entre todas as rodadas e entre todas as pessoas", async () => {
  const { db, store } = setup();
  const [ana, bia] = [db.addPlayer(), db.addPlayer()];
  const anaFirst = await store.photoSurveyDraw(ana.key, POLITICS.id);
  const anaPicks = picksOf(anaFirst.draw);
  const firstReceipt = randomUUID();
  await store.photoSurveyRespond({ recoveryKey: ana.key, surveyId: POLITICS.id, answerId: firstReceipt, pickIds: anaPicks, championId: anaPicks[0] });
  const anaSecond = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  const secondPicks = picksOf(anaSecond.draw, 1);

  // O recibo da rodada 1 não serve para a rodada 2 da mesma pessoa.
  for (const receipt of [firstReceipt, firstReceipt.toUpperCase()]) {
    await rejectsWith(store.photoSurveyRespond({ recoveryKey: ana.key, surveyId: POLITICS.id, answerId: receipt, pickIds: secondPicks, championId: secondPicks[0], round: 2 }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "answer-id");
  }
  assert.equal(db.counts().roundResponses, 0);
  // Com recibo novo a rodada 2 entra.
  const secondReceipt = randomUUID();
  assert.equal((await store.photoSurveyRespond({ recoveryKey: ana.key, surveyId: POLITICS.id, answerId: secondReceipt, pickIds: secondPicks, championId: secondPicks[0], round: 2 })).status, "created");

  // O recibo de uma rodada 2 de outra pessoa não serve para a rodada 1, nem o
  // da rodada 1 de outra pessoa para a rodada 2. Também não em outra pesquisa.
  const biaFirst = await store.photoSurveyDraw(bia.key, POLITICS.id);
  const biaPicks = picksOf(biaFirst.draw, 2);
  for (const receipt of [secondReceipt, firstReceipt]) {
    await rejectsWith(store.photoSurveyRespond({ recoveryKey: bia.key, surveyId: POLITICS.id, answerId: receipt, pickIds: biaPicks, championId: biaPicks[0] }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "answer-id");
  }
  assert.equal((await store.photoSurveyDraw(bia.key, POLITICS.id)).response, null);
  const biaReceipt = randomUUID();
  await store.photoSurveyRespond({ recoveryKey: bia.key, surveyId: POLITICS.id, answerId: biaReceipt, pickIds: biaPicks, championId: biaPicks[0] });
  const biaSecond = await store.photoSurveyDraw(bia.key, POLITICS.id, { next: true });
  const biaSecondPicks = picksOf(biaSecond.draw);
  for (const receipt of [firstReceipt, secondReceipt, biaReceipt]) {
    await rejectsWith(store.photoSurveyRespond({ recoveryKey: bia.key, surveyId: POLITICS.id, answerId: receipt, pickIds: biaSecondPicks, championId: biaSecondPicks[0], round: 2 }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "answer-id");
  }
  const clothes = await store.photoSurveyDraw(bia.key, CLOTHES.id);
  const clothesPicks = picksOf(clothes.draw);
  await rejectsWith(store.photoSurveyRespond({ recoveryKey: bia.key, surveyId: CLOTHES.id, answerId: secondReceipt, pickIds: clothesPicks, championId: clothesPicks[0] }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "answer-id");
  assert.deepEqual(db.counts(), { draws: 3, responses: 2, roundDraws: 2, roundResponses: 1 });
  // A conferência do recibo acontece debaixo da trava derivada dele.
  const lockAt = db.statements.findLastIndex((sql) => sql.includes("pg_advisory_xact_lock"));
  assert.ok(lockAt >= 0 && db.statements[lockAt + 1].startsWith("SELECT 1 FROM photo_survey_responses WHERE answer_id = $1 UNION ALL SELECT 1 FROM photo_survey_round_responses"));
});

test("o progresso conta as duplas das rodadas respondidas da pessoa, e só dela", async () => {
  const { db, store } = setup();
  const [ana, bia] = [db.addPlayer(), db.addPlayer()];
  const rounds = [];
  let drawn = await store.photoSurveyDraw(ana.key, POLITICS.id);
  for (let round = 1; round <= 3; round += 1) {
    assert.equal(drawn.round, round);
    const answered = await answer(store, ana, POLITICS.id, drawn, { offset: round });
    rounds.push({ shownIds: drawn.draw.groups.flat(), pickIds: answered.response.pickIds });
    const expected = seenPairKeys(POLITICS, rounds).size;
    assert.deepEqual(answered.progress, { answeredRounds: round, seenPairs: expected, totalPairs: 190, canContinue: true });
    assert.deepEqual(Object.keys(answered.progress), ["answeredRounds", "seenPairs", "totalPairs", "canContinue"]);
    drawn = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
    assert.deepEqual(drawn.progress, { answeredRounds: round, seenPairs: expected, totalPairs: 190, canContinue: false });
  }
  assert.ok(seenPairKeys(POLITICS, rounds).size > 60, "três rodadas montadas mostram bem mais que duas rodadas de duplas");
  // As respostas de uma pessoa não entram no progresso de outra, nem no de outra pesquisa dela.
  const biaDraw = await store.photoSurveyDraw(bia.key, POLITICS.id);
  assert.deepEqual(biaDraw.progress, { answeredRounds: 0, seenPairs: 0, totalPairs: 190, canContinue: false });
  const anaClothes = await store.photoSurveyDraw(ana.key, CLOTHES.id);
  assert.equal(anaClothes.round, 1);
  assert.deepEqual(anaClothes.progress, { answeredRounds: 0, seenPairs: 0, totalPairs: 120, canContinue: false });
  assert.deepEqual(db.counts(), { draws: 3, responses: 1, roundDraws: 3, roundResponses: 2 });
});

test("quem responde todas as rodadas vê todos os confrontos, e a pesquisa fecha para a pessoa", async () => {
  // Os limites são os da simulação em shared/photo-survey.test.js.
  for (const [survey, limit] of [[POLITICS, 12], [CLOTHES, 9]]) {
    const { db, store } = setup({ seed: 751 });
    const ana = db.addPlayer();
    const total = totalPairCount(survey);
    const rounds = [];
    let drawn = await store.photoSurveyDraw(ana.key, survey.id);
    let progress = drawn.progress;
    for (;;) {
      assert.equal(drawn.round, rounds.length + 1, "as rodadas são numeradas em sequência");
      assert.equal(drawn.response, null);
      const seen = seenPairKeys(survey, rounds);
      if (rounds.length) assert.ok(freshPairsInScreens(survey, drawn.draw.groups, seen) >= 1, `${survey.id}: rodada ${drawn.round} sem dupla nova`);
      const answered = await answer(store, ana, survey.id, drawn, { offset: rounds.length });
      rounds.push({ shownIds: drawn.draw.groups.flat(), pickIds: answered.response.pickIds });
      progress = answered.progress;
      assert.equal(progress.seenPairs, seenPairKeys(survey, rounds).size);
      assert.ok(rounds.length <= limit, `${survey.id}: passou de ${limit} rodadas`);
      if (!progress.canContinue) break;
      drawn = await store.photoSurveyDraw(ana.key, survey.id, { next: true });
    }
    assert.deepEqual(progress, { answeredRounds: rounds.length, seenPairs: total, totalPairs: total, canContinue: false });
    // Sem confronto por ver, next devolve a última rodada respondida e nada é emitido.
    const before = db.counts();
    for (const options of [{ next: true }, {}]) {
      const last = await store.photoSurveyDraw(ana.key, survey.id, options);
      assert.equal(last.round, rounds.length);
      assert.deepEqual(last.response.pickIds, rounds.at(-1).pickIds);
      assert.deepEqual(last.progress, progress);
    }
    assert.deepEqual(db.counts(), before);
    assert.deepEqual(before, { draws: 1, responses: 1, roundDraws: rounds.length - 1, roundResponses: rounds.length - 1 });
    assert.deepEqual(db.rows("roundDraws").map((row) => row.round), rounds.slice(1).map((_round, index) => index + 2));
  }
});

test("as rodadas 2 em diante valem pela identidade, como a rodada 1: a conta não recomeça quando o jogador ativo muda", async () => {
  const { db, store } = setup();
  const previous = db.addPlayer();
  const first = await store.photoSurveyDraw(previous.key, POLITICS.id);
  const firstAnswer = await answer(store, previous, POLITICS.id, first);
  const second = await store.photoSurveyDraw(previous.key, POLITICS.id, { next: true });
  const secondAnswer = await answer(store, previous, POLITICS.id, second);
  const third = await store.photoSurveyDraw(previous.key, POLITICS.id, { next: true });
  assert.equal(third.round, 3);
  // O jogador ativo da conta muda, e o anterior passa a ser um histórico ligado a ele.
  const active = db.addPlayer();
  db.link(previous, active);
  const seen = await store.photoSurveyDraw(active.key, POLITICS.id);
  assert.equal(seen.round, 3, "a rodada aberta da conta continua sendo a mesma");
  assert.equal(seen.response, null);
  assert.deepEqual(seen.draw, third.draw);
  assert.deepEqual(seen.lastAnswered, { round: 2, response: secondAnswer.response });
  assert.equal(seen.progress.answeredRounds, 2);
  assert.equal(seen.progress.seenPairs, secondAnswer.progress.seenPairs);
  // Pedir outra rodada não emite uma segunda rodada 2 nem uma segunda rodada 3.
  assert.deepEqual(await store.photoSurveyDraw(active.key, POLITICS.id, { next: true }), seen);
  assert.equal(db.rows("roundDraws").filter((row) => row.player_id === active.id).length, 0);
  // A rodada 2 da conta não aceita outra escolha do jogador ativo novo.
  const otherPicks = second.draw.groups.map((group) => group[3]);
  await assert.rejects(store.photoSurveyRespond(body(active, POLITICS.id, { pickIds: otherPicks, championId: otherPicks[0], round: 2 })), (error) => {
    assert.deepEqual([error.status, error.code], [409, "PHOTO_SURVEY_ALREADY_ANSWERED"]);
    return true;
  });
  // A resposta da rodada aberta é gravada no nome de quem recebeu o sorteio
  // dela, e a rodada seguinte já sai no nome do jogador ativo.
  const thirdAnswer = await answer(store, active, POLITICS.id, seen);
  assert.equal(thirdAnswer.status, "created");
  assert.equal(thirdAnswer.round, 3);
  assert.equal(db.rows("roundResponses").filter((row) => row.round === 3)[0].player_id, previous.id);
  const fourth = await store.photoSurveyDraw(active.key, POLITICS.id, { next: true });
  assert.equal(fourth.round, 4);
  assert.equal(db.rows("roundDraws").filter((row) => row.round === 4)[0].player_id, active.id);
  assert.deepEqual(firstAnswer.response, (await store.photoSurveyRespond(body(active, POLITICS.id, { pickIds: firstAnswer.response.pickIds, championId: firstAnswer.response.championId, round: 1 }))).response);
});

test("carta que sai da pesquisa deixa de contar no progresso e de entrar nas rodadas novas", async () => {
  const { db, store, build } = setup();
  const ana = db.addPlayer();
  const first = await store.photoSurveyDraw(ana.key, POLITICS.id);
  const answered = await answer(store, ana, POLITICS.id, first);
  const gone = answered.response.pickIds[0];
  const smaller = { ...POLITICS, cardIds: POLITICS.cardIds.filter((id) => id !== gone) };
  const later = build([smaller]);
  const seen = await later.photoSurveyDraw(ana.key, POLITICS.id);
  // A carta foi à final: saem as 3 duplas da tela dela e as 3 da final.
  assert.deepEqual(seen.progress, { answeredRounds: 1, seenPairs: 24, totalPairs: 171, canContinue: true });
  assert.deepEqual(seen.draw, first.draw, "o sorteio gravado continua o mesmo");
  const second = await later.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  assert.equal(second.round, 2);
  assert.ok(!second.draw.groups.flat().includes(gone));
});

test("o sorteio e a resposta não devolvem soma de respostas", async () => {
  const { db, store } = setup();
  const players = [db.addPlayer(), db.addPlayer(), db.addPlayer()];
  for (const player of players) await answer(store, player, POLITICS.id, await store.photoSurveyDraw(player.key, POLITICS.id));
  const drawn = await store.photoSurveyDraw(players[0].key, POLITICS.id, { next: true });
  const answered = await answer(store, players[0], POLITICS.id, drawn);
  for (const payload of [drawn, answered]) {
    const { status, ...rest } = payload;
    assert.deepEqual(Object.keys(rest), ["survey", "draw", "response", "round", "progress", "lastAnswered"]);
    assert.deepEqual(Object.keys(rest.survey).sort(), ["cardIds", "closesAt", "drawSize", "groupSize", "id", "note", "opensAt", "question", "screens", "status", "subject"]);
    assert.deepEqual(Object.keys(rest.draw), ["groups"]);
    assert.deepEqual(Object.keys(rest.progress), ["answeredRounds", "seenPairs", "totalPairs", "canContinue"]);
    assert.ok(rest.progress.answeredRounds <= 2, "o progresso é de uma pessoa: três pessoas responderam, e ele não passa das rodadas dela");
    assert.deepEqual(Object.keys(rest.lastAnswered), ["round", "response"]);
    assert.deepEqual(Object.keys(rest.lastAnswered.response), ["answerId", "pickIds", "championId", "respondedAt"]);
  }
  assert.deepEqual(Object.keys(answered.response), ["answerId", "pickIds", "championId", "respondedAt"]);
});

test("as telas de uma rodada nova vêm do gerador do servidor, não do pedido", async () => {
  const db = createPhotoSurveyMemoryDb();
  let calls = 0;
  const generator = seededRandomInt(9);
  const store = photoSurveyStore({
    pool: db.pool, findPlayer: db.findPlayer, requireRegistration: db.requireRegistration, clock: () => NOW,
    randomInt: (limit) => { calls += 1; return generator(limit); },
  });
  const ana = db.addPlayer();
  const first = await store.photoSurveyDraw(ana.key, POLITICS.id);
  const firstCalls = calls;
  assert.equal(firstCalls, 16, "a rodada 1 é o sorteio simples: um número por carta");
  await answer(store, ana, POLITICS.id, first);
  await store.photoSurveyDraw(ana.key, POLITICS.id);
  assert.equal(calls, firstCalls, "sem next, nenhum sorteio novo");
  const second = await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true, shownIds: first.draw.groups.flat() });
  assert.ok(calls > firstCalls);
  assert.notDeepEqual(second.draw, first.draw);
  const after = calls;
  await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true });
  assert.equal(calls, after, "a rodada aberta volta sem novo sorteio");
});

test("duas abas pedem a rodada seguinte e respondem ao mesmo tempo: uma rodada, uma resposta", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  await answer(store, ana, POLITICS.id, await store.photoSurveyDraw(ana.key, POLITICS.id));
  const [one, two] = await Promise.all([
    store.photoSurveyDraw(ana.key, POLITICS.id, { next: true }),
    store.photoSurveyDraw(ana.key, POLITICS.id, { next: true }),
  ]);
  assert.deepEqual(one, two);
  assert.equal(db.counts().roundDraws, 1);
  const [optionA, optionB] = [picksOf(one.draw, 0), picksOf(one.draw, 3)];
  const settled = await Promise.allSettled([
    store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: optionA, championId: optionA[0], round: 2 })),
    store.photoSurveyRespond(body(ana, POLITICS.id, { pickIds: optionB, championId: optionB[1], round: 2 })),
  ]);
  assert.deepEqual(settled.map((entry) => entry.status).sort(), ["fulfilled", "rejected"]);
  const refused = settled.find((entry) => entry.status === "rejected").reason;
  assert.equal(refused.code, "PHOTO_SURVEY_ALREADY_ANSWERED");
  assert.deepEqual(refused.current, settled.find((entry) => entry.status === "fulfilled").value.response);
  assert.equal(db.counts().roundResponses, 1);
});

test("as tabelas das rodadas nascem na subida da API, junto das da rodada 1, sem alterar as que existem", async () => {
  const { installPhotoSurveySchema } = await import("./photo-survey-store.js");
  const statements = [];
  await installPhotoSurveySchema({ query: async (sql) => { statements.push(sql); } });
  const sql = statements.join("\n");
  for (const table of ["photo_survey_draws", "photo_survey_responses", "photo_survey_round_draws", "photo_survey_round_responses"]) {
    assert.ok(sql.includes(`CREATE TABLE IF NOT EXISTS ${table} (`), table);
    assert.ok(sql.includes(`CREATE TRIGGER ${table}_are_immutable`), table);
    assert.ok(sql.includes(`BEFORE UPDATE OR DELETE ON ${table}`), table);
  }
  assert.equal((sql.match(/EXECUTE FUNCTION reject_vote_mutation\(\)/g) || []).length, 4);
  assert.equal((sql.match(/CHECK \(round >= 2\)/g) || []).length, 2);
  assert.ok(sql.includes("FOREIGN KEY (survey_id, player_id, round) REFERENCES photo_survey_round_draws (survey_id, player_id, round)"));
  assert.equal((sql.match(/answer_id uuid NOT NULL UNIQUE/g) || []).length, 2);
  assert.ok(sql.includes("('2026-11-13-photo-survey-v1')") && sql.includes("('2026-11-26-photo-survey-rounds-v1')"));
  // Migração só aditiva: nada altera nem apaga tabela, coluna ou linha.
  assert.doesNotMatch(sql, /ALTER TABLE|DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM|UPDATE\s+photo_survey/);
});
