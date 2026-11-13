import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { gzipSync } from "node:zlib";
import {
  CLIENT_ERROR_LIMITS,
  CLIENT_ERROR_MAX_BYTES,
  createClientErrorLimiter,
  normalizeClientErrorReport,
} from "./client-error-report.js";
import { createHttpApp } from "./http-app.js";
import { createLogger } from "./logger.js";

const googleIdentity = { configured: false, verify: async () => ({ subject: "test" }) };
const store = { health: async () => {} };
const SHA = "0123456789abcdef0123456789abcdef01234567";

function validReport(overrides = {}) {
  return {
    build: SHA,
    page: "/quem-disse-isso.html",
    kind: "error",
    message: "teste forçado",
    source: "https://polimatch.com.br/assets/main-abc.js",
    line: 12,
    column: 34,
    stack: "Error: teste forçado\n    at https://polimatch.com.br/assets/main-abc.js:12:34",
    ...overrides,
  };
}

function captureLogger() {
  const lines = [];
  const logger = createLogger({ base: { service: "polimatch-api", rev: null }, write: (line) => lines.push(line) });
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

function post(baseUrl, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  const url = new URL("/api/client-errors", baseUrl);
  return new Promise((resolve, reject) => {
    const req = request({
      method: "POST",
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { "Content-Type": "text/plain;charset=UTF-8", "Content-Length": payload.length, ...headers },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test("a valid report keeps only known fields, trimmed and without URL queries", () => {
  const normalized = normalizeClientErrorReport(JSON.stringify(validReport({
    page: "/index.html?ref=x#ranking",
    source: "https://polimatch.com.br/assets/main-abc.js?v=1",
    stack: `Error: x\n    at https://polimatch.com.br/assets/main-abc.js?v=1:1:2\n${"y".repeat(5000)}`,
    message: "m".repeat(1000),
    recoveryKey: "pm2_should-never-be-kept",
    userAgent: "ignored",
    line: -1,
    column: 1.5,
  })));
  assert.deepEqual(Object.keys(normalized), ["build", "page", "kind", "message", "source", "line", "column", "stack"]);
  assert.equal(normalized.build, SHA);
  assert.equal(normalized.page, "/index.html");
  assert.equal(normalized.source, "https://polimatch.com.br/assets/main-abc.js");
  assert.match(normalized.stack, /main-abc\.js:1:2/);
  assert.equal(normalized.stack.includes("?v=1"), false);
  assert.equal(normalized.stack.length, 1200);
  assert.equal(normalized.message.length, 300);
  assert.equal(normalized.line, null);
  assert.equal(
    normalizeClientErrorReport(validReport({ message: "Failed to fetch dynamically imported module: /assets/x.js?v=1#a" })).message,
    "Failed to fetch dynamically imported module: /assets/x.js",
  );
  assert.equal(normalized.column, null);
});

test("malformed reports are refused and an unknown build is not echoed", () => {
  for (const raw of ["not json", "[]", "null", JSON.stringify({ kind: "error" }), JSON.stringify(validReport({ kind: "console" })), JSON.stringify(validReport({ message: 42 }))]) {
    assert.throws(() => normalizeClientErrorReport(raw), (error) => error.status === 400 && error.code === "INVALID_CLIENT_ERROR", raw);
  }
  assert.equal(normalizeClientErrorReport(validReport({ build: "<script>" })).build, "unknown");
  assert.equal(normalizeClientErrorReport(validReport({ page: "https://elsewhere.example/" })).page, null);
  assert.equal(normalizeClientErrorReport(validReport({ message: "", stack: "Error: só stack" })).message, null);
});

test("the limiter caps each network and the whole process per minute", () => {
  let now = 0;
  const limiter = createClientErrorLimiter({ perNetworkPerMinute: 2, globalPerMinute: 3, now: () => now });
  assert.deepEqual([limiter.take("a"), limiter.take("a"), limiter.take("a")], [true, true, false]);
  assert.deepEqual([limiter.take("b"), limiter.take("c")], [true, false]);
  now = 60000;
  assert.deepEqual([limiter.take("a"), limiter.take("c")], [true, true]);
  assert.ok(CLIENT_ERROR_LIMITS.perNetworkPerMinute <= CLIENT_ERROR_LIMITS.globalPerMinute);
});

test("POST /api/client-errors logs one client_error line with the build and answers 204", async () => {
  const { logger, lines, entries } = captureLogger();
  await withServer(createHttpApp({ store, googleIdentity, env: {}, logger }), async (baseUrl) => {
    const response = await post(baseUrl, validReport({ message: "teste com pm2_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG" }), {
      Authorization: "Bearer pm2_header-token-never-logged-0123456789",
    });
    await settle();
    assert.equal(response.status, 204);
    assert.equal(response.text, "");
    const reports = entries().filter((entry) => entry.event === "client_error");
    assert.equal(reports.length, 1);
    assert.equal(reports[0].level, "warn");
    assert.equal(reports[0].build, SHA);
    assert.equal(reports[0].page, "/quem-disse-isso.html");
    assert.equal(reports[0].kind, "error");
    assert.match(reports[0].message, /teste com \[redacted-token\]/);
    const request = entries().find((entry) => entry.event === "http_request");
    assert.deepEqual([request.route, request.status], ["/api/client-errors", 204]);
    assert.equal(reports[0].requestId, request.requestId);
    const joined = lines.join("");
    assert.equal(joined.includes("127.0.0.1"), false);
    assert.equal(joined.includes("header-token"), false);
    assert.equal(joined.includes("abcdefghijklmnopqrstuvwxyz"), false);
  });
});

test("reports above 2 KB, compressed or malformed get 4xx and are not logged", async () => {
  const { logger, entries } = captureLogger();
  await withServer(createHttpApp({ store, googleIdentity, env: {}, logger }), async (baseUrl) => {
    const oversized = await post(baseUrl, validReport({ stack: "x".repeat(CLIENT_ERROR_MAX_BYTES) }));
    assert.equal(oversized.status, 413);
    assert.equal(oversized.json().code, "PAYLOAD_TOO_LARGE");
    const compressed = await post(baseUrl, gzipSync(Buffer.from(JSON.stringify(validReport()))), { "Content-Encoding": "gzip" });
    assert.equal(compressed.status, 415);
    const malformed = await post(baseUrl, "{\"kind\":");
    assert.equal(malformed.status, 400);
    assert.equal(malformed.json().code, "INVALID_CLIENT_ERROR");
    const json = await post(baseUrl, validReport(), { "Content-Type": "application/json" });
    assert.equal(json.status, 204);
    const missingType = await post(baseUrl, validReport(), { "Content-Type": "application/octet-stream" });
    assert.equal(missingType.status, 400);
    await settle();
    assert.equal(entries().filter((entry) => entry.event === "client_error").length, 1);
  });
});

test("a flood of reports from one network is cut with 429 and counted by code", async () => {
  const { logger, entries } = captureLogger();
  const clientErrorLimiter = createClientErrorLimiter({ perNetworkPerMinute: 2, globalPerMinute: 100 });
  await withServer(createHttpApp({ store, googleIdentity, env: {}, logger, clientErrorLimiter }), async (baseUrl) => {
    const statuses = [];
    for (let index = 0; index < 4; index += 1) statuses.push((await post(baseUrl, validReport({ message: `erro ${index}` }))).status);
    assert.deepEqual(statuses, [204, 204, 429, 429]);
    const limited = await post(baseUrl, validReport());
    assert.equal(limited.json().code, "CLIENT_ERROR_RATE_LIMITED");
    assert.equal(limited.headers["retry-after"], "60");
    await settle();
    assert.equal(entries().filter((entry) => entry.event === "client_error").length, 2);
    assert.equal(entries().filter((entry) => entry.event === "http_request" && entry.code === "CLIENT_ERROR_RATE_LIMITED").length, 3);
  });
});

test("browser origins outside the allowed list cannot send reports", async () => {
  const { logger, entries } = captureLogger();
  await withServer(createHttpApp({ store, googleIdentity, env: { NODE_ENV: "development" }, logger }), async (baseUrl) => {
    const denied = await post(baseUrl, validReport(), { Origin: "https://evil.example" });
    assert.equal(denied.status, 403);
    const local = await post(baseUrl, validReport(), { Origin: "http://127.0.0.1:4173" });
    assert.equal(local.status, 204);
    assert.equal(local.headers["access-control-allow-origin"], "http://127.0.0.1:4173");
    await settle();
    assert.equal(entries().filter((entry) => entry.event === "client_error").length, 1);
  });
});
