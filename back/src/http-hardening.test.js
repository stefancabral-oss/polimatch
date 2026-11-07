import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { createHttpApp } from "./http-app.js";
import { createLogger } from "./logger.js";

const googleIdentity = { configured: false, verify: async () => ({ subject: "test" }) };

function fakeStore(overrides = {}) {
  return {
    health: async () => {},
    createPlayer: async () => ({ recoveryKey: "pm2_test" }),
    playerRanking: async () => ({ ranking: [] }),
    roundVote: async () => ({ ok: true }),
    ...overrides,
  };
}

function captureLogger(base = {}) {
  const lines = [];
  const logger = createLogger({ base, write: (line) => lines.push(line) });
  return { logger, lines, entries: () => lines.map((line) => JSON.parse(line)) };
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
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function rawRequest(baseUrl, { method = "POST", path = "/api/player", headers = {}, body = Buffer.alloc(0) }) {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = request({ method, hostname: url.hostname, port: url.port, path: url.pathname, headers: { "Content-Length": body.length, ...headers } }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) });
      });
    });
    req.on("error", reject);
    req.end(body);
  });
}

// Espera a linha de log da requisição: ela sai no evento finish da resposta.
const settle = () => new Promise((resolve) => setImmediate(resolve));

test("responses do not advertise the framework", async () => {
  await withServer(createHttpApp({ store: fakeStore(), googleIdentity, env: {} }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-powered-by"), null);
  });
});

test("compressed request bodies are refused with 415 before any store write", async () => {
  let writes = 0;
  const store = fakeStore({ roundVote: async () => { writes += 1; return { ok: true }; } });
  await withServer(createHttpApp({ store, googleIdentity, env: {} }), async (baseUrl) => {
    const valid = gzipSync(Buffer.from(JSON.stringify({ roundId: "x" })));
    const cases = [
      ["gzip", valid],
      ["gzip", Buffer.concat([valid, Buffer.from("x".repeat(32))])],
      ["deflate", Buffer.from("not really deflate")],
      ["br", Buffer.from("not really brotli")],
      ["GZIP", valid],
      ["identity, gzip", valid],
    ];
    for (const [encoding, body] of cases) {
      const response = await rawRequest(baseUrl, {
        path: "/api/round-vote",
        headers: { "Content-Type": "application/json", "Content-Encoding": encoding, Authorization: "Bearer pm2_player" },
        body,
      });
      assert.equal(response.status, 415, encoding);
      assert.equal(response.json().code, "UNSUPPORTED_CONTENT_ENCODING", encoding);
      assert.equal(typeof response.json().requestId, "string");
    }
    assert.equal(writes, 0);
    // O processo continua atendendo depois de todas as recusas.
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  });
});

test("an explicit identity encoding is accepted", async () => {
  let received = null;
  const store = fakeStore({ roundVote: async (input) => { received = input; return { ok: true }; } });
  await withServer(createHttpApp({ store, googleIdentity, env: {} }), async (baseUrl) => {
    const response = await rawRequest(baseUrl, {
      path: "/api/round-vote",
      headers: { "Content-Type": "application/json", "Content-Encoding": "identity", Authorization: "Bearer pm2_player" },
      body: Buffer.from(JSON.stringify({ roundId: "r1", winnerId: "lula", candidateIds: ["a", "b", "c", "d"] })),
    });
    assert.equal(response.status, 200);
    assert.equal(received.roundId, "r1");
  });
});

test("malformed and oversized JSON bodies get stable 4xx codes without echoing the body", async () => {
  await withServer(createHttpApp({ store: fakeStore(), googleIdentity, env: {} }), async (baseUrl) => {
    for (const body of ['{"roundId": "abc', "not json at all", '{"a":1}garbage']) {
      const response = await rawRequest(baseUrl, {
        path: "/api/round-vote",
        headers: { "Content-Type": "application/json", Authorization: "Bearer pm2_player" },
        body: Buffer.from(body),
      });
      assert.equal(response.status, 400, body);
      assert.deepEqual(Object.keys(response.json()).sort(), ["code", "error", "requestId"]);
      assert.equal(response.json().code, "INVALID_JSON");
      // Mensagem fixa: nada do corpo recebido volta na resposta.
      assert.equal(response.json().error, "corpo JSON inválido");
    }

    const oversized = await rawRequest(baseUrl, {
      path: "/api/round-vote",
      headers: { "Content-Type": "application/json", Authorization: "Bearer pm2_player" },
      body: Buffer.from(JSON.stringify({ padding: "x".repeat(40 * 1024) })),
    });
    assert.equal(oversized.status, 413);
    assert.equal(oversized.json().code, "PAYLOAD_TOO_LARGE");

    const charset = await rawRequest(baseUrl, {
      path: "/api/round-vote",
      headers: { "Content-Type": "application/json; charset=latin1", Authorization: "Bearer pm2_player" },
      body: Buffer.from("{}"),
    });
    assert.equal(charset.status, 415);
    assert.equal(charset.json().code, "UNSUPPORTED_CHARSET");

    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
  });
});

test("each request produces one JSON log line with route, status, latency, code and request id", async () => {
  const { logger, lines, entries } = captureLogger({ service: "polimatch-api", rev: "a".repeat(40) });
  const store = fakeStore({
    createPlayer: async () => {
      throw Object.assign(new Error("limite diário de novos jogadores nesta rede atingido"), {
        status: 429, code: "PLAYER_ISSUANCE_LIMIT", retryAfterSeconds: 86400,
      });
    },
  });
  await withServer(createHttpApp({ store, googleIdentity, env: {}, logger }), async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health?probe=1`);
    const limited = await fetch(`${baseUrl}/api/player`, { method: "POST", headers: { Authorization: "Bearer pm2_secret-recovery-key-value-1234567890" } });
    const missing = await fetch(`${baseUrl}/api/nao-existe?token=abc`);
    await settle();

    const requests = entries().filter((entry) => entry.event === "http_request");
    assert.equal(requests.length, 3);
    const [healthLine, limitedLine, missingLine] = requests;

    assert.equal(healthLine.level, "info");
    assert.equal(healthLine.service, "polimatch-api");
    assert.equal(healthLine.rev, "a".repeat(40));
    assert.equal(healthLine.method, "GET");
    assert.equal(healthLine.route, "/api/health");
    assert.equal(healthLine.status, 200);
    assert.equal(healthLine.code, null);
    assert.equal(healthLine.requestId, health.headers.get("x-request-id"));
    assert.equal(typeof healthLine.ms, "number");
    assert.ok(healthLine.ms >= 0);
    assert.match(healthLine.t, /^\d{4}-\d{2}-\d{2}T/);

    assert.equal(limitedLine.route, "/api/player");
    assert.equal(limitedLine.status, 429);
    assert.equal(limitedLine.code, "PLAYER_ISSUANCE_LIMIT");
    assert.equal(limitedLine.requestId, limited.headers.get("x-request-id"));

    assert.equal(missingLine.status, 404);
    assert.equal(missingLine.route, null);
    assert.equal(missingLine.path, "/api/nao-existe");
    assert.equal(missing.status, 404);

    // Recusas contáveis por grep no log do container, com o código.
    assert.equal(lines.filter((line) => line.includes('"status":429')).length, 1);
    assert.ok(lines.find((line) => line.includes('"status":429')).includes('"code":"PLAYER_ISSUANCE_LIMIT"'));
    // Sem IP, sem cabeçalhos, sem query string, sem token.
    const allowed = new Set(["t", "level", "service", "rev", "event", "requestId", "method", "route", "status", "ms", "code", "path", "aborted"]);
    for (const entry of requests) {
      for (const key of Object.keys(entry)) assert.ok(allowed.has(key), `campo inesperado ${key}`);
    }
    const joined = lines.join("");
    assert.equal(joined.includes("127.0.0.1"), false);
    assert.equal(joined.includes("secret-recovery-key"), false);
    assert.equal(joined.toLowerCase().includes("authorization"), false);
    assert.equal(joined.includes("probe=1") || joined.includes("token=abc"), false);
  });
});

test("error codes from responses outside sendError reach the request log", async () => {
  const { logger, entries } = captureLogger();
  await withServer(createHttpApp({ store: fakeStore(), googleIdentity, env: { NODE_ENV: "development" }, logger }), async (baseUrl) => {
    const denied = await fetch(`${baseUrl}/api/player`, { method: "POST", headers: { Origin: "https://evil.example" } });
    const withheld = await fetch(`${baseUrl}/api/ranking`);
    const refused = await rawRequest(baseUrl, { headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" }, body: Buffer.from("x") });
    await settle();
    assert.equal(denied.status, 403);
    assert.equal(withheld.status, 403);
    assert.equal(refused.status, 415);
    const codes = entries().filter((entry) => entry.event === "http_request").map((entry) => [entry.status, entry.code]);
    assert.deepEqual(codes, [
      [403, "CORS_ORIGIN_DENIED"],
      [403, "AGGREGATE_PUBLICATION_WITHHELD"],
      [415, "UNSUPPORTED_CONTENT_ENCODING"],
    ]);
  });
});

test("5xx failures log the stack with the request id next to the request line", async () => {
  const { logger, entries } = captureLogger();
  const store = fakeStore({ playerRanking: async () => { throw new Error("falha inesperada no ranking pessoal"); } });
  await withServer(createHttpApp({ store, googleIdentity, env: {}, logger }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/player/state`, { headers: { Authorization: "Bearer pm2_player" } });
    await settle();
    assert.equal(response.status, 500);
    const requestId = response.headers.get("x-request-id");
    const failure = entries().find((entry) => entry.event === "request_failed");
    assert.equal(failure.level, "error");
    assert.equal(failure.requestId, requestId);
    assert.equal(failure.status, 500);
    assert.match(failure.error, /falha inesperada no ranking pessoal/);
    assert.match(failure.error, /http-hardening\.test\.js/);
    const line = entries().find((entry) => entry.event === "http_request");
    assert.deepEqual([line.status, line.code, line.requestId], [500, "INTERNAL_ERROR", requestId]);
  });
});

test("transient database failures answer 503 with a retry hint instead of a generic 500", async () => {
  const { logger, entries } = captureLogger();
  const cases = [
    Object.assign(new Error("canceling statement due to statement timeout"), { code: "57014" }),
    Object.assign(new Error("canceling statement due to lock timeout"), { code: "55P03" }),
    Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" }),
    new Error("timeout exceeded when trying to connect"),
    new Error("Client has encountered a connection error and is not queryable"),
  ];
  for (const failure of cases) {
    const store = fakeStore({ playerRanking: async () => { throw failure; } });
    await withServer(createHttpApp({ store, googleIdentity, env: {}, logger }), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/player/state`, { headers: { Authorization: "Bearer pm2_player" } });
      const body = await response.json();
      assert.equal(response.status, 503, failure.message);
      assert.equal(response.headers.get("retry-after"), "5");
      assert.deepEqual(Object.keys(body).sort(), ["code", "error", "requestId"]);
      assert.equal(body.code, "DATABASE_UNAVAILABLE");
      assert.equal(JSON.stringify(body).includes(failure.message), false);
    });
  }
  await settle();
  const failures = entries().filter((entry) => entry.event === "request_failed");
  assert.equal(failures.length, cases.length);
  assert.deepEqual(failures.slice(0, 3).map((entry) => entry.errorCode), ["57014", "55P03", "57P01"]);
});

test("explicit 5xx errors that are not database outages keep the internal error contract", async () => {
  const store = fakeStore({ health: async () => { throw new Error("falha qualquer"); } });
  await withServer(createHttpApp({ store, googleIdentity, env: {}, logger: { error() {} } }), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "INTERNAL_ERROR");
    assert.equal(response.headers.get("retry-after"), null);
  });
});
