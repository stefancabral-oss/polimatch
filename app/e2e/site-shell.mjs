/**
 * A capa nova e o menu (ICM 69, #331): `/` é a pesquisa por foto, o menu abre
 * no canto, a conta Google entra e sai por ele, e "Como funciona" tem página
 * própria. O percurso da pesquisa em si é do roteiro photo-survey.mjs.
 *
 * O servidor aqui é simulado e conta cada requisição, para provar o que a
 * página grava e quando. O script do Google também é simulado: o botão dele
 * chama a página com uma credencial de teste.
 *
 * Cenários:
 *   1. O início é a pesquisa, com o botão do menu, e abrir não grava nada.
 *   2. O menu abre, prende o foco, fecha por Esc e pelo botão, e devolve o foco.
 *   3. Durante o voto não há menu: fica o indicador de etapa.
 *   4. Entrar com Google pelo menu, na entrada, não cria jogador.
 *   5. Quem respondeu sem conta e entra com Google recomeça com a conta.
 *   6. Sair revoga a sessão e esquece a chave.
 *   7. Sair com a sessão vencida esquece a chave; com o servidor fora do ar, não.
 *   8. Cota de rede esgotada: o aviso aponta o menu, e entrar com Google libera.
 *   9. A resposta registrada mostra as próximas pesquisas, sem "Ir para o início".
 *  10. "Como funciona" cabe na tela, abre o menu e leva ao início.
 *  11. As páginas antigas saíram do build e o sitemap lista as duas novas.
 */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { chromium, webkit } from "playwright";
import { PHOTO_SURVEYS, drawCards, drawGroups, publicPhotoSurvey } from "../../shared/photo-survey.js";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const SURVEY = PHOTO_SURVEYS[0];
const HOW_URL = new URL("como-funciona.html", appUrl).href;
const IDENTITY_KEY = "polimatch:v3:recovery-key";
const ANONYMOUS_KEY = `pm2_${"a".repeat(43)}`;
const GOOGLE_KEY = `pms_${"g".repeat(43)}`;
const GOOGLE_SCRIPT = `window.google={accounts:{id:{initialize(options){window.__e2eGoogle=options.callback},renderButton(element){const button=document.createElement('button');button.type='button';button.id='e2e-google';button.textContent='Continuar com Google';button.addEventListener('click',()=>window.__e2eGoogle({credential:'credencial-de-teste'}));element.replaceChildren(button)}}}};`;

/** API simulada: a pesquisa, o jogador, o sorteio, a entrada e a saída da conta. */
function createServer() {
  const server = {
    quota: false,
    logout: "ok",
    requests: [],
    draws: new Map(),
    responses: new Map(),
    issued: 0,
    writes() {
      return server.requests.filter((request) => request.method !== "GET").map(({ method, pathname }) => `${method} ${pathname}`);
    },
    last(suffix) {
      return server.requests.filter((request) => request.pathname.endsWith(suffix)).at(-1);
    },
    count(method, suffix) {
      return server.requests.filter((request) => request.method === method && request.pathname.endsWith(suffix)).length;
    },
  };
  const view = () => publicPhotoSurvey(SURVEY, new Date());
  server.handler = async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const key = (request.headers().authorization || "").replace(/^Bearer /, "");
    server.requests.push({ method, pathname, key });
    const send = (status, json) => route.fulfill({ status, json, headers: status === 429 ? { "Retry-After": String(json.retryAfterSeconds) } : {} });

    if (pathname === "/api/player" && method === "POST") {
      if (server.quota) return send(429, { error: "limite diário de novos jogadores nesta rede atingido", code: "PLAYER_ISSUANCE_LIMIT", retryAfterSeconds: 5400 });
      server.issued += 1;
      return send(201, { recoveryKey: ANONYMOUS_KEY });
    }
    if (pathname === "/api/auth/google" && method === "POST") {
      return send(200, { sessionToken: GOOGLE_KEY, account: { displayName: "Bia" }, player: { version: 0 }, merge: null });
    }
    if (pathname === "/api/auth/logout" && method === "POST") {
      if (server.logout === "down") return route.abort("connectionrefused");
      if (server.logout === "expired") return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
      return route.fulfill({ status: 204, body: "" });
    }
    if (pathname === `/api/photo-surveys/${SURVEY.id}` && method === "GET") return send(200, view());
    if (pathname === `/api/photo-surveys/${SURVEY.id}/draw` && method === "POST") {
      if (!key) return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
      const prior = server.responses.get(key);
      if (prior) return send(200, { survey: view(), draw: { groups: drawGroups(prior.shownIds, SURVEY.groupSize) }, response: prior.response });
      if (!server.draws.has(key)) server.draws.set(key, drawCards(SURVEY, (limit) => randomInt(limit)));
      return send(200, { survey: view(), draw: { groups: drawGroups(server.draws.get(key), SURVEY.groupSize) }, response: null });
    }
    return send(404, { error: "rota não simulada" });
  };
  /** Deixa registrada uma resposta desta chave, como se a pessoa já tivesse respondido. */
  server.answered = (key) => {
    const shownIds = drawCards(SURVEY, (limit) => randomInt(limit));
    const pickIds = drawGroups(shownIds, SURVEY.groupSize).map((group) => group[0]);
    server.responses.set(key, { shownIds, response: { answerId: "00000000-0000-4000-8000-000000000000", pickIds, championId: pickIds[0], respondedAt: new Date().toISOString() } });
  };
  return server;
}

const browser = await browserType.launch();
const contexts = [];
const pageErrors = [];

async function newContext(server, { width = 390, height = 844, storedKey = "" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  contexts.push(context);
  if (storedKey) {
    await context.addInitScript(([name, key]) => {
      if (!sessionStorage.getItem("e2e-semeado")) {
        localStorage.setItem(name, key);
        sessionStorage.setItem("e2e-semeado", "1");
      }
    }, [IDENTITY_KEY, storedKey]);
  }
  await context.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({ contentType: "application/javascript", body: GOOGLE_SCRIPT }));
  await context.route(/\/api(?:\/|$)/, server.handler);
  return context;
}

async function open(context, url = appUrl) {
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  return page;
}

const storedKey = (page) => page.evaluate((name) => localStorage.getItem(name), IDENTITY_KEY);
const entryReady = (page, label = "Começar") => page.locator("#ps-action:not([disabled])", { hasText: label }).waitFor();
const menuButton = (page) => page.locator('[data-action="menu"]').first();
const menu = (page) => page.locator("dialog.pm-menu");
const stepText = (page) => page.locator("#ps-step").evaluate((element) => element.textContent);
const fits = (page) => page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1);

async function openMenu(page) {
  await menuButton(page).click();
  await page.locator("dialog.pm-menu[open]").waitFor();
}

async function signIn(page) {
  await page.locator("dialog.pm-menu[open] #e2e-google").click();
  await page.locator('dialog.pm-menu[open] [data-menu="signout"]').waitFor();
}

const results = [];
const only = process.env.CI ? "" : process.env.POLIMATCH_E2E_ONLY || "";
async function scenario(name, run) {
  if (only && !name.includes(only)) return;
  await run();
  results.push(name);
  console.log(`ok - ${name}`);
}

try {
  await scenario("o início é a pesquisa, com o botão do menu, e abrir não grava nada", async () => {
    const server = createServer();
    const page = await open(await newContext(server));
    await entryReady(page);
    assert.equal(await page.locator("#ps-title").innerText(), "Quem você prefere?");
    assert.equal(await page.title(), "PoliMatch — Quem você prefere?");
    assert.equal(await page.locator('meta[name="robots"]').count(), 0, "a capa não tem noindex");
    assert.equal(await page.locator('link[rel="manifest"]').count(), 1);
    await menuButton(page).waitFor();
    assert.equal(await menuButton(page).getAttribute("aria-label"), "Abrir menu");
    // O rótulo de etapa continua para o leitor de tela, fora da vista.
    assert.equal(await stepText(page), "Pesquisa");
    const stepBox = await page.locator("#ps-step").boundingBox();
    assert.ok(!stepBox || (stepBox.width <= 1 && stepBox.height <= 1), "o rótulo de etapa não aparece ao lado do menu");
    await page.waitForTimeout(400);
    assert.deepEqual(server.requests.map(({ method, pathname }) => `${method} ${pathname}`), [`GET /api/photo-surveys/${SURVEY.id}`]);
    assert.equal(await storedKey(page), null, "nenhum jogador foi criado");
  });

  await scenario("o menu abre, prende o foco, fecha por Esc e pelo botão, e devolve o foco", async () => {
    const server = createServer();
    const page = await open(await newContext(server));
    await entryReady(page);
    assert.equal(await menu(page).count(), 1);
    assert.equal(await menu(page).evaluate((dialog) => dialog.open), false);
    await openMenu(page);
    assert.equal(await menu(page).getAttribute("aria-label"), "Menu");
    const items = await menu(page).locator(".pm-item").evaluateAll((nodes) => nodes.map((node) => ({
      text: node.querySelector("span").textContent,
      tag: node.querySelector(".pm-tag")?.textContent || "",
      href: node.getAttribute("href"),
      current: node.getAttribute("aria-current"),
    })));
    assert.deepEqual(items, [
      { text: "Política", tag: "Aberta", href: "./", current: "page" },
      { text: "Famosos e influenciadores", tag: "Em breve", href: null, current: null },
      { text: "Roupas", tag: "Em breve", href: null, current: null },
      { text: "Como funciona", tag: "", href: "./como-funciona.html", current: null },
    ]);
    // O painel cobre a tela e nada dele fica cortado.
    const box = await menu(page).boundingBox();
    assert.ok(box.width >= 389 && box.height >= 843, `o menu cobre a tela (${box.width}×${box.height})`);
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    const googleBox = await page.locator("#e2e-google").boundingBox();
    assert.ok(googleBox.y + googleBox.height <= 844, "o botão do Google aparece inteiro");
    // Ao abrir, o foco entra no menu, e o Tab nunca alcança a página de trás.
    // (No WebKit do macOS o Tab não percorre botões e links; ali o foco pode
    // ficar no documento, mas não na página de trás.)
    // O foco vai para o painel, não para um item: nada aparece destacado ao abrir.
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("dialog.pm-menu")), true, "o foco entra no menu ao abrir");
    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active || active === document.body || active === document.documentElement) return "documento";
        return active.closest("dialog.pm-menu") ? "menu" : `fora: ${active.id || active.className || active.tagName}`;
      });
      assert.match(where, /^(menu|documento)$/, `depois de ${press + 1} Tab o foco está em ${where}`);
    }
    assert.equal(await page.evaluate(() => document.querySelector("#ps-action").matches(":focus")), false);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog.pm-menu").open);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), "menu", "o foco volta ao botão do menu");
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [data-menu="close"]').click();
    await page.waitForFunction(() => !document.querySelector("dialog.pm-menu").open);
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), "menu");
    assert.deepEqual(server.writes(), [], "abrir e fechar o menu não grava nada");
    assert.equal(await storedKey(page), null);
  });

  await scenario("durante o voto não há menu: fica o indicador de etapa", async () => {
    const server = createServer();
    const page = await open(await newContext(server));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
    assert.equal(await stepText(page), "Tela 1 de 4");
    assert.equal(await page.locator('[data-action="menu"]').count(), 0);
    const stepBox = await page.locator("#ps-step").boundingBox();
    assert.ok(stepBox && stepBox.width > 20, "o indicador de etapa aparece no voto");
  });

  await scenario("entrar com Google pelo menu, na entrada, não cria jogador", async () => {
    const server = createServer();
    const page = await open(await newContext(server));
    await entryReady(page);
    await openMenu(page);
    await signIn(page);
    assert.equal(await storedKey(page), GOOGLE_KEY);
    assert.match(await menu(page).innerText(), /Você entrou com Google\./);
    assert.equal(await page.locator("#e2e-google").count(), 0);
    assert.equal(server.last("/api/auth/google").key, "", "sem chave no aparelho, a entrada vai sem ela");
    await page.keyboard.press("Escape");
    await entryReady(page);
    await page.locator("#ps-action").click();
    await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
    assert.equal(server.count("POST", "/api/player"), 0, "a conta dispensa o jogador anônimo");
    assert.equal(server.last("/draw").key, GOOGLE_KEY);
  });

  await scenario("quem respondeu sem conta e entra com Google recomeça com a conta", async () => {
    const server = createServer();
    server.answered(ANONYMOUS_KEY);
    const page = await open(await newContext(server, { storedKey: ANONYMOUS_KEY }));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await page.waitForFunction(() => document.querySelector("#ps-step")?.textContent === "Registrada");
    await openMenu(page);
    await signIn(page);
    assert.equal(server.last("/api/auth/google").key, ANONYMOUS_KEY, "a chave anônima vai junto, para o servidor reunir as escolhas");
    assert.equal(await storedKey(page), GOOGLE_KEY);
    await page.keyboard.press("Escape");
    await entryReady(page, "Continuar");
    assert.match(await page.locator("#ps-notice").innerText(), /Sua conta mudou\./);
    await page.locator("#ps-action").click();
    await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
    assert.equal(server.last("/draw").key, GOOGLE_KEY);
  });

  await scenario("sair revoga a sessão e esquece a chave", async () => {
    const server = createServer();
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }));
    await entryReady(page);
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    assert.equal(server.last("/api/auth/logout").key, GOOGLE_KEY);
    assert.equal(await storedKey(page), null);
    assert.doesNotMatch(await menu(page).innerText(), /Você entrou com Google/);
  });

  await scenario("sair com a sessão vencida esquece a chave; com o servidor fora do ar, não", async () => {
    const expired = createServer();
    expired.logout = "expired";
    const first = await open(await newContext(expired, { storedKey: GOOGLE_KEY }));
    await entryReady(first);
    await openMenu(first);
    await first.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await first.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    assert.equal(await storedKey(first), null, "sessão que o servidor não reconhece não prende a pessoa na conta");

    const down = createServer();
    down.logout = "down";
    const second = await open(await newContext(down, { storedKey: GOOGLE_KEY }));
    await entryReady(second);
    await openMenu(second);
    await second.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await second.locator('dialog.pm-menu[open] [role="alert"]').waitFor();
    assert.match(await second.locator('dialog.pm-menu[open] [role="alert"]').innerText(), /Você continua na conta\./);
    assert.equal(await storedKey(second), GOOGLE_KEY, "sem revogar no servidor, a sessão fica");
    assert.equal(await second.locator('dialog.pm-menu[open] [data-menu="signout"]:not([disabled])').count(), 1);
  });

  await scenario("cota de rede esgotada: o aviso aponta o menu, e entrar com Google libera", async () => {
    const server = createServer();
    server.quota = true;
    const page = await open(await newContext(server));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await page.locator("#ps-notice:not([hidden])").waitFor();
    const notice = await page.locator("#ps-notice").innerText();
    assert.match(notice, /Muitas participações novas nesta rede hoje\. Entre com Google no menu para responder agora\./);
    assert.doesNotMatch(notice, /página inicial|Ir para o início/);
    assert.equal(await page.locator('#ps-notice a[href]').count(), 0);
    await page.locator('#ps-notice [data-action="menu"]').click();
    await page.locator("dialog.pm-menu[open]").waitFor();
    await signIn(page);
    await page.keyboard.press("Escape");
    // Com a conta, o aviso some e a entrada volta a oferecer "Começar".
    await entryReady(page);
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
    await page.locator("#ps-action").click();
    await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
    assert.equal(server.count("POST", "/api/player"), 1, "só a tentativa recusada pediu jogador novo");
    assert.equal(server.last("/draw").key, GOOGLE_KEY);
  });

  await scenario("a resposta registrada mostra as próximas pesquisas, sem \"Ir para o início\"", async () => {
    for (const [width, height] of [[390, 844], [360, 640]]) {
      const server = createServer();
      server.answered(ANONYMOUS_KEY);
      const page = await open(await newContext(server, { width, height, storedKey: ANONYMOUS_KEY }));
      await entryReady(page);
      await page.locator("#ps-action").click();
      await page.waitForFunction(() => document.querySelector("#ps-step")?.textContent === "Registrada");
      await menuButton(page).waitFor();
      const next = page.locator(".ps-next");
      assert.match(await next.innerText(), /Próximas pesquisas/);
      assert.deepEqual(await next.locator(".pm-item span").allInnerTexts(), ["Famosos e influenciadores", "Roupas"]);
      assert.equal(await page.locator('.ps-main a[href]').count(), 0, "a tela não manda a pessoa para outra página");
      assert.doesNotMatch(await page.locator(".ps-main").innerText(), /Ir para o início/);
      const nextBox = await next.boundingBox();
      assert.ok(nextBox.y + nextBox.height <= height + 1, `${width}×${height}: as próximas pesquisas aparecem sem rolar`);
      const heroBox = await page.locator(".ps-hero .ps-card").boundingBox();
      assert.ok(heroBox.height >= 70, `${width}×${height}: a carta escolhida continua visível (${Math.round(heroBox.height)} px)`);
    }
  });

  await scenario("\"Como funciona\" cabe na tela, abre o menu e leva ao início", async () => {
    for (const [width, height] of [[390, 844], [360, 640]]) {
      const server = createServer();
      const page = await open(await newContext(server, { width, height }), HOW_URL);
      await page.locator("h1").waitFor();
      assert.equal(await page.locator("h1").innerText(), "Como funciona");
      assert.equal(await page.title(), "Como funciona — PoliMatch");
      assert.equal(await page.locator(".ps-list li").count(), 4);
      assert.match(await page.locator(".pm-note").innerText(), /só sai o resultado somado, nunca a escolha de uma pessoa/);
      assert.equal(await fits(page), true, `${width}×${height}: a página cabe sem rolar`);
      const action = page.locator(".ps-stack a.ps-btn");
      assert.equal(await action.innerText(), "Responder a pesquisa");
      assert.equal(new URL(await action.getAttribute("href"), HOW_URL).href, appUrl);
      await openMenu(page);
      assert.equal(await menu(page).locator('a[aria-current="page"] span').innerText(), "Como funciona");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      assert.deepEqual(server.requests, [], "a página não fala com a API");
      await Promise.all([page.waitForURL(appUrl), action.click()]);
      await entryReady(page);
    }
  });

  await scenario("as páginas antigas saíram do build e o sitemap lista as duas novas", async () => {
    const sitemap = await (await fetch(new URL("sitemap.xml", appUrl))).text();
    assert.deepEqual(
      [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
      ["https://polimatch.com.br/", "https://polimatch.com.br/como-funciona.html"],
    );
    for (const old of ["pesquisa.html", "quem-disse-isso.html", "fato-ou-fake.html", "duelos-da-corrida.html", "integridade.html"]) {
      const response = await fetch(new URL(old, appUrl));
      const body = await response.text();
      // O preview não redireciona (isso é do nginx): ou responde 404, ou cai na capa nova.
      assert.ok(response.status === 404 || /photo-survey/.test(body), `${old}: ${response.status}`);
      assert.doesNotMatch(body, /quote-quiz|fact-check|presidential-page|id="app"/, `${old} não serve mais a página antiga`);
    }
    const manifest = await (await fetch(new URL("manifest.webmanifest", appUrl))).json();
    assert.equal(manifest.name, "PoliMatch");
    assert.equal(manifest.theme_color, "#ffffff");
  });

  assert.deepEqual(pageErrors, [], `erros de página: ${pageErrors.join(" | ")}`);
  if (only && results.length === 0) throw new Error(`POLIMATCH_E2E_ONLY="${only}" não casa com nenhum cenário.`);
  console.log(JSON.stringify({ suite: "site-shell", browser: browserName, scenarios: results.length }));
} finally {
  await Promise.all(contexts.map((context) => context.close().catch(() => {})));
  await browser.close();
}
