/**
 * Mede o LCP da capa com a API simulada e lenta (medição manual, fora do CI).
 *
 * Usa o Chromium com os valores do throttling "devtools" do Lighthouse para
 * celular (Slow 4G: 562,5 ms de latência, 1,47 Mbps de descida, 675 kbps de
 * subida; CPU 4x) e segura toda resposta de /api/ por POLIMATCH_LCP_API_DELAY_MS
 * (padrão 4000 ms). A pergunta é se a capa pinta o maior elemento antes de
 * qualquer resposta da API. O número absoluto depende de como os arquivos são
 * servidos (compressão, cache), então rode contra um servidor parecido com o
 * de produção.
 *
 *   POLIMATCH_E2E_URL=http://127.0.0.1:4173/ node app/scripts/measure-home-lcp.mjs
 */
import { chromium } from "playwright";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { capabilityFixture } from "../e2e/aggregate-fixture.mjs";
import { completedDailySession } from "../e2e/daily-fixture.mjs";
import { approvedEditorialCandidates } from "../e2e/editorial-fixtures.mjs";

const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const apiDelay = Number(process.env.POLIMATCH_LCP_API_DELAY_MS || 4000);
const runs = Number(process.env.POLIMATCH_LCP_RUNS || 3);
const candidates = approvedEditorialCandidates(CATALOG.filter(({ personId }) => [1, 2, 3, 4, 46, 48].includes(personId)));

async function measure(browser) {
  const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 562.5,
    downloadThroughput: (1474.56 * 1024) / 8,
    uploadThroughput: (675 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__lcp = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__lcp.push({ time: entry.startTime, tag: entry.element?.tagName || "", text: (entry.element?.textContent || "").trim().slice(0, 60) });
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  });
  let firstApiResponse = null;
  const navigationStart = Date.now();
  await page.route(/\/api(?:\/|$)/, async (route) => {
    const { pathname } = new URL(route.request().url());
    await new Promise((resolve) => setTimeout(resolve, apiDelay));
    firstApiResponse ??= Date.now() - navigationStart;
    if (pathname === "/api/capabilities") return route.fulfill({ json: capabilityFixture([]) });
    if (pathname === "/api/candidates") return route.fulfill({ json: { candidates } });
    // Versões que ainda criam jogador na abertura também chegam à capa.
    if (pathname === "/api/player") return route.fulfill({ status: 201, json: { recoveryKey: `pm2_${"l".repeat(43)}` } });
    if (pathname === "/api/player/state") return route.fulfill({ json: { version: 0, duels: 0, ranking: [] } });
    if (pathname === "/api/daily-session") return route.fulfill({ json: completedDailySession(candidates) });
    return route.fulfill({ status: 404, json: { error: "rota não simulada" } });
  });
  await page.goto(appUrl, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(3 * apiDelay + 1500);
  const entries = await page.evaluate(() => window.__lcp);
  await context.close();
  const last = entries.at(-1) || null;
  return { lcpMs: last ? Math.round(last.time) : null, element: last, firstApiResponseMs: firstApiResponse };
}

const browser = await chromium.launch();
try {
  const results = [];
  for (let run = 0; run < runs; run += 1) results.push(await measure(browser));
  const sorted = results.map(({ lcpMs }) => lcpMs).filter(Number.isFinite).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? null;
  console.log(JSON.stringify({ appUrl, apiDelayMs: apiDelay, medianLcpMs: median, results }, null, 2));
} finally {
  await browser.close();
}
