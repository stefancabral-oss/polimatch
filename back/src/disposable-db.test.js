import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DISPOSABLE_DB_EXIT_CODE,
  disposableDatabaseRefusal,
  requireDisposableDatabase,
} from "../test-support/disposable-db.js";

const disposable = { POLIMATCH_DISPOSABLE_DB: "1" };
const scriptsDir = fileURLToPath(new URL("../scripts/", import.meta.url));

test("smokes aceitam somente banco local, descartável e terminado em _test", () => {
  for (const url of [
    "postgresql://postgres:postgres@127.0.0.1:5432/polimatch_test",
    "postgresql://postgres@localhost:54337/polimatch_test",
    "postgres://u:p@[::1]:5432/outro_test",
    "postgresql://u@LOCALHOST/polimatch_test?sslmode=disable",
  ]) {
    assert.equal(disposableDatabaseRefusal(url, { env: disposable }), null, url);
  }
  const refusals = [
    ["postgresql://u@db.prod.exemplo:5432/polimatch_test", /não é local/],
    ["postgresql://u@postgres:5432/polimatch_test", /não é local/],
    ["postgresql://u@127.0.0.1.nip.io/polimatch_test", /não é local/],
    ["postgresql://u@db1,localhost/polimatch_test", /não é local/],
    ["postgresql:///polimatch_test", /não é local/],
    ["postgresql://u@127.0.0.1:5432/polimatch", /não termina em _test/],
    ["postgresql://u@127.0.0.1:5432/polimatch_TEST", /não termina em _test/],
    ["postgresql://u@127.0.0.1:5432/", /banco ausente/],
    ["postgresql://u@localhost/polimatch_test?host=db.prod.exemplo", /host=/],
    ["postgresql://u@localhost/polimatch_test?dbname=polimatch", /dbname=/],
    ["mysql://u@localhost/polimatch_test", /postgresql:\/\//],
    ["não é url", /URL/],
    ["", /DATABASE_URL ausente/],
  ];
  for (const [url, reason] of refusals) {
    assert.match(disposableDatabaseRefusal(url, { env: disposable }) || "", reason, url);
  }
});

test("NODE_ENV=production e a ausência da opção explícita recusam antes de olhar a URL", () => {
  const local = "postgresql://u@127.0.0.1:5432/polimatch_test";
  assert.equal(disposableDatabaseRefusal(local, { env: { ...disposable, NODE_ENV: "production" } }), "NODE_ENV=production");
  assert.match(disposableDatabaseRefusal(local, { env: {} }), /POLIMATCH_DISPOSABLE_DB=1 ausente/);
  assert.match(disposableDatabaseRefusal(local, { env: { POLIMATCH_DISPOSABLE_DB: "true" } }), /ausente/);
});

test("a recusa encerra com código próprio e nunca devolve a URL", () => {
  const calls = [];
  assert.throws(() => requireDisposableDatabase({
    connectionString: "postgresql://u@db.prod.exemplo:5432/polimatch",
    env: disposable,
    exit: (code) => calls.push(["exit", code]),
    log: (message) => calls.push(["log", message]),
  }), /não descartável/);
  assert.equal(calls[0][0], "log");
  assert.match(calls[0][1], /POLIMATCH_DISPOSABLE_DB=1/);
  assert.deepEqual(calls[1], ["exit", DISPOSABLE_DB_EXIT_CODE]);
  const ok = "postgresql://u@127.0.0.1:5432/polimatch_test";
  assert.equal(requireDisposableDatabase({ connectionString: ok, env: disposable }), ok);
});

// Todo smoke novo herda a regra: este teste falha se algum *-smoke.mjs abrir
// conexão sem passar pela guarda. Os alvos são inalcançáveis de propósito
// (porta 1 e domínio .invalid), então uma regressão nunca toca banco real.
const smokes = readdirSync(scriptsDir).filter((name) => name.endsWith("-smoke.mjs")).sort();

test("existem smokes de integração para proteger", () => {
  assert.ok(smokes.includes("topic-store-smoke.mjs"));
  assert.ok(smokes.includes("partial-restore-smoke.mjs"));
});

for (const smoke of smokes) {
  test(`${smoke} recusa produção e host remoto antes de conectar`, () => {
    const cases = [
      { NODE_ENV: "production", POLIMATCH_DISPOSABLE_DB: "1", DATABASE_URL: "postgresql://u:p@127.0.0.1:1/polimatch_test" },
      { POLIMATCH_DISPOSABLE_DB: "1", DATABASE_URL: "postgresql://u:p@db.prod.invalid:5432/polimatch_test" },
      { DATABASE_URL: "postgresql://u:p@127.0.0.1:1/polimatch_test" },
    ];
    for (const env of cases) {
      const result = spawnSync(process.execPath, [`${scriptsDir}${smoke}`], {
        env: { PATH: process.env.PATH, CIVIC_DISPOSABLE_TEST: "1", ...env },
        encoding: "utf8",
        timeout: 30_000,
      });
      assert.equal(result.status, DISPOSABLE_DB_EXIT_CODE, `${smoke} ${JSON.stringify(env)}\n${result.stderr}`);
      assert.match(result.stderr, /Recusado .*POLIMATCH_DISPOSABLE_DB=1/s);
    }
  });
}
