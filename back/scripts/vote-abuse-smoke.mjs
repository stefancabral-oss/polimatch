import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import { createTopicStore, networkIssuanceWindow, recoveryKeyHash, VOTE_ABUSE_LIMITS } from "../src/topic-store.js";
import { createApprovedTestRegistry } from "../test-support/editorial-fixtures.js";
import { requireDisposableDatabase } from "../test-support/disposable-db.js";

const connectionString = requireDisposableDatabase();

const candidateRegistry = createApprovedTestRegistry();
const store = createTopicStore(connectionString, { candidateRegistry });
await store.init();

async function expectCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.status, code === "PLAYER_SESSION_REQUIRED" ? 401 : 429);
    assert.equal(error.code, code);
    return true;
  });
}

// The integration workflow intentionally runs the broader store smoke first in
// the same database. Use per-run network subjects so this abuse proof measures
// its own quota window instead of inheriting counters from another smoke.
const networkSubject = (label) => createHash("sha256")
  .update(`${label}:${randomUUID()}`)
  .digest("hex");

const issuanceNetwork = networkSubject("issuance-limit");
for (let index = 0; index < VOTE_ABUSE_LIMITS.anonymousPlayersPerNetworkPerDay; index += 1) {
  const issued = await store.createPlayer({ networkHash: issuanceNetwork });
  assert.match(issued.recoveryKey, /^pm2_/);
}
await expectCode(() => store.createPlayer({ networkHash: issuanceNetwork }), "PLAYER_ISSUANCE_LIMIT");

const { recoveryKey } = await store.createPlayer({ networkHash: networkSubject("round-limits") });
const candidateIds = ["lula", "jair-bolsonaro", "anitta", "neymar-jr"];
await assert.rejects(
  () => store.roundVote({
    topicId: "eleicoes-2026",
    winnerId: "lula",
    candidateIds,
    roundId: randomUUID(),
    recoveryKey: "",
    playerVersion: 0,
  }),
  (error) => error.status === 401,
);

let lastRound;
for (let version = 0; version < VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute; version += 1) {
  lastRound = {
    topicId: "eleicoes-2026",
    winnerId: candidateIds[version % candidateIds.length],
    candidateIds,
    roundId: randomUUID(),
    recoveryKey,
    playerVersion: version,
  };
  const result = await store.roundVote(lastRound);
  assert.equal(result.round.status, "created");
  assert.equal(result.round.winnerId, lastRound.winnerId);
  assert.deepEqual(result.round.candidateIds, lastRound.candidateIds);
  assert.equal(result.player.version, version + 1);
}

const replay = await store.roundVote(lastRound);
assert.equal(replay.round.status, "alreadyProcessed");
assert.equal(replay.round.winnerId, lastRound.winnerId);
assert.deepEqual(replay.round.candidateIds, lastRound.candidateIds);
assert.equal(replay.player.version, VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute);

const blockedRound = {
  ...lastRound,
  roundId: randomUUID(),
  playerVersion: VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute,
};
await expectCode(() => store.roundVote(blockedRound), "VOTE_RATE_LIMITED");

const audit = new pg.Pool({ connectionString });
const player = await audit.query("SELECT id FROM anonymous_players WHERE recovery_hash = $1", [recoveryKeyHash(recoveryKey)]);
assert.equal(player.rowCount, 1);
const playerId = player.rows[0].id;
await audit.query(
  `UPDATE abuse_quota_counters
   SET window_start = window_start - interval '2 minutes'
   WHERE scope = 'player-round-minute' AND subject_hash = $1`,
  [playerId],
);
await audit.query(
  `UPDATE abuse_quota_counters
   SET used = $2
   WHERE scope = 'player-choice-editorial-day-v2' AND subject_hash = $1`,
  [playerId, VOTE_ABUSE_LIMITS.editorialChoicesPerPlayerPerDay],
);
await expectCode(() => store.roundVote(blockedRound), "VOTE_DAILY_LIMIT");

const persisted = await audit.query(
  `SELECT scope, used FROM abuse_quota_counters WHERE subject_hash = $1 ORDER BY scope`,
  [playerId],
);
assert.deepEqual(
  persisted.rows.map(({ scope, used }) => [scope, Number(used)]),
  [
    ["player-choice-editorial-day-v2", VOTE_ABUSE_LIMITS.editorialChoicesPerPlayerPerDay],
    ["player-free-editorial-day-v2", VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute],
    ["player-round-minute", VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute],
  ],
);
const personal = await store.playerRanking(recoveryKey, "eleicoes-2026");
assert.equal(personal.version, VOTE_ABUSE_LIMITS.roundsPerPlayerPerMinute);

// Cota de jogos novos por rede no dia editorial de São Paulo, com recusas
// contadas em agregado. O relógio fixo isola esta prova de outras execuções
// no mesmo banco: o que se mede é a diferença no dia escolhido.
const editorialNow = new Date("2026-10-25T23:30:00-03:00");
const editorialIssuance = networkIssuanceWindow(editorialNow);
const clockedStore = createTopicStore(connectionString, { candidateRegistry, clock: () => editorialNow });
const rejectionCount = async (day) => Number((await audit.query(
  `SELECT count FROM quota_rejections_daily
   WHERE day = $1::date AND scope = 'network-player-day' AND code = 'PLAYER_ISSUANCE_LIMIT'`,
  [day],
)).rows[0]?.count || 0);
const rejectionsBefore = await rejectionCount(editorialIssuance.day);
const editorialNetwork = networkSubject("editorial-issuance");
let issuanceAttempts = 0;
let issuanceRejections = 0;
for (let attempt = 0; attempt < 5; attempt += 1) {
  issuanceAttempts += 1;
  try {
    const issued = await clockedStore.createPlayer({ networkHash: editorialNetwork });
    assert.match(issued.recoveryKey, /^pm2_/);
  } catch (error) {
    assert.equal(error.status, 429);
    assert.equal(error.code, "PLAYER_ISSUANCE_LIMIT");
    // Às 23h30 de Brasília faltam 30 minutos para a cota voltar, não 24 horas.
    assert.equal(error.retryAfterSeconds, 1800);
    issuanceRejections += 1;
  }
}
assert.equal(issuanceAttempts - issuanceRejections, VOTE_ABUSE_LIMITS.anonymousPlayersPerNetworkPerDay);
assert.equal(issuanceRejections, 2);
const editorialCounter = await audit.query(
  `SELECT window_start, used FROM abuse_quota_counters
   WHERE scope = 'network-player-day' AND subject_hash = $1`,
  [editorialNetwork],
);
assert.equal(editorialCounter.rowCount, 1);
assert.equal(editorialCounter.rows[0].window_start.toISOString(), "2026-10-25T03:00:00.000Z");
assert.equal(Number(editorialCounter.rows[0].used), VOTE_ABUSE_LIMITS.anonymousPlayersPerNetworkPerDay);
assert.equal(await rejectionCount(editorialIssuance.day) - rejectionsBefore, 2);
const rejectionColumns = await audit.query(
  `SELECT column_name FROM information_schema.columns
   WHERE table_name = 'quota_rejections_daily' ORDER BY ordinal_position`,
);
assert.deepEqual(rejectionColumns.rows.map(({ column_name: name }) => name), ["day", "scope", "code", "count", "updated_at"]);

// Bucket legado por dia UTC herdado na troca: o dia do deploy não abre uma
// segunda franquia para a rede que já tinha esgotado a cota antiga.
const legacyNetwork = networkSubject("legacy-utc-issuance");
await audit.query(
  `INSERT INTO abuse_quota_counters (scope, subject_hash, window_start, used)
   VALUES ('network-player-day', $1, '2026-10-25T00:00:00Z', $2)`,
  [legacyNetwork, VOTE_ABUSE_LIMITS.anonymousPlayersPerNetworkPerDay],
);
await expectCode(() => clockedStore.createPlayer({ networkHash: legacyNetwork }), "PLAYER_ISSUANCE_LIMIT");

// Login Google sem token é a saída do limite anônimo e não consome a cota de
// rede: nem contador novo, nem recusa contada, mesmo com a rede esgotada.
const networkCounters = async () => (await audit.query(
  `SELECT subject_hash, window_start, used FROM abuse_quota_counters
   WHERE scope = 'network-player-day' ORDER BY subject_hash, window_start`,
)).rows.map((row) => `${row.subject_hash}:${row.window_start.toISOString()}:${row.used}`);
const countersBeforeGoogle = await networkCounters();
const rejectionsBeforeGoogle = await rejectionCount(editorialIssuance.day);
const playersBeforeGoogle = Number((await audit.query("SELECT count(*) FROM anonymous_players")).rows[0].count);
const googleSubject = `smoke-google-${randomUUID()}`;
const google = await clockedStore.signInWithGoogle({
  identity: { subject: googleSubject, displayName: "Pessoa Smoke", avatarUrl: "" },
  currentToken: "",
  topicId: "eleicoes-2026",
});
assert.match(google.sessionToken, /^pms_/);
assert.equal(google.merge, null);
assert.deepEqual(await networkCounters(), countersBeforeGoogle);
assert.equal(await rejectionCount(editorialIssuance.day), rejectionsBeforeGoogle);
assert.equal(Number((await audit.query("SELECT count(*) FROM anonymous_players")).rows[0].count), playersBeforeGoogle + 1);
await clockedStore.close();

// Nove dias depois, a manutenção apaga o contador por rede (8 dias), mas o
// agregado de recusas continua para análise.
const laterStore = createTopicStore(connectionString, {
  candidateRegistry,
  clock: () => new Date(editorialNow.getTime() + 9 * 86400 * 1000),
});
await laterStore.init();
const expiredCounter = await audit.query(
  "SELECT 1 FROM abuse_quota_counters WHERE scope = 'network-player-day' AND subject_hash = $1",
  [editorialNetwork],
);
assert.equal(expiredCounter.rowCount, 0);
assert.ok(await rejectionCount(editorialIssuance.day) >= 2);
await laterStore.close();

await audit.end();
await store.close();

console.log("Abuso bloqueado: sessão obrigatória, emissão 3/dia editorial/rede com recusas agregadas, login Google fora da cota de rede, 8 rodadas/minuto, 30 rodadas/dia e retry idempotente sem consumo.");
