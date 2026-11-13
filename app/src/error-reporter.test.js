import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  CLIENT_ERROR_PATH,
  MAX_REPORT_BYTES,
  MAX_REPORTS_PER_PAGE,
  beaconSender,
  buildClientErrorReport,
  entryScriptBuild,
  installErrorReporter,
  releaseBuild,
  scrubText,
} from "./error-reporter.js";

const SHA = "0123456789abcdef0123456789abcdef01234567";
const REPORT_KEYS = ["build", "page", "kind", "message", "source", "line", "column", "stack"];

function fakeWindow(pathname = "/quem-disse-isso.html") {
  const target = new EventTarget();
  target.location = { pathname, search: "?token=pm2_aaaaaaaaaaaaaaaaaaaa", hash: "#x" };
  return target;
}

function harness(options = {}) {
  const target = fakeWindow(options.pathname);
  const sent = [];
  const uninstall = installErrorReporter({ target, endpoint: "/api/client-errors", build: SHA, send: (body) => sent.push(body), ...options });
  return { target, sent, reports: () => sent.map((body) => JSON.parse(body)), uninstall };
}

function errorEvent(fields) {
  return Object.assign(new Event("error"), fields);
}

function rejectionEvent(reason) {
  return Object.assign(new Event("unhandledrejection"), { reason });
}

test("a runtime error becomes a small report with build, page and position", () => {
  const { target, reports } = harness();
  const error = new Error("falhou ao montar a carta");
  target.dispatchEvent(errorEvent({ error, message: `Uncaught Error: ${error.message}`, filename: "https://polimatch.com.br/assets/main-abc.js?v=1", lineno: 10, colno: 5 }));
  const [report] = reports();
  assert.deepEqual(Object.keys(report), REPORT_KEYS);
  assert.equal(report.build, SHA);
  assert.equal(report.page, "/quem-disse-isso.html");
  assert.equal(report.kind, "error");
  assert.equal(report.message, "Uncaught Error: falhou ao montar a carta");
  assert.equal(report.source, "https://polimatch.com.br/assets/main-abc.js");
  assert.deepEqual([report.line, report.column], [10, 5]);
  assert.match(report.stack, /falhou ao montar a carta/);
});

test("unhandled rejections and failed dynamic imports are reported", () => {
  const { target, reports } = harness();
  target.dispatchEvent(rejectionEvent(new TypeError("x is not a function")));
  target.dispatchEvent(rejectionEvent({ recoveryKey: "pm2_aaaaaaaaaaaaaaaaaaaaaaaa", votes: [1, 2] }));
  target.dispatchEvent(Object.assign(new Event("vite:preloadError"), { payload: new Error("Failed to fetch dynamically imported module") }));
  const sent = reports();
  assert.deepEqual(sent.map(({ kind }) => kind), ["unhandledrejection", "unhandledrejection", "preload"]);
  assert.equal(sent[0].message, "x is not a function");
  // Um objeto rejeitado nunca é serializado: só o tipo dele segue.
  assert.equal(sent[1].message, "[object Object]");
  assert.equal(sent[1].stack, null);
  assert.equal(JSON.stringify(sent).includes("recoveryKey"), false);
  assert.match(sent[2].message, /dynamically imported module/);
});

test("tokens and URL queries never leave the browser", () => {
  const { target, sent } = harness();
  const error = new Error("falha com pm2_abcdefghijklmnopqrstuvwxyz e Bearer abc.def");
  error.stack = "Error\n    at https://polimatch.com.br/portraits/001.jpg?v=abc:1:2\n    at https://polimatch.com.br/#/perfil?x=1";
  target.dispatchEvent(errorEvent({ error, message: error.message }));
  const body = sent[0];
  assert.equal(body.includes("pm2_abc"), false);
  assert.equal(body.includes("abc.def"), false);
  assert.equal(body.includes("?v=abc"), false);
  assert.equal(body.includes("x=1"), false);
  assert.equal(body.includes("token="), false);
  assert.match(JSON.parse(body).stack, /001\.jpg:1:2/);
  assert.equal(scrubText("https://a.test/x.js?y=1#z", 100), "https://a.test/x.js");
  assert.equal(scrubText("Failed to fetch dynamically imported module: /assets/a.js?v=1", 100), "Failed to fetch dynamically imported module: /assets/a.js");
  assert.equal(scrubText("at f (https://a.test/x.js?v=2:10:5)", 100), "at f (https://a.test/x.js:10:5)");
  assert.equal(scrubText("Que horas? 10:30", 100), "Que horas? 10:30");
});

test("each report stays within 2 KB even with multibyte text", () => {
  const error = new Error("ç".repeat(2000));
  error.stack = "ã".repeat(5000);
  const report = buildClientErrorReport({ kind: "error", error, source: "é".repeat(500), build: SHA, page: `/${"ê".repeat(500)}` });
  assert.ok(new TextEncoder().encode(JSON.stringify(report)).length <= MAX_REPORT_BYTES);
  assert.ok(report.message.length > 0);
  assert.equal(buildClientErrorReport({ kind: "error", message: "x", source: "undefined" }).source, null);
});

test("repeated errors are sent once and a page sends at most five reports", () => {
  const { target, sent } = harness();
  for (let index = 0; index < 3; index += 1) target.dispatchEvent(errorEvent({ message: "mesmo erro", filename: "https://polimatch.com.br/assets/a.js", lineno: 1 }));
  assert.equal(sent.length, 1);
  for (let index = 0; index < 20; index += 1) target.dispatchEvent(errorEvent({ message: `erro ${index}` }));
  assert.equal(sent.length, MAX_REPORTS_PER_PAGE);
});

test("extension errors, empty events and a failing sender do not report or throw", () => {
  const { target, sent } = harness();
  target.dispatchEvent(errorEvent({ message: "boom", filename: "chrome-extension://abc/content.js" }));
  target.dispatchEvent(errorEvent({ message: "" }));
  assert.equal(sent.length, 0);
  const broken = harness({ send: () => { throw new Error("rede"); } });
  assert.doesNotThrow(() => broken.target.dispatchEvent(errorEvent({ message: "boom" })));
});

test("uninstalling removes every listener", () => {
  const { target, sent, uninstall } = harness();
  uninstall();
  target.dispatchEvent(errorEvent({ message: "boom" }));
  target.dispatchEvent(rejectionEvent(new Error("x")));
  assert.equal(sent.length, 0);
  assert.equal(typeof installErrorReporter({ target: {}, endpoint: "/x" }), "function");
  assert.equal(typeof installErrorReporter({ target: fakeWindow(), endpoint: "" }), "function");
});

test("the beacon goes as text/plain and falls back to fetch with keepalive", async () => {
  const beacons = [];
  beaconSender({ navigator: { sendBeacon: (url, body) => { beacons.push([url, body]); return true; } } }, CLIENT_ERROR_PATH)("{}");
  assert.deepEqual(beacons, [[CLIENT_ERROR_PATH, "{}"]]);

  const fetches = [];
  const target = {
    navigator: { sendBeacon: () => false },
    fetch: (url, options) => { fetches.push([url, options]); return Promise.reject(new Error("offline")); },
  };
  beaconSender(target, CLIENT_ERROR_PATH)("{}");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetches.length, 1);
  assert.equal(fetches[0][1].keepalive, true);
  assert.equal(fetches[0][1].credentials, "omit");
  assert.equal(fetches[0][1].headers["Content-Type"], "text/plain;charset=UTF-8");
});

test("every page entry installs the reporter before any other module", async () => {
  for (const entry of ["./main.js", "./quote-quiz-page.js", "./fact-check-page.js", "./presidential-page.js"]) {
    const source = await readFile(new URL(entry, import.meta.url), "utf8");
    const firstImport = source.split("\n").find((line) => line.startsWith("import "));
    assert.match(firstImport, /^import ["']\.\/install-error-reporter\.js["'];$/, entry);
  }
});

function fakeDocument({ release = null, entry = null } = {}) {
  const element = (attribute, value) => (value === null ? null : { getAttribute: (name) => (name === attribute ? value : null) });
  return {
    querySelector: (selector) => {
      if (selector === 'meta[name="polimatch-release"]') return element("content", release);
      if (selector === 'script[type="module"][src]') return element("src", entry);
      return null;
    },
  };
}

test("build do relato vem da meta do release e, sem o SHA, do fallback", () => {
  assert.equal(releaseBuild(fakeDocument({ release: SHA }), "main-BBiuPtfp"), SHA);
  assert.equal(releaseBuild(fakeDocument(), "main-BBiuPtfp"), "main-BBiuPtfp");
  assert.equal(releaseBuild(fakeDocument({ release: "" }), "main-BBiuPtfp"), "main-BBiuPtfp");
  // O build que não recebe SOURCE_COMMIT grava "unknown" na meta (ICM 45).
  assert.equal(releaseBuild(fakeDocument({ release: "unknown" }), "main-BBiuPtfp"), "main-BBiuPtfp");
  assert.equal(releaseBuild(undefined), "unknown");
});

test("sem o SHA, o build do relato é o nome com hash do script de entrada da página", () => {
  assert.equal(entryScriptBuild(fakeDocument({ entry: "./assets/main-BBiuPtfp.js" })), "main-BBiuPtfp");
  assert.equal(entryScriptBuild(fakeDocument({ entry: "https://polimatch.com.br/assets/quoteQuiz-Bm3wRaBp.js?v=1#x" })), "quoteQuiz-Bm3wRaBp");
  assert.equal(entryScriptBuild(fakeDocument({ entry: "/src/main.js" })), "main");
  assert.equal(entryScriptBuild(fakeDocument({ entry: "./assets/nome com espaço.js" })), "unknown");
  assert.equal(entryScriptBuild(fakeDocument({ entry: `./assets/${"a".repeat(65)}.js` })), "unknown");
  assert.equal(entryScriptBuild(fakeDocument()), "unknown");
  assert.equal(entryScriptBuild(undefined), "unknown");
});

test("o instalador do relato não depende da constante de build que o Vite deixou de definir", async () => {
  const source = await readFile(new URL("./install-error-reporter.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /__POLIMATCH_ASSET_VERSION__/);
  assert.match(source, /releaseBuild\(window\.document, entryScriptBuild\(window\.document\)\)/);
});
