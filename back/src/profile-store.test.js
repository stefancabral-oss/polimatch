import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PHOTO_SURVEYS, photoSurveyById } from "../../shared/photo-survey.js";
import { PROFILE_CONSENT_VERSION } from "../../shared/profile.js";
import { createPhotoSurveyMemoryDb } from "../test-support/photo-survey-memory-db.js";
import { createHttpApp } from "./http-app.js";
import { photoSurveyStore } from "./photo-survey-store.js";
import { checkProfileUpdate, profileStore } from "./profile-store.js";

// Resultado da pessoa e perfil (ICM 76, #354, decisão 0008): os stores de
// verdade sobre o banco em memória. O SQL de verdade e a disputa simultânea
// pelo mesmo nome são provados em back/scripts/profile-smoke.mjs.

const NOW = new Date("2026-11-26T15:00:00.000Z");
const LATER = new Date("2026-11-26T16:00:00.000Z");
const POLITICS = photoSurveyById("politica-2026-01");
const CELEBRITIES = photoSurveyById("famosos-01");
const CLOTHES = photoSurveyById("roupas-demo-01");
const CLOSED = Object.freeze({ ...POLITICS, id: "teste-fechada", opensAt: "2026-11-01T03:00:00.000Z", closesAt: "2026-11-02T03:00:00.000Z" });

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

function setup({ surveys = PHOTO_SURVEYS } = {}) {
  const db = createPhotoSurveyMemoryDb();
  const clock = { now: NOW };
  const common = { pool: db.pool, findPlayer: db.findPlayer, clock: () => clock.now, surveys };
  const store = {
    ...photoSurveyStore({ ...common, requireRegistration: db.requireRegistration, randomInt: seededRandomInt(76) }),
    ...profileStore({ ...common, hasRegistration: db.hasRegistration }),
  };
  return { db, clock, store };
}

const rejectsWith = (promise, status, code, current) => assert.rejects(promise, (error) => {
  assert.equal(error.code, code, error.message);
  assert.equal(error.status, status, error.message);
  if (current !== undefined) assert.deepEqual(error.current, current, error.message);
  return true;
});
const picksOf = (draw, offset = 0) => draw.groups.map((group, index) => group[(index + offset) % group.length]);

// Joga `count` rodadas respondidas e devolve o que foi gravado em cada uma.
async function play(store, player, surveyId, count, { offset = 0 } = {}) {
  const answers = [];
  for (let index = 0; index < count; index += 1) {
    // Sem rodada nenhuma, `next` emite a rodada 1; depois, a seguinte.
    const drawn = await store.photoSurveyDraw(player.key, surveyId, { next: true });
    const pickIds = picksOf(drawn.draw, offset + index);
    const championId = pickIds[(offset + index) % pickIds.length];
    const answered = await store.photoSurveyRespond({ recoveryKey: player.key, surveyId, answerId: randomUUID(), pickIds, championId, round: drawn.round });
    answers.push(answered.response);
  }
  return answers;
}

// A conta feita à mão, sem personalRanking: 1 ponto por vitória em tela, 3
// pela final; desempate por final, tela e ordem das cartas.
function expectedRanking(survey, answers) {
  const table = new Map();
  for (const { pickIds, championId } of answers) {
    for (const id of pickIds) {
      const entry = table.get(id) || { cardId: id, points: 0, finalWins: 0, screenWins: 0 };
      entry.points += 1;
      entry.screenWins += 1;
      table.set(id, entry);
    }
    const champion = table.get(championId);
    champion.points += 3;
    champion.finalWins += 1;
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.finalWins - a.finalWins || b.screenWins - a.screenWins
    || survey.cardIds.indexOf(a.cardId) - survey.cardIds.indexOf(b.cardId));
}

const writes = (db, from) => db.statements.slice(from).filter((sql) => /^(INSERT|UPDATE|DELETE)/.test(sql));
const enable = (store, player, extra = {}) => store.updateProfile({
  recoveryKey: player.key, enabled: true, handle: "ana_01", consentVersion: PROFILE_CONSENT_VERSION, ...extra,
});

// --- Resultado da pessoa ---

test("resultado sem rodada respondida: zero rodadas e ranking vazio, mesmo com rodada aberta, sem gravar nada", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  assert.deepEqual(await store.photoSurveyResult(ana.key, POLITICS.id), { surveyId: POLITICS.id, answeredRounds: 0, ranking: [] });
  await store.photoSurveyDraw(ana.key, POLITICS.id);
  const mark = db.statements.length;
  const counts = db.counts();
  assert.deepEqual(await store.photoSurveyResult(ana.key, POLITICS.id), { surveyId: POLITICS.id, answeredRounds: 0, ranking: [] });
  assert.deepEqual(db.counts(), counts);
  assert.deepEqual(writes(db, mark), [], "o resultado só lê");
});

test("resultado com rodadas conhecidas bate com a regra de pontos; a rodada aberta não entra", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const answers = await play(store, ana, POLITICS.id, 3, { offset: 1 });
  // Uma quarta rodada aberta, sem resposta.
  assert.equal((await store.photoSurveyDraw(ana.key, POLITICS.id, { next: true })).round, 4);
  const mark = db.statements.length;
  const result = await store.photoSurveyResult(ana.key, POLITICS.id);
  assert.deepEqual(Object.keys(result), ["surveyId", "answeredRounds", "ranking"]);
  assert.equal(result.answeredRounds, 3);
  assert.deepEqual(result.ranking, expectedRanking(POLITICS, answers));
  assert.ok(result.ranking.every((entry) => entry.points >= 1));
  // Cada rodada dá 4 vitórias de tela e uma final: 3 rodadas, 3 × (4 + 3) pontos.
  assert.equal(result.ranking.reduce((sum, entry) => sum + entry.points, 0), 21);
  assert.equal(result.ranking.reduce((sum, entry) => sum + entry.finalWins, 0), 3);
  assert.deepEqual(writes(db, mark), []);
  // O resultado de uma pesquisa não mistura as outras.
  assert.deepEqual(await store.photoSurveyResult(ana.key, CLOTHES.id), { surveyId: CLOTHES.id, answeredRounds: 0, ranking: [] });
});

test("resultado segue a identidade da decisão 0007: as rodadas do anônimo incorporado contam", async () => {
  const { db, store } = setup();
  const anonymous = db.addPlayer();
  const answers = await play(store, anonymous, POLITICS.id, 1);
  const account = db.addPlayer();
  db.link(anonymous, account);
  const more = await play(store, account, POLITICS.id, 1, { offset: 2 });
  // A rodada 1 do anônimo vale; a conta seguiu da rodada 2.
  const result = await store.photoSurveyResult(account.key, POLITICS.id);
  assert.equal(result.answeredRounds, 2);
  assert.deepEqual(result.ranking, expectedRanking(POLITICS, [...answers, ...more]));
});

test("resultado tem as recusas do sorteio e continua legível com a pesquisa fechada", async () => {
  const { db, store } = setup({ surveys: [...PHOTO_SURVEYS, CLOSED] });
  const ana = db.addPlayer();
  await rejectsWith(store.photoSurveyResult(ana.key, "nao-existe"), 404, "PHOTO_SURVEY_NOT_FOUND");
  await assert.rejects(store.photoSurveyResult("pms_desconhecida", POLITICS.id), (error) => error.status === 401);
  const bruno = db.addPlayer({ registered: false });
  await rejectsWith(store.photoSurveyResult(bruno.key, POLITICS.id), 403, "CPF_REGISTRATION_REQUIRED");
  const visitor = db.addPlayer({ registered: false, account: false });
  await rejectsWith(store.photoSurveyResult(visitor.key, POLITICS.id), 403, "CPF_REGISTRATION_REQUIRED");
  // Pesquisa fechada: sem sorteio novo, mas o resultado responde.
  assert.deepEqual(await store.photoSurveyResult(ana.key, CLOSED.id), { surveyId: CLOSED.id, answeredRounds: 0, ranking: [] });
  // Conta que perde o cadastro deixa de ler o próprio resultado, como o sorteio.
  await play(store, ana, POLITICS.id, 1);
  db.unregister(ana);
  await rejectsWith(store.photoSurveyResult(ana.key, POLITICS.id), 403, "CPF_REGISTRATION_REQUIRED");
});

// --- Conferência do corpo do PUT, sem banco ---

test("o corpo do PUT: enabled booleano, nome válido, pesquisas conhecidas sem repetição, aceite atual", () => {
  const refuses = (body, code, reason) => assert.throws(() => checkProfileUpdate(body), (error) => {
    assert.equal(error.code, code, JSON.stringify(body));
    assert.equal(error.status, 400);
    if (reason) assert.deepEqual(error.current, { reason });
    return true;
  });
  for (const enabled of [undefined, null, "true", 1, 0]) refuses({ enabled }, "PROFILE_INVALID", "enabled");
  const on = { enabled: true, consentVersion: PROFILE_CONSENT_VERSION };
  for (const handle of ["ab", "a".repeat(21), "ana-01", "anã", "ana 01", "admin", "PoliMatch", " api ", "", null, 12345, ["ana_01"]]) {
    refuses({ ...on, handle }, "PROFILE_INVALID", "handle");
  }
  for (const surveys of [null, "politica-2026-01", [1], ["nao-existe"], [POLITICS.id, "nao-existe"], {}]) {
    refuses({ ...on, handle: "ana_01", surveys }, "PROFILE_INVALID", "surveys");
    refuses({ enabled: false, surveys }, "PROFILE_INVALID", "surveys");
  }
  for (const consentVersion of [undefined, "", "2026-11-25", true]) refuses({ enabled: true, handle: "ana_01", consentVersion }, "PROFILE_CONSENT_REQUIRED");
  assert.deepEqual(checkProfileUpdate({ ...on, handle: "  Ana_01 ", surveys: [CLOTHES.id, POLITICS.id, CLOTHES.id] }), {
    enabled: true, handle: "ana_01", surveys: [CLOTHES.id, POLITICS.id], consentVersion: PROFILE_CONSENT_VERSION,
  });
  // Desligar não exige nada: nome e aceite são ignorados, mesmo inválidos.
  assert.deepEqual(checkProfileUpdate({ enabled: false, handle: "x", consentVersion: "velha" }), { enabled: false, surveys: undefined });
  assert.deepEqual(checkProfileUpdate({ enabled: false, surveys: [] }), { enabled: false, surveys: [] });
});

// --- Meu perfil ---

test("o perfil nasce desligado; a vista da pessoa traz a primeira colocada de toda pesquisa respondida", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const mark = db.statements.length;
  assert.deepEqual(await store.myProfile(ana.key), {
    enabled: false, handle: null, consentVersion: null, consentedAt: null, surveys: [], firstPlaces: [], canEnable: true,
  });
  assert.deepEqual(writes(db, mark), [], "ler o perfil não cria linha");
  const clothes = await play(store, ana, CLOTHES.id, 2);
  const politics = await play(store, ana, POLITICS.id, 1, { offset: 3 });
  // Pesquisa só sorteada, sem resposta, não entra.
  await store.photoSurveyDraw(ana.key, CELEBRITIES.id);
  const view = await store.myProfile(ana.key);
  assert.deepEqual(view.firstPlaces, [
    { surveyId: POLITICS.id, cardId: expectedRanking(POLITICS, politics)[0].cardId },
    { surveyId: CLOTHES.id, cardId: expectedRanking(CLOTHES, clothes)[0].cardId },
  ], "na ordem das pesquisas, marcadas ou não");
  assert.equal(view.enabled, false);
});

test("ler o próprio perfil: conta sem cadastro lê com canEnable falso; visitante sem conta é recusado", async () => {
  const { db, store } = setup();
  const bruno = db.addPlayer({ registered: false });
  assert.equal((await store.myProfile(bruno.key)).canEnable, false);
  const visitor = db.addPlayer({ registered: false, account: false });
  await rejectsWith(store.myProfile(visitor.key), 403, "GOOGLE_ACCOUNT_REQUIRED");
  await assert.rejects(store.myProfile("pms_desconhecida"), (error) => error.status === 401);
});

test("ligar exige cadastro, nome e o aceite atual; recusa não grava nada", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const bruno = db.addPlayer({ registered: false });
  const visitor = db.addPlayer({ registered: false, account: false });
  await rejectsWith(enable(store, bruno), 403, "CPF_REGISTRATION_REQUIRED");
  await rejectsWith(enable(store, visitor), 403, "CPF_REGISTRATION_REQUIRED");
  // Visitante sem conta Google não tem perfil: nem desligar ele pode.
  await rejectsWith(store.updateProfile({ recoveryKey: visitor.key, enabled: false }), 403, "CPF_REGISTRATION_REQUIRED");
  await rejectsWith(enable(store, ana, { consentVersion: undefined }), 400, "PROFILE_CONSENT_REQUIRED");
  await rejectsWith(enable(store, ana, { consentVersion: "2026-01-01" }), 400, "PROFILE_CONSENT_REQUIRED");
  await rejectsWith(enable(store, ana, { handle: undefined }), 400, "PROFILE_INVALID", { reason: "handle" });
  await rejectsWith(enable(store, ana, { handle: "suporte" }), 400, "PROFILE_INVALID", { reason: "handle" });
  await rejectsWith(enable(store, ana, { surveys: ["nao-existe"] }), 400, "PROFILE_INVALID", { reason: "surveys" });
  assert.deepEqual(db.profileCounts(), { settings: 0, surveys: 0 });
});

test("ligar grava o nome em minúsculas, o aceite e a data; marcações sem repetição, na ordem das pesquisas", async () => {
  const { db, store, clock } = setup();
  const ana = db.addPlayer();
  const on = await enable(store, ana, { handle: "Ana_01", surveys: [CLOTHES.id, POLITICS.id, CLOTHES.id] });
  assert.deepEqual(on, {
    enabled: true, handle: "ana_01", consentVersion: PROFILE_CONSENT_VERSION, consentedAt: NOW.toISOString(),
    surveys: [POLITICS.id, CLOTHES.id], firstPlaces: [], canEnable: true,
  });
  assert.deepEqual(await store.myProfile(ana.key), on);
  assert.deepEqual(db.profileCounts(), { settings: 1, surveys: 2 });
  // Mexer nas marcações com o perfil ligado mantém a data do aceite.
  clock.now = LATER;
  const changed = await enable(store, ana, { handle: undefined, surveys: [CELEBRITIES.id] });
  assert.equal(changed.handle, "ana_01", "sem nome no pedido, vale o atual");
  assert.equal(changed.consentedAt, NOW.toISOString());
  assert.deepEqual(changed.surveys, [CELEBRITIES.id]);
  // Sem `surveys`, as marcações ficam como estão.
  assert.deepEqual((await enable(store, ana)).surveys, [CELEBRITIES.id]);
});

test("desligar vale na hora, não exige nada e guarda nome, aceite e marcações; religar grava data nova", async () => {
  const { db, store, clock } = setup();
  const ana = db.addPlayer();
  await play(store, ana, POLITICS.id, 1);
  await enable(store, ana, { surveys: [POLITICS.id] });
  assert.equal((await store.publicProfile("ana_01")).surveys.length, 1);
  const off = await store.updateProfile({ recoveryKey: ana.key, enabled: false, handle: "!!", consentVersion: "velha" });
  assert.deepEqual([off.enabled, off.handle, off.consentVersion, off.consentedAt, off.surveys], [false, "ana_01", PROFILE_CONSENT_VERSION, NOW.toISOString(), [POLITICS.id]]);
  await rejectsWith(store.publicProfile("ana_01"), 404, "PROFILE_NOT_FOUND");
  // Desligado, mexer nas marcações continua possível.
  assert.deepEqual((await store.updateProfile({ recoveryKey: ana.key, enabled: false, surveys: [] })).surveys, []);
  clock.now = LATER;
  const again = await enable(store, ana, { handle: undefined, surveys: [POLITICS.id] });
  assert.equal(again.consentedAt, LATER.toISOString(), "religar é um aceite novo");
  assert.equal((await store.publicProfile("ANA_01")).handle, "ana_01");
});

test("sem cadastro o pedido só desliga: a conta que perdeu o cadastro desliga, o perfil público some e as marcações ficam", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  await play(store, ana, POLITICS.id, 1);
  await enable(store, ana, { surveys: [POLITICS.id] });
  assert.equal((await store.publicProfile("ana_01")).surveys.length, 1);
  db.unregister(ana);
  // Sem cadastro, ligar de novo é recusado e nada muda.
  let mark = db.statements.length;
  await rejectsWith(enable(store, ana), 403, "CPF_REGISTRATION_REQUIRED");
  // Sem cadastro, mandar marcações é recusado, mesmo desligando, e nada é gravado.
  await rejectsWith(store.updateProfile({ recoveryKey: ana.key, enabled: false, surveys: [] }), 403, "CPF_REGISTRATION_REQUIRED");
  await rejectsWith(store.updateProfile({ recoveryKey: ana.key, enabled: false, surveys: [CLOTHES.id] }), 403, "CPF_REGISTRATION_REQUIRED");
  assert.deepEqual(writes(db, mark), []);
  assert.equal((await store.publicProfile("ana_01")).handle, "ana_01");
  // Desligar funciona, vale na hora e não mexe nas marcações.
  const off = await store.updateProfile({ recoveryKey: ana.key, enabled: false });
  assert.deepEqual([off.enabled, off.handle, off.canEnable, off.surveys], [false, "ana_01", false, [POLITICS.id]]);
  await rejectsWith(store.publicProfile("ana_01"), 404, "PROFILE_NOT_FOUND");
  // Já desligado, desligar de novo não grava nada.
  mark = db.statements.length;
  assert.equal((await store.updateProfile({ recoveryKey: ana.key, enabled: false })).enabled, false);
  assert.deepEqual(writes(db, mark), []);
  // Conta sem cadastro que nunca ligou: responde o perfil desligado sem criar linha.
  const counts = db.profileCounts();
  const bruno = db.addPlayer({ registered: false });
  mark = db.statements.length;
  const brunoOff = await store.updateProfile({ recoveryKey: bruno.key, enabled: false });
  assert.deepEqual([brunoOff.enabled, brunoOff.handle, brunoOff.surveys, brunoOff.canEnable], [false, null, [], false]);
  await rejectsWith(store.updateProfile({ recoveryKey: bruno.key, enabled: false, surveys: [POLITICS.id] }), 403, "CPF_REGISTRATION_REQUIRED");
  assert.deepEqual(writes(db, mark), []);
  assert.deepEqual(db.profileCounts(), counts);
  // Visitante sem conta Google é recusado ao desligar, e nada é gravado para ele.
  const visitor = db.addPlayer({ registered: false, account: false });
  await rejectsWith(store.updateProfile({ recoveryKey: visitor.key, enabled: false }), 403, "CPF_REGISTRATION_REQUIRED");
  assert.deepEqual(db.profileCounts(), counts);
});

test("perfil público: só pesquisas marcadas com rodada respondida, na ordem das pesquisas, com assunto e pergunta", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const clothes = await play(store, ana, CLOTHES.id, 2, { offset: 1 });
  const politics = await play(store, ana, POLITICS.id, 1);
  await play(store, ana, PHOTO_SURVEYS[1].id, 1);
  // Famosos marcada sem rodada respondida; política 2 respondida e não marcada.
  await store.photoSurveyDraw(ana.key, CELEBRITIES.id);
  await enable(store, ana, { surveys: [CLOTHES.id, CELEBRITIES.id, POLITICS.id] });
  const mark = db.statements.length;
  const shown = await store.publicProfile("ana_01");
  assert.deepEqual(shown, {
    handle: "ana_01",
    surveys: [
      { surveyId: POLITICS.id, subject: POLITICS.subject, question: POLITICS.question, cardId: expectedRanking(POLITICS, politics)[0].cardId },
      { surveyId: CLOTHES.id, subject: CLOTHES.subject, question: CLOTHES.question, cardId: expectedRanking(CLOTHES, clothes)[0].cardId },
    ],
  });
  assert.deepEqual(writes(db, mark), [], "o perfil público só lê");
  // O primeiro lugar é o resultado de agora: acompanha as rodadas novas.
  const politicsMore = await play(store, ana, POLITICS.id, 3, { offset: 2 });
  assert.equal((await store.publicProfile("ana_01")).surveys[0].cardId, expectedRanking(POLITICS, [...politics, ...politicsMore])[0].cardId);
});

test("perfil desligado, inexistente e nome inválido têm a mesma recusa", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  await enable(store, ana);
  await store.updateProfile({ recoveryKey: ana.key, enabled: false });
  const bruno = db.addPlayer();
  // Perfil que nunca foi ligado, só com marcações.
  await store.updateProfile({ recoveryKey: bruno.key, enabled: false, surveys: [POLITICS.id] });
  const refusals = [];
  for (const handle of ["ana_01", "ninguem_aqui", "ab", "admin", "", "../x"]) {
    await assert.rejects(store.publicProfile(handle), (error) => {
      refusals.push({ status: error.status, code: error.code, message: error.message, current: error.current });
      return true;
    });
  }
  assert.ok(refusals.every((refusal) => JSON.stringify(refusal) === JSON.stringify(refusals[0])), JSON.stringify(refusals));
  assert.deepEqual(refusals[0], { status: 404, code: "PROFILE_NOT_FOUND", message: "perfil não encontrado", current: undefined });
});

test("nome de perfil é único sem diferença de caixa; o nome gravado não muda e o link continua da mesma pessoa", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const bruno = db.addPlayer();
  await play(store, ana, POLITICS.id, 1);
  await enable(store, ana, { handle: "ana_01", surveys: [POLITICS.id] });
  const shown = await store.publicProfile("ana_01");
  await rejectsWith(enable(store, bruno, { handle: "ANA_01" }), 409, "PROFILE_HANDLE_TAKEN");
  // Ligado, trocar de nome é recusado e nada muda.
  const before = await store.myProfile(ana.key);
  await rejectsWith(enable(store, ana, { handle: "ana_02" }), 400, "PROFILE_INVALID", { reason: "handle-locked" });
  assert.deepEqual(await store.myProfile(ana.key), before);
  // O mesmo nome, em outra caixa, não é troca.
  assert.equal((await enable(store, ana, { handle: "ANA_01" })).handle, "ana_01");
  // Desligado, o nome continua da conta e continua travado.
  await store.updateProfile({ recoveryKey: ana.key, enabled: false });
  await rejectsWith(enable(store, bruno, { handle: "ana_01" }), 409, "PROFILE_HANDLE_TAKEN");
  await rejectsWith(enable(store, ana, { handle: "ana_02" }), 400, "PROFILE_INVALID", { reason: "handle-locked" });
  await rejectsWith(store.publicProfile("ana_02"), 404, "PROFILE_NOT_FOUND");
  // Religada, o link do nome original mostra a mesma pessoa.
  await enable(store, ana, { handle: undefined });
  assert.deepEqual(await store.publicProfile("ana_01"), shown);
  await rejectsWith(store.publicProfile("ana_02"), 404, "PROFILE_NOT_FOUND");
  // O nome travado de uma conta não afeta o nome livre de outra.
  assert.equal((await enable(store, bruno, { handle: "ana_02" })).handle, "ana_02");
});

test("outra conta grava o mesmo nome entre a conferência e a gravação: 409, não 500, e nada muda", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const bruno = db.addPlayer();
  // Bruno ainda não tem nome gravado (só marcações), então pode escolher um.
  await store.updateProfile({ recoveryKey: bruno.key, enabled: false, surveys: [POLITICS.id] });
  const before = await store.myProfile(bruno.key);
  assert.equal(before.handle, null);
  db.onProfileUpsert((tables) => {
    tables.profileSettings.push({ provider: "google", subject: ana.subject, handle: "disputado", enabled: true, consent_version: PROFILE_CONSENT_VERSION, consented_at: NOW, updated_at: NOW });
  });
  await rejectsWith(enable(store, bruno, { handle: "disputado", surveys: [] }), 409, "PROFILE_HANDLE_TAKEN");
  assert.deepEqual(await store.myProfile(bruno.key), before, "a recusa desfaz a transação inteira");
});

test("o perfil é da conta: quando o jogador ativo muda, ele acompanha", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  await play(store, ana, POLITICS.id, 1);
  await enable(store, ana, { surveys: [POLITICS.id] });
  const shown = await store.publicProfile("ana_01");
  const other = db.addPlayer({ account: false });
  db.moveAccount(ana, other);
  assert.deepEqual(await store.publicProfile("ana_01"), shown, "as rodadas do jogador anterior continuam valendo");
  assert.equal((await store.myProfile(other.key)).handle, "ana_01");
});

// --- Rotas ---

async function withApp(store, env, run) {
  const app = createHttpApp({
    store: { health: async () => {}, ...store },
    googleIdentity: { configured: false, verify: async () => ({ subject: "test" }) },
    env,
    clock: () => NOW,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

const call = async (url, { method = "GET", key, payload } = {}) => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const { requestId, ...body } = await response.json();
  return { status: response.status, cache: response.headers.get("cache-control"), robots: response.headers.get("x-robots-tag"), body, requestId };
};

test("as quatro rotas seguem PHOTO_SURVEYS_ENABLED e nada chega ao store desligado", async () => {
  const calls = [];
  const spy = new Proxy({}, { get: (_target, name) => async (...args) => { calls.push(name); return {}; } });
  await withApp({ photoSurveyResult: spy.photoSurveyResult, myProfile: spy.myProfile, updateProfile: spy.updateProfile, publicProfile: spy.publicProfile }, {}, async (base) => {
    for (const [method, path] of [["GET", "/api/photo-surveys/politica-2026-01/result"], ["GET", "/api/me/profile"], ["PUT", "/api/me/profile"], ["GET", "/api/profiles/ana_01"]]) {
      const response = await call(`${base}${path}`, { method, key: "pms_x", payload: method === "PUT" ? { enabled: false } : undefined });
      assert.deepEqual([response.status, response.body.code, response.cache], [404, "PHOTO_SURVEYS_DISABLED", "no-store"], path);
    }
  });
  assert.deepEqual(calls, []);
});

test("pelas rotas: sessão exigida, corpo do PUT só com os quatro campos, respostas e recusas sem cache", async () => {
  const { db, store } = setup();
  const ana = db.addPlayer();
  const answers = await play(store, ana, POLITICS.id, 2);
  const seen = [];
  const spied = { ...store, updateProfile: (args) => { seen.push(args); return store.updateProfile(args); } };
  await withApp(spied, { PHOTO_SURVEYS_ENABLED: "true" }, async (base) => {
    for (const [method, path] of [["GET", `/api/photo-surveys/${POLITICS.id}/result`], ["GET", "/api/me/profile"], ["PUT", "/api/me/profile"]]) {
      const response = await call(`${base}${path}`, { method, payload: method === "PUT" ? { enabled: false } : undefined });
      assert.deepEqual([response.status, response.body.code, response.cache], [401, "PLAYER_SESSION_REQUIRED", "no-store"], path);
    }
    assert.deepEqual(seen, []);

    const result = await call(`${base}/api/photo-surveys/${POLITICS.id}/result`, { key: ana.key });
    assert.deepEqual([result.status, result.cache], [200, "no-store"]);
    assert.deepEqual(result.body, { surveyId: POLITICS.id, answeredRounds: 2, ranking: expectedRanking(POLITICS, answers) });
    const missing = await call(`${base}/api/photo-surveys/nao-existe/result`, { key: ana.key });
    assert.deepEqual([missing.status, missing.body.code, missing.cache], [404, "PHOTO_SURVEY_NOT_FOUND", "no-store"]);
    const noRegistration = db.addPlayer({ registered: false });
    const notRegistered = await call(`${base}/api/photo-surveys/${POLITICS.id}/result`, { key: noRegistration.key });
    assert.deepEqual([notRegistered.status, notRegistered.body.code, notRegistered.cache], [403, "CPF_REGISTRATION_REQUIRED", "no-store"]);

    const mine = await call(`${base}/api/me/profile`, { key: ana.key });
    assert.deepEqual([mine.status, mine.cache, mine.body.enabled, mine.body.firstPlaces.length], [200, "no-store", false, 1]);

    const refused = await call(`${base}/api/me/profile`, { method: "PUT", key: ana.key, payload: { enabled: true, handle: "ana_01" } });
    assert.deepEqual([refused.status, refused.body.code, refused.cache], [400, "PROFILE_CONSENT_REQUIRED", "no-store"]);
    const invalid = await call(`${base}/api/me/profile`, { method: "PUT", key: ana.key, payload: { enabled: "sim" } });
    assert.deepEqual([invalid.status, invalid.body.code, invalid.body.current, invalid.cache], [400, "PROFILE_INVALID", { reason: "enabled" }, "no-store"]);

    seen.length = 0;
    const on = await call(`${base}/api/me/profile`, {
      method: "PUT",
      key: ana.key,
      payload: { enabled: true, handle: "Ana_01", consentVersion: PROFILE_CONSENT_VERSION, surveys: [POLITICS.id], subject: "outra-conta", recoveryKey: "pms_outra", now: "2000-01-01" },
    });
    assert.deepEqual([on.status, on.cache, on.body.enabled, on.body.handle, on.body.consentedAt], [200, "no-store", true, "ana_01", NOW.toISOString()]);
    assert.deepEqual(seen, [{ recoveryKey: ana.key, enabled: true, handle: "Ana_01", surveys: [POLITICS.id], consentVersion: PROFILE_CONSENT_VERSION, now: NOW }]);

    // Pública, sem sessão.
    const shown = await call(`${base}/api/profiles/Ana_01`);
    assert.deepEqual([shown.status, shown.cache, shown.robots], [200, "no-store", "noindex"]);
    assert.deepEqual(shown.body, {
      handle: "ana_01",
      surveys: [{ surveyId: POLITICS.id, subject: POLITICS.subject, question: POLITICS.question, cardId: expectedRanking(POLITICS, answers)[0].cardId }],
    });

    const bruno = db.addPlayer();
    const taken = await call(`${base}/api/me/profile`, { method: "PUT", key: bruno.key, payload: { enabled: true, handle: "ANA_01", consentVersion: PROFILE_CONSENT_VERSION } });
    assert.deepEqual([taken.status, taken.body.code, taken.cache], [409, "PROFILE_HANDLE_TAKEN", "no-store"]);
    const locked = await call(`${base}/api/me/profile`, { method: "PUT", key: ana.key, payload: { enabled: true, handle: "ana_02", consentVersion: PROFILE_CONSENT_VERSION } });
    assert.deepEqual([locked.status, locked.body.code, locked.body.current, locked.cache], [400, "PROFILE_INVALID", { reason: "handle-locked" }, "no-store"]);
    const unregistered = db.addPlayer({ registered: false });
    const forbidden = await call(`${base}/api/me/profile`, { method: "PUT", key: unregistered.key, payload: { enabled: true, handle: "sem_cad", consentVersion: PROFILE_CONSENT_VERSION } });
    assert.deepEqual([forbidden.status, forbidden.body.code, forbidden.cache], [403, "CPF_REGISTRATION_REQUIRED", "no-store"]);
    // Sem cadastro o pedido só desliga: sem linha, responde desligado e nada grava.
    const countsBefore = db.profileCounts();
    const offWithout = await call(`${base}/api/me/profile`, { method: "PUT", key: unregistered.key, payload: { enabled: false } });
    assert.deepEqual([offWithout.status, offWithout.cache, offWithout.body.enabled, offWithout.body.canEnable], [200, "no-store", false, false]);
    const marksWithout = await call(`${base}/api/me/profile`, { method: "PUT", key: unregistered.key, payload: { enabled: false, surveys: [POLITICS.id] } });
    assert.deepEqual([marksWithout.status, marksWithout.body.code, marksWithout.cache], [403, "CPF_REGISTRATION_REQUIRED", "no-store"]);
    assert.deepEqual(db.profileCounts(), countsBefore, "conta sem cadastro não grava linha nem marcação");
    const visitor = db.addPlayer({ registered: false, account: false });
    const visitorOff = await call(`${base}/api/me/profile`, { method: "PUT", key: visitor.key, payload: { enabled: false } });
    assert.deepEqual([visitorOff.status, visitorOff.body.code, visitorOff.cache], [403, "CPF_REGISTRATION_REQUIRED", "no-store"]);

    // Desligado e inexistente: corpo, status e cabeçalho iguais.
    await call(`${base}/api/me/profile`, { method: "PUT", key: ana.key, payload: { enabled: false } });
    const off = await call(`${base}/api/profiles/ana_01`);
    const none = await call(`${base}/api/profiles/ninguem_aqui`);
    const bad = await call(`${base}/api/profiles/a`);
    for (const refusal of [off, none, bad]) {
      assert.deepEqual({ status: refusal.status, cache: refusal.cache, robots: refusal.robots, body: refusal.body }, {
        status: 404, cache: "no-store", robots: "noindex", body: { error: "perfil não encontrado", code: "PROFILE_NOT_FOUND" },
      });
    }
  });
});
