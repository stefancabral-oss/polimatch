import assert from "node:assert/strict";
import test from "node:test";
import { CONSENT_VERSION } from "../../shared/registration.js";
import { createHttpApp, networkPseudonym } from "./http-app.js";
import { cpfPseudonym } from "./registration-store.js";

const NOW = new Date("2026-11-20T15:00:00.000Z");
const SECRET = "segredo-de-teste-com-mais-de-trinta-e-dois-caracteres";
const CPF = "52998224725";
const googleIdentity = { configured: false, verify: async () => ({ subject: "test" }) };
const BODY = Object.freeze({ cpf: "529.982.247-25", ageRange: "25-34", gender: "mulher", state: "SP", consent: true, consentVersion: CONSENT_VERSION });
const BEARER = { Authorization: "Bearer pms_sessao" };
// Toda resposta traz um requestId aleatório: a busca é pelo CPF inteiro, com
// ou sem pontuação, e não por um trecho de três dígitos que o acaso produz.
const ANY_TEST_CPF = /52998224725|529\.982\.247|529 982 247|11111111111|111\.111\.111/;

function harness(overrides = {}, env = {}) {
  const calls = [];
  const logs = [];
  const store = {
    health: async () => {},
    registerCpf: async (input) => {
      calls.push(input);
      return { status: "created", registeredAt: NOW.toISOString() };
    },
    ...overrides,
  };
  const logger = Object.fromEntries(["debug", "info", "warn", "error"].map((level) => [level, (entry) => logs.push(entry)]));
  const app = createHttpApp({
    store,
    googleIdentity,
    logger,
    env: { PHOTO_SURVEYS_ENABLED: "true", VOTER_NETWORK_SECRET: SECRET, ...env },
    clock: () => NOW,
  });
  return { app, calls, logs };
}

async function withServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

const post = (url, body, headers = {}) => fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body ?? {}),
});

test("o código do CPF depende do segredo, é estável e não é o pseudônimo de rede", () => {
  const code = cpfPseudonym(CPF, SECRET);
  assert.match(code, /^[0-9a-f]{64}$/);
  assert.equal(cpfPseudonym(CPF, SECRET), code);
  assert.notEqual(cpfPseudonym(CPF, `${SECRET}!`), code);
  assert.notEqual(cpfPseudonym("11144477735", SECRET), code);
  assert.notEqual(networkPseudonym(CPF, SECRET), code);
  assert.ok(!code.includes(CPF));
});

test("o código só é calculado para onze dígitos e com segredo", () => {
  for (const value of ["529.982.247-25", "5299822472", "529982247250", "", null, undefined, 52998224725]) {
    assert.throws(() => cpfPseudonym(value, SECRET), /onze dígitos/);
  }
  assert.throws(() => cpfPseudonym(CPF, ""), /VOTER_NETWORK_SECRET/);
});

test("o cadastro exige sessão antes de chegar ao store", async () => {
  const { app, calls } = harness();
  await withServer(app, async (base) => {
    const response = await post(`${base}/api/registration`, BODY);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "PLAYER_SESSION_REQUIRED");
  });
  assert.deepEqual(calls, []);
});

test("o store recebe o código do CPF, nunca o número", async () => {
  const { app, calls } = harness();
  await withServer(app, async (base) => {
    const response = await post(`${base}/api/registration`, BODY, BEARER);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { registered: true, status: "created", registeredAt: NOW.toISOString() });
  });
  assert.deepEqual(calls, [{
    recoveryKey: "pms_sessao",
    cpfHash: cpfPseudonym(CPF, SECRET),
    ageRange: "25-34",
    gender: "mulher",
    state: "SP",
    consentVersion: CONSENT_VERSION,
    now: NOW,
  }]);
  assert.ok(!JSON.stringify(calls).includes(CPF));
});

test("o mesmo CPF escrito de outro jeito dá o mesmo código", async () => {
  const { app, calls } = harness();
  await withServer(app, async (base) => {
    for (const cpf of ["52998224725", "529.982.247-25", " 529 982 247 25 "]) {
      assert.equal((await post(`${base}/api/registration`, { ...BODY, cpf }, BEARER)).status, 200, cpf);
    }
  });
  assert.equal(new Set(calls.map((call) => call.cpfHash)).size, 1);
});

test("pedido inválido é recusado sem chegar ao store e sem devolver o CPF", async () => {
  const { app, calls } = harness();
  const cases = [
    [{ cpf: "529.982.247-24" }, "CPF_INVALID", "cpf"],
    [{ cpf: "111.111.111-11" }, "CPF_INVALID", "cpf"],
    [{ cpf: 52998224725 }, "CPF_INVALID", "cpf"],
    [{ ageRange: "idade" }, "REGISTRATION_INVALID", "ageRange"],
    [{ gender: "x" }, "REGISTRATION_INVALID", "gender"],
    [{ state: "sp" }, "REGISTRATION_INVALID", "state"],
    [{ consent: false }, "CONSENT_REQUIRED", "consent"],
    [{ consentVersion: "2020-01-01" }, "CONSENT_VERSION_MISMATCH", "consentVersion"],
  ];
  await withServer(app, async (base) => {
    for (const [change, code, field] of cases) {
      const response = await post(`${base}/api/registration`, { ...BODY, ...change }, BEARER);
      const text = await response.text();
      assert.equal(response.status, 400, code);
      const body = JSON.parse(text);
      assert.equal(body.code, code);
      assert.deepEqual(body.current, { field });
      assert.doesNotMatch(text, ANY_TEST_CPF);
    }
    const empty = await post(`${base}/api/registration`, "", BEARER);
    assert.equal(empty.status, 400);
    assert.equal((await empty.json()).code, "CPF_INVALID");
  });
  assert.deepEqual(calls, []);
});

test("as recusas do store saem com o código e o prazo, sem detalhe a mais", async () => {
  const refusals = [
    [{ status: 403, code: "GOOGLE_ACCOUNT_REQUIRED", message: "entre com Google para se cadastrar" }, {}],
    [{ status: 409, code: "CPF_ALREADY_REGISTERED", message: "este CPF já tem cadastro em outra conta" }, {}],
    [{ status: 409, code: "REGISTRATION_EXISTS", message: "esta conta já tem cadastro" }, {}],
    [{ status: 429, code: "REGISTRATION_ATTEMPT_LIMIT", message: "muitas tentativas de cadastro hoje", retryAfterSeconds: 3600 }, { retryAfterSeconds: 3600 }],
  ];
  for (const [refusal, extra] of refusals) {
    const { app } = harness({ registerCpf: async () => { throw Object.assign(new Error(refusal.message), refusal); } });
    await withServer(app, async (base) => {
      const response = await post(`${base}/api/registration`, BODY, BEARER);
      assert.equal(response.status, refusal.status, refusal.code);
      const body = await response.json();
      assert.equal(body.code, refusal.code);
      assert.equal(body.retryAfterSeconds, extra.retryAfterSeconds);
      if (extra.retryAfterSeconds) assert.equal(response.headers.get("retry-after"), "3600");
      assert.doesNotMatch(JSON.stringify(body), ANY_TEST_CPF);
    });
  }
});

test("nem o log de requisição nem o de falha levam o CPF", async () => {
  const { app, logs } = harness({ registerCpf: async () => { throw new Error("banco fora do ar"); } });
  await withServer(app, async (base) => {
    const failed = await post(`${base}/api/registration`, BODY, BEARER);
    assert.equal(failed.status, 500);
    assert.doesNotMatch(await failed.text(), ANY_TEST_CPF);
    await post(`${base}/api/registration`, { ...BODY, cpf: "529.982.247-24" }, BEARER);
  });
  assert.ok(logs.length >= 2);
  const text = JSON.stringify(logs);
  assert.doesNotMatch(text, ANY_TEST_CPF);
  assert.doesNotMatch(text, /pms_sessao/);
  assert.match(text, /\/api\/registration/);
});

test("com as pesquisas desligadas, o cadastro também responde 404 e nada é gravado", async () => {
  const { app, calls } = harness({}, { PHOTO_SURVEYS_ENABLED: "" });
  await withServer(app, async (base) => {
    const response = await post(`${base}/api/registration`, BODY, BEARER);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "PHOTO_SURVEYS_DISABLED");
  });
  assert.deepEqual(calls, []);
});
