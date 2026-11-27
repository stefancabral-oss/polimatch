import assert from "node:assert/strict";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import pg from "pg";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { PROFILE_CONSENT_VERSION } from "../../shared/profile.js";
import { CONSENT_VERSION, isValidCpf } from "../../shared/registration.js";
import { createApprovedTestRegistry } from "../test-support/editorial-fixtures.js";
import { cpfPseudonym } from "../src/registration-store.js";
import { createTopicStore } from "../src/topic-store.js";
import { requireDisposableDatabase } from "../test-support/disposable-db.js";

// Resultado da pessoa e perfil público (ICM 76, #354, decisão 0008) contra um
// PostgreSQL de verdade. Roda só no banco descartável do workflow de
// integração. O store é criado como o servidor cria.
const connection = requireDisposableDatabase();

const [POLITICS, POLITICS_TWO, CELEBRITIES, CLOTHES] = PHOTO_SURVEYS;
const SECRET = "segredo-do-smoke-do-perfil-com-mais-de-32-caracteres";
// Um dia que nenhum outro smoke usa.
const DAY = new Date("2035-03-14T15:00:00.000Z");
const LATER = new Date("2035-03-14T16:00:00.000Z");
let now = DAY;
const options = {
  candidateRegistry: createApprovedTestRegistry(CATALOG.map((person) => person.id)),
  clock: () => now,
  photoSurveys: PHOTO_SURVEYS,
};
const store = createTopicStore(connection, options);
const audit = new pg.Pool({ connectionString: connection });
await store.init();

const rejectsWith = (promise, status, code, current) => assert.rejects(promise, (error) => {
  assert.equal(error.code, code, error.message);
  assert.equal(error.status, status, error.message);
  if (current !== undefined) assert.deepEqual(error.current, current, error.message);
  return true;
});
const count = async (table, where = "", values = []) => Number((await audit.query(`SELECT count(*) AS total FROM ${table} ${where}`, values)).rows[0].total);
const allRows = async () => Promise.all([
  "photo_survey_draws", "photo_survey_responses", "photo_survey_round_draws", "photo_survey_round_responses",
  "profile_settings", "profile_surveys", "cpf_registrations",
].map((table) => count(table)));
const picksOf = (draw, offset = 0) => draw.groups.map((group, index) => group[(index + offset) % group.length]);
// Nomes novos a cada execução, para o smoke poder rodar de novo no mesmo banco.
const handleOf = (prefix) => `${prefix}_${randomBytes(4).toString("hex")}`;

function newCpf() {
  for (;;) {
    const base = Array.from({ length: 9 }, () => randomInt(10));
    const digit = (digits, weight) => {
      const rest = (digits.reduce((sum, value, index) => sum + value * (weight - index), 0) * 10) % 11;
      return rest === 10 ? 0 : rest;
    };
    const first = digit(base, 10);
    const cpf = [...base, first, digit([...base, first], 11)].join("");
    if (isValidCpf(cpf)) return cpf;
  }
}
const newAnonymous = () => store.createPlayer({ networkHash: randomBytes(32).toString("hex") });
const signIn = (subject, currentToken = "") => store.signInWithGoogle({ identity: { subject, displayName: "Teste" }, currentToken, topicId: "eleicoes-2026" });
async function newAccount({ registered = true, currentToken = "" } = {}) {
  const subject = `profile-smoke-${randomUUID()}`;
  const login = await signIn(subject, currentToken);
  if (registered) {
    const done = await store.registerCpf({
      recoveryKey: login.sessionToken, cpfHash: cpfPseudonym(newCpf(), SECRET),
      ageRange: "25-34", gender: "mulher", state: "SP", consentVersion: CONSENT_VERSION,
    });
    assert.equal(done.status, "created");
  }
  return { subject, token: login.sessionToken, login };
}

// Joga `rounds` rodadas respondidas e devolve as respostas.
async function play(token, survey, rounds, offset = 0) {
  const answers = [];
  for (let index = 0; index < rounds; index += 1) {
    const drawn = await store.photoSurveyDraw(token, survey.id, { next: true });
    const pickIds = picksOf(drawn.draw, offset + index);
    const championId = pickIds[(offset + index) % pickIds.length];
    answers.push((await store.photoSurveyRespond({ recoveryKey: token, surveyId: survey.id, answerId: randomUUID(), pickIds, championId, round: drawn.round })).response);
  }
  return answers;
}

// A regra de pontos feita à mão: 1 por vitória em tela, 3 pela final.
function expectedRanking(survey, answers) {
  const table = new Map();
  for (const { pickIds, championId } of answers) {
    for (const id of pickIds) {
      const entry = table.get(id) || { cardId: id, points: 0, finalWins: 0, screenWins: 0 };
      entry.points += 1;
      entry.screenWins += 1;
      table.set(id, entry);
    }
    table.get(championId).points += 3;
    table.get(championId).finalWins += 1;
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.finalWins - a.finalWins || b.screenWins - a.screenWins
    || survey.cardIds.indexOf(a.cardId) - survey.cardIds.indexOf(b.cardId));
}

const enable = (token, handle, extra = {}) => store.updateProfile({ recoveryKey: token, enabled: true, handle, consentVersion: PROFILE_CONSENT_VERSION, ...extra });
const settingsRow = async (subject) => (await audit.query("SELECT * FROM profile_settings WHERE provider = 'google' AND subject = $1", [subject])).rows[0];

try {
  assert.equal(await count("schema_migrations", "WHERE id = '2026-11-26-profiles-v1'"), 1);

  const ana = await newAccount();
  const carla = await newAccount({ registered: false });
  const visitor = await newAnonymous();

  // --- Resultado: só leitura, mesmas recusas do sorteio ---
  let before = await allRows();
  assert.deepEqual(await store.photoSurveyResult(ana.token, POLITICS.id), { surveyId: POLITICS.id, answeredRounds: 0, ranking: [] });
  await rejectsWith(store.photoSurveyResult(carla.token, POLITICS.id), 403, "CPF_REGISTRATION_REQUIRED");
  await rejectsWith(store.photoSurveyResult(visitor.recoveryKey, POLITICS.id), 403, "CPF_REGISTRATION_REQUIRED");
  await rejectsWith(store.photoSurveyResult(ana.token, "nao-existe"), 404, "PHOTO_SURVEY_NOT_FOUND");
  await assert.rejects(store.photoSurveyResult("pms_chave-que-nao-existe", POLITICS.id), (error) => error.status === 401);
  assert.deepEqual(await allRows(), before, "o resultado e as recusas não gravam nada");

  const anaPolitics = await play(ana.token, POLITICS, 3, 1);
  const anaClothes = await play(ana.token, CLOTHES, 2, 2);
  await play(ana.token, POLITICS_TWO, 1);
  // Rodada aberta, sem resposta: não entra no resultado.
  assert.equal((await store.photoSurveyDraw(ana.token, POLITICS.id, { next: true })).round, 4);
  before = await allRows();
  const result = await store.photoSurveyResult(ana.token, POLITICS.id);
  assert.deepEqual(result, { surveyId: POLITICS.id, answeredRounds: 3, ranking: expectedRanking(POLITICS, anaPolitics) });
  assert.deepEqual(await allRows(), before);

  // --- Meu perfil: nasce desligado e ler não cria linha ---
  const fresh = await store.myProfile(ana.token);
  assert.deepEqual(fresh, {
    enabled: false, handle: null, consentVersion: null, consentedAt: null, surveys: [],
    firstPlaces: [
      { surveyId: POLITICS.id, cardId: result.ranking[0].cardId },
      { surveyId: POLITICS_TWO.id, cardId: (await store.photoSurveyResult(ana.token, POLITICS_TWO.id)).ranking[0].cardId },
      { surveyId: CLOTHES.id, cardId: expectedRanking(CLOTHES, anaClothes)[0].cardId },
    ],
    canEnable: true,
  });
  assert.equal(await count("profile_settings", "WHERE subject = $1", [ana.subject]), 0);
  assert.equal((await store.myProfile(carla.token)).canEnable, false);
  await rejectsWith(store.myProfile(visitor.recoveryKey), 403, "GOOGLE_ACCOUNT_REQUIRED");

  // --- Ligar: cadastro, nome e aceite ---
  before = await allRows();
  const anaHandle = handleOf("ana");
  await rejectsWith(enable(carla.token, handleOf("carla")), 403, "CPF_REGISTRATION_REQUIRED");
  // Visitante sem conta Google não tem perfil: nem desligar ele pode.
  await rejectsWith(store.updateProfile({ recoveryKey: visitor.recoveryKey, enabled: false }), 403, "CPF_REGISTRATION_REQUIRED");
  await rejectsWith(enable(ana.token, anaHandle, { consentVersion: undefined }), 400, "PROFILE_CONSENT_REQUIRED");
  await rejectsWith(enable(ana.token, undefined), 400, "PROFILE_INVALID", { reason: "handle" });
  await rejectsWith(enable(ana.token, "polimatch"), 400, "PROFILE_INVALID", { reason: "handle" });
  await rejectsWith(enable(ana.token, anaHandle, { surveys: ["nao-existe"] }), 400, "PROFILE_INVALID", { reason: "surveys" });
  assert.deepEqual(await allRows(), before, "nenhuma recusa grava");

  const on = await enable(ana.token, anaHandle.toUpperCase(), { surveys: [CLOTHES.id, CELEBRITIES.id, POLITICS.id, CLOTHES.id] });
  assert.deepEqual([on.enabled, on.handle, on.consentVersion, on.consentedAt, on.surveys], [true, anaHandle, PROFILE_CONSENT_VERSION, DAY.toISOString(), [POLITICS.id, CELEBRITIES.id, CLOTHES.id]]);
  const row = await settingsRow(ana.subject);
  assert.deepEqual(Object.keys(row).sort(), ["consent_version", "consented_at", "enabled", "handle", "provider", "subject", "updated_at"]);
  assert.deepEqual([row.handle, row.enabled, row.consent_version, new Date(row.consented_at).toISOString()], [anaHandle, true, PROFILE_CONSENT_VERSION, DAY.toISOString()]);
  assert.equal(await count("profile_surveys", "WHERE subject = $1", [ana.subject]), 3);

  // --- Perfil público: marcadas com rodada respondida, na ordem das pesquisas ---
  before = await allRows();
  const shown = await store.publicProfile(anaHandle.toUpperCase());
  assert.deepEqual(shown, {
    handle: anaHandle,
    surveys: [
      { surveyId: POLITICS.id, subject: POLITICS.subject, question: POLITICS.question, cardId: result.ranking[0].cardId },
      { surveyId: CLOTHES.id, subject: CLOTHES.subject, question: CLOTHES.question, cardId: expectedRanking(CLOTHES, anaClothes)[0].cardId },
    ],
  }, "famosos marcada sem rodada não aparece; política 2 respondida e não marcada não aparece");
  assert.deepEqual(await allRows(), before, "o perfil público só lê");

  // --- Desligar vale na hora; marcações e nome ficam guardados ---
  now = LATER;
  const off = await store.updateProfile({ recoveryKey: ana.token, enabled: false, handle: "x", consentVersion: "velha" });
  assert.deepEqual([off.enabled, off.handle, off.surveys.length], [false, anaHandle, 3]);
  await rejectsWith(store.publicProfile(anaHandle), 404, "PROFILE_NOT_FOUND");
  await rejectsWith(store.publicProfile(handleOf("ninguem")), 404, "PROFILE_NOT_FOUND");
  await rejectsWith(store.publicProfile("a"), 404, "PROFILE_NOT_FOUND");
  assert.equal(await count("profile_surveys", "WHERE subject = $1", [ana.subject]), 3);
  const again = await enable(ana.token, undefined);
  assert.equal(again.consentedAt, LATER.toISOString(), "religar grava a data do aceite novo");
  assert.equal((await store.publicProfile(anaHandle)).surveys.length, 2);
  now = DAY;

  // --- O banco segura as regras mesmo sem passar pelo store ---
  const raw = await audit.connect();
  try {
    for (const [handle, enabled, consent, code] of [
      [null, true, PROFILE_CONSENT_VERSION, "23514"],
      [handleOf("sem_aceite"), true, null, "23514"],
      ["MAIUSCULA", false, null, "23514"],
      [anaHandle, false, null, "23505"],
    ]) {
      const other = await newAccount();
      await assert.rejects(raw.query(
        "INSERT INTO profile_settings (provider, subject, handle, enabled, consent_version, consented_at, updated_at) VALUES ('google', $1, $2, $3, $4, $5, now())",
        [other.subject, handle, enabled, consent, consent ? DAY : null],
      ), (error) => error.code === code, `${handle} ${enabled}`);
    }
    await assert.rejects(raw.query(
      "INSERT INTO profile_settings (provider, subject, enabled, updated_at) VALUES ('google', $1, false, now())",
      [`sem-conta-${randomUUID()}`],
    ), (error) => error.code === "23503", "perfil sem conta");
  } finally {
    raw.release();
  }

  // --- Sem cadastro, o pedido só desliga: conta sem cadastro que nunca ligou
  // responde desligado sem criar linha; marcações são recusadas sem gravar;
  // conta que perdeu o cadastro desliga, o perfil público some na hora e as
  // marcações ficam como estavam ---
  before = await allRows();
  const carlaOff = await store.updateProfile({ recoveryKey: carla.token, enabled: false });
  assert.deepEqual([carlaOff.enabled, carlaOff.handle, carlaOff.surveys, carlaOff.canEnable], [false, null, [], false]);
  await rejectsWith(store.updateProfile({ recoveryKey: carla.token, enabled: false, surveys: [POLITICS.id] }), 403, "CPF_REGISTRATION_REQUIRED");
  await rejectsWith(store.updateProfile({ recoveryKey: carla.token, enabled: false, surveys: [] }), 403, "CPF_REGISTRATION_REQUIRED");
  assert.deepEqual(await allRows(), before, "conta sem cadastro não grava linha nem marcação");
  assert.equal(await count("profile_settings", "WHERE subject = $1", [carla.subject]), 0);
  const elisa = await newAccount();
  await play(elisa.token, POLITICS, 1);
  const elisaHandle = handleOf("elisa");
  await enable(elisa.token, elisaHandle, { surveys: [POLITICS.id] });
  assert.equal((await store.publicProfile(elisaHandle)).surveys.length, 1);
  // O banco é descartável: apagar o cadastro imita a conta que o perdeu.
  await audit.query("DELETE FROM cpf_registrations WHERE provider = 'google' AND subject = $1", [elisa.subject]);
  before = await allRows();
  const elisaRow = await settingsRow(elisa.subject);
  await rejectsWith(enable(elisa.token, undefined), 403, "CPF_REGISTRATION_REQUIRED");
  await rejectsWith(store.updateProfile({ recoveryKey: elisa.token, enabled: false, surveys: [] }), 403, "CPF_REGISTRATION_REQUIRED");
  assert.deepEqual(await allRows(), before, "as recusas não gravam");
  assert.deepEqual(await settingsRow(elisa.subject), elisaRow);
  assert.equal((await store.publicProfile(elisaHandle)).handle, elisaHandle, "a recusa de ligar não muda nada");
  const elisaOff = await store.updateProfile({ recoveryKey: elisa.token, enabled: false });
  assert.deepEqual([elisaOff.enabled, elisaOff.handle, elisaOff.surveys, elisaOff.canEnable], [false, elisaHandle, [POLITICS.id], false]);
  await rejectsWith(store.publicProfile(elisaHandle), 404, "PROFILE_NOT_FOUND");
  assert.equal((await settingsRow(elisa.subject)).enabled, false);
  assert.equal(await count("profile_surveys", "WHERE subject = $1", [elisa.subject]), 1, "desligar sem cadastro não mexe nas marcações");
  // Já desligado, desligar de novo não grava nada.
  const elisaOffRow = await settingsRow(elisa.subject);
  assert.equal((await store.updateProfile({ recoveryKey: elisa.token, enabled: false })).enabled, false);
  assert.deepEqual(await settingsRow(elisa.subject), elisaOffRow);

  // --- Nome único sem diferença de caixa; o nome gravado não muda e o link
  // continua da mesma pessoa ---
  const bruno = await newAccount();
  await rejectsWith(enable(bruno.token, anaHandle.toUpperCase()), 409, "PROFILE_HANDLE_TAKEN");
  const anaShown = await store.publicProfile(anaHandle);
  const anaSecond = handleOf("ana2");
  before = await allRows();
  const anaRow = await settingsRow(ana.subject);
  await rejectsWith(enable(ana.token, anaSecond), 400, "PROFILE_INVALID", { reason: "handle-locked" });
  assert.deepEqual(await allRows(), before, "a troca recusada não grava");
  assert.deepEqual(await settingsRow(ana.subject), anaRow);
  await rejectsWith(store.publicProfile(anaSecond), 404, "PROFILE_NOT_FOUND");
  // Desligada, a troca continua recusada; o nome continua dela.
  await store.updateProfile({ recoveryKey: ana.token, enabled: false });
  await rejectsWith(enable(ana.token, anaSecond), 400, "PROFILE_INVALID", { reason: "handle-locked" });
  await rejectsWith(enable(bruno.token, anaHandle), 409, "PROFILE_HANDLE_TAKEN");
  // O mesmo nome em outra caixa não é troca.
  assert.equal((await enable(ana.token, anaHandle.toUpperCase())).handle, anaHandle);
  assert.deepEqual(await store.publicProfile(anaHandle), anaShown, "o link do nome original mostra a mesma pessoa");
  // O nome que ela tentou continua livre para outra conta.
  assert.equal((await enable(bruno.token, anaSecond)).handle, anaSecond);
  assert.deepEqual(await store.publicProfile(anaSecond), { handle: anaSecond, surveys: [] }, "bruno sem marcação");

  // --- Duas contas disputam o mesmo nome ao mesmo tempo: uma grava, a outra 409, nunca 500 ---
  for (let round = 0; round < 6; round += 1) {
    const pair = [await newAccount(), await newAccount()];
    const disputed = handleOf("disputa");
    const settled = await Promise.allSettled(pair.map((account) => enable(account.token, disputed)));
    assert.deepEqual(settled.map((entry) => entry.status).sort(), ["fulfilled", "rejected"], `rodada ${round}`);
    const refused = settled.find((entry) => entry.status === "rejected").reason;
    assert.deepEqual([refused.status, refused.code], [409, "PROFILE_HANDLE_TAKEN"], refused.message);
    assert.equal(await count("profile_settings", "WHERE lower(handle) = $1", [disputed]), 1);
  }

  // --- O caminho do índice único, de forma determinística: outra conta grava
  // o nome depois da conferência e antes da gravação ---
  const held = await audit.connect();
  try {
    const holder = await newAccount();
    const late = await newAccount();
    const guarded = handleOf("segurado");
    await held.query("BEGIN");
    await held.query(
      "INSERT INTO profile_settings (provider, subject, handle, enabled, consent_version, consented_at, updated_at) VALUES ('google', $1, $2, true, $3, now(), now())",
      [holder.subject, guarded, PROFILE_CONSENT_VERSION],
    );
    // A conferência de `late` não vê a linha ainda sem COMMIT; a gravação fica
    // presa no índice único até a outra transação terminar.
    const pending = enable(late.token, guarded).then(
      (value) => ({ status: "fulfilled", value }),
      (reason) => ({ status: "rejected", reason }),
    );
    let blocked = false;
    for (let tries = 0; tries < 250 && !blocked; tries += 1) {
      const waiting = await audit.query("SELECT count(*)::integer AS total FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'INSERT INTO profile_settings%'");
      blocked = waiting.rows[0].total > 0;
      if (!blocked) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    await held.query("COMMIT");
    assert.ok(blocked, "a gravação esperou no índice único, depois da conferência");
    const outcome = await pending;
    assert.equal(outcome.status, "rejected", "a segunda gravação não passa");
    assert.deepEqual([outcome.reason.status, outcome.reason.code], [409, "PROFILE_HANDLE_TAKEN"], outcome.reason.message);
    assert.equal(await count("profile_settings", "WHERE subject = $1", [late.subject]), 0, "a recusa desfaz a transação");
  } finally {
    held.release();
  }

  // --- A mesma conta em duas abas, com nomes diferentes: em fila, sem 500;
  // o primeiro nome gravado fica e o segundo é recusado por estar travado ---
  const dora = await newAccount();
  const names = [handleOf("dora"), handleOf("dora")];
  const both = await Promise.allSettled(names.map((handle) => enable(dora.token, handle)));
  assert.deepEqual(both.map((entry) => entry.status).sort(), ["fulfilled", "rejected"]);
  const kept = both.find((entry) => entry.status === "fulfilled").value;
  const lockedOut = both.find((entry) => entry.status === "rejected").reason;
  assert.deepEqual([lockedOut.status, lockedOut.code, lockedOut.current], [400, "PROFILE_INVALID", { reason: "handle-locked" }], lockedOut.message);
  assert.equal(await count("profile_settings", "WHERE subject = $1", [dora.subject]), 1);
  assert.equal((await settingsRow(dora.subject)).handle, kept.handle);

  // --- O perfil é da conta: quando o jogador ativo muda, ele acompanha ---
  const hugo = await newAccount();
  const hugoAnswers = await play(hugo.token, POLITICS, 1);
  const hugoHandle = handleOf("hugo");
  await enable(hugo.token, hugoHandle, { surveys: [POLITICS.id] });
  const iris = await newAnonymous();
  const daily = await store.dailySession(iris.recoveryKey, "eleicoes-2026");
  await store.dailyVote({
    topicId: "eleicoes-2026", editionId: daily.edition.id, slot: 1, winnerId: daily.round.candidateIds[1],
    answerId: randomUUID(), recoveryKey: iris.recoveryKey, playerVersion: 0,
  });
  const switched = await signIn(hugo.subject, iris.recoveryKey);
  assert.equal(switched.merge.status, "combined");
  const hugoShown = await store.publicProfile(hugoHandle);
  assert.deepEqual(hugoShown.surveys.map((entry) => entry.cardId), [expectedRanking(POLITICS, hugoAnswers)[0].cardId]);
  assert.equal((await store.myProfile(switched.sessionToken)).handle, hugoHandle);

  // --- Nada de soma: o perfil público só tem os campos do contrato ---
  for (const profile of [shown, hugoShown]) {
    assert.deepEqual(Object.keys(profile), ["handle", "surveys"]);
    for (const entry of profile.surveys) assert.deepEqual(Object.keys(entry), ["surveyId", "subject", "question", "cardId"]);
  }

  // --- Um segundo boot no mesmo banco não falha nem perde perfis ---
  const profiles = await count("profile_settings");
  const restarted = createTopicStore(connection, options);
  try {
    await restarted.init();
    assert.equal(await count("profile_settings"), profiles);
    assert.equal((await restarted.publicProfile(anaHandle)).handle, anaHandle);
  } finally {
    await restarted.close();
  }
  assert.equal(await count("schema_migrations", "WHERE id = '2026-11-26-profiles-v1'"), 1);

  console.log("Smoke do perfil aprovado: resultado só lê e bate com a regra de pontos, perfil nasce desligado, ligar exige cadastro, nome e aceite, desligar vale na hora e não exige cadastro (sem cadastro só desliga, sem gravar marcações), o nome gravado não muda, só pesquisas marcadas com rodada aparecem, desligado e inexistente respondem igual, nome único também em disputa simultânea e no índice, perfil acompanha a conta e segundo boot.");
} finally {
  await audit.end();
  await store.close();
}
