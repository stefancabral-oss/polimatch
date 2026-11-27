import assert from "node:assert/strict";
import test from "node:test";
import { PROFILE_CONSENT_TEXT, PROFILE_CONSENT_VERSION, RESERVED_HANDLES, isValidHandle, normalizeHandle } from "./profile.js";

test("nome de perfil: minúsculas, 3 a 20, letras, números e sublinhado", () => {
  assert.equal(normalizeHandle("  Ana_Beta "), "ana_beta");
  for (const ok of ["ana", "Ana_2026", "a".repeat(20), "x_y_z"]) assert.equal(isValidHandle(ok), true, ok);
  for (const bad of ["ab", "a".repeat(21), "ana beta", "joão", "ana-beta", "ana.beta", "", null, undefined, 42]) assert.equal(isValidHandle(bad), false, String(bad));
});

test("nomes reservados são recusados, em qualquer caixa", () => {
  for (const reserved of RESERVED_HANDLES) {
    assert.equal(isValidHandle(reserved), false, reserved);
    assert.equal(isValidHandle(reserved.toUpperCase()), false, reserved);
  }
});

test("o aceite do perfil tem versão e diz o que fica público", () => {
  assert.match(PROFILE_CONSENT_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(PROFILE_CONSENT_TEXT, /perfil público/);
  assert.match(PROFILE_CONSENT_TEXT, /primeiro lugar/);
  assert.match(PROFILE_CONSENT_TEXT, /inclusive de política/);
  assert.match(PROFILE_CONSENT_TEXT, /desligar/);
});
