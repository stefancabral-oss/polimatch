import assert from "node:assert/strict";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import pg from "pg";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { CONSENT_VERSION, isValidCpf } from "../../shared/registration.js";
import { createApprovedTestRegistry } from "../test-support/editorial-fixtures.js";
import { REGISTRATION_ATTEMPTS_PER_DAY, cpfPseudonym } from "../src/registration-store.js";
import { createTopicStore } from "../src/topic-store.js";
import { requireDisposableDatabase } from "../test-support/disposable-db.js";

// Cadastro com CPF (ICM 71, #336) contra um PostgreSQL de verdade. Roda só no
// banco descartável do workflow de integração. O store é criado como o
// servidor cria: com a exigência do cadastro ligada.
const connection = requireDisposableDatabase();

const SURVEY = PHOTO_SURVEYS[0];
const SECRET = "segredo-do-smoke-de-cadastro-com-mais-de-32-caracteres";
// Um dia que nenhum outro smoke usa.
const DAY_ONE = new Date("2034-06-12T15:00:00.000Z");
let now = DAY_ONE;
const options = {
  candidateRegistry: createApprovedTestRegistry(CATALOG.map((person) => person.id)),
  clock: () => now,
  photoSurveys: PHOTO_SURVEYS,
};
const store = createTopicStore(connection, options);
// Só para montar o que existia antes da exigência: respostas de quem não tinha conta.
const legacy = createTopicStore(connection, { ...options, requirePhotoSurveyRegistration: async () => {} });
const audit = new pg.Pool({ connectionString: connection });
await store.init();

const rejectsWith = (promise, status, code) => assert.rejects(promise, (error) => {
  assert.equal(error.code, code, error.message);
  assert.equal(error.status, status, error.message);
  return true;
});
const count = async (table, where = "", values = []) => Number((await audit.query(`SELECT count(*) AS total FROM ${table} ${where}`, values)).rows[0].total);
const surveyRows = async () => [await count("photo_survey_draws"), await count("photo_survey_responses")];
const picksOf = (draw, offset = 0) => draw.groups.map((group, index) => group[(index + offset) % group.length]);

// CPFs válidos e novos a cada execução, por uma conta separada da de shared/.
const usedCpfs = [];
function newCpf() {
  for (;;) {
    const base = Array.from({ length: 9 }, () => randomInt(10));
    const digit = (digits, weight) => {
      const rest = (digits.reduce((sum, value, index) => sum + value * (weight - index), 0) * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    const first = digit(base, 10);
    const cpf = [...base, first, digit([...base, first], 11)].join("");
    if (!isValidCpf(cpf) || usedCpfs.includes(cpf)) continue;
    usedCpfs.push(cpf);
    return cpf;
  }
}
const hashOf = (cpf) => cpfPseudonym(cpf, SECRET);
const profile = { ageRange: "25-34", gender: "mulher", state: "SP", consentVersion: CONSENT_VERSION };
const register = (token, cpf, extra = {}) => store.registerCpf({ recoveryKey: token, cpfHash: hashOf(cpf), ...profile, ...extra });
const newAnonymous = () => store.createPlayer({ networkHash: randomBytes(32).toString("hex") });
const subjects = [];
async function newAccount(currentToken = "") {
  const subject = `cpf-smoke-${randomUUID()}`;
  subjects.push(subject);
  const login = await store.signInWithGoogle({ identity: { subject, displayName: "Teste" }, currentToken, topicId: "eleicoes-2026" });
  return { subject, token: login.sessionToken, login };
}
const signIn = (subject, currentToken = "") => store.signInWithGoogle({ identity: { subject, displayName: "Teste" }, currentToken, topicId: "eleicoes-2026" });
const attemptsOf = async (subject) => Number((await audit.query(
  "SELECT coalesce(sum(used), 0) AS used FROM cpf_registration_attempts WHERE subject = $1",
  [subject],
)).rows[0].used);
const respond = (token, body, surveyId = SURVEY.id) => store.photoSurveyRespond({ recoveryKey: token, surveyId, answerId: randomUUID(), ...body });

try {
  assert.equal(await count("schema_migrations", "WHERE id = '2026-11-16-cpf-registration-v1'"), 1);

  // --- Sem cadastro não há sorteio nem resposta, e nada é gravado ---
  const visitor = await newAnonymous();
  const ana = await newAccount();
  const rowsBefore = await surveyRows();
  for (const token of [visitor.recoveryKey, ana.token]) {
    await rejectsWith(store.photoSurveyDraw(token, SURVEY.id), 403, "CPF_REGISTRATION_REQUIRED");
    await rejectsWith(respond(token, { pickIds: ["a", "b", "c", "d"], championId: "a" }), 403, "CPF_REGISTRATION_REQUIRED");
  }
  assert.deepEqual(await surveyRows(), rowsBefore, "a recusa não emite sorteio nem grava resposta");
  await rejectsWith(store.photoSurveyDraw("pm2_chave-que-nao-existe", SURVEY.id), 401, undefined);
  // A definição pública continua aberta a qualquer visitante.
  assert.equal((await store.photoSurvey(SURVEY.id)).id, SURVEY.id);

  // --- O cadastro só vale para conta Google ---
  const registrationsBefore = await count("cpf_registrations");
  await rejectsWith(register(visitor.recoveryKey, newCpf()), 403, "GOOGLE_ACCOUNT_REQUIRED");
  await rejectsWith(register("pms_sessao-que-nao-existe", newCpf()), 401, undefined);
  assert.equal(await count("cpf_registrations"), registrationsBefore);

  // --- Pedido malformado chega ao store: recusado antes de qualquer gravação ---
  for (const cpfHash of [undefined, "", "abc", usedCpfs[0], hashOf(usedCpfs[0]).toUpperCase(), `${hashOf(usedCpfs[0])}0`]) {
    await rejectsWith(store.registerCpf({ recoveryKey: ana.token, cpfHash, ...profile }), 400, "CPF_INVALID");
  }
  for (const change of [{ ageRange: "0-15" }, { gender: "x" }, { state: "sp" }, { state: "XX" }, { consentVersion: "" }, { consentVersion: undefined }]) {
    await rejectsWith(register(ana.token, usedCpfs[0], change), 400, "REGISTRATION_INVALID");
  }
  assert.equal(await count("cpf_registrations"), registrationsBefore);
  assert.equal(await attemptsOf(ana.subject), 0, "pedido malformado não conta tentativa");

  // --- Cadastro: grava o código, nunca o número ---
  const anaCpf = newCpf();
  const created = await register(ana.token, anaCpf);
  assert.deepEqual(created, { status: "created", registeredAt: DAY_ONE.toISOString() });
  const row = (await audit.query("SELECT * FROM cpf_registrations WHERE subject = $1", [ana.subject])).rows[0];
  assert.equal(row.provider, "google");
  assert.equal(row.cpf_hmac, hashOf(anaCpf));
  assert.equal(row.age_range, "25-34");
  assert.equal(row.gender, "mulher");
  assert.equal(row.state, "SP");
  assert.equal(row.consent_version, CONSENT_VERSION);
  assert.equal(new Date(row.consented_at).toISOString(), DAY_ONE.toISOString());
  assert.deepEqual(Object.keys(row).sort(), ["age_range", "consent_version", "consented_at", "cpf_hmac", "gender", "provider", "registered_at", "state", "subject"]);
  assert.equal(await attemptsOf(ana.subject), 1);

  // --- A mesma conta: o mesmo CPF repete sem gravar; outro CPF é recusado ---
  now = new Date(DAY_ONE.getTime() + 60_000);
  assert.deepEqual(await register(ana.token, anaCpf), { status: "alreadyRegistered", registeredAt: DAY_ONE.toISOString() });
  await rejectsWith(register(ana.token, newCpf()), 409, "REGISTRATION_EXISTS");
  assert.equal(await count("cpf_registrations", "WHERE subject = $1", [ana.subject]), 1);
  assert.equal(await attemptsOf(ana.subject), 1, "quem já tem cadastro não gasta tentativa");
  now = DAY_ONE;

  // --- Com cadastro, o percurso da pesquisa passa inteiro ---
  const anaDraw = await store.photoSurveyDraw(ana.token, SURVEY.id);
  assert.equal(anaDraw.response, null);
  assert.equal(anaDraw.draw.groups.length, 4);
  const anaPicks = picksOf(anaDraw.draw, 1);
  const anaAnswer = await respond(ana.token, { pickIds: anaPicks, championId: anaPicks[2] });
  assert.equal(anaAnswer.status, "created");
  assert.deepEqual((await store.photoSurveyDraw(ana.token, SURVEY.id)).response, anaAnswer.response);
  await rejectsWith(respond(ana.token, { pickIds: picksOf(anaDraw.draw, 2), championId: picksOf(anaDraw.draw, 2)[0] }), 409, "PHOTO_SURVEY_ALREADY_ANSWERED");
  // Outra sessão da mesma conta, em outro aparelho, já entra cadastrada.
  const anaOtherDevice = await signIn(ana.subject);
  assert.deepEqual((await store.photoSurveyDraw(anaOtherDevice.sessionToken, SURVEY.id)).response, anaAnswer.response);

  // --- Um CPF, uma conta ---
  const bruno = await newAccount();
  await rejectsWith(register(bruno.token, anaCpf), 409, "CPF_ALREADY_REGISTERED");
  assert.equal(await count("cpf_registrations", "WHERE subject = $1", [bruno.subject]), 0);
  assert.equal(await attemptsOf(bruno.subject), 1, "a tentativa recusada fica contada");
  await rejectsWith(store.photoSurveyDraw(bruno.token, SURVEY.id), 403, "CPF_REGISTRATION_REQUIRED");
  // O perfil diferente não muda nada: quem decide é o CPF.
  await rejectsWith(register(bruno.token, anaCpf, { ageRange: "60+", gender: "homem", state: "RJ" }), 409, "CPF_ALREADY_REGISTERED");
  assert.equal((await register(bruno.token, newCpf(), { ageRange: "60+", gender: "nao-informado", state: "AC" })).status, "created");
  assert.equal((await store.photoSurveyDraw(bruno.token, SURVEY.id)).response, null);

  // --- Duas contas disputam o mesmo CPF ao mesmo tempo: uma grava, a outra recebe 409, nunca 500 ---
  for (let round = 0; round < 6; round += 1) {
    const pair = [await newAccount(), await newAccount()];
    const disputed = newCpf();
    const settled = await Promise.allSettled(pair.map((account) => register(account.token, disputed)));
    assert.deepEqual(settled.map((result) => result.status).sort(), ["fulfilled", "rejected"], `CPF disputado, rodada ${round}`);
    const refused = settled.find((result) => result.status === "rejected").reason;
    assert.equal(refused.code, "CPF_ALREADY_REGISTERED", refused.message);
    assert.equal(refused.status, 409);
    assert.equal(await count("cpf_registrations", "WHERE cpf_hmac = $1", [hashOf(disputed)]), 1);
  }

  // --- A mesma conta manda o cadastro duas vezes ao mesmo tempo (duas abas) ---
  const carla = await newAccount();
  const carlaCpf = newCpf();
  const twice = await Promise.all([register(carla.token, carlaCpf), register(carla.token, carlaCpf)]);
  assert.deepEqual(twice.map((result) => result.status).sort(), ["alreadyRegistered", "created"]);
  assert.equal(await count("cpf_registrations", "WHERE subject = $1", [carla.subject]), 1);

  // --- Limite de tentativas por conta e por dia ---
  const dora = await newAccount();
  for (let attempt = 1; attempt <= REGISTRATION_ATTEMPTS_PER_DAY; attempt += 1) {
    await rejectsWith(register(dora.token, anaCpf), 409, "CPF_ALREADY_REGISTERED");
    assert.equal(await attemptsOf(dora.subject), attempt);
  }
  // Esgotado o limite, nem um CPF livre entra hoje.
  const doraCpf = newCpf();
  now = new Date("2034-06-12T23:00:00.000Z");
  await assert.rejects(register(dora.token, doraCpf), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.code, "REGISTRATION_ATTEMPT_LIMIT");
    // Até a meia-noite de São Paulo: 03:00 UTC do dia seguinte.
    assert.equal(error.retryAfterSeconds, 4 * 3600);
    return true;
  });
  await rejectsWith(register(dora.token, anaCpf), 429, "REGISTRATION_ATTEMPT_LIMIT");
  // O dia do limite é o de São Paulo: à 01:00 UTC do dia 13 ainda é dia 12 lá,
  // e a conta continua barrada até a meia-noite de São Paulo.
  now = new Date("2034-06-13T01:00:00.000Z");
  await assert.rejects(register(dora.token, doraCpf), (error) => {
    assert.equal(error.code, "REGISTRATION_ATTEMPT_LIMIT");
    assert.equal(error.retryAfterSeconds, 2 * 3600);
    return true;
  });
  now = new Date("2034-06-13T02:59:59.999Z");
  await rejectsWith(register(dora.token, doraCpf), 429, "REGISTRATION_ATTEMPT_LIMIT");
  assert.equal(await attemptsOf(dora.subject), REGISTRATION_ATTEMPTS_PER_DAY, "a recusa por limite não passa do teto");
  assert.equal(await count("cpf_registrations", "WHERE subject = $1", [dora.subject]), 0);
  // O limite é da conta: outra conta segue podendo se cadastrar.
  assert.equal((await register((await newAccount()).token, newCpf())).status, "created");
  // No dia editorial seguinte a conta volta a poder.
  now = new Date("2034-06-13T03:00:00.000Z");
  assert.equal((await register(dora.token, doraCpf)).status, "created");
  now = DAY_ONE;

  // --- Resposta dada sem conta, antes da exigência: a pessoa entra, se cadastra e continua com ela ---
  const elis = await newAnonymous();
  const elisDraw = await legacy.photoSurveyDraw(elis.recoveryKey, SURVEY.id);
  const elisPicks = picksOf(elisDraw.draw, 3);
  const elisAnswer = (await legacy.photoSurveyRespond({
    recoveryKey: elis.recoveryKey, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: elisPicks, championId: elisPicks[0],
  })).response;
  // Sem conta, nem a resposta que ela deu é devolvida.
  await rejectsWith(store.photoSurveyDraw(elis.recoveryKey, SURVEY.id), 403, "CPF_REGISTRATION_REQUIRED");
  const elisAccount = await newAccount(elis.recoveryKey);
  await rejectsWith(store.photoSurveyDraw(elisAccount.token, SURVEY.id), 403, "CPF_REGISTRATION_REQUIRED");
  assert.equal((await register(elisAccount.token, newCpf())).status, "created");
  const elisSeen = await store.photoSurveyDraw(elisAccount.token, SURVEY.id);
  assert.deepEqual(elisSeen.response, elisAnswer, "a resposta dada sem conta continua sendo a da pessoa");
  assert.deepEqual(elisSeen.draw, elisDraw.draw);
  await rejectsWith(respond(elisAccount.token, { pickIds: picksOf(elisSeen.draw, 1), championId: picksOf(elisSeen.draw, 1)[0] }), 409, "PHOTO_SURVEY_ALREADY_ANSWERED");

  // O mesmo, entrando numa conta que já existia e já tinha cadastro.
  const fabio = await newAccount();
  assert.equal((await register(fabio.token, newCpf())).status, "created");
  const gil = await newAnonymous();
  const gilDraw = await legacy.photoSurveyDraw(gil.recoveryKey, SURVEY.id);
  const gilPicks = picksOf(gilDraw.draw, 2);
  const gilAnswer = (await legacy.photoSurveyRespond({
    recoveryKey: gil.recoveryKey, surveyId: SURVEY.id, answerId: randomUUID(), pickIds: gilPicks, championId: gilPicks[1],
  })).response;
  const linked = await signIn(fabio.subject, gil.recoveryKey);
  assert.equal(linked.merge.status, "linked");
  for (const token of [linked.sessionToken, fabio.token]) {
    assert.deepEqual((await store.photoSurveyDraw(token, SURVEY.id)).response, gilAnswer);
  }
  // A chave antiga deixou de valer: 401, não um jeito de responder sem cadastro.
  await rejectsWith(store.photoSurveyDraw(gil.recoveryKey, SURVEY.id), 401, undefined);

  // --- O cadastro é da conta: se o jogador ativo muda, ele acompanha ---
  const hugo = await newAccount();
  assert.equal((await register(hugo.token, newCpf())).status, "created");
  const hugoDraw = await store.photoSurveyDraw(hugo.token, SURVEY.id);
  const iris = await newAnonymous();
  const daily = await store.dailySession(iris.recoveryKey, "eleicoes-2026");
  await store.dailyVote({
    topicId: "eleicoes-2026", editionId: daily.edition.id, slot: 1, winnerId: daily.round.candidateIds[1],
    answerId: randomUUID(), recoveryKey: iris.recoveryKey, playerVersion: 0,
  });
  const switched = await signIn(hugo.subject, iris.recoveryKey);
  assert.equal(switched.merge.status, "combined");
  assert.equal(switched.merge.activeDaily, "anonymous");
  for (const token of [switched.sessionToken, hugo.token]) {
    // Sem resposta ainda: o jogador que virou o ativo recebe o próprio sorteio.
    const seen = await store.photoSurveyDraw(token, SURVEY.id);
    assert.equal(seen.response, null);
    assert.equal(seen.draw.groups.length, hugoDraw.draw.groups.length);
  }
  assert.deepEqual(await register(switched.sessionToken, usedCpfs.at(-1)), { status: "alreadyRegistered", registeredAt: DAY_ONE.toISOString() });

  // --- O número do CPF não está em lugar nenhum das tabelas do cadastro ---
  const dump = JSON.stringify((await audit.query(`SELECT
    (SELECT coalesce(json_agg(r), '[]'::json) FROM cpf_registrations r) AS registrations,
    (SELECT coalesce(json_agg(a), '[]'::json) FROM cpf_registration_attempts a) AS attempts`)).rows[0]);
  for (const cpf of usedCpfs) assert.ok(!dump.includes(cpf), "um CPF apareceu em texto no banco");
  assert.ok(dump.includes(hashOf(anaCpf)));

  // --- Um segundo boot no mesmo banco não falha nem perde cadastros ---
  const registered = await count("cpf_registrations");
  const restarted = createTopicStore(connection, options);
  try {
    await restarted.init();
    assert.equal(await count("cpf_registrations"), registered);
    assert.deepEqual((await restarted.photoSurveyDraw(ana.token, SURVEY.id)).response, anaAnswer.response);
    await rejectsWith(restarted.photoSurveyDraw(visitor.recoveryKey, SURVEY.id), 403, "CPF_REGISTRATION_REQUIRED");
  } finally {
    await restarted.close();
  }
  assert.equal(await count("schema_migrations", "WHERE id = '2026-11-16-cpf-registration-v1'"), 1);

  console.log("Smoke do cadastro com CPF aprovado: sem cadastro nada é emitido nem gravado, cadastro só com conta Google, código no lugar do número, um CPF por conta e uma conta por CPF também em disputa simultânea, limite de tentativas por dia, resposta antiga preservada, cadastro acompanha a conta e segundo boot.");
} finally {
  await audit.end();
  await legacy.close();
  await store.close();
}
