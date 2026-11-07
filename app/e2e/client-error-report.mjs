// Erros forçados no navegador chegam à API como relatos pequenos, sem dados do
// jogador: erro de execução, rejeição não tratada e falha de import dinâmico,
// em cada tipo de página (jogo principal, quiz e checagem).
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { completedDailySession } from "./daily-fixture.mjs";
import { capabilityFixture } from "./aggregate-fixture.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const expectedBuild = process.env.POLIMATCH_E2E_EXPECT_BUILD || "";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const REPORT_KEYS = ["build", "page", "kind", "message", "source", "line", "column", "stack"];
const RECOVERY_KEY = `pm2_${"a".repeat(43)}`;
const daily = completedDailySession(Array.from({ length: 4 }, (_, index) => ({ id: `p${index}`, name: `Pessoa ${index}`, role: "Pessoa pública" })));

function mainApi(path) {
  if (path === "/api/capabilities") return [200, capabilityFixture([])];
  if (path === "/api/game-capabilities") return [200, { version: 1, pairs: false, discard: false, mirror: false, collection: true }];
  if (path === "/api/candidates") return [200, { candidates: daily.catalog }];
  if (path === "/api/player") return [201, { recoveryKey: RECOVERY_KEY }];
  if (path === "/api/player/state") return [200, { ranking: [], duels: 0, version: 0 }];
  if (path === "/api/daily-session") return [200, daily];
  if (path === "/api/collection") return [200, { enabled: true, purchasable: false, total: 0, items: [] }];
  return [404, { error: `unexpected ${path}` }];
}

const pages = [
  { file: "", path: "/", ready: ".bottom-nav:not([hidden])" },
  { file: "quem-disse-isso.html", path: "/quem-disse-isso.html", ready: "#quiz *" },
  { file: "fato-ou-fake.html", path: "/fato-ou-fake.html", ready: "#facts *" },
];

const browser = await browserType.launch();
try {
  for (const target of pages) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addInitScript(() => localStorage.setItem("polimatch:v4:round-coach", "seen"));
    const page = await context.newPage();
    const reports = [];
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/client-errors") {
        reports.push({ body: request.postData() || "", headers: await request.allHeaders(), method: request.method() });
        return route.fulfill({ status: 204, body: "" });
      }
      const [status, json] = mainApi(path);
      return route.fulfill({ status, json });
    });

    await page.goto(new URL(target.file, appUrl).href, { waitUntil: "domcontentloaded" });
    await page.locator(target.ready).first().waitFor();
    // Uma página saudável não envia nenhum relato.
    await page.waitForTimeout(300);
    assert.deepEqual(reports, [], `${target.path}: relato sem erro`);

    await page.evaluate((key) => {
      setTimeout(() => { throw new Error(`erro forçado no e2e ${key}`); }, 0);
      Promise.reject(new Error("rejeição forçada no e2e"));
      const preload = new Event("vite:preloadError", { cancelable: true });
      preload.payload = new Error("Failed to fetch dynamically imported module: /assets/antigo.js?v=1");
      window.dispatchEvent(preload);
      // O mesmo erro repetido não gera um segundo relato.
      window.dispatchEvent(preload);
    }, RECOVERY_KEY);
    const deadline = Date.now() + 5000;
    while (reports.length < 3 && Date.now() < deadline) await page.waitForTimeout(50);
    await page.waitForTimeout(200);
    assert.equal(reports.length, 3, `${target.path}: relatos recebidos ${reports.length}`);

    const parsed = reports.map(({ body, headers, method }) => {
      assert.equal(method, "POST");
      assert.ok(new TextEncoder().encode(body).length <= 2048, `${target.path}: relato acima de 2 KB`);
      assert.match(headers["content-type"] || "", /^text\/plain/);
      assert.equal(headers.authorization, undefined);
      assert.equal(body.includes("pm2_"), false, `${target.path}: chave do jogador no relato`);
      assert.equal(body.includes("?v=1"), false, `${target.path}: query string no relato`);
      const report = JSON.parse(body);
      assert.deepEqual(Object.keys(report), REPORT_KEYS);
      assert.equal(report.page, target.path);
      assert.match(report.build, /^[A-Za-z0-9._-]{1,64}$/);
      assert.notEqual(report.build, "unknown");
      if (expectedBuild) assert.equal(report.build, expectedBuild);
      return report;
    });
    const byKind = Object.fromEntries(parsed.map((report) => [report.kind, report]));
    assert.deepEqual(Object.keys(byKind).sort(), ["error", "preload", "unhandledrejection"]);
    assert.match(byKind.error.message, /erro forçado no e2e \[redacted-token\]/);
    assert.match(byKind.unhandledrejection.message, /rejeição forçada no e2e/);
    assert.match(byKind.preload.message, /dynamically imported module: \/assets\/antigo\.js/);
    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`Relato de erros do navegador validado em ${browserName}: ${pages.length} páginas, erro, rejeição e import dinâmico, sem dados do jogador.`);
