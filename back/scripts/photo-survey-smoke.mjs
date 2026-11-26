import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import pg from "pg";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { PHOTO_SURVEYS, pairKey, seenPairKeys, totalPairCount } from "../../shared/photo-survey.js";
import { createApprovedTestRegistry } from "../test-support/editorial-fixtures.js";
import { createTopicStore } from "../src/topic-store.js";
import { requireDisposableDatabase } from "../test-support/disposable-db.js";

// Roda só contra o banco descartável do workflow de integração.
const connection = requireDisposableDatabase();

const SURVEY = PHOTO_SURVEYS[0];
const SECOND = PHOTO_SURVEYS[1];
const CELEBRITIES = PHOTO_SURVEYS.find((survey) => survey.id === "famosos-01");
const CLOTHES = PHOTO_SURVEYS.find((survey) => survey.id === "roupas-demo-01");
const WINDOWED = Object.freeze({
  ...SURVEY,
  id: "smoke-janela",
  opensAt: "2034-05-10T03:00:00.000Z",
  closesAt: "2034-05-11T03:00:00.000Z",
});
// A janela das rodadas é outra pesquisa: a de cima termina o smoke sem resposta
// nenhuma, e isso é conferido.
const ROUND_WINDOW = Object.freeze({ ...WINDOWED, id: "smoke-janela-rodadas" });
// Um dia que nenhum outro smoke usa: a rodada diária dele ainda está aberta
// mesmo quando este script roda depois dos outros no mesmo banco.
const OPEN_INSTANT = new Date("2034-05-10T15:00:00.000Z");
let now = OPEN_INSTANT;
// Este smoke prova o sorteio e a resposta em si, com jogadores sem conta,
// como eles existiam antes do cadastro obrigatório (ICM 71). A exigência do
// cadastro fica desligada aqui e é provada no cpf-registration-smoke.mjs.
const options = {
  candidateRegistry: createApprovedTestRegistry(CATALOG.map((person) => person.id)),
  clock: () => now,
  photoSurveys: [SURVEY, SECOND, CELEBRITIES, CLOTHES, WINDOWED, ROUND_WINDOW],
  requirePhotoSurveyRegistration: async () => {},
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
const count = async (table, where = "", values = []) => Number((await audit.query(`SELECT count(*) AS total FROM ${table} ${where}`, values)).rows[0].total);
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

// --- Apoio das rodadas (ICM 75) ---
const ROUND_ONE_COLUMNS = {
  photo_survey_draws: ["survey_id", "player_id", "shown_ids", "issued_at"],
  photo_survey_responses: ["survey_id", "player_id", "answer_id", "shown_ids", "pick_ids", "champion_id", "responded_at"],
};
// Tudo o que as duas tabelas da rodada 1 guardam: as colunas e cada linha.
async function roundOneFingerprint() {
  const columns = await audit.query(`SELECT table_name, array_agg(column_name::text ORDER BY ordinal_position) AS names
    FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name IN ('photo_survey_draws', 'photo_survey_responses')
    GROUP BY table_name ORDER BY table_name`);
  const rows = await audit.query(`SELECT
    (SELECT count(*)::integer FROM photo_survey_draws) AS draws,
    (SELECT md5(coalesce(string_agg(d::text, '|' ORDER BY d.survey_id, d.player_id), '')) FROM photo_survey_draws d) AS draws_hash,
    (SELECT count(*)::integer FROM photo_survey_responses) AS responses,
    (SELECT md5(coalesce(string_agg(r::text, '|' ORDER BY r.survey_id, r.player_id), '')) FROM photo_survey_responses r) AS responses_hash`);
  return { columns: Object.fromEntries(columns.rows.map((row) => [row.table_name, row.names])), ...rows.rows[0] };
}
const roundRows = async () => [await count("photo_survey_round_draws"), await count("photo_survey_round_responses")];
const receiptUses = async (receipt) => Number((await audit.query(`SELECT
  (SELECT count(*) FROM photo_survey_responses WHERE answer_id = $1)
  + (SELECT count(*) FROM photo_survey_round_responses WHERE answer_id = $1) AS total`, [receipt])).rows[0].total);
const freshPairsInScreens = (groups, seen) => groups.reduce(
  (total, group) => total + group.reduce((sum, a, index) => sum + group.slice(index + 1).filter((b) => !seen.has(pairKey(a, b))).length, 0),
  0,
);
const nextRound = (player, surveyId = SURVEY.id) => store.photoSurveyDraw(player.recoveryKey ?? player.sessionToken, surveyId, { next: true });
// Um jogador novo com a rodada 1 respondida e a rodada 2 aberta.
async function playerAtRoundTwo(surveyId = SURVEY.id) {
  const player = await newPlayer();
  const one = await store.photoSurveyDraw(player.recoveryKey, surveyId);
  const picks = picksOf(one.draw, 1);
  const answered = await respond(player, { pickIds: picks, championId: picks[0] }, surveyId);
  const two = await nextRound(player, surveyId);
  assert.equal(two.round, 2);
  return { player, one, answered, two };
}
// Responde todas as rodadas de uma pesquisa até não haver mais confronto por ver.
async function playToTheEnd(survey, limit) {
  const player = await newPlayer();
  const rounds = [];
  let drawn = await store.photoSurveyDraw(player.recoveryKey, survey.id);
  let progress;
  for (;;) {
    assert.equal(drawn.round, rounds.length + 1, "as rodadas são numeradas em sequência");
    assert.equal(drawn.response, null);
    const seen = seenPairKeys(survey, rounds);
    if (rounds.length) assert.ok(freshPairsInScreens(drawn.draw.groups, seen) >= 1, `${survey.id}: a rodada ${drawn.round} não trouxe dupla nova`);
    const picks = picksOf(drawn.draw, rounds.length);
    const answered = await respond(player, { pickIds: picks, championId: picks[rounds.length % picks.length], round: drawn.round }, survey.id);
    assert.equal(answered.status, "created");
    rounds.push({ shownIds: drawn.draw.groups.flat(), pickIds: picks });
    progress = answered.progress;
    assert.equal(progress.seenPairs, seenPairKeys(survey, rounds).size);
    assert.equal(progress.answeredRounds, rounds.length);
    assert.ok(rounds.length <= limit, `${survey.id}: passou de ${limit} rodadas`);
    if (!progress.canContinue) break;
    drawn = await nextRound(player, survey.id);
  }
  return { player, rounds, progress };
}

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

  // --- Duas pesquisas (ICM 70): sorteio e resposta são por pesquisa ---
  const vera = await newPlayer();
  const veraOne = await store.photoSurveyDraw(vera.recoveryKey, SURVEY.id);
  const veraTwo = await store.photoSurveyDraw(vera.recoveryKey, SECOND.id);
  assert.equal(veraTwo.survey.id, SECOND.id);
  assert.equal(veraTwo.survey.question, "Em quem você confia mais?");
  assert.equal(veraTwo.response, null);
  const answeredOne = await respond(vera, { pickIds: picksOf(veraOne.draw), championId: picksOf(veraOne.draw)[0] });
  // Responder a primeira não responde a segunda nem troca o sorteio dela.
  const veraTwoAgain = await store.photoSurveyDraw(vera.recoveryKey, SECOND.id);
  assert.equal(veraTwoAgain.response, null);
  assert.deepEqual(veraTwoAgain.draw, veraTwo.draw);
  // A chave de uma pesquisa não serve na outra, a não ser que os sorteios coincidam.
  const answeredTwo = await respond(vera, { pickIds: picksOf(veraTwo.draw, 1), championId: picksOf(veraTwo.draw, 1)[1] }, SECOND.id);
  assert.equal(answeredTwo.status, "created");
  assert.notEqual(answeredTwo.response.answerId, answeredOne.response.answerId);
  assert.equal((await store.photoSurveyDraw(vera.recoveryKey, SURVEY.id)).response.championId, answeredOne.response.championId);
  assert.equal((await store.photoSurveyDraw(vera.recoveryKey, SECOND.id)).response.championId, answeredTwo.response.championId);
  await rejectsWith(respond(vera, { pickIds: picksOf(veraTwo.draw), championId: picksOf(veraTwo.draw)[0] }, SECOND.id), 409, "PHOTO_SURVEY_ALREADY_ANSWERED");

  // --- Pesquisa de roupas (ICM 73): as 16 cartas entram no sorteio de toda pessoa ---
  assert.equal(CLOTHES.id, "roupas-demo-01");
  const veraClothes = await store.photoSurveyDraw(vera.recoveryKey, CLOTHES.id);
  assert.equal(veraClothes.survey.subject, "Roupas");
  assert.equal(veraClothes.survey.note, "Peças de demonstração, desenhadas com IA pelo PoliMatch.");
  assert.equal(veraClothes.response, null, "as respostas de política não respondem a de roupas");
  assert.deepEqual(veraClothes.draw.groups.map((group) => group.length), [4, 4, 4, 4]);
  assert.deepEqual(veraClothes.draw.groups.flat().sort(), [...CLOTHES.cardIds], "todas as cartas, uma vez cada");
  assert.deepEqual(await store.photoSurveyDraw(vera.recoveryKey, CLOTHES.id), veraClothes, "o sorteio não muda");
  // Uma carta de política não entra numa resposta da pesquisa de roupas.
  const clothesPicks = picksOf(veraClothes.draw, 2);
  await assert.rejects(respond(vera, { pickIds: [veraOne.draw.groups[0][0], ...clothesPicks.slice(1)], championId: clothesPicks[1] }, CLOTHES.id), (error) => {
    assert.equal(error.code, "PHOTO_SURVEY_RESPONSE_INVALID");
    assert.equal(error.current.reason, "pick-outside-group");
    return true;
  });
  const answeredClothes = await respond(vera, { pickIds: clothesPicks, championId: clothesPicks[1] }, CLOTHES.id);
  assert.equal(answeredClothes.status, "created");
  assert.equal((await store.photoSurveyDraw(vera.recoveryKey, CLOTHES.id)).response.championId, clothesPicks[1]);
  assert.equal((await store.photoSurveyDraw(vera.recoveryKey, SURVEY.id)).response.championId, answeredOne.response.championId);

  // --- Pesquisa de famosos (ICM 74): 16 de 20 cartas próprias, por sorteio ---
  assert.equal(CELEBRITIES.id, "famosos-01");
  const veraCelebrities = await store.photoSurveyDraw(vera.recoveryKey, CELEBRITIES.id);
  assert.equal(veraCelebrities.survey.subject, "Famosos");
  assert.equal(veraCelebrities.survey.question, "De quem você é mais fã?");
  assert.equal(veraCelebrities.survey.note, "Fotos de licença livre.");
  assert.equal(veraCelebrities.response, null, "as respostas de política e de roupas não respondem a de famosos");
  assert.deepEqual(veraCelebrities.draw.groups.map((group) => group.length), [4, 4, 4, 4]);
  const celebrityShown = veraCelebrities.draw.groups.flat();
  assert.equal(new Set(celebrityShown).size, 16, "16 cartas, sem repetir");
  assert.ok(celebrityShown.every((id) => CELEBRITIES.cardIds.includes(id)), "só cartas da pesquisa de famosos");
  assert.deepEqual(await store.photoSurveyDraw(vera.recoveryKey, CELEBRITIES.id), veraCelebrities, "o sorteio não muda");
  // Uma carta de roupa não entra numa resposta da pesquisa de famosos.
  const celebrityPicks = picksOf(veraCelebrities.draw, 3);
  await assert.rejects(respond(vera, { pickIds: [veraClothes.draw.groups[0][0], ...celebrityPicks.slice(1)], championId: celebrityPicks[1] }, CELEBRITIES.id), (error) => {
    assert.equal(error.code, "PHOTO_SURVEY_RESPONSE_INVALID");
    assert.equal(error.current.reason, "pick-outside-group");
    return true;
  });
  const answeredCelebrities = await respond(vera, { pickIds: celebrityPicks, championId: celebrityPicks[2] }, CELEBRITIES.id);
  assert.equal(answeredCelebrities.status, "created");
  assert.equal((await store.photoSurveyDraw(vera.recoveryKey, CELEBRITIES.id)).response.championId, celebrityPicks[2]);
  await rejectsWith(respond(vera, { pickIds: celebrityPicks, championId: celebrityPicks[0] }, CELEBRITIES.id), 409, "PHOTO_SURVEY_ALREADY_ANSWERED");
  // As outras respostas dela continuam como estavam.
  assert.equal((await store.photoSurveyDraw(vera.recoveryKey, CLOTHES.id)).response.championId, clothesPicks[1]);
  assert.equal((await store.photoSurveyDraw(vera.recoveryKey, SECOND.id)).response.championId, answeredTwo.response.championId);

  // --- Rodadas (ICM 75, #350) ---

  // Quem não manda `next` nem `round` recebe o de sempre, com os valores de
  // sempre, mais a rodada, o progresso e a última rodada respondida.
  assert.deepEqual(Object.keys(first), ["survey", "draw", "response", "round", "progress", "lastAnswered"]);
  assert.equal(first.round, 1);
  assert.deepEqual(first.progress, { answeredRounds: 0, seenPairs: 0, totalPairs: 190, canContinue: false });
  assert.equal(first.lastAnswered, null, "sem rodada respondida não há última resposta");
  assert.deepEqual(first.survey, view);
  assert.deepEqual(Object.keys(created), ["status", "survey", "draw", "response", "round", "progress", "lastAnswered"]);
  assert.equal(created.round, 1);
  assert.deepEqual(created.progress, { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: true });
  assert.deepEqual(created.lastAnswered, { round: 1, response: created.response });
  assert.deepEqual(
    (({ status, survey, draw, response }) => ({ status, survey, draw, response }))(created),
    { status: "created", survey: view, draw: first.draw, response: { answerId, pickIds, championId: pickIds[3], respondedAt: OPEN_INSTANT.toISOString() } },
  );

  // Subida num banco que já tem sorteios e respostas da rodada 1 e ainda não
  // tem as tabelas das rodadas, como o de produção antes deste estágio: as
  // tabelas novas nascem, e as duas que existiam ficam como estavam.
  const roundOneBefore = await roundOneFingerprint();
  assert.deepEqual(roundOneBefore.columns, ROUND_ONE_COLUMNS);
  assert.ok(roundOneBefore.draws > 0 && roundOneBefore.responses > 0);
  await audit.query(`DROP TABLE IF EXISTS photo_survey_round_responses;
    DROP TABLE IF EXISTS photo_survey_round_draws;
    DELETE FROM schema_migrations WHERE id = '2026-11-26-photo-survey-rounds-v1'`);
  assert.equal(await count("information_schema.tables", "WHERE table_schema = current_schema() AND table_name LIKE 'photo_survey_round_%'"), 0);
  const upgraded = createTopicStore(connection, options);
  try {
    await upgraded.init();
    assert.equal(await count("information_schema.tables", "WHERE table_schema = current_schema() AND table_name LIKE 'photo_survey_round_%'"), 2);
    assert.equal(await count("schema_migrations", "WHERE id = '2026-11-26-photo-survey-rounds-v1'"), 1);
    assert.deepEqual(await roundRows(), [0, 0]);
    assert.deepEqual(await roundOneFingerprint(), roundOneBefore, "a subida não altera as tabelas nem as linhas da rodada 1");
    // E de novo, com as tabelas novas já criadas.
    await upgraded.init();
    assert.equal(await count("schema_migrations", "WHERE id = '2026-11-26-photo-survey-rounds-v1'"), 1);
    assert.deepEqual(await roundOneFingerprint(), roundOneBefore);
    // A resposta que já existia é a rodada 1, e a pessoa pode continuar.
    const upgradedAlice = await upgraded.photoSurveyDraw(alice.recoveryKey, SURVEY.id);
    assert.deepEqual(upgradedAlice, {
      survey: first.survey, draw: first.draw, response: created.response, round: 1, progress: created.progress,
      lastAnswered: { round: 1, response: created.response },
    });
  } finally {
    await upgraded.close();
  }

  // Rodada 2: só com next, depois de a rodada 1 ser respondida, e uma só em pedidos repetidos e simultâneos.
  const openRoundOne = await newPlayer();
  const openDraw = await store.photoSurveyDraw(openRoundOne.recoveryKey, SURVEY.id, { next: true });
  assert.equal(openDraw.round, 1, "sem rodada nenhuma, next emite a rodada 1");
  assert.deepEqual(await nextRound(openRoundOne), openDraw, "com a rodada 1 aberta, next devolve a mesma rodada");
  assert.deepEqual(await roundRows(), [0, 0]);
  await rejectsWith(store.photoSurveyDraw(alice.recoveryKey, SURVEY.id, { next: "true" }), 400, "PHOTO_SURVEY_DRAW_INVALID");
  assert.equal((await store.photoSurveyDraw(alice.recoveryKey, SURVEY.id, { next: false })).round, 1);
  const beforeRounds = await gameFootprint();
  const nextCalls = await Promise.all([nextRound(alice), nextRound(alice), nextRound(alice)]);
  const aliceTwo = nextCalls[0];
  assert.deepEqual(nextCalls[1], aliceTwo);
  assert.deepEqual(nextCalls[2], aliceTwo);
  assert.deepEqual(await roundRows(), [1, 0], "três pedidos simultâneos, uma rodada emitida");
  assert.equal(aliceTwo.round, 2);
  assert.equal(aliceTwo.response, null);
  assert.deepEqual(aliceTwo.progress, { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: false });
  // Com a rodada 2 aberta, a resposta vem vazia e a última respondida é a rodada 1.
  assert.deepEqual(aliceTwo.lastAnswered, { round: 1, response: created.response });
  assert.deepEqual(aliceTwo.draw.groups.map((group) => group.length), [4, 4, 4, 4]);
  const aliceTwoShown = aliceTwo.draw.groups.flat();
  assert.equal(new Set(aliceTwoShown).size, 16);
  assert.ok(aliceTwoShown.every((id) => SURVEY.cardIds.includes(id)));
  const aliceRounds = [{ shownIds: shown, pickIds }];
  assert.ok(freshPairsInScreens(aliceTwo.draw.groups, seenPairKeys(SURVEY, aliceRounds)) >= 1, "a rodada nova traz dupla que a pessoa ainda não viu");
  // Com rodada aberta, sem next e com next devolvem a mesma rodada.
  assert.deepEqual(await store.photoSurveyDraw(alice.recoveryKey, SURVEY.id), aliceTwo);
  assert.deepEqual(await nextRound(alice), aliceTwo);

  // Resposta da rodada 2: conferida contra o sorteio da rodada 2, com recibo novo.
  const twoPicks = picksOf(aliceTwo.draw, 2);
  const twoBody = { recoveryKey: alice.recoveryKey, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: twoPicks, championId: twoPicks[1], round: 2 };
  const refusedWith = (promise, status, code, reason) => assert.rejects(promise, (error) => {
    assert.equal(error.code, code, error.message);
    assert.equal(error.status, status, error.message);
    assert.deepEqual(error.current, { reason });
    return true;
  });
  for (const round of [3, 99]) await refusedWith(store.photoSurveyRespond({ ...twoBody, round }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "round");
  for (const round of [0, -1, 1.5, "2", null]) await refusedWith(store.photoSurveyRespond({ ...twoBody, round }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "round");
  const outsideTwo = SURVEY.cardIds.find((id) => !aliceTwoShown.includes(id));
  await refusedWith(store.photoSurveyRespond({ ...twoBody, pickIds: [outsideTwo, ...twoPicks.slice(1)] }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "pick-outside-group");
  await refusedWith(store.photoSurveyRespond({ ...twoBody, championId: aliceTwo.draw.groups[0][1] }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "champion");
  // O recibo da rodada 1 não serve para a rodada 2, nem o de outra pessoa.
  await refusedWith(store.photoSurveyRespond({ ...twoBody, answerId }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "answer-id");
  await refusedWith(store.photoSurveyRespond({ ...twoBody, answerId: winner.response.answerId }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "answer-id");
  assert.deepEqual(await roundRows(), [1, 0]);
  // Duas abas confirmam a mesma escolha da mesma rodada ao mesmo tempo: uma grava, a outra é repetição.
  const sameTwice = await Promise.all([store.photoSurveyRespond(twoBody), store.photoSurveyRespond(twoBody)]);
  assert.deepEqual(sameTwice.map((result) => result.status).sort(), ["alreadyProcessed", "created"]);
  assert.deepEqual(sameTwice[0].response, sameTwice[1].response);
  const createdTwo = sameTwice.find((result) => result.status === "created");
  assert.deepEqual(createdTwo.response, { answerId: twoBody.answerId, pickIds: twoPicks, championId: twoPicks[1], respondedAt: OPEN_INSTANT.toISOString() });
  assert.equal(createdTwo.round, 2);
  assert.deepEqual(createdTwo.draw, aliceTwo.draw);
  aliceRounds.push({ shownIds: aliceTwoShown, pickIds: twoPicks });
  assert.deepEqual(createdTwo.progress, { answeredRounds: 2, seenPairs: seenPairKeys(SURVEY, aliceRounds).size, totalPairs: 190, canContinue: true });
  // Respondida a rodada 2, a última respondida passa a ser ela, também na repetição simultânea.
  for (const result of sameTwice) assert.deepEqual(result.lastAnswered, { round: 2, response: createdTwo.response });
  assert.deepEqual(await roundRows(), [1, 1]);
  // Repetição idempotente e outra escolha, por rodada.
  assert.equal((await store.photoSurveyRespond({ ...twoBody, answerId: randomUUID() })).response.answerId, twoBody.answerId, "a mesma escolha devolve o recibo original");
  const otherTwo = picksOf(aliceTwo.draw, 3);
  await assert.rejects(store.photoSurveyRespond({ ...twoBody, answerId: randomUUID(), pickIds: otherTwo, championId: otherTwo[0] }), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, "PHOTO_SURVEY_ALREADY_ANSWERED");
    assert.deepEqual(error.current, createdTwo.response);
    return true;
  });
  // A rodada 1 continua respondendo por ela: com round 1 e, sem rodada aberta, sem round.
  for (const extra of [{ round: 1 }, {}]) {
    const replayOne = await store.photoSurveyRespond({ ...body, ...extra });
    assert.equal(replayOne.status, "alreadyProcessed");
    assert.equal(replayOne.round, 1);
    assert.deepEqual(replayOne.response, created.response);
    assert.deepEqual(replayOne.progress, createdTwo.progress);
    // A repetição da rodada 1 devolve a resposta dela; a última respondida é a rodada 2.
    assert.deepEqual(replayOne.lastAnswered, { round: 2, response: createdTwo.response });
    await assert.rejects(store.photoSurveyRespond({ ...body, ...extra, answerId: randomUUID(), pickIds: other, championId: other[0] }), (error) => {
      assert.equal(error.code, "PHOTO_SURVEY_ALREADY_ANSWERED");
      assert.deepEqual(error.current, created.response);
      return true;
    });
  }
  // O sorteio sem next passa a devolver a última rodada respondida.
  assert.deepEqual(await store.photoSurveyDraw(alice.recoveryKey, SURVEY.id), {
    survey: first.survey, draw: aliceTwo.draw, response: createdTwo.response, round: 2, progress: createdTwo.progress,
    lastAnswered: { round: 2, response: createdTwo.response },
  });
  // Sem round, a resposta é da rodada 1, mesmo com uma rodada nova aberta: a
  // recusa é a de antes das rodadas e nada é gravado na rodada aberta.
  const aliceThree = await nextRound(alice);
  assert.equal(aliceThree.round, 3);
  assert.equal(aliceThree.response, null);
  assert.deepEqual(aliceThree.lastAnswered, { round: 2, response: createdTwo.response });
  const threePicks = picksOf(aliceThree.draw, 0);
  await assert.rejects(respond(alice, { pickIds: threePicks, championId: threePicks[2] }), (error) => {
    assert.equal(error.status, 409);
    assert.equal(error.code, "PHOTO_SURVEY_ALREADY_ANSWERED");
    assert.deepEqual(error.current, created.response);
    return true;
  });
  assert.deepEqual(await roundRows(), [2, 1]);
  const createdThree = await respond(alice, { pickIds: threePicks, championId: threePicks[2], round: 3 });
  assert.equal(createdThree.status, "created");
  assert.equal(createdThree.round, 3);
  assert.deepEqual(createdThree.lastAnswered, { round: 3, response: createdThree.response });
  assert.deepEqual(await roundRows(), [2, 2]);
  assert.deepEqual(await gameFootprint(), beforeRounds, "as rodadas não tocam votos, Elo nem cotas do jogo");

  // Duas abas confirmam escolhas diferentes da mesma rodada ao mesmo tempo: só uma grava.
  const brunoTwo = await nextRound(bruno);
  assert.equal(brunoTwo.round, 2);
  const [roundA, roundB] = [picksOf(brunoTwo.draw, 0), picksOf(brunoTwo.draw, 3)];
  const roundRace = await Promise.allSettled([
    respond(bruno, { pickIds: roundA, championId: roundA[0], round: 2 }),
    respond(bruno, { pickIds: roundB, championId: roundB[1], round: 2 }),
  ]);
  assert.deepEqual(roundRace.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
  const roundWinner = roundRace.find((result) => result.status === "fulfilled").value;
  const roundLoser = roundRace.find((result) => result.status === "rejected").reason;
  assert.equal(roundWinner.status, "created");
  assert.equal(roundLoser.code, "PHOTO_SURVEY_ALREADY_ANSWERED");
  assert.deepEqual(roundLoser.current, roundWinner.response);
  assert.equal(await count("photo_survey_round_responses", `WHERE player_id = (SELECT player_id FROM photo_survey_round_draws WHERE shown_ids = $1 LIMIT 1)`, [brunoTwo.draw.groups.flat()]), 1);

  // Duas pessoas mandam o mesmo recibo ao mesmo tempo, uma na rodada 1 e outra
  // na rodada 2 (tabelas diferentes): uma grava, a outra recebe 400, nunca 500.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const fresh = await newPlayer();
    const freshDraw = await store.photoSurveyDraw(fresh.recoveryKey, SURVEY.id);
    const { player: veteran, two } = await playerAtRoundTwo();
    const sharedReceipt = randomUUID();
    const freshPicks = picksOf(freshDraw.draw, attempt);
    const veteranPicks = picksOf(two.draw, attempt);
    const requests = [
      () => store.photoSurveyRespond({ recoveryKey: fresh.recoveryKey, surveyId: SURVEY.id, answerId: sharedReceipt, pickIds: freshPicks, championId: freshPicks[0] }),
      () => store.photoSurveyRespond({ recoveryKey: veteran.recoveryKey, surveyId: SURVEY.id, answerId: sharedReceipt, pickIds: veteranPicks, championId: veteranPicks[0], round: 2 }),
    ];
    // Quem sai na frente alterna a cada tentativa.
    const settled = await Promise.allSettled((attempt % 2 ? requests.reverse() : requests).map((send) => send()));
    assert.deepEqual(settled.map((result) => result.status).sort(), ["fulfilled", "rejected"], `recibo disputado entre rodadas, tentativa ${attempt}`);
    const refused = settled.find((result) => result.status === "rejected").reason;
    assert.equal(refused.code, "PHOTO_SURVEY_RESPONSE_INVALID", refused.message);
    assert.equal(refused.status, 400);
    assert.deepEqual(refused.current, { reason: "answer-id" });
    assert.equal(await receiptUses(sharedReceipt), 1, "o recibo ficou em uma resposta só, somando as duas tabelas");
  }
  // O mesmo, com as duas pessoas na rodada 2.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pair = [await playerAtRoundTwo(), await playerAtRoundTwo()];
    const sharedReceipt = randomUUID();
    const settled = await Promise.allSettled(pair.map(({ player, two }) => {
      const picks = picksOf(two.draw, attempt);
      return store.photoSurveyRespond({ recoveryKey: player.recoveryKey, surveyId: SURVEY.id, answerId: sharedReceipt, pickIds: picks, championId: picks[0], round: 2 });
    }));
    assert.deepEqual(settled.map((result) => result.status).sort(), ["fulfilled", "rejected"], `recibo disputado na rodada 2, tentativa ${attempt}`);
    const refused = settled.find((result) => result.status === "rejected").reason;
    assert.equal(refused.code, "PHOTO_SURVEY_RESPONSE_INVALID", refused.message);
    assert.equal(refused.status, 400);
    assert.equal(await receiptUses(sharedReceipt), 1);
  }
  // Um recibo de rodada 2 já gravado não serve para a rodada 1 de outra pessoa.
  const late = await newPlayer();
  const latePicks = picksOf((await store.photoSurveyDraw(late.recoveryKey, SURVEY.id)).draw, 0);
  await refusedWith(store.photoSurveyRespond({ recoveryKey: late.recoveryKey, surveyId: SURVEY.id, answerId: twoBody.answerId, pickIds: latePicks, championId: latePicks[0] }), 400, "PHOTO_SURVEY_RESPONSE_INVALID", "answer-id");
  assert.equal(await receiptUses(twoBody.answerId), 1);

  // As tabelas das rodadas são imutáveis como as da rodada 1.
  assert.ok((await roundRows()).every((total) => total > 0));
  for (const statement of [
    "UPDATE photo_survey_round_responses SET champion_id = 'outra'",
    "UPDATE photo_survey_round_responses SET round = round + 1",
    "DELETE FROM photo_survey_round_responses",
    "UPDATE photo_survey_round_draws SET shown_ids = ARRAY['x']",
    "DELETE FROM photo_survey_round_draws",
  ]) {
    await assert.rejects(audit.query(statement), /imutáveis/, statement);
  }
  // As restrições das tabelas: rodada a partir de 2 e resposta só com o sorteio da mesma rodada.
  const anyRound = (await audit.query("SELECT survey_id, player_id, round, shown_ids FROM photo_survey_round_draws ORDER BY round DESC LIMIT 1")).rows[0];
  await assert.rejects(audit.query(
    "INSERT INTO photo_survey_round_draws(survey_id, player_id, round, shown_ids, issued_at) VALUES($1, $2, 1, $3, now())",
    [anyRound.survey_id, anyRound.player_id, anyRound.shown_ids],
  ), /round_check/);
  await assert.rejects(audit.query(
    `INSERT INTO photo_survey_round_responses(survey_id, player_id, round, answer_id, shown_ids, pick_ids, champion_id, responded_at)
     VALUES($1, $2, $3, $4, $5, $5, 'x', now())`,
    [anyRound.survey_id, anyRound.player_id, anyRound.round + 50, randomUUID(), anyRound.shown_ids],
  ), /foreign key/);

  // Janela: fora dela não há rodada nova; a rodada aberta continua visível e não aceita resposta.
  const windowAnswered = await playerAtRoundTwo(ROUND_WINDOW.id);
  const windowDone = await newPlayer();
  const windowDoneDraw = await store.photoSurveyDraw(windowDone.recoveryKey, ROUND_WINDOW.id);
  const windowDonePicks = picksOf(windowDoneDraw.draw, 1);
  const windowDoneAnswer = await respond(windowDone, { pickIds: windowDonePicks, championId: windowDonePicks[0] }, ROUND_WINDOW.id);
  assert.equal(windowDoneAnswer.progress.canContinue, true);
  const windowRoundsBefore = await count("photo_survey_round_draws", `WHERE survey_id = '${ROUND_WINDOW.id}'`);
  now = new Date(ROUND_WINDOW.closesAt);
  for (const options of [{ next: true }, {}]) {
    const closedDone = await store.photoSurveyDraw(windowDone.recoveryKey, ROUND_WINDOW.id, options);
    assert.equal(closedDone.survey.status, "closed");
    assert.equal(closedDone.round, 1);
    assert.deepEqual(closedDone.response, windowDoneAnswer.response);
    assert.deepEqual(closedDone.progress, { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: false });
    assert.deepEqual(closedDone.lastAnswered, { round: 1, response: windowDoneAnswer.response });
  }
  const closedOpenRound = await nextRound(windowAnswered.player, ROUND_WINDOW.id);
  assert.deepEqual(closedOpenRound.draw, windowAnswered.two.draw, "quem tinha a rodada aberta continua vendo a mesma depois do fechamento");
  assert.equal(closedOpenRound.round, 2);
  assert.equal(closedOpenRound.response, null);
  assert.deepEqual(closedOpenRound.lastAnswered, { round: 1, response: windowAnswered.answered.response }, "a rodada deixada aberta no fechamento não esconde a última respondida");
  const windowPicks = picksOf(windowAnswered.two.draw, 0);
  await rejectsWith(respond(windowAnswered.player, { pickIds: windowPicks, championId: windowPicks[0], round: 2 }, ROUND_WINDOW.id), 409, "PHOTO_SURVEY_CLOSED");
  // A repetição da rodada já respondida continua valendo depois do fechamento.
  assert.equal((await respond(windowDone, { pickIds: windowDonePicks, championId: windowDonePicks[0], round: 1 }, ROUND_WINDOW.id)).status, "alreadyProcessed");
  assert.equal(await count("photo_survey_round_draws", `WHERE survey_id = '${ROUND_WINDOW.id}'`), windowRoundsBefore);
  assert.equal(await count("photo_survey_round_responses", `WHERE survey_id = '${ROUND_WINDOW.id}'`), 0);
  now = OPEN_INSTANT;

  // Quem responde todas as rodadas vê todos os confrontos, e a pesquisa fecha
  // para a pessoa. Os limites são os da simulação em shared/photo-survey.test.js.
  for (const [survey, limit] of [[SURVEY, 12], [CLOTHES, 9]]) {
    const total = totalPairCount(survey);
    const { player, rounds, progress } = await playToTheEnd(survey, limit);
    assert.deepEqual(progress, { answeredRounds: rounds.length, seenPairs: total, totalPairs: total, canContinue: false });
    const rowsAtTheEnd = await roundRows();
    for (const options of [{ next: true }, {}]) {
      const last = await store.photoSurveyDraw(player.recoveryKey, survey.id, options);
      assert.equal(last.round, rounds.length, "sem confronto por ver, next devolve a última rodada respondida");
      assert.deepEqual(last.response.pickIds, rounds.at(-1).pickIds);
      assert.deepEqual(last.progress, progress);
      assert.deepEqual(last.lastAnswered, { round: rounds.length, response: last.response });
    }
    assert.deepEqual(await roundRows(), rowsAtTheEnd);
    assert.deepEqual((await audit.query(
      "SELECT round FROM photo_survey_round_responses WHERE survey_id = $1 AND player_id = (SELECT player_id FROM photo_survey_round_draws WHERE survey_id = $1 AND shown_ids = $2 LIMIT 1) ORDER BY round",
      [survey.id, rounds.at(-1).shownIds],
    )).rows.map((row) => row.round), rounds.slice(1).map((_round, index) => index + 2));
  }

  // As rodadas de uma pesquisa não entram no progresso de outra, nem no de outra pessoa.
  assert.deepEqual((await store.photoSurveyDraw(alice.recoveryKey, SECOND.id)).progress, { answeredRounds: 0, seenPairs: 0, totalPairs: 190, canContinue: false });
  const lateSeen = await store.photoSurveyDraw(late.recoveryKey, SURVEY.id);
  assert.deepEqual(lateSeen.progress, { answeredRounds: 0, seenPairs: 0, totalPairs: 190, canContinue: false });
  assert.equal(lateSeen.lastAnswered, null, "a última respondida é da própria pessoa");

  // Todas as rodadas valem pela identidade. Quando o jogador ativo da conta
  // muda, as rodadas respondidas pelo anterior continuam valendo: a conta não
  // recomeça nem ganha uma segunda resposta para a mesma rodada.
  const subjectFour = `photo-survey-smoke-${randomUUID()}`;
  const seedFour = await newPlayer();
  const accountFour = await store.signInWithGoogle({
    identity: { subject: subjectFour, displayName: "Teste" }, currentToken: seedFour.recoveryKey, topicId: "eleicoes-2026",
  });
  const fourOne = await store.photoSurveyDraw(accountFour.sessionToken, SURVEY.id);
  const fourPicks = picksOf(fourOne.draw, 2);
  const fourAnswer = await store.photoSurveyRespond({
    recoveryKey: accountFour.sessionToken, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: fourPicks, championId: fourPicks[0],
  });
  const fourTwo = await store.photoSurveyDraw(accountFour.sessionToken, SURVEY.id, { next: true });
  const fourTwoPicks = picksOf(fourTwo.draw, 1);
  const fourTwoAnswer = await store.photoSurveyRespond({
    recoveryKey: accountFour.sessionToken, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: fourTwoPicks, championId: fourTwoPicks[0], round: 2,
  });
  const karen = await newPlayer();
  const karenDaily = await store.dailySession(karen.recoveryKey, "eleicoes-2026");
  await store.dailyVote({
    topicId: "eleicoes-2026", editionId: karenDaily.edition.id, slot: 1, winnerId: karenDaily.round.candidateIds[1],
    answerId: randomUUID(), recoveryKey: karen.recoveryKey, playerVersion: 0,
  });
  const karenLogin = await store.signInWithGoogle({
    identity: { subject: subjectFour, displayName: "Teste" }, currentToken: karen.recoveryKey, topicId: "eleicoes-2026",
  });
  assert.equal(karenLogin.merge.activeDaily, "anonymous");
  for (const token of [karenLogin.sessionToken, accountFour.sessionToken]) {
    const seen = await store.photoSurveyDraw(token, SURVEY.id);
    assert.equal(seen.round, 2);
    assert.deepEqual(seen.response, fourTwoAnswer.response, "as rodadas da conta valem para o jogador que passou a ser o ativo");
    assert.deepEqual(seen.progress, fourTwoAnswer.progress);
    assert.deepEqual(seen.lastAnswered, { round: 2, response: fourTwoAnswer.response });
    // A rodada 1 continua respondendo por ela.
    const replay = await store.photoSurveyRespond({
      recoveryKey: token, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: fourPicks, championId: fourPicks[0], round: 1,
    });
    assert.deepEqual(replay.response, fourAnswer.response);
    // A rodada 2 da conta não aceita outra escolha.
    const otherFour = picksOf(fourTwo.draw, 3);
    await assert.rejects(store.photoSurveyRespond({
      recoveryKey: token, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: otherFour, championId: otherFour[0], round: 2,
    }), (error) => error.status === 409 && error.code === "PHOTO_SURVEY_ALREADY_ANSWERED");
  }
  const roundsBeforeSwitch = await roundRows();
  const switchedTwo = await store.photoSurveyDraw(karenLogin.sessionToken, SURVEY.id, { next: true });
  assert.equal(switchedTwo.round, 3, "o jogador ativo novo continua de onde a conta parou");
  assert.equal(switchedTwo.response, null);
  assert.deepEqual(switchedTwo.lastAnswered, { round: 2, response: fourTwoAnswer.response });
  assert.deepEqual(await roundRows(), [roundsBeforeSwitch[0] + 1, roundsBeforeSwitch[1]]);

  // Um boot a mais, agora com rodadas gravadas: nada se perde e a rodada aberta continua lá.
  const roundRowsBefore = [await roundOneFingerprint(), await roundRows()];
  const rebooted = createTopicStore(connection, options);
  try {
    await rebooted.init();
    assert.deepEqual([await roundOneFingerprint(), await roundRows()], roundRowsBefore);
    assert.deepEqual(await rebooted.photoSurveyDraw(karenLogin.sessionToken, SURVEY.id), switchedTwo);
    assert.equal((await rebooted.photoSurveyDraw(alice.recoveryKey, SURVEY.id)).round, 3);
  } finally {
    await rebooted.close();
  }
  assert.equal(await count("schema_migrations", "WHERE id = '2026-11-26-photo-survey-rounds-v1'"), 1);

  console.log("Smoke da pesquisa por foto aprovado: sorteio estável e simultâneo, resposta única e idempotente, corrida de duas abas, respostas forjadas recusadas, janela, imutabilidade, jogo atual intacto, identidade Google, duas pesquisas independentes, a de roupas com as 16 cartas, a de famosos com 16 de 20 e segundo boot. Rodadas: subida num banco que só tinha a rodada 1, rodada nova só com next e uma por vez, resposta única e idempotente por rodada, última rodada respondida devolvida também com rodada aberta, corrida de duas abas na mesma rodada, recibo único entre rodadas e entre pessoas também em disputa simultânea, tabelas novas imutáveis, sem rodada nova fora da janela, todos os confrontos vistos até a pesquisa fechar para a pessoa e boot com rodadas gravadas.");
} finally {
  await audit.end();
  await store.close();
}
