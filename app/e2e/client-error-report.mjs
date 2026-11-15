// Erros forçados no navegador chegam à API como relatos pequenos, sem dados do
// jogador: erro de execução, rejeição não tratada e falha de import dinâmico,
// em cada página do site (a capa, que é a pesquisa, e "Como funciona").
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import { PHOTO_SURVEYS, publicPhotoSurvey } from "../../shared/photo-survey.js";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const expectedBuild = process.env.POLIMATCH_E2E_EXPECT_BUILD || "";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const REPORT_KEYS = ["build", "page", "kind", "message", "source", "line", "column", "stack"];
const RECOVERY_KEY = `pm2_${"a".repeat(43)}`;
const SURVEY = PHOTO_SURVEYS[0];

const pages = [
  { file: "", path: "/", ready: "#ps-action:not([disabled])" },
  { file: "como-funciona.html", path: "/como-funciona.html", ready: "h1" },
];

const browser = await browserType.launch();
try {
  for (const target of pages) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage();
    const reports = [];
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === "/api/client-errors") {
        reports.push({ body: request.postData() || "", headers: await request.allHeaders(), method: request.method() });
        return route.fulfill({ status: 204, body: "" });
      }
      if (path === `/api/photo-surveys/${SURVEY.id}` && request.method() === "GET") {
        return route.fulfill({ status: 200, json: publicPhotoSurvey(SURVEY, new Date()) });
      }
      return route.fulfill({ status: 404, json: { error: `unexpected ${path}` } });
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
