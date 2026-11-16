import test from "node:test";
import assert from "node:assert/strict";
import { AGE_RANGES, CONSENT_TEXT, CONSENT_VERSION, GENDERS, STATES } from "../../shared/registration.js";
import {
  EMPTY_REGISTRATION_FORM,
  registrationBody,
  registrationFormMarkup,
  registrationProblem,
  registrationRefusal,
  signInMarkup,
} from "./registration-view.js";

const FILLED = Object.freeze({ cpf: "529.982.247-25", ageRange: "25-34", gender: "mulher", state: "SP", consent: true });

test("a entrada reserva o lugar do botão do Google e oferece voltar à capa", () => {
  const markup = signInMarkup({ googleReady: true });
  assert.match(markup, /<div class="pm-google" id="ps-google"><span>Carregando Google…<\/span><\/div>/);
  assert.match(markup, /<a class="ps-btn ps-btn--ghost" href="\.\/">Voltar<\/a>/);
  assert.doesNotMatch(markup, /<form|name="cpf"/);
});

test("enquanto o servidor confirma a entrada, o lugar do botão avisa", () => {
  assert.match(signInMarkup({ googleReady: true, busy: true }), /<div class="pm-google is-busy" id="ps-google"><span>Confirmando…<\/span><\/div>/);
});

test("sem o identificador do Google no build, a entrada diz que não dá para entrar agora", () => {
  const markup = signInMarkup({ googleReady: false });
  assert.doesNotMatch(markup, /id="ps-google"/);
  assert.match(markup, /A entrada com Google não está disponível agora\./);
  assert.match(markup, /href="\.\/">Voltar<\/a>/);
});

test("o formulário traz o CPF, as opções do protótipo, o consentimento e Concluir", () => {
  const markup = registrationFormMarkup({ form: EMPTY_REGISTRATION_FORM });
  assert.match(markup, /<form class="ps-form" id="ps-register" novalidate autocomplete="off">/);
  assert.match(markup, /<label class="ps-flabel" for="ps-cpf">CPF<\/label><input class="ps-input" id="ps-cpf" name="cpf" type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000\.000\.000-00" value="">/);
  for (const item of [...AGE_RANGES, ...GENDERS]) assert.ok(markup.includes(`>${item.label}</button>`), item.label);
  assert.equal(markup.match(/data-field="ageRange"/g).length, AGE_RANGES.length);
  assert.equal(markup.match(/data-field="gender"/g).length, GENDERS.length);
  assert.equal(markup.match(/aria-pressed="false"/g).length, AGE_RANGES.length + GENDERS.length);
  assert.match(markup, /<select class="ps-input" id="ps-state" name="state"><option value="">Escolha<\/option>/);
  assert.equal(markup.match(/<option /g).length, STATES.length + 1);
  assert.ok(markup.includes(CONSENT_TEXT));
  assert.match(markup, /<input type="checkbox" id="ps-consent" name="consent">/);
  assert.match(markup, /<button class="ps-btn" type="submit">Concluir<\/button><a class="ps-btn ps-btn--ghost" href="\.\/">Voltar<\/a>/);
  assert.match(markup, /Não guardamos o número do CPF/);
});

test("o formulário volta com o que a pessoa já tinha preenchido", () => {
  const markup = registrationFormMarkup({ form: FILLED });
  assert.match(markup, /name="cpf"[^>]* value="529\.982\.247-25">/);
  assert.match(markup, /data-field="ageRange" data-value="25-34" aria-pressed="true">25 a 34<\/button>/);
  assert.match(markup, /data-field="gender" data-value="mulher" aria-pressed="true">Mulher<\/button>/);
  assert.equal(markup.match(/aria-pressed="true"/g).length, 2);
  assert.match(markup, /<option value="SP" selected>SP<\/option>/);
  assert.equal(markup.match(/ selected>/g).length, 1);
  assert.match(markup, /name="consent" checked>/);
});

test("enquanto envia, o botão fica travado e diz o que acontece", () => {
  assert.match(registrationFormMarkup({ form: FILLED, busy: true }), /<button class="ps-btn" type="submit" disabled>Concluindo…<\/button>/);
});

test("o que a pessoa digitou nunca entra como marcação", () => {
  const markup = registrationFormMarkup({ form: { ...FILLED, cpf: '"><img src=x onerror=alert(1)>', state: '"><b>' } });
  assert.doesNotMatch(markup, /<img|<b>/);
  assert.match(markup, /value="&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;"/);
});

test("o que falta no formulário é dito antes de chamar o servidor", () => {
  assert.equal(registrationProblem(EMPTY_REGISTRATION_FORM), "Confira o CPF: os números não fecham.");
  assert.equal(registrationProblem({ ...FILLED, cpf: "529.982.247-24" }), "Confira o CPF: os números não fecham.");
  for (const field of ["ageRange", "gender", "state"]) {
    assert.equal(registrationProblem({ ...FILLED, [field]: "" }), "Escolha idade, gênero e estado.", field);
  }
  assert.equal(registrationProblem({ ...FILLED, consent: false }), "Marque a autorização para concluir.");
  assert.equal(registrationProblem(FILLED), "");
});

test("o pedido leva o CPF como foi digitado, o perfil, o consentimento e a versão do texto", () => {
  assert.deepEqual(registrationBody(FILLED), { ...FILLED, consentVersion: CONSENT_VERSION });
  assert.deepEqual(Object.keys(registrationBody({ ...FILLED, outro: "campo" })).sort(), ["ageRange", "consent", "consentVersion", "cpf", "gender", "state"]);
});

test("cada recusa do servidor tem o seu texto e o seu destino", () => {
  const cases = [
    [{ status: 400, code: "CPF_INVALID" }, "form", /Confira o CPF/],
    [{ status: 400, code: "REGISTRATION_INVALID" }, "form", /Escolha idade, gênero e estado/],
    [{ status: 400, code: "CONSENT_REQUIRED" }, "form", /Marque a autorização/],
    [{ status: 400, code: "CONSENT_VERSION_MISMATCH" }, "form", /Atualize a página/],
    [{ status: 409, code: "CPF_ALREADY_REGISTERED" }, "form", /Este CPF já tem cadastro em outra conta Google/],
    [{ status: 409, code: "REGISTRATION_EXISTS" }, "start", null],
    [{ status: 429, code: "REGISTRATION_ATTEMPT_LIMIT" }, "form", /Muitas tentativas de cadastro hoje/],
    [{ status: 429, code: "RATE_LIMITED" }, "form", /Muitas tentativas agora/],
    [{ status: 401, code: "PLAYER_SESSION_REQUIRED" }, "signin", /Sua sessão venceu/],
    [{ status: 403, code: "GOOGLE_ACCOUNT_REQUIRED" }, "signin", /Entre com Google/],
    [{ status: 0, code: "NETWORK" }, "form", /Não conseguimos falar com o servidor/],
    [{ status: 500, code: "INTERNAL_ERROR" }, "form", /Não foi possível concluir o cadastro agora/],
    [{ status: 404, code: "PHOTO_SURVEYS_DISABLED" }, "form", /Não foi possível concluir o cadastro agora/],
  ];
  for (const [error, next, text] of cases) {
    const refusal = registrationRefusal(error);
    assert.equal(refusal.next, next, error.code);
    if (text) assert.match(refusal.text, text, error.code);
    else assert.equal(refusal.text, "", error.code);
  }
});

test("nenhum texto de recusa repete o que veio do servidor", () => {
  const refusal = registrationRefusal({ status: 409, code: "CPF_ALREADY_REGISTERED", message: "<b>529.982.247-25</b>", body: { error: "<b>x</b>" } });
  assert.doesNotMatch(refusal.text, /529|<b>/);
});
