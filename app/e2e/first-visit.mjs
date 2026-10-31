/**
 * Primeira visita sem escrita no servidor e saída quando a cota da rede acaba.
 *
 * O servidor aqui é simulado e conta cada POST /api/player. Cenários:
 *
 *   1. A capa, a navegação e os links dos quizzes aparecem antes de qualquer
 *      resposta da API, e uma visita sem interação não cria jogador — nem na
 *      página principal, nem nos Duelos da corrida.
 *   2. Com POST /api/player respondendo 429 PLAYER_ISSUANCE_LIMIT, tocar em
 *      jogar mostra o aviso próprio com "Entrar com Google" e o horário de
 *      liberação, mantendo hero, navegação e quizzes. O texto genérico de
 *      servidor nunca aparece. Depois do callback do Google (stub), a capa
 *      continua com navegação e o jogo abre sem novo POST.
 *   3. Com o catálogo fora do ar na abertura, o login inicializa o app sem
 *      tocar em "Tentar novamente".
 *   4. Com localStorage bloqueado, a capa abre, o jogo começa e o aviso é de
 *      armazenamento, não de rede, sem texto em inglês.
 *   5. O botão de conta mostra o avatar (≥ 24 px) e tem alvo ≥ 44 px em 375,
 *      390 e 440 px de largura.
 *   6. Quem já tem chave salva e entra com Google enquanto ela ainda é lida
 *      leva a chave anônima ao login, para as escolhas serem reunidas.
 */
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";
import CATALOG from "../../shared/elections-2026.json" with { type: "json" };
import { completedDailySession } from "./daily-fixture.mjs";
import { capabilityFixture } from "./aggregate-fixture.mjs";
import { approvedEditorialCandidates } from "./editorial-fixtures.mjs";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const GENERIC_SERVER_ERROR = "Não conseguimos falar com o servidor";
const SESSION_TOKEN = `pms_${"s".repeat(43)}`;
const ANONYMOUS_KEY = `pm2_${"f".repeat(43)}`;
const STORED_KEY = `pm2_${"k".repeat(43)}`;
const AVATAR_URL = "https://lh3.googleusercontent.com/a/polimatch-e2e";
const AVATAR_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const candidates = approvedEditorialCandidates(CATALOG.filter(({ personId }) => [1, 2, 3, 4, 46, 48].includes(personId)));
const ranking = () => candidates.map((candidate) => ({ ...candidate, elo: 1000, wins: 0, losses: 0, decisions: 0, winRate: 0, rank: null }));

const GOOGLE_STUB = "window.google={accounts:{id:{initialize(options){window.__polimatchGoogleCallback=options.callback},renderButton(element){const button=document.createElement('button');button.type='button';button.textContent='Continuar com Google';button.addEventListener('click',()=>window.__polimatchGoogleCallback({credential:'mock-google-id-token'}));element.replaceChildren(button)}}}};";

/** Servidor simulado com contadores. `player` decide a resposta do POST. */
function createServer({ player = "created", candidatesFailures = 0, holdApi = false, storedStateDelayMs = 0 } = {}) {
  const server = {
    playerPosts: 0,
    requests: [],
    candidatesFailures,
    fulfilled: 0,
    held: [],
    holdApi,
    release() {
      server.holdApi = false;
      for (const resume of server.held.splice(0)) resume();
    },
  };
  server.handler = async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    server.requests.push({ method: request.method(), pathname, authorization: request.headers().authorization || "" });
    if (server.holdApi) await new Promise((resume) => server.held.push(resume));
    const send = async (status, json) => {
      server.fulfilled += 1;
      if (status === 204) return route.fulfill({ status });
      return route.fulfill({ status, json, headers: status === 429 ? { "Retry-After": String(json.retryAfterSeconds) } : {} });
    };
    if (pathname === "/api/capabilities") return send(200, capabilityFixture([]));
    if (pathname === "/api/game-capabilities") return send(404, { error: "sem capacidades" });
    if (pathname === "/api/candidates") {
      if (server.candidatesFailures > 0) {
        server.candidatesFailures -= 1;
        return send(503, { error: "catálogo indisponível" });
      }
      return send(200, { candidates });
    }
    if (pathname === "/api/player" && request.method() === "POST") {
      server.playerPosts += 1;
      if (player === "quota") {
        return send(429, { error: "limite diário de novos jogadores nesta rede atingido", code: "PLAYER_ISSUANCE_LIMIT", retryAfterSeconds: 5400 });
      }
      return send(201, { recoveryKey: ANONYMOUS_KEY });
    }
    if (pathname === "/api/player/state") {
      if (storedStateDelayMs && request.headers().authorization === `Bearer ${STORED_KEY}`) {
        await new Promise((resume) => setTimeout(resume, storedStateDelayMs));
      }
      const signedIn = request.headers().authorization === `Bearer ${SESSION_TOKEN}`;
      return send(200, { version: 0, duels: 0, ranking: ranking(), ...(signedIn ? { account: { displayName: "Bia Teste", avatarUrl: AVATAR_URL } } : {}) });
    }
    if (pathname === "/api/daily-session") return send(200, completedDailySession(candidates));
    if (pathname === "/api/auth/google" && request.method() === "POST") {
      return send(200, {
        sessionToken: SESSION_TOKEN,
        account: { displayName: "Bia Teste", avatarUrl: AVATAR_URL },
        player: { version: 0, duels: 0, ranking: ranking(), account: { displayName: "Bia Teste", avatarUrl: AVATAR_URL } },
        merge: null,
      });
    }
    return send(404, { error: "rota não simulada" });
  };
  return server;
}

async function openPage(browser, server, { width = 390, height = 844, blockStorage = false, storedKey = "" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  if (blockStorage) {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() { throw new DOMException("The operation is insecure.", "SecurityError"); },
      });
    });
  }
  if (storedKey) {
    await page.addInitScript((key) => {
      if (!localStorage.getItem("polimatch:v3:recovery-key")) localStorage.setItem("polimatch:v3:recovery-key", key);
    }, storedKey);
  }
  await page.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({ contentType: "application/javascript", body: GOOGLE_STUB }));
  await page.route("https://lh3.googleusercontent.com/**", (route) => route.fulfill({ contentType: "image/png", body: AVATAR_PNG }));
  await page.route(/\/api(?:\/|$)/, server.handler);
  return { context, page, pageErrors };
}

async function assertHomeShell(page, label) {
  await page.getByRole("heading", { name: "Quem representa o Brasil que você imagina?" }).waitFor({ timeout: 3000 });
  const shell = await page.evaluate(() => {
    const visible = (element) => Boolean(element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
    const navLabels = [...document.querySelectorAll(".bottom-nav .nav-button")].filter(visible).map((button) => button.textContent.trim());
    return {
      navVisible: visible(document.querySelector(".bottom-nav")),
      navLabels,
      quoteQuiz: visible(document.querySelector('a[href="./quem-disse-isso.html"]')),
      raceDuels: visible(document.querySelector('a[href="./duelos-da-corrida.html"]')),
      startButton: visible(document.querySelector("#start-election")),
      text: document.body.innerText,
    };
  });
  assert.ok(shell.navVisible, `${label}: navegação ausente`);
  assert.ok(shell.navLabels.includes("Início") && shell.navLabels.includes("Duelo"), `${label}: navegação sem Início/Duelo (${shell.navLabels.join("|")})`);
  assert.ok(shell.quoteQuiz, `${label}: link de Quem disse isso? ausente`);
  assert.ok(shell.raceDuels, `${label}: link dos Duelos da corrida ausente`);
  assert.ok(shell.startButton, `${label}: botão de jogar ausente`);
  assert.ok(!shell.text.includes(GENERIC_SERVER_ERROR), `${label}: texto genérico de servidor apareceu`);
  return shell;
}

async function signInWithGoogleStub(page) {
  await page.getByRole("button", { name: "Continuar com Google" }).click();
  await page.getByRole("heading", { name: "Tudo certo, Bia!" }).waitFor();
  await page.getByRole("button", { name: "Voltar ao jogo" }).click();
}

async function measureAccountButton(page) {
  return page.evaluate(() => {
    const button = document.querySelector("#account-button").getBoundingClientRect();
    const avatarElement = document.querySelector(".account-avatar");
    const avatar = avatarElement.getBoundingClientRect();
    const icon = [...avatarElement.querySelectorAll("img")].find((image) => !image.hidden)?.getBoundingClientRect();
    return {
      button: { width: button.width, height: button.height },
      avatar: { width: avatar.width, height: avatar.height, display: getComputedStyle(avatarElement).display },
      icon: icon ? { width: icon.width, height: icon.height } : null,
    };
  });
}

const browser = await browserType.launch();
const results = [];
async function scenario(name, run) {
  await run();
  results.push(name);
  console.log(`ok - ${name}`);
}

try {
  await scenario("capa pintada antes da API e visita passiva sem POST /api/player", async () => {
    const server = createServer({ holdApi: true });
    const { context, page, pageErrors } = await openPage(browser, server);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await assertHomeShell(page, "capa com API pendente");
    assert.equal(server.fulfilled, 0, "a capa esperou uma resposta da API para aparecer");
    assert.ok(server.requests.length > 0, "o app deveria ter pedido o catálogo em segundo plano");
    const placeholder = (await page.locator("[data-available-count]").first().innerText()).trim();
    assert.equal(placeholder, "—", "o contador de perfis deveria começar como marcador");
    server.release();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    assert.equal((await page.locator("[data-available-count]").first().innerText()).trim(), String(candidates.length));
    assert.equal(server.playerPosts, 0, "uma visita sem interação criou jogador");
    assert.ok(!server.requests.some(({ authorization }) => authorization), "uma visita sem chave enviou credencial");

    await page.goto(new URL("duelos-da-corrida.html", appUrl).href, { waitUntil: "networkidle" });
    await page.locator("#race-start").waitFor();
    await page.waitForTimeout(400);
    assert.equal(server.playerPosts, 0, "os Duelos da corrida criaram jogador sem interação");
    assert.ok(pageErrors.length === 0, `erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  });

  await scenario("cota da rede esgotada mostra saída pelo Google e libera o jogo após o login", async () => {
    const server = createServer({ player: "quota" });
    const { context, page, pageErrors } = await openPage(browser, server);
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await assertHomeShell(page, "capa antes de jogar");
    assert.equal(server.playerPosts, 0, "a capa criou jogador antes de qualquer toque");

    await page.locator("#start-election").click();
    const notice = page.locator(".home-notice.is-quota");
    await notice.waitFor();
    assert.equal(server.playerPosts, 1, "jogar deveria pedir um jogador uma única vez");
    await assertHomeShell(page, "capa com cota esgotada");
    assert.equal(await notice.getAttribute("role"), "alert");
    assert.equal((await notice.locator("h2").innerText()).trim(), "Muitos jogos novos nesta rede hoje.");
    const reset = (await notice.locator("[data-quota-reset]").innerText()).trim();
    assert.match(reset, /^Novos jogos anônimos nesta rede voltam a ser liberados às \d{2}:\d{2} \(horário de Brasília\)\.$/);
    const googleButton = notice.getByRole("button", { name: "Entrar com Google" });
    assert.ok(await googleButton.isVisible(), "o aviso não ofereceu Entrar com Google");
    const text = await page.locator("body").innerText();
    assert.ok(!/Conexão necessária/i.test(text), "o aviso de cota culpou a conexão");
    assert.equal(await page.locator("#retry").count(), 0, "o aviso de cota ofereceu Tentar novamente");
    const accountButton = await measureAccountButton(page);
    assert.ok(accountButton.avatar.width >= 24 && accountButton.avatar.display !== "none", `avatar invisível no aviso: ${JSON.stringify(accountButton)}`);

    await page.locator("#start-election").click();
    await page.waitForTimeout(250);
    assert.equal(server.playerPosts, 1, "um novo toque repetiu o POST antes da liberação");
    await notice.waitFor();

    await googleButton.click();
    await page.getByRole("heading", { name: "Entre com Google" }).waitFor();
    await signInWithGoogleStub(page);
    await page.getByRole("button", { name: "Abrir sua conta" }).waitFor();
    await assertHomeShell(page, "capa depois do login");
    assert.equal(await page.locator(".home-notice").count(), 0, "o aviso de cota continuou depois do login");
    assert.ok(server.requests.some(({ pathname, authorization }) => pathname === "/api/daily-session" && authorization === `Bearer ${SESSION_TOKEN}`), "a rodada do dia não foi lida com a sessão Google");
    const signedIn = await measureAccountButton(page);
    assert.ok(signedIn.icon && signedIn.icon.width >= 24, `foto da conta invisível: ${JSON.stringify(signedIn)}`);

    await page.locator("#start-election").click();
    await page.getByRole("heading", { name: "Você fechou a rodada." }).waitFor();
    assert.equal(server.playerPosts, 1, "o jogo depois do login criou outro jogador anônimo");
    assert.ok(pageErrors.length === 0, `erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  });

  await scenario("login com o catálogo fora do ar inicializa o app sem Tentar novamente", async () => {
    const server = createServer({ candidatesFailures: 1 });
    const { context, page, pageErrors } = await openPage(browser, server);
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await page.locator(".home-notice #retry").waitFor();
    await assertHomeShell(page, "capa com catálogo fora do ar");
    await page.getByRole("button", { name: "Entrar com Google" }).click();
    await signInWithGoogleStub(page);
    await page.locator(".home-notice").waitFor({ state: "detached" });
    await page.getByRole("button", { name: "Abrir sua conta" }).waitFor();
    assert.equal((await page.locator("[data-available-count]").first().innerText()).trim(), String(candidates.length));
    assert.equal(server.requests.filter(({ pathname }) => pathname === "/api/candidates").length, 2, "o login não refez a inicialização");
    assert.equal(server.playerPosts, 0, "o login criou jogador anônimo");
    assert.ok(pageErrors.length === 0, `erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  });

  await scenario("armazenamento bloqueado não vira falha de rede", async () => {
    const server = createServer();
    const { context, page, pageErrors } = await openPage(browser, server, { blockStorage: true });
    await page.goto(appUrl, { waitUntil: "networkidle" });
    await assertHomeShell(page, "capa com armazenamento bloqueado");
    await page.locator("#start-election").click();
    await page.getByRole("heading", { name: "Você fechou a rodada." }).waitFor();
    assert.equal(server.playerPosts, 1);
    await page.getByRole("button", { name: "Início" }).click();
    const notice = page.locator(".home-notice.is-storage");
    await notice.waitFor();
    assert.match(await notice.innerText(), /não permite salvar o progresso neste aparelho/);
    const text = await page.locator("body").innerText();
    assert.ok(!/operation is insecure|SecurityError/i.test(text), "texto do navegador em inglês apareceu na interface");
    assert.ok(!text.includes(GENERIC_SERVER_ERROR), "armazenamento bloqueado foi descrito como falha de servidor");
    assert.ok(pageErrors.length === 0, `erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  });

  await scenario("avatar visível e alvo de 44 px no botão de conta em 375, 390 e 440", async () => {
    for (const width of [375, 390, 440]) {
      const server = createServer();
      const { context, page } = await openPage(browser, server, { width, height: 844 });
      await page.goto(appUrl, { waitUntil: "networkidle" });
      const measured = await measureAccountButton(page);
      assert.ok(measured.avatar.display !== "none" && measured.avatar.width >= 24 && measured.avatar.height >= 24, `${width}px: avatar abaixo de 24 px ${JSON.stringify(measured)}`);
      assert.ok(measured.icon && measured.icon.width >= 24 && measured.icon.height >= 24, `${width}px: ícone do avatar invisível ${JSON.stringify(measured)}`);
      assert.ok(measured.button.width >= 44 && measured.button.height >= 44, `${width}px: alvo abaixo de 44 px ${JSON.stringify(measured)}`);
      assert.equal(server.playerPosts, 0, `${width}px: visita passiva criou jogador`);
      await context.close();
    }
  });

  await scenario("login durante a leitura da chave salva leva o jogo anônimo junto", async () => {
    const server = createServer({ storedStateDelayMs: 2500 });
    const { context, page, pageErrors } = await openPage(browser, server, { storedKey: STORED_KEY });
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await assertHomeShell(page, "capa com a chave salva ainda em leitura");
    await page.getByRole("button", { name: "Entrar com Google" }).click();
    await signInWithGoogleStub(page);
    const login = server.requests.find(({ method, pathname }) => method === "POST" && pathname === "/api/auth/google");
    assert.ok(login, "o login não chegou ao servidor");
    assert.equal(login.authorization, `Bearer ${STORED_KEY}`, "o login saiu sem a chave anônima salva e não reuniria as escolhas");
    assert.equal(server.playerPosts, 0, "o login criou jogador anônimo");
    assert.equal(await page.evaluate(() => localStorage.getItem("polimatch:v3:recovery-key")), SESSION_TOKEN);
    assert.ok(pageErrors.length === 0, `erros na página: ${pageErrors.join(" | ")}`);
    await context.close();
  });
} finally {
  await browser.close();
}

console.log(`Primeira visita (${browserName}): ${results.length} cenários aprovados.`);
