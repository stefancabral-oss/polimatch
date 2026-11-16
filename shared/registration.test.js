import assert from "node:assert/strict";
import test from "node:test";
import {
  AGE_RANGES,
  CONSENT_TEXT,
  CONSENT_VERSION,
  GENDERS,
  STATES,
  cpfDigits,
  formatCpf,
  isValidCpf,
  validateRegistration,
} from "./registration.js";

const VALID = Object.freeze({
  cpf: "529.982.247-25",
  ageRange: "25-34",
  gender: "mulher",
  state: "SP",
  consent: true,
  consentVersion: CONSENT_VERSION,
});

test("o CPF vale pelos dois dígitos verificadores", () => {
  for (const cpf of ["52998224725", "529.982.247-25", " 111.444.777-35 ", "123 456 789 09"]) {
    assert.equal(isValidCpf(cpf), true, cpf);
  }
  // Um dígito trocado em cada posição derruba o número.
  for (let index = 0; index < 11; index += 1) {
    const digits = "52998224725".split("");
    digits[index] = String((Number(digits[index]) + 1) % 10);
    assert.equal(isValidCpf(digits.join("")), false, digits.join(""));
  }
});

test("resto dez vira dígito zero, nos dois verificadores, e zeros à esquerda contam", () => {
  assert.equal(isValidCpf("100.000.001-08"), true);
  assert.equal(isValidCpf("100.000.028-10"), true);
  assert.equal(isValidCpf("000.000.001-91"), true);
  assert.equal(isValidCpf("100.000.001-18"), false);
  assert.equal(isValidCpf("100.000.028-11"), false);
});

test("dígitos todos iguais passam na conta e não valem", () => {
  for (let digit = 0; digit <= 9; digit += 1) assert.equal(isValidCpf(String(digit).repeat(11)), false);
});

test("o que não é um CPF escrito não vale", () => {
  for (const value of ["", "   ", "5299822472", "529982247250", "529.982.247-2x", "cpf 529.982.247-25", "５２９９８２２４７２５", null, undefined, 52998224725, ["52998224725"], { cpf: "52998224725" }]) {
    assert.equal(isValidCpf(value), false, String(value));
    assert.equal(cpfDigits(value), typeof value === "string" && /^[\d.\-\s]*$/.test(value) ? value.replace(/\D/g, "") : "");
  }
  assert.equal(cpfDigits("529.982.247-25"), "52998224725");
});

test("a máscara acompanha a digitação e ignora o que não é número", () => {
  assert.equal(formatCpf(""), "");
  assert.equal(formatCpf("5"), "5");
  assert.equal(formatCpf("529"), "529");
  assert.equal(formatCpf("5299"), "529.9");
  assert.equal(formatCpf("529982"), "529.982");
  assert.equal(formatCpf("5299822"), "529.982.2");
  assert.equal(formatCpf("529982247"), "529.982.247");
  assert.equal(formatCpf("5299822472"), "529.982.247-2");
  assert.equal(formatCpf("52998224725"), "529.982.247-25");
  assert.equal(formatCpf("529.982.247-25"), "529.982.247-25");
  assert.equal(formatCpf("529982247259999"), "529.982.247-25");
  assert.equal(formatCpf("52a9b9"), "529.9");
  assert.equal(formatCpf(null), "");
});

test("as opções do cadastro são as do protótipo aprovado", () => {
  assert.deepEqual(AGE_RANGES.map((item) => item.label), ["16 a 24", "25 a 34", "35 a 44", "45 a 59", "60 ou mais"]);
  assert.deepEqual(GENDERS.map((item) => item.label), ["Mulher", "Homem", "Outro", "Prefiro não dizer"]);
  assert.equal(STATES.length, 27);
  assert.equal(new Set(STATES).size, 27);
  assert.ok(STATES.every((uf) => /^[A-Z]{2}$/.test(uf)));
  for (const uf of ["AC", "DF", "SP", "TO"]) assert.ok(STATES.includes(uf));
  for (const list of [AGE_RANGES, GENDERS]) {
    assert.equal(new Set(list.map((item) => item.id)).size, list.length);
    assert.ok(list.every((item) => /^[a-z0-9+-]+$/.test(item.id)));
    assert.ok(Object.isFrozen(list));
  }
  assert.ok(Object.isFrozen(STATES));
});

test("o consentimento tem versão e diz para que servem o CPF e o perfil", () => {
  assert.match(CONSENT_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(CONSENT_TEXT, /CPF/);
  assert.match(CONSENT_TEXT, /um voto por pessoa/);
  assert.match(CONSENT_TEXT, /resultado somado/);
});

test("um cadastro completo é aceito, com o CPF só em dígitos", () => {
  assert.deepEqual(validateRegistration(VALID), {
    ok: true,
    value: { cpf: "52998224725", ageRange: "25-34", gender: "mulher", state: "SP", consentVersion: CONSENT_VERSION },
  });
});

test("cada campo errado é recusado com o código e o nome do campo", () => {
  const cases = [
    [{ cpf: "529.982.247-24" }, "CPF_INVALID", "cpf"],
    [{ cpf: "" }, "CPF_INVALID", "cpf"],
    [{ cpf: 52998224725 }, "CPF_INVALID", "cpf"],
    [{ ageRange: "0-15" }, "REGISTRATION_INVALID", "ageRange"],
    [{ ageRange: "" }, "REGISTRATION_INVALID", "ageRange"],
    [{ ageRange: "25 a 34" }, "REGISTRATION_INVALID", "ageRange"],
    [{ gender: "Mulher" }, "REGISTRATION_INVALID", "gender"],
    [{ gender: undefined }, "REGISTRATION_INVALID", "gender"],
    [{ state: "sp" }, "REGISTRATION_INVALID", "state"],
    [{ state: "XX" }, "REGISTRATION_INVALID", "state"],
    [{ state: ["SP"] }, "REGISTRATION_INVALID", "state"],
    [{ consent: false }, "CONSENT_REQUIRED", "consent"],
    [{ consent: "true" }, "CONSENT_REQUIRED", "consent"],
    [{ consent: 1 }, "CONSENT_REQUIRED", "consent"],
    [{ consentVersion: "2020-01-01" }, "CONSENT_VERSION_MISMATCH", "consentVersion"],
    [{ consentVersion: undefined }, "CONSENT_VERSION_MISMATCH", "consentVersion"],
  ];
  for (const [change, code, field] of cases) {
    assert.deepEqual(validateRegistration({ ...VALID, ...change }), { ok: false, code, field }, JSON.stringify(change));
  }
});

test("a recusa nunca devolve o que foi digitado", () => {
  for (const input of [null, undefined, "texto", 7, [], { cpf: "529.982.247-24" }]) {
    const result = validateRegistration(input);
    assert.equal(result.ok, false);
    assert.deepEqual(Object.keys(result).sort(), ["code", "field", "ok"]);
    assert.doesNotMatch(JSON.stringify(result), /529/);
  }
});

test("o primeiro erro é o do CPF, depois o perfil, depois o consentimento", () => {
  const broken = { cpf: "1", ageRange: "x", gender: "x", state: "x", consent: false, consentVersion: "x" };
  assert.equal(validateRegistration(broken).field, "cpf");
  assert.equal(validateRegistration({ ...broken, cpf: VALID.cpf }).field, "ageRange");
  assert.equal(validateRegistration({ ...broken, cpf: VALID.cpf, ageRange: "25-34" }).field, "gender");
  assert.equal(validateRegistration({ ...broken, cpf: VALID.cpf, ageRange: "25-34", gender: "homem" }).field, "state");
  assert.equal(validateRegistration({ ...broken, cpf: VALID.cpf, ageRange: "25-34", gender: "homem", state: "RJ" }).field, "consent");
  assert.equal(validateRegistration({ ...broken, cpf: VALID.cpf, ageRange: "25-34", gender: "homem", state: "RJ", consent: true }).field, "consentVersion");
});
