import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { closeHttpServer, installProcessGuards } from "./process-guards.js";

function harness({ close = async () => {}, forceExitMs = 1000 } = {}) {
  const processRef = new EventEmitter();
  const logs = [];
  const exits = [];
  let closes = 0;
  const logger = Object.fromEntries(["info", "warn", "error", "fatal"].map((level) => [level, (entry) => logs.push({ level, ...entry })]));
  let resolveExit;
  const exited = new Promise((resolve) => { resolveExit = resolve; });
  const guards = installProcessGuards({
    processRef,
    logger,
    forceExitMs,
    close: async () => { closes += 1; await close(); },
    exit: (code) => { exits.push(code); resolveExit(code); },
  });
  return { processRef, logs, exits, exited, guards, closes: () => closes };
}

test("unhandled rejections are logged and the process keeps serving", async () => {
  const { processRef, logs, exits, closes, guards } = harness();
  processRef.emit("unhandledRejection", new Error("promessa esquecida"), Promise.resolve());
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(exits, []);
  assert.equal(closes(), 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].event, "unhandled_rejection");
  assert.equal(logs[0].level, "error");
  assert.equal(logs[0].fatal, false);
  assert.equal(logs[0].err.message, "promessa esquecida");
  guards.uninstall();
});

test("uncaught exceptions are logged, close the server and pool, then exit non-zero", async () => {
  const { processRef, logs, exited, closes, guards } = harness();
  processRef.emit("uncaughtException", new Error("estado corrompido"), "uncaughtException");
  assert.equal(await exited, 1);
  assert.equal(closes(), 1);
  assert.equal(processRef.exitCode, 1);
  const fatal = logs.find((entry) => entry.event === "uncaught_exception");
  assert.equal(fatal.level, "fatal");
  assert.equal(fatal.err.message, "estado corrompido");
  assert.deepEqual(logs.map(({ event }) => event), ["uncaught_exception", "shutdown_started", "shutdown_completed"]);
  guards.uninstall();
});

test("termination signals close gracefully with exit code zero", async () => {
  const { processRef, exited, closes, guards } = harness();
  processRef.emit("SIGTERM", "SIGTERM");
  assert.equal(await exited, 0);
  assert.equal(closes(), 1);
  guards.uninstall();
});

test("a hanging close is cut by the force-exit timer", async () => {
  const { processRef, logs, exited, guards } = harness({ close: () => new Promise(() => {}), forceExitMs: 30 });
  processRef.emit("uncaughtException", new Error("travou"), "uncaughtException");
  assert.equal(await exited, 1);
  assert.ok(logs.some((entry) => entry.event === "shutdown_forced"));
  guards.uninstall();
});

test("a second exception during shutdown exits immediately and close runs once", async () => {
  const { processRef, exits, exited, closes, guards } = harness({ close: () => new Promise(() => {}), forceExitMs: 5000 });
  processRef.emit("uncaughtException", new Error("primeira"), "uncaughtException");
  processRef.emit("uncaughtException", new Error("segunda"), "uncaughtException");
  assert.equal(await exited, 1);
  assert.deepEqual(exits, [1]);
  assert.equal(closes(), 1);
  guards.uninstall();
});

test("a failing close still exits non-zero", async () => {
  const { processRef, logs, exited, guards } = harness({ close: async () => { throw new Error("pool.end falhou"); } });
  processRef.emit("SIGTERM", "SIGTERM");
  assert.equal(await exited, 1);
  assert.ok(logs.some((entry) => entry.event === "shutdown_failed"));
  guards.uninstall();
});

test("closing the HTTP server waits for it and tolerates a server that never listened", async () => {
  await closeHttpServer(null);
  const server = createServer((_req, res) => res.end("ok"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(await response.text(), "ok");
  await closeHttpServer(server);
  assert.equal(server.listening, false);
});
