import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { createApprovedTestRegistry } from "../test-support/editorial-fixtures.js";
import { createTopicStore } from "../src/topic-store.js";
import { requireDisposableDatabase } from "../test-support/disposable-db.js";

// Roda só contra o banco descartável do workflow de integração.
const connection = requireDisposableDatabase();

const SURVEY = PHOTO_SURVEYS[0];
const WINDOWED = Object.freeze({
  ...SURVEY,
  id: "smoke-janela",
  opensAt: "2034-05-10T03:00:00.000Z",
  closesAt: "2034-05-11T03:00:00.000Z",
});
// Um dia que nenhum outro smoke usa: a rodada diária dele ainda está aberta
// mesmo quando este script roda depois dos outros no mesmo banco.
const OPEN_INSTANT = new Date("2034-05-10T15:00:00.000Z");
let now = OPEN_INSTANT;
const options = {
  candidateRegistry: createApprovedTestRegistry(CATALOG.map((person) => person.id)),
  clock: () => now,
  photoSurveys: [SURVEY, WINDOWED],
};
const store = createTopicStore(connection, options);
const audit = new pg.Pool({ connectionString: connection });
await store.init();

const newPlayer = () => store.createPlayer({ networkHash: randomBytes(32).toString("hex") });
const rejectsWith = (promise, status, code) => assert.rejects(promise, (error) => {
  assert.equal(error.code, code, error.message);
  assert.equal(error.status, status, error.message);
  return true;
});
const count = async (table, where = "") => Number((await audit.query(`SELECT count(*) AS total FROM ${table} ${where}`)).rows[0].total);
// O que a pesquisa não pode tocar: votos, rodadas, Elo e cotas do jogo atual.
async function gameFootprint() {
  const result = await audit.query(`SELECT
    (SELECT count(*) FROM votes) AS votes,
    (SELECT count(*) FROM choice_rounds) AS rounds,
    (SELECT count(*) FROM ranking_stats) AS ranking_rows,
    (SELECT coalesce(sum(wins + losses), 0) FROM ranking_stats) AS ranking_games,
    (SELECT count(*) FROM player_stats) AS player_rows,
    (SELECT count(*) FROM abuse_quota_counters) AS quota_rows,
    (SELECT coalesce(sum(used), 0) FROM abuse_quota_counters) AS quota_used`);
  return result.rows[0];
}
const picksOf = (draw, offset = 0) => draw.groups.map((group, index) => group[(index + offset) % group.length]);
const respond = (player, body, surveyId = SURVEY.id) => store.photoSurveyRespond({
  recoveryKey: player.recoveryKey ?? player.sessionToken,
  surveyId,
  answerId: randomUUID(),
  ...body,
});

try {
  // --- Definição pública, sem jogador ---
  const view = await store.photoSurvey(SURVEY.id);
  assert.equal(view.status, "open");
  assert.equal(view.screens, 4);
  assert.equal(view.cardIds.length, 20);
  await rejectsWith(store.photoSurvey("nao-existe"), 404, "PHOTO_SURVEY_NOT_FOUND");

  // --- Sorteio: emitido uma vez por jogador, igual em chamadas repetidas e simultâneas ---
  const alice = await newPlayer();
  const drawsBefore = await count("photo_survey_draws");
  const [first, parallel] = await Promise.all([
    store.photoSurveyDraw(alice.recoveryKey, SURVEY.id),
    store.photoSurveyDraw(alice.recoveryKey, SURVEY.id),
  ]);
  assert.deepEqual(first, parallel);
  assert.deepEqual(await store.photoSurveyDraw(alice.recoveryKey, SURVEY.id), first);
  assert.equal(first.response, null);
  assert.equal(first.draw.groups.length, 4);
  assert.ok(first.draw.groups.every((group) => group.length === 4));
  const shown = first.draw.groups.flat();
  assert.equal(new Set(shown).size, 16);
  assert.ok(shown.every((id) => SURVEY.cardIds.includes(id)));
  assert.equal(await count("photo_survey_draws"), drawsBefore + 1, "três chamadas, um sorteio gravado");
  await rejectsWith(store.photoSurveyDraw("pm2_chave-que-nao-existe", SURVEY.id), 401, undefined);
  await rejectsWith(store.photoSurveyDraw(alice.recoveryKey, "nao-existe"), 404, "PHOTO_SURVEY_NOT_FOUND");

  // --- Resposta: grava uma vez, repete sem gravar, recusa outra escolha ---
  const before = await gameFootprint();
  const responsesBefore = await count("photo_survey_responses");
  const pickIds = picksOf(first.draw, 1);
  const answerId = randomUUID();
  const body = { recoveryKey: alice.recoveryKey, surveyId: SURVEY.id, answerId, pickIds, championId: pickIds[3] };
  const created = await store.photoSurveyRespond(body);
  assert.equal(created.status, "created");
  assert.deepEqual(created.response, { answerId, pickIds, championId: pickIds[3], respondedAt: OPEN_INSTANT.toISOString() });
  assert.deepEqual(created.draw, first.draw);
  const replay = await store.photoSurveyRespond(body);
  assert.equal(replay.status, "alreadyProcessed");
  assert.deepEqual(replay.response, created.response);
  const sameChoice = await store.photoSurveyRespond({ ...body, answerId: randomUUID() });
  assert.equal(sameChoice.status, "alreadyProcessed");
  assert.deepEqual(sameChoice.response, created.response, "a mesma escolha devolve o recibo original");
  const other = picksOf(first.draw, 2);
  await assert.rejects(respond(alice, { pickIds: other, championId: other[0] }), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, "PHOTO_SURVEY_ALREADY_ANSWERED");
    assert.deepEqual(error.current, created.response);
    return true;
  });
  // Mesmo recibo com outra escolha também não regrava.
  await rejectsWith(store.photoSurveyRespond({ ...body, pickIds: other, championId: other[0] }), 409, "PHOTO_SURVEY_ALREADY_ANSWERED");
  assert.equal(await count("photo_survey_responses"), responsesBefore + 1);
  assert.deepEqual((await store.photoSurveyDraw(alice.recoveryKey, SURVEY.id)).response, created.response);
  assert.deepEqual(await gameFootprint(), before, "a resposta da pesquisa não toca votos, Elo nem cotas do jogo");

  // --- Duas abas confirmam escolhas diferentes ao mesmo tempo: só uma grava ---
  const bruno = await newPlayer();
  const brunoDraw = await store.photoSurveyDraw(bruno.recoveryKey, SURVEY.id);
  const [optionA, optionB] = [picksOf(brunoDraw.draw, 0), picksOf(brunoDraw.draw, 3)];
  const race = await Promise.allSettled([
    respond(bruno, { pickIds: optionA, championId: optionA[0] }),
    respond(bruno, { pickIds: optionB, championId: optionB[1] }),
  ]);
  assert.deepEqual(race.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
  const winner = race.find((result) => result.status === "fulfilled").value;
  const loser = race.find((result) => result.status === "rejected").reason;
  assert.equal(winner.status, "created");
  assert.equal(loser.code, "PHOTO_SURVEY_ALREADY_ANSWERED");
  assert.deepEqual(loser.current, winner.response);

  // --- Respostas forjadas ou malformadas: 400 e nada gravado ---
  const carla = await newPlayer();
  const carlaDraw = await store.photoSurveyDraw(carla.recoveryKey, SURVEY.id);
  const valid = picksOf(carlaDraw.draw, 0);
  const outside = SURVEY.cardIds.find((id) => !carlaDraw.draw.groups.flat().includes(id));
  const forged = [
    { pickIds: [outside, valid[1], valid[2], valid[3]], championId: valid[1] },
    { pickIds: [carlaDraw.draw.groups[1][0], valid[1], valid[2], valid[3]], championId: valid[1] },
    { pickIds: valid, championId: carlaDraw.draw.groups[0][1] },
    { pickIds: valid, championId: outside },
    { pickIds: valid.slice(0, 3), championId: valid[0] },
    { pickIds: [valid[0], valid[0], valid[2], valid[3]], championId: valid[0] },
    { pickIds: "abcd", championId: valid[0] },
    { pickIds: valid, championId: null },
    { pickIds: undefined, championId: undefined },
  ];
  for (const attempt of forged) {
    await rejectsWith(respond(carla, attempt), 400, "PHOTO_SURVEY_RESPONSE_INVALID");
  }
  for (const badAnswerId of [undefined, "", "abc", 7, `${randomUUID()}x`]) {
    await rejectsWith(store.photoSurveyRespond({
      recoveryKey: carla.recoveryKey, surveyId: SURVEY.id, answerId: badAnswerId, pickIds: valid, championId: valid[0],
    }), 400, "PHOTO_SURVEY_RESPONSE_INVALID");
  }
  // Recibo de outra pessoa não serve para gravar.
  await rejectsWith(store.photoSurveyRespond({
    recoveryKey: carla.recoveryKey, surveyId: SURVEY.id, answerId, pickIds: valid, championId: valid[0],
  }), 400, "PHOTO_SURVEY_RESPONSE_INVALID");
  assert.equal((await store.photoSurveyDraw(carla.recoveryKey, SURVEY.id)).response, null);
  assert.equal((await respond(carla, { pickIds: valid, championId: valid[2] })).status, "created");

  // --- Duas pessoas mandam o mesmo recibo ao mesmo tempo: uma grava, a outra recebe 400, nunca 500 ---
  for (let round = 0; round < 6; round += 1) {
    const pair = [await newPlayer(), await newPlayer()];
    const draws = await Promise.all(pair.map((player) => store.photoSurveyDraw(player.recoveryKey, SURVEY.id)));
    const sharedReceipt = randomUUID();
    const settled = await Promise.allSettled(pair.map((player, index) => {
      const picks = picksOf(draws[index].draw, round);
      return store.photoSurveyRespond({
        recoveryKey: player.recoveryKey, surveyId: SURVEY.id, answerId: sharedReceipt, pickIds: picks, championId: picks[0],
      });
    }));
    assert.deepEqual(settled.map((result) => result.status).sort(), ["fulfilled", "rejected"], `recibo disputado, rodada ${round}`);
    const refused = settled.find((result) => result.status === "rejected").reason;
    assert.equal(refused.code, "PHOTO_SURVEY_RESPONSE_INVALID", refused.message);
    assert.equal(refused.status, 400);
  }

  // --- Sem sorteio, sem pesquisa, sem sessão ---
  const dora = await newPlayer();
  await rejectsWith(respond(dora, { pickIds: valid, championId: valid[0] }), 409, "PHOTO_SURVEY_DRAW_REQUIRED");
  await rejectsWith(respond(dora, { pickIds: valid, championId: valid[0] }, "nao-existe"), 404, "PHOTO_SURVEY_NOT_FOUND");
  await rejectsWith(store.photoSurveyRespond({
    recoveryKey: "pm2_chave-que-nao-existe", surveyId: SURVEY.id, answerId: randomUUID(), pickIds: valid, championId: valid[0],
  }), 401, undefined);

  // --- Janela: antes de abrir, aberta, e fechando entre o sorteio e a resposta ---
  const elis = await newPlayer();
  now = new Date("2034-05-10T02:59:59.999Z");
  assert.equal((await store.photoSurvey(WINDOWED.id)).status, "scheduled");
  await rejectsWith(store.photoSurveyDraw(elis.recoveryKey, WINDOWED.id), 409, "PHOTO_SURVEY_CLOSED");
  now = OPEN_INSTANT;
  const elisDraw = await store.photoSurveyDraw(elis.recoveryKey, WINDOWED.id);
  const elisPicks = picksOf(elisDraw.draw, 2);
  now = new Date(WINDOWED.closesAt);
  assert.equal((await store.photoSurvey(WINDOWED.id)).status, "closed");
  await rejectsWith(respond(elis, { pickIds: elisPicks, championId: elisPicks[0] }, WINDOWED.id), 409, "PHOTO_SURVEY_CLOSED");
  const closedView = await store.photoSurveyDraw(elis.recoveryKey, WINDOWED.id);
  assert.deepEqual(closedView.draw, elisDraw.draw, "quem já tinha sorteio continua vendo o mesmo depois do fechamento");
  assert.equal(closedView.survey.status, "closed");
  assert.equal(closedView.response, null);
  await rejectsWith(store.photoSurveyDraw((await newPlayer()).recoveryKey, WINDOWED.id), 409, "PHOTO_SURVEY_CLOSED");
  assert.equal(await count("photo_survey_responses", `WHERE survey_id = '${WINDOWED.id}'`), 0);
  now = OPEN_INSTANT;

  // --- Gravações imutáveis ---
  for (const statement of [
    "UPDATE photo_survey_responses SET champion_id = 'outra'",
    "DELETE FROM photo_survey_responses",
    "UPDATE photo_survey_draws SET shown_ids = ARRAY['x']",
    "DELETE FROM photo_survey_draws",
  ]) {
    await assert.rejects(audit.query(statement), /imutáveis/, statement);
  }

  // --- Identidade: o anônimo responde e depois entra numa conta Google que já existia ---
  const subject = `photo-survey-smoke-${randomUUID()}`;
  const accountSeed = await newPlayer();
  const account = await store.signInWithGoogle({
    identity: { subject, displayName: "Teste" }, currentToken: accountSeed.recoveryKey, topicId: "eleicoes-2026",
  });
  const accountVersion = (await store.playerRanking(account.sessionToken, "eleicoes-2026")).version;
  const fabio = await newPlayer();
  const fabioDraw = await store.photoSurveyDraw(fabio.recoveryKey, SURVEY.id);
  const fabioPicks = picksOf(fabioDraw.draw, 1);
  const fabioResponse = (await respond(fabio, { pickIds: fabioPicks, championId: fabioPicks[2] })).response;
  const combined = await store.signInWithGoogle({
    identity: { subject, displayName: "Teste" }, currentToken: fabio.recoveryKey, topicId: "eleicoes-2026",
  });
  // Sem escolhas no jogo, nada é somado: o vínculo existe só para a pesquisa.
  assert.equal(combined.merge.status, "linked");
  assert.equal(combined.merge.anonymousChoices, 0);
  for (const token of [combined.sessionToken, account.sessionToken]) {
    const seen = await store.photoSurveyDraw(token, SURVEY.id);
    assert.deepEqual(seen.response, fabioResponse, "a conta enxerga a resposta dada como anônimo");
    assert.deepEqual(seen.draw, fabioDraw.draw);
    const again = picksOf(seen.draw, 3);
    await rejectsWith(store.photoSurveyRespond({
      recoveryKey: token, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: again, championId: again[0],
    }), 409, "PHOTO_SURVEY_ALREADY_ANSWERED");
  }

  assert.equal(
    (await store.playerRanking(account.sessionToken, "eleicoes-2026")).version,
    accountVersion,
    "o vínculo da pesquisa não soma nada do jogo nem muda a versão do ranking da conta",
  );

  // Anônimo com sorteio e sem resposta também é ligado: a chave antiga deixa de
  // valer, e uma aba aberta com ela não grava uma segunda resposta.
  const subjectTwo = `photo-survey-smoke-${randomUUID()}`;
  const seedTwo = await newPlayer();
  const accountTwo = await store.signInWithGoogle({
    identity: { subject: subjectTwo, displayName: "Teste" }, currentToken: seedTwo.recoveryKey, topicId: "eleicoes-2026",
  });
  const gil = await newPlayer();
  const gilDraw = await store.photoSurveyDraw(gil.recoveryKey, SURVEY.id);
  const gilPicks = picksOf(gilDraw.draw, 0);
  const gilLogin = await store.signInWithGoogle({
    identity: { subject: subjectTwo, displayName: "Teste" }, currentToken: gil.recoveryKey, topicId: "eleicoes-2026",
  });
  assert.equal(gilLogin.merge.status, "linked");
  await rejectsWith(respond(gil, { pickIds: gilPicks, championId: gilPicks[0] }), 401, undefined);
  const accountTwoDraw = await store.photoSurveyDraw(gilLogin.sessionToken, SURVEY.id);
  assert.equal(accountTwoDraw.response, null, "a conta recomeça com o sorteio dela");
  const accountTwoPicks = picksOf(accountTwoDraw.draw, 1);
  const accountTwoResponse = await store.photoSurveyRespond({
    recoveryKey: accountTwo.sessionToken, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: accountTwoPicks, championId: accountTwoPicks[1],
  });
  assert.equal(accountTwoResponse.status, "created");

  // Anônimo sem jogo e sem pesquisa continua não sendo incorporado, como antes.
  const hugo = await newPlayer();
  const untouched = await store.signInWithGoogle({
    identity: { subject: subjectTwo, displayName: "Teste" }, currentToken: hugo.recoveryKey, topicId: "eleicoes-2026",
  });
  assert.equal(untouched.merge, null);

  // Conta que acaba com duas respostas (uma dela, outra de um anônimo ligado
  // depois): vale a mais antiga, sempre a mesma.
  const iris = await newPlayer();
  const irisDraw = await store.photoSurveyDraw(iris.recoveryKey, SURVEY.id);
  const irisPicks = picksOf(irisDraw.draw, 2);
  now = new Date(OPEN_INSTANT.getTime() + 60_000);
  await respond(iris, { pickIds: irisPicks, championId: irisPicks[3] });
  now = OPEN_INSTANT;
  const irisLogin = await store.signInWithGoogle({
    identity: { subject: subjectTwo, displayName: "Teste" }, currentToken: iris.recoveryKey, topicId: "eleicoes-2026",
  });
  assert.equal(irisLogin.merge.status, "linked");
  for (const token of [irisLogin.sessionToken, accountTwo.sessionToken]) {
    assert.deepEqual((await store.photoSurveyDraw(token, SURVEY.id)).response, accountTwoResponse.response, "vale a resposta mais antiga da identidade");
  }

  // Quando o anônimo já jogou a rodada de hoje, ele vira o jogador ativo da
  // conta. A resposta que a conta já tinha continua valendo para ele.
  const subjectThree = `photo-survey-smoke-${randomUUID()}`;
  const seedThree = await newPlayer();
  const accountThree = await store.signInWithGoogle({
    identity: { subject: subjectThree, displayName: "Teste" }, currentToken: seedThree.recoveryKey, topicId: "eleicoes-2026",
  });
  const accountThreeDraw = await store.photoSurveyDraw(accountThree.sessionToken, SURVEY.id);
  const accountThreePicks = picksOf(accountThreeDraw.draw, 3);
  const accountThreeResponse = (await store.photoSurveyRespond({
    recoveryKey: accountThree.sessionToken, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: accountThreePicks, championId: accountThreePicks[2],
  })).response;
  const joana = await newPlayer();
  const daily = await store.dailySession(joana.recoveryKey, "eleicoes-2026");
  await store.dailyVote({
    topicId: "eleicoes-2026", editionId: daily.edition.id, slot: 1, winnerId: daily.round.candidateIds[1],
    answerId: randomUUID(), recoveryKey: joana.recoveryKey, playerVersion: 0,
  });
  const joanaLogin = await store.signInWithGoogle({
    identity: { subject: subjectThree, displayName: "Teste" }, currentToken: joana.recoveryKey, topicId: "eleicoes-2026",
  });
  assert.equal(joanaLogin.merge.status, "combined");
  assert.equal(joanaLogin.merge.activeDaily, "anonymous");
  for (const token of [joanaLogin.sessionToken, accountThree.sessionToken]) {
    const seen = await store.photoSurveyDraw(token, SURVEY.id);
    assert.deepEqual(seen.response, accountThreeResponse, "a resposta da conta vale para o jogador que passou a ser o ativo");
    const again = picksOf(seen.draw, 0);
    await rejectsWith(store.photoSurveyRespond({
      recoveryKey: token, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: again, championId: again[1],
    }), 409, "PHOTO_SURVEY_ALREADY_ANSWERED");
  }

  // --- Um segundo boot no mesmo banco não falha nem perde linhas ---
  const rowsBefore = [await count("photo_survey_draws"), await count("photo_survey_responses")];
  const restarted = createTopicStore(connection, options);
  try {
    await restarted.init();
    assert.deepEqual([await count("photo_survey_draws"), await count("photo_survey_responses")], rowsBefore);
    assert.deepEqual((await restarted.photoSurveyDraw(alice.recoveryKey, SURVEY.id)).response, created.response);
  } finally {
    await restarted.close();
  }
  assert.equal(await count("schema_migrations", "WHERE id = '2026-11-13-photo-survey-v1'"), 1);

  console.log("Smoke da pesquisa por foto aprovado: sorteio estável e simultâneo, resposta única e idempotente, corrida de duas abas, respostas forjadas recusadas, janela, imutabilidade, jogo atual intacto, identidade Google e segundo boot.");
} finally {
  await audit.end();
  await store.close();
}
