import assert from "node:assert/strict";
import test from "node:test";
import { createLogger, logLevelFromEnvironment, redactSecrets, serializeError } from "./logger.js";

function capture(options = {}) {
  const lines = [];
  return { lines, logger: createLogger({ write: (line) => lines.push(line), clock: () => new Date("2026-10-31T12:00:00Z"), ...options }) };
}

test("each call writes exactly one JSON line with timestamp, level and base fields", () => {
  const { lines, logger } = capture({ base: { service: "polimatch-api", rev: null } });
  logger.info({ event: "listening", port: 3001 });
  assert.equal(lines.length, 1);
  assert.ok(lines[0].endsWith("\n"));
  assert.equal(lines[0].trimEnd().includes("\n"), false);
  assert.deepEqual(JSON.parse(lines[0]), {
    t: "2026-10-31T12:00:00.000Z", level: "info", service: "polimatch-api", rev: null, event: "listening", port: 3001,
  });
});

test("levels below the threshold are dropped", () => {
  const { lines, logger } = capture({ level: "warn" });
  logger.debug({ event: "a" });
  logger.info({ event: "b" });
  logger.warn({ event: "c" });
  logger.error({ event: "d" });
  logger.fatal({ event: "e" });
  assert.deepEqual(lines.map((line) => JSON.parse(line).event), ["c", "d", "e"]);
});

test("errors are serialized with type, message, code and stack", () => {
  const { lines, logger } = capture();
  const error = Object.assign(new Error("terminating connection"), { code: "57P01" });
  logger.error({ event: "pg_pool_error", err: error });
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.err.type, "Error");
  assert.equal(entry.err.message, "terminating connection");
  assert.equal(entry.err.code, "57P01");
  assert.match(entry.err.stack, /logger\.test\.js/);
  assert.deepEqual(serializeError("plain"), { message: "plain" });
});

test("bearer tokens, player keys and database credentials never reach the output", () => {
  const { lines, logger } = capture();
  logger.error({
    event: "x",
    message: "Authorization: Bearer abc.def-ghi pm2_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA pms_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    err: new Error("connect postgres://admin:hunter2@db.internal/app password=hunter2"),
  });
  const line = lines[0];
  for (const secret of ["abc.def-ghi", "pm2_AAAA", "pms_BBBB", "hunter2"]) assert.equal(line.includes(secret), false, secret);
  assert.ok(JSON.parse(line));
  assert.equal(redactSecrets("postgresql://u:p@h:5432/db"), "postgresql://[redacted]@h:5432/db");
});

test("logging never throws, even with circular data or a broken stream", () => {
  const circular = { event: "loop" };
  circular.self = circular;
  const { lines, logger } = capture();
  assert.doesNotThrow(() => logger.info(circular));
  assert.equal(JSON.parse(lines[0]).event, "log_serialization_failed");
  const broken = createLogger({ write: () => { throw new Error("EPIPE"); } });
  assert.doesNotThrow(() => broken.error({ event: "x" }));
  assert.doesNotThrow(() => capture().logger.info({ big: 10n }));
});

test("child loggers extend the base fields", () => {
  const { lines, logger } = capture({ base: { service: "polimatch-api" } });
  logger.child({ component: "pool" }).warn({ event: "x" });
  assert.deepEqual(Object.keys(JSON.parse(lines[0])), ["t", "level", "service", "component", "event"]);
});

test("LOG_LEVEL falls back to info when absent or unknown", () => {
  assert.equal(logLevelFromEnvironment({}), "info");
  assert.equal(logLevelFromEnvironment({ LOG_LEVEL: "WARN" }), "warn");
  assert.equal(logLevelFromEnvironment({ LOG_LEVEL: "verbose" }), "info");
});
