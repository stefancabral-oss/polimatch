// PR DE TESTE, NÃO MESCLAR. Este arquivo existe só para provar que o ruleset
// de main recusa o merge quando o ci-gate está vermelho (issue #287,
// docs/ops/RELEASE.md). O PR é fechado sem mesclar e a branch é apagada.
import assert from "node:assert/strict";
import test from "node:test";

test("prova do bloqueio: falha de propósito", () => {
  assert.fail("falha proposital para provar o bloqueio do ci-gate");
});
