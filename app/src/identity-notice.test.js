import assert from "node:assert/strict";
import test from "node:test";
import {
  identityNoticeFromError,
  isPlayerIssuanceLimit,
  quotaNoticeActive,
  quotaResetLabel,
  quotaResetSentence,
} from "./identity-notice.js";

test("só o 429 com o código de emissão vira aviso de cota", () => {
  assert.equal(isPlayerIssuanceLimit({ status: 429, code: "PLAYER_ISSUANCE_LIMIT" }), true);
  assert.equal(isPlayerIssuanceLimit({ status: 429, code: "VOTE_RATE_LIMITED" }), false);
  assert.equal(isPlayerIssuanceLimit({ status: 503, code: "PLAYER_ISSUANCE_LIMIT" }), false);
  assert.equal(isPlayerIssuanceLimit(null), false);
});

test("a recusa guarda o instante de liberação informado pelo servidor", () => {
  const now = Date.parse("2026-10-30T23:30:00-03:00");
  const notice = identityNoticeFromError({ status: 429, code: "PLAYER_ISSUANCE_LIMIT", retryAfterSeconds: 1800 }, now);
  assert.deepEqual(notice, { kind: "quota", retryAt: Date.parse("2026-10-31T00:00:00-03:00") });
  assert.equal(quotaNoticeActive(notice, now), true);
  assert.equal(quotaNoticeActive(notice, notice.retryAt), false);
});

test("sem prazo do servidor a interface diz amanhã e não bloqueia nova tentativa", () => {
  const notice = identityNoticeFromError({ status: 429, code: "PLAYER_ISSUANCE_LIMIT" });
  assert.equal(notice.retryAt, null);
  assert.equal(quotaNoticeActive(notice), false);
  assert.equal(quotaResetLabel(notice.retryAt), "amanhã");
});

test("outras falhas não usam o texto de cota", () => {
  assert.deepEqual(identityNoticeFromError({ status: 0, code: "NETWORK" }), { kind: "failure", unreachable: true });
  assert.deepEqual(identityNoticeFromError({ status: 500 }), { kind: "failure", unreachable: false });
});

test("o horário de liberação é mostrado no fuso de São Paulo", () => {
  const midnight = Date.parse("2026-10-31T03:00:00Z");
  assert.equal(quotaResetLabel(midnight), "às 00:00 (horário de Brasília)");
  assert.equal(
    quotaResetSentence(midnight),
    "Novos jogos anônimos nesta rede voltam a ser liberados às 00:00 (horário de Brasília).",
  );
});
