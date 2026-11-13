import assert from "node:assert/strict";
import test from "node:test";
import { createHttpApp } from "./http-app.js";

const NOW = new Date("2026-11-20T15:00:00.000Z");
const googleIdentity = { configured: false, verify: async () => ({ subject: "test" }) };
const SURVEY_VIEW = { id: "politica-2026-01", question: "Quem você prefere?", status: "open" };

function harness(overrides = {}, env = { PHOTO_SURVEYS_ENABLED: "true" }) {
  const calls = [];
  const store = {
    health: async () => {},
    photoSurvey: async (...args) => { calls.push(["photoSurvey", ...args]); return SURVEY_VIEW; },
    photoSurveyDraw: async (...args) => { calls.push(["photoSurveyDraw", ...args]); return { survey: SURVEY_VIEW, draw: { groups: [] }, response: null }; },
    photoSurveyRespond: async (...args) => { calls.push(["photoSurveyRespond", ...args]); return { status: "created" }; },
    ...overrides,
  };
  return { calls, app: createHttpApp({ store, googleIdentity, env, clock: () => NOW }) };
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
  body: JSON.stringify(body ?? {}),
});
const BEARER = { Authorization: "Bearer pm2_jogador" };

test("a definição da pesquisa é pública e não aceita cache", async () => {
  const { app, calls } = harness();
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/photo-surveys/politica-2026-01`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), SURVEY_VIEW);
  });
  assert.deepEqual(calls, [["photoSurvey", "politica-2026-01", { now: NOW }]]);
});

test("sorteio e resposta exigem sessão de jogador antes de chegar ao store", async () => {
  const { app, calls } = harness();
  await withServer(app, async (base) => {
    for (const route of ["draw", "response"]) {
      const response = await post(`${base}/api/photo-surveys/politica-2026-01/${route}`, {});
      assert.equal(response.status, 401, route);
      assert.equal((await response.json()).code, "PLAYER_SESSION_REQUIRED", route);
    }
  });
  assert.deepEqual(calls, []);
});

test("o sorteio repassa a chave, a pesquisa e o relógio", async () => {
  const { app, calls } = harness();
  await withServer(app, async (base) => {
    const response = await post(`${base}/api/photo-surveys/politica-2026-01/draw`, { cardIds: ["ignorado"] }, BEARER);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { survey: SURVEY_VIEW, draw: { groups: [] }, response: null });
  });
  assert.deepEqual(calls, [["photoSurveyDraw", "pm2_jogador", "politica-2026-01", { now: NOW }]]);
});

test("a resposta repassa só o recibo, as escolhas e a escolhida", async () => {
  const { app, calls } = harness();
  const body = {
    answerId: "5f0c2c0e-8a55-4a52-9d6c-0d2b8a1f3c11",
    pickIds: ["a", "b", "c", "d"],
    championId: "c",
    shownIds: ["forjado"],
    surveyId: "outra",
    now: "2000-01-01T00:00:00Z",
  };
  await withServer(app, async (base) => {
    const response = await post(`${base}/api/photo-surveys/politica-2026-01/response`, body, BEARER);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { status: "created" });
  });
  assert.deepEqual(calls, [["photoSurveyRespond", {
    recoveryKey: "pm2_jogador",
    surveyId: "politica-2026-01",
    answerId: body.answerId,
    pickIds: body.pickIds,
    championId: "c",
    now: NOW,
  }]]);
});

test("erros da pesquisa chegam com status, código e a resposta já gravada", async () => {
  const current = { answerId: "x", pickIds: ["a", "b", "c", "d"], championId: "a", respondedAt: NOW.toISOString() };
  const { app } = harness({
    photoSurvey: async () => { throw Object.assign(new Error("pesquisa não encontrada"), { status: 404, code: "PHOTO_SURVEY_NOT_FOUND" }); },
    photoSurveyDraw: async () => { throw Object.assign(new Error("pesquisa fechada"), { status: 409, code: "PHOTO_SURVEY_CLOSED", current: { status: "closed" } }); },
    photoSurveyRespond: async () => { throw Object.assign(new Error("esta pesquisa já foi respondida"), { status: 409, code: "PHOTO_SURVEY_ALREADY_ANSWERED", current }); },
  });
  await withServer(app, async (base) => {
    const missing = await fetch(`${base}/api/photo-surveys/nao-existe`);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).code, "PHOTO_SURVEY_NOT_FOUND");

    const closed = await post(`${base}/api/photo-surveys/politica-2026-01/draw`, {}, BEARER);
    assert.equal(closed.status, 409);
    assert.deepEqual((({ code, current: state }) => ({ code, state }))(await closed.json()), { code: "PHOTO_SURVEY_CLOSED", state: { status: "closed" } });

    const answered = await post(`${base}/api/photo-surveys/politica-2026-01/response`, {}, BEARER);
    assert.equal(answered.status, 409);
    const payload = await answered.json();
    assert.equal(payload.code, "PHOTO_SURVEY_ALREADY_ANSWERED");
    assert.deepEqual(payload.current, current);
    assert.ok(payload.requestId);
  });
});

test("corpo malformado é recusado antes do store", async () => {
  const { app, calls } = harness();
  await withServer(app, async (base) => {
    const response = await fetch(`${base}/api/photo-surveys/politica-2026-01/response`, {
      method: "POST", headers: { "Content-Type": "application/json", ...BEARER }, body: "{não é json",
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INVALID_JSON");
  });
  assert.deepEqual(calls, []);
});

test("sem PHOTO_SURVEYS_ENABLED=true as três rotas ficam desligadas e não chegam ao store", async () => {
  for (const env of [{}, { PHOTO_SURVEYS_ENABLED: "false" }, { PHOTO_SURVEYS_ENABLED: "1" }, { PHOTO_SURVEYS_ENABLED: "TRUE" }]) {
    const { app, calls } = harness({}, env);
    await withServer(app, async (base) => {
      const responses = [
        await fetch(`${base}/api/photo-surveys/politica-2026-01`),
        await post(`${base}/api/photo-surveys/politica-2026-01/draw`, {}, BEARER),
        await post(`${base}/api/photo-surveys/politica-2026-01/response`, {}, BEARER),
      ];
      for (const response of responses) {
        assert.equal(response.status, 404, JSON.stringify(env));
        assert.equal((await response.json()).code, "PHOTO_SURVEYS_DISABLED");
        assert.equal(response.headers.get("cache-control"), "no-store");
      }
    });
    assert.deepEqual(calls, [], JSON.stringify(env));
  }
});
