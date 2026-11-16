/**
 * A capa nova e o menu (ICM 69, #331): `/` é a pesquisa por foto, o menu abre
 * no canto, a conta Google entra e sai por ele, e "Como funciona" tem página
 * própria. O percurso da pesquisa em si é do roteiro photo-survey.mjs.
 *
 * O servidor aqui é simulado e conta cada requisição, para provar o que a
 * página grava e quando. Desde a ICM 71 só responde quem entrou com Google e
 * tem cadastro: a conta de teste nasce cadastrada, e nenhum cenário pode
 * terminar com pedido de jogador sem conta. O script do Google também é simulado: o botão dele
 * chama a página com uma credencial de teste.
 *
 * Cenários:
 *   1. O início é a pesquisa, com o botão do menu, e abrir não grava nada.
 *   2. O menu abre, prende o foco, fecha por Esc e pelo botão, e devolve o foco.
 *   3. Durante o voto não há menu: fica o indicador de etapa.
 *   4. Entrar com Google pelo menu, na entrada, não cria jogador.
 *   5. Quem respondeu sem conta entra, faz o cadastro e vê a resposta que deu.
 *   6. Sair revoga a sessão e esquece a chave.
 *   7. Sair com a sessão vencida esquece a chave; com o servidor fora do ar, não.
 *   8. Cadastro com CPF (ICM 71, #336), no lugar do antigo cenário da cota de
 *      rede: conta sem cadastro abre o formulário e cada recusa do servidor
 *      tem o seu texto; sessão vencida volta para a entrada; entrar e sair
 *      pelo menu com o cadastro na tela; Google ou servidor fora do ar na
 *      entrada; a conta que perde o cadastro espera o toque.
 *   9. A resposta registrada mostra as próximas pesquisas, sem "Ir para o início".
 *  10. "Como funciona" cabe na tela, abre o menu e leva ao início.
 *  11. As páginas antigas saíram do build e o sitemap lista as duas novas.
 *  12. O script do Google falha: o menu avisa, e tentar de novo carrega.
 *  13. A entrada falha no servidor: o menu avisa e a chave não muda.
 *  14. Chave anônima recusada: a entrada tenta de novo sem ela.
 *  15. Duas abas: a outra sai da conta e o menu desta acompanha.
 *  16. Sair na resposta registrada não convida a responder de novo.
 *  17. Pesquisa fechada: entrar com Google mostra a resposta da conta.
 *  18. Entrar enquanto a pesquisa abre não cria jogador anônimo.
 *  19. O foco fica no menu quando o conteúdo dele muda.
 *  20. Navegador sem showModal: o menu abre e fecha mesmo assim.
 *  21. Credencial do Google recusada: a chave do aparelho não é descartada.
 *  22. Entrada sem sessão na resposta: o menu avisa e a chave não muda.
 *  23. Sair não apaga a sessão que outra aba gravou enquanto o servidor respondia.
 *  24. A pesquisa fechou depois de aberta a página: sair não oferece "Começar".
 *
 * Capa com várias pesquisas (ICM 70, #334):
 *  25. Cada pesquisa tem endereço; um código desconhecido cai na capa.
 *  26. Responder a primeira: a capa mostra a escolha e destaca a segunda;
 *      respondidas as duas, a capa diz isso. Uma não mexe na outra.
 *  27. A capa destaca a pesquisa que ficou pela metade, com "Continuar"; se
 *      ela fecha, a capa não fica presa nela.
 *  28. Uma pesquisa fechada sai do destaque e aparece como fechada.
 *  29. Com a API fora do ar, a capa avisa e tenta de novo.
 *  30. Compartilhar: a imagem com a carta, o texto e o endereço, só no toque.
 *  31. Sem compartilhamento de arquivo vai o texto; sem compartilhamento, o
 *      endereço é copiado; fechar a folha de compartilhar não é erro.
 *  32. Servidor que ainda não conhece a segunda pesquisa: a capa mostra só a
 *      primeira (é o que acontece se o app for publicado antes da API).
 *  33. Uma leitura que falha não vira informação falsa: a capa pede para
 *      tentar de novo.
 *  34. Outra aba sai da conta: a capa desta se refaz.
 */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { chromium, webkit } from "playwright";
import { PHOTO_SURVEYS, drawCards, drawGroups, photoSurveyById, publicPhotoSurvey, validateBracket } from "../../shared/photo-survey.js";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const SURVEY = PHOTO_SURVEYS[0];
const SECOND = PHOTO_SURVEYS[1];
const surveyUrl = (survey) => new URL(`?p=${survey.id}`, appUrl).href;
const HOW_URL = new URL("como-funciona.html", appUrl).href;
const IDENTITY_KEY = "polimatch:v3:recovery-key";
const ANONYMOUS_KEY = `pm2_${"a".repeat(43)}`;
const GOOGLE_KEY = `pms_${"g".repeat(43)}`;
const GOOGLE_SCRIPT = `window.google={accounts:{id:{initialize(options){window.__e2eGoogle=options.callback},renderButton(element){const button=document.createElement('button');button.type='button';button.id='e2e-google';button.textContent='Continuar com Google';button.addEventListener('click',()=>window.__e2eGoogle({credential:'credencial-de-teste'}));element.replaceChildren(button)}}}};`;

// Os servidores do cenário em curso: no fim dele, nenhum pode ter recebido
// pedido de jogador sem conta (ICM 71).
const servers = [];

/** API simulada: a pesquisa, o sorteio, a entrada e a saída da conta, e o cadastro. */
function createServer() {
  const server = {
    quota: false,
    logout: "ok",
    status: "open",
    // Pesquisas fechadas uma a uma (o `status` vale para todas).
    closed: new Set(),
    // Pesquisas que este servidor ainda não conhece: respondem 404.
    unknown: new Set(),
    googleDown: false,
    // Falhas programadas da entrada com Google: cada item é um status HTTP,
    // ou um objeto com status e código.
    failAuth: [],
    // Quantas entradas respondem 200 sem a sessão.
    emptyAuth: 0,
    // Chamada antes de responder à saída da conta.
    beforeLogout: null,
    // Chaves que o servidor deixou de reconhecer.
    revoked: new Set(),
    // Segura a próxima leitura da pesquisa até `release()` ser chamada.
    holdSurvey: null,
    // Contas com cadastro com CPF (ICM 71). A conta de teste nasce cadastrada;
    // os cenários do cadastro tiram ela daqui.
    registered: new Set([GOOGLE_KEY]),
    // A sessão que a entrada com Google devolve.
    session: GOOGLE_KEY,
    // Recusas programadas do cadastro: "down", ou um objeto com status e código.
    failRegistration: [],
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
  const view = (survey = SURVEY) => ({ ...publicPhotoSurvey(survey, new Date()), status: server.closed.has(survey.id) ? "closed" : server.status });
  const slot = (survey, key) => `${survey.id}:${key}`;
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
      if (server.failAuth.length) {
        const failure = server.failAuth.shift();
        const { status, code } = typeof failure === "number" ? { status: failure, code: "" } : failure;
        return send(status, { error: "falha de login", ...(code ? { code } : {}) });
      }
      if (server.emptyAuth > 0) {
        server.emptyAuth -= 1;
        return send(200, { account: { displayName: "Bia" }, player: { version: 0 }, merge: null });
      }
      // Como o servidor de verdade: uma chave que ele não reconhece recusa a entrada.
      if (key && server.revoked.has(key)) return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
      // E a resposta de quem respondia sem conta passa a ser da conta.
      for (const item of PHOTO_SURVEYS) {
        const answer = key && server.responses.get(slot(item, key));
        if (answer && !server.responses.has(slot(item, server.session))) server.responses.set(slot(item, server.session), answer);
      }
      return send(200, { sessionToken: server.session, account: { displayName: "Bia" }, player: { version: 0 }, merge: null });
    }
    if (pathname === "/api/registration" && method === "POST") {
      if (!key || server.revoked.has(key)) return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
      if (!key.startsWith("pms_")) return send(403, { error: "entre com Google para se cadastrar", code: "GOOGLE_ACCOUNT_REQUIRED" });
      if (server.failRegistration.length) {
        const failure = server.failRegistration.shift();
        if (failure === "down") return route.abort("connectionrefused");
        return send(failure.status, { error: "recusa do cadastro", code: failure.code, ...(failure.retryAfterSeconds ? { retryAfterSeconds: failure.retryAfterSeconds } : {}) });
      }
      server.registered.add(key);
      return send(200, { registered: true, status: "created", registeredAt: new Date().toISOString() });
    }
    if (pathname === "/api/auth/logout" && method === "POST") {
      if (server.beforeLogout) await server.beforeLogout();
      if (server.logout === "down") return route.abort("connectionrefused");
      if (server.logout === "error") return send(500, { error: "erro interno", code: "INTERNAL_ERROR" });
      if (server.logout === "expired") return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
      return route.fulfill({ status: 204, body: "" });
    }
    const [, surveyId, action = ""] = pathname.match(/^\/api\/photo-surveys\/([^/]+)(?:\/(draw|response))?$/) || [];
    const survey = server.unknown.has(surveyId) ? null : photoSurveyById(surveyId || "");
    if (!survey) return send(404, { error: "pesquisa não encontrada", code: "PHOTO_SURVEY_NOT_FOUND" });
    if (!action && method === "GET") {
      if (server.holdSurvey) await server.holdSurvey.promise;
      return send(200, view(survey));
    }
    if (method !== "POST") return send(404, { error: "rota não simulada" });
    if (!key || server.revoked.has(key)) return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
    // Como o servidor de verdade: sem conta com cadastro não há sorteio nem resposta.
    if (!server.registered.has(key)) return send(403, { error: "cadastro com CPF obrigatório para responder", code: "CPF_REGISTRATION_REQUIRED" });
    const status = view(survey).status;
    const prior = server.responses.get(slot(survey, key));
    if (action === "draw") {
      if (prior) return send(200, { survey: view(survey), draw: { groups: drawGroups(prior.shownIds, survey.groupSize) }, response: prior.response });
      if (status !== "open") return send(409, { error: "pesquisa fechada", code: "PHOTO_SURVEY_CLOSED", current: { status } });
      if (!server.draws.has(slot(survey, key))) server.draws.set(slot(survey, key), drawCards(survey, (limit) => randomInt(limit)));
      return send(200, { survey: view(survey), draw: { groups: drawGroups(server.draws.get(slot(survey, key)), survey.groupSize) }, response: null });
    }
    if (prior) return send(409, { error: "esta pesquisa já foi respondida", code: "PHOTO_SURVEY_ALREADY_ANSWERED", current: prior.response });
    const shownIds = server.draws.get(slot(survey, key));
    const body = request.postDataJSON();
    const bracket = shownIds ? validateBracket(survey, shownIds, { pickIds: body?.pickIds, championId: body?.championId }) : { ok: false };
    if (!bracket.ok) return send(400, { error: "resposta não corresponde ao sorteio", code: "PHOTO_SURVEY_RESPONSE_INVALID", current: { reason: "bracket" } });
    const response = { answerId: body.answerId, pickIds: bracket.pickIds, championId: bracket.championId, respondedAt: new Date().toISOString() };
    server.responses.set(slot(survey, key), { shownIds, response });
    return send(200, { status: "created", survey: view(survey), draw: { groups: drawGroups(shownIds, survey.groupSize) }, response });
  };
  /** Deixa registrada uma resposta desta chave, como se a pessoa já tivesse respondido. */
  server.answered = (key, survey = SURVEY) => {
    const shownIds = drawCards(survey, (limit) => randomInt(limit));
    const pickIds = drawGroups(shownIds, survey.groupSize).map((group) => group[0]);
    const response = { answerId: "00000000-0000-4000-8000-000000000000", pickIds, championId: pickIds[0], respondedAt: new Date().toISOString() };
    server.responses.set(slot(survey, key), { shownIds, response });
    return response;
  };
  server.responseOf = (key, survey = SURVEY) => server.responses.get(slot(survey, key))?.response || null;
  servers.push(server);
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
  await context.route("https://accounts.google.com/gsi/client", (route) => (server.googleDown
    ? route.abort("connectionrefused")
    : route.fulfill({ contentType: "application/javascript", body: GOOGLE_SCRIPT })));
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

const waitStep = (page, text) => page.waitForFunction((expected) => document.querySelector("#ps-step")?.textContent === expected, text, { timeout: 15000 });
const tapCard = (page, position = 0) => page.locator('.ps-grid[data-ready="true"] button[data-card]:not([disabled])').nth(position).click();

/** Joga as quatro telas, a final e confirma. Devolve o nome da carta escolhida. */
async function answer(page, position = 0) {
  for (let screen = 1; screen <= 4; screen += 1) {
    await waitStep(page, `Tela ${screen} de 4`);
    await tapCard(page, position);
  }
  await waitStep(page, "Final");
  await tapCard(page, position);
  await waitStep(page, "Confirmar");
  await page.locator('[data-action="confirm"]:not([disabled])').click();
  await waitStep(page, "Registrada");
  return page.locator("#ps-title").innerText();
}

const VALID_CPF = "529.982.247-25";
const formNotice = (page) => page.locator("#ps-notice:not([hidden])");
const submitButton = (page) => page.locator('#ps-register button[type="submit"]');

/** Preenche o formulário de cadastro inteiro, sem enviar. */
async function fillRegistration(page, cpf = VALID_CPF) {
  await waitStep(page, "Cadastro");
  await page.locator("#ps-cpf").fill(cpf);
  await page.getByRole("button", { name: "35 a 44" }).click();
  await page.getByRole("button", { name: "Mulher" }).click();
  await page.locator("#ps-state").selectOption("RJ");
  await page.locator("#ps-consent").check();
}

const results = [];
const only = process.env.CI ? "" : process.env.POLIMATCH_E2E_ONLY || "";
async function scenario(name, run) {
  if (only && !name.includes(only)) return;
  servers.length = 0;
  await run();
  for (const server of servers) {
  }
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
    // Uma leitura por pesquisa, sem identidade, e mais nada.
    assert.deepEqual(server.requests.map(({ method, pathname, key }) => `${method} ${pathname} ${key}`).sort(), PHOTO_SURVEYS.map((survey) => `GET /api/photo-surveys/${survey.id} `).sort());
    assert.equal(await storedKey(page), null, "nenhum jogador foi criado");
    assert.equal(await page.evaluate(() => localStorage.length), 0, "nada foi guardado no aparelho");
    // Abaixo do destaque: a outra pesquisa aberta e as que vêm.
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "POLÍTICA · 16 CARTAS");
    assert.deepEqual(await page.locator(".ps-home .ps-label").allInnerTexts(), ["Mais pesquisas", "Em breve"]);
    const more = await page.locator(".ps-home a.ps-survey").evaluateAll((rows) => rows.map((row) => ({ href: row.getAttribute("href"), title: row.querySelector("b").textContent, sub: row.querySelector("small").textContent, tag: row.querySelector(".pm-tag").textContent })));
    assert.deepEqual(more, [{ href: `./?p=${SECOND.id}`, title: "Em quem você confia mais?", sub: "Política · 16 cartas", tag: "Aberta" }]);
    assert.deepEqual(await page.locator(".ps-home .pm-item.is-soon span").allInnerTexts(), ["Famosos e influenciadores", "Roupas"]);
    assert.equal(await page.locator(".ps-home .ps-pick").count(), 0, "sem resposta, não há Suas escolhas");
    assert.equal(new URL(page.url()).search, "", "a capa não tem pesquisa no endereço");
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
      note: (node.querySelector(".pm-sub") || node.querySelector(".pm-tag"))?.textContent || "",
      href: node.getAttribute("href"),
      current: node.getAttribute("aria-current"),
    })));
    assert.deepEqual(items, [
      { text: "Quem você prefere?", note: "Política", href: `./?p=${SURVEY.id}`, current: null },
      { text: "Em quem você confia mais?", note: "Política", href: `./?p=${SECOND.id}`, current: null },
      { text: "Famosos e influenciadores", note: "Em breve", href: null, current: null },
      { text: "Roupas", note: "Em breve", href: null, current: null },
      { text: "Início", note: "", href: "./", current: "page" },
      { text: "Como funciona", note: "", href: "./como-funciona.html", current: null },
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
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }));
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
    assert.equal(server.last("/draw").key, GOOGLE_KEY);
  });

  await scenario("quem respondeu sem conta entra, faz o cadastro e vê a resposta que deu", async () => {
    const server = createServer();
    server.registered.delete(GOOGLE_KEY);
    const answered = server.answered(ANONYMOUS_KEY);
    const page = await open(await newContext(server, { storedKey: ANONYMOUS_KEY }));
    await entryReady(page);
    await page.waitForTimeout(300);
    assert.deepEqual(server.writes(), [], "com a chave sem conta, a capa não pede nada ao servidor");
    await page.locator("#ps-action").click();
    await waitStep(page, "Entrar");
    assert.deepEqual(server.writes(), [], "sem conta, o toque não emite sorteio");
    await page.locator("#e2e-google").click();
    assert.equal(await fillRegistration(page), undefined);
    assert.equal(server.last("/api/auth/google").key, ANONYMOUS_KEY, "a chave sem conta vai junto, para o servidor ligar a resposta à conta");
    assert.equal(await storedKey(page), GOOGLE_KEY);
    await submitButton(page).click();
    // A resposta dada sem conta agora é da conta: a pessoa vê a escolha, não um voto novo.
    await waitStep(page, "Registrada");
    assert.equal(server.last("/draw").key, GOOGLE_KEY);
    assert.equal(await page.locator(".ps-grid, #ps-action").count(), 0, "quem já respondeu não vota de novo");
    assert.deepEqual(server.responseOf(GOOGLE_KEY), answered);
    assert.equal(server.count("POST", "/response"), 0);
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

    const broken = createServer();
    broken.logout = "error";
    const third = await open(await newContext(broken, { storedKey: GOOGLE_KEY }));
    await entryReady(third);
    await openMenu(third);
    await third.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await third.locator('dialog.pm-menu[open] [role="alert"]').waitFor();
    assert.match(await third.locator('dialog.pm-menu[open] [role="alert"]').innerText(), /Não foi possível sair agora\./);
    assert.equal(await storedKey(third), GOOGLE_KEY, "com erro do servidor, a sessão fica");
  });

  await scenario("conta sem cadastro: Começar abre o formulário, e cada recusa do servidor tem o seu texto", async () => {
    const server = createServer();
    server.registered.delete(GOOGLE_KEY);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }));
    await entryReady(page);
    await page.waitForTimeout(300);
    assert.deepEqual(server.writes(), [], "a capa não pergunta pelo cadastro: quem decide é o toque");
    assert.equal(await page.locator(".ps-cta-note").innerText(), "Sua escolha só é registrada quando você confirmar.");
    await page.locator("#ps-action").click();
    await fillRegistration(page);
    assert.equal(await page.locator("#e2e-google").count(), 0, "com a conta no aparelho, não há tela de entrada");
    assert.equal(server.count("POST", "/api/auth/google"), 0);

    const refusals = [
      [{ status: 409, code: "CPF_ALREADY_REGISTERED" }, /Este CPF já tem cadastro em outra conta Google\. Entre com a conta usada no cadastro\./],
      [{ status: 429, code: "REGISTRATION_ATTEMPT_LIMIT", retryAfterSeconds: 3600 }, /Muitas tentativas de cadastro hoje\. Tente de novo amanhã\./],
      ["down", /Não conseguimos falar com o servidor/],
      [{ status: 500, code: "INTERNAL_ERROR" }, /Não foi possível concluir o cadastro agora\. Tente de novo\./],
      [{ status: 400, code: "CONSENT_VERSION_MISMATCH" }, /Atualize a página para concluir o cadastro\./],
    ];
    for (const [failure, text] of refusals) {
      server.failRegistration.push(failure);
      await submitButton(page).click();
      await formNotice(page).waitFor();
      const shown = await formNotice(page).innerText();
      assert.match(shown, text);
      assert.doesNotMatch(shown, /529|recusa do cadastro/, "o aviso é da página: nem o CPF nem o texto do servidor");
      // O que a pessoa preencheu continua na tela, e o botão volta.
      assert.equal(await page.locator("#ps-cpf").inputValue(), VALID_CPF);
      assert.equal(await page.locator("#ps-state").inputValue(), "RJ");
      assert.equal(await page.locator("#ps-consent").isChecked(), true);
      assert.equal(await page.getByRole("button", { name: "35 a 44" }).getAttribute("aria-pressed"), "true");
      assert.equal(await submitButton(page).isEnabled(), true);
      assert.equal(await stepText(page), "Cadastro");
    }
    assert.equal(server.registered.has(GOOGLE_KEY), false);
    assert.equal(server.count("POST", "/draw"), 1, "o formulário não pede sorteio a cada recusa");
    await submitButton(page).click();
    await waitStep(page, "Tela 1 de 4");
    assert.equal(server.count("POST", "/api/registration"), refusals.length + 1);
    assert.deepEqual(server.requests.filter((request) => request.pathname === "/api/registration").map((request) => request.key), Array(refusals.length + 1).fill(GOOGLE_KEY));
  });

  await scenario("sessão vencida no cadastro volta para a entrada, e entrar de novo conclui", async () => {
    const server = createServer();
    const renewed = `pms_${"r".repeat(43)}`;
    server.registered.delete(GOOGLE_KEY);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await fillRegistration(page);
    server.revoked.add(GOOGLE_KEY);
    server.session = renewed;
    await submitButton(page).click();
    await waitStep(page, "Entrar");
    assert.match(await formNotice(page).innerText(), /Sua sessão venceu\. Entre de novo para concluir o cadastro\./);
    await page.locator("#e2e-google").click();
    await waitStep(page, "Cadastro");
    assert.deepEqual(server.requests.filter((request) => request.pathname === "/api/auth/google").map((request) => request.key), [GOOGLE_KEY, ""], "a sessão que o servidor recusou não prende a entrada");
    assert.equal(await storedKey(page), renewed);
    await submitButton(page).click();
    await waitStep(page, "Tela 1 de 4");
    assert.equal(server.last("/api/registration").key, renewed);
    assert.equal(server.last("/draw").key, renewed);
  });

  await scenario("com a entrada na tela, entrar pelo menu segue para o cadastro; sair no formulário volta para a entrada", async () => {
    const server = createServer();
    server.registered.delete(GOOGLE_KEY);
    const page = await open(await newContext(server));
    await entryReady(page);
    assert.equal(await page.locator(".ps-cta-note").innerText(), "Para responder, entre com Google e cadastre o CPF.");
    await page.locator("#ps-action").click();
    await waitStep(page, "Entrar");
    assert.equal(await page.locator("#ps-title").innerText(), "Entre para responder");
    await page.locator("#ps-google #e2e-google").waitFor();
    await openMenu(page);
    await signIn(page);
    await page.keyboard.press("Escape");
    await waitStep(page, "Cadastro");
    assert.equal(await storedKey(page), GOOGLE_KEY);
    assert.equal(server.count("POST", "/api/auth/google"), 1);
    // Sair da conta com o formulário na tela: volta para a entrada, com o motivo.
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    await page.keyboard.press("Escape");
    await waitStep(page, "Entrar");
    assert.match(await formNotice(page).innerText(), /Você saiu da conta neste aparelho\. Entre de novo para fazer o cadastro\./);
    assert.equal(await page.locator("#ps-register").count(), 0);
    assert.equal(await storedKey(page), null);
    // E a entrada da própria tela continua valendo.
    await page.locator("#ps-google #e2e-google").click();
    await fillRegistration(page);
    await submitButton(page).click();
    await waitStep(page, "Tela 1 de 4");
  });

  await scenario("na entrada, o Google não carrega ou o servidor falha: a tela avisa e a nova tentativa entra", async () => {
    const server = createServer();
    server.googleDown = true;
    const page = await open(await newContext(server));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await waitStep(page, "Entrar");
    await formNotice(page).waitFor();
    const retry = formNotice(page).locator('[data-action="gate-retry"]');
    assert.equal(await retry.innerText(), "Tentar carregar o Google de novo");
    assert.equal(await page.locator("#e2e-google").count(), 0);
    server.googleDown = false;
    await retry.click();
    await page.locator("#ps-google #e2e-google").waitFor();
    assert.equal(await formNotice(page).count(), 0);
    // O Google respondeu, mas a troca pela sessão falha no servidor.
    server.failAuth.push(503);
    await page.locator("#e2e-google").click();
    await formNotice(page).waitFor();
    assert.match(await formNotice(page).innerText(), /Não foi possível entrar agora\. Tente de novo\./);
    assert.equal(await storedKey(page), null);
    assert.equal(await stepText(page), "Entrar");
    // A conta já tem cadastro: entrar leva direto à pesquisa, sem formulário.
    await page.locator("#ps-google #e2e-google").click();
    await waitStep(page, "Tela 1 de 4");
    assert.equal(server.count("POST", "/api/registration"), 0);
    assert.equal(server.last("/draw").key, GOOGLE_KEY);
  });

  await scenario("a conta perde o cadastro: a retomada sem toque fica na entrada e o toque abre o formulário", async () => {
    const server = createServer();
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await waitStep(page, "Tela 1 de 4");
    await tapCard(page, 1);
    await waitStep(page, "Tela 2 de 4");
    // O servidor deixa de ter o cadastro desta conta. Recarregar tenta retomar sozinho.
    server.registered.delete(GOOGLE_KEY);
    const drawsBefore = server.count("POST", "/draw");
    await page.reload({ waitUntil: "domcontentloaded" });
    await entryReady(page);
    await page.waitForTimeout(400);
    assert.equal(server.count("POST", "/draw"), drawsBefore + 1, "uma tentativa de retomada, sem repetir");
    assert.equal(await stepText(page), "Pesquisa", "sem toque, ninguém cai no formulário");
    assert.equal(await page.locator("#ps-register, #ps-google").count(), 0);
    await page.locator("#ps-action").click();
    await fillRegistration(page);
    await submitButton(page).click();
    // Com o cadastro refeito, a pesquisa volta de onde parou.
    await waitStep(page, "Tela 2 de 4");
  });

  await scenario("a resposta registrada oferece a próxima pesquisa, sem \"Ir para o início\"", async () => {
    // A fonte do Linux do CI é mais larga que a do macOS: o terceiro caso força
    // uma fonte larga, para a medida não depender da máquina.
    const WIDE_FONT = '.ps-shell, .ps-shell button, .ps-shell a { font-family: Menlo, "DejaVu Sans Mono", "Liberation Mono", monospace !important; }';
    for (const [width, height, wide = false] of [[390, 844], [360, 640], [360, 640, true]]) {
      const server = createServer();
      server.answered(GOOGLE_KEY);
      const page = await open(await newContext(server, { width, height, storedKey: GOOGLE_KEY }));
      await entryReady(page);
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      await page.locator("#ps-action").click();
      await page.waitForFunction(() => document.querySelector("#ps-step")?.textContent === "Registrada");
      await menuButton(page).waitFor();
      const next = page.locator(".ps-stack");
      const link = next.getByRole("link", { name: "Próxima pesquisa" });
      assert.equal(await link.getAttribute("href"), "./", "a próxima é a que a capa puser em destaque");
      // Os dois botões cabem na largura, com texto curto, mesmo lado a lado.
      const share = next.getByRole("button", { name: "Compartilhar minha escolha" });
      assert.equal(await share.innerText(), "Compartilhar");
      const [linkBox, shareBox] = [await link.boundingBox(), await share.boundingBox()];
      for (const [label, box] of [["próxima pesquisa", linkBox], ["compartilhar", shareBox]]) {
        assert.ok(box.height >= 44 && box.height <= 80, `${width}×${height}${wide ? " com fonte larga" : ""}: o botão de ${label} tem ${Math.round(box.height)} px de altura`);
        assert.ok(box.x >= 0 && box.x + box.width <= width + 0.5, `${width}×${height}: o botão de ${label} sai da tela`);
      }
      assert.doesNotMatch(await page.locator(".ps-main").innerText(), /Ir para o início/);
      assert.equal(new URL(page.url()).search, `?p=${SURVEY.id}`, "a pesquisa respondida fica no endereço");
      const nextBox = await next.boundingBox();
      assert.ok(nextBox.y + nextBox.height <= height + 1, `${width}×${height}: a próxima pesquisa aparece sem rolar`);
      const heroBox = await page.locator(".ps-hero .ps-card").boundingBox();
      const rowBox = await page.locator(".ps-row").boundingBox();
      // O mínimo do CSS é 70 px: aqui a carta precisa sobrar bem acima disso.
      assert.ok(heroBox.height >= (height >= 800 ? 180 : 90), `${width}×${height}${wide ? " com fonte larga" : ""}: a carta escolhida ficou pequena (${Math.round(heroBox.height)} px)`);
      assert.ok(rowBox.y + rowBox.height <= nextBox.y + 1, `${width}×${height}: as finalistas não ficam atrás dos botões`);
      assert.ok(heroBox.y + heroBox.height <= rowBox.y + 1, `${width}×${height}: a escolhida não cobre as finalistas`);
    }
  });

  await scenario("\"Como funciona\" cabe na tela, abre o menu e leva ao início", async () => {
    for (const [width, height] of [[390, 844], [360, 640]]) {
      const server = createServer();
      const page = await open(await newContext(server, { width, height }), HOW_URL);
      await page.locator("h1").waitFor();
      assert.equal(await page.locator("h1").innerText(), "Como funciona");
      assert.equal(await page.title(), "Como funciona — PoliMatch");
      assert.equal(await page.locator(".ps-list li").count(), 5);
      assert.match(await page.locator(".ps-list li").first().innerText(), /você entra com Google e cadastra o CPF, uma vez só/);
      assert.match(await page.locator(".pm-note").innerText(), /só sai o resultado somado, nunca a escolha de uma pessoa/);
      assert.match(await page.locator(".pm-note").innerText(), /Não guardamos o número do CPF/);
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
    const home = await (await fetch(appUrl)).text();
    for (const old of ["pesquisa.html", "quem-disse-isso.html", "fato-ou-fake.html", "duelos-da-corrida.html", "integridade.html"]) {
      const response = await fetch(new URL(old, appUrl));
      const body = await response.text();
      // O preview não redireciona (isso é do nginx): ou responde 404, ou devolve
      // a própria capa. Uma página antiga ainda no build teria outro HTML.
      assert.ok(response.status === 404 || body === home, `${old}: ${response.status}, com HTML próprio`);
    }
    const manifest = await (await fetch(new URL("manifest.webmanifest", appUrl))).json();
    assert.equal(manifest.name, "PoliMatch");
    assert.equal(manifest.theme_color, "#ffffff");
  });

  await scenario("o script do Google falha: o menu avisa, e tentar de novo carrega", async () => {
    const server = createServer();
    server.googleDown = true;
    const page = await open(await newContext(server));
    await entryReady(page);
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [role="alert"]').waitFor();
    const retry = page.locator('dialog.pm-menu[open] [data-menu="retry-google"]');
    assert.equal(await retry.innerText(), "Tentar carregar o Google de novo");
    server.googleDown = false;
    await retry.click();
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    assert.equal(await page.locator('dialog.pm-menu[open] [role="alert"]').count(), 0);
    await signIn(page);
    assert.equal(await storedKey(page), GOOGLE_KEY);
  });

  await scenario("a entrada falha no servidor: o menu avisa e a chave não muda", async () => {
    const server = createServer();
    server.failAuth.push(503);
    const page = await open(await newContext(server, { storedKey: ANONYMOUS_KEY }));
    await entryReady(page);
    await openMenu(page);
    await page.locator("dialog.pm-menu[open] #e2e-google").click();
    await page.locator('dialog.pm-menu[open] [role="alert"]').waitFor();
    assert.match(await page.locator('dialog.pm-menu[open] [role="alert"]').innerText(), /Não foi possível entrar agora\./);
    assert.equal(await storedKey(page), ANONYMOUS_KEY);
    // O botão do Google volta, e a segunda tentativa entra.
    await signIn(page);
    assert.equal(await storedKey(page), GOOGLE_KEY);
  });

  await scenario("chave anônima recusada: a entrada tenta de novo sem ela", async () => {
    const server = createServer();
    server.revoked.add(ANONYMOUS_KEY);
    const page = await open(await newContext(server, { storedKey: ANONYMOUS_KEY }));
    await entryReady(page);
    await openMenu(page);
    await signIn(page);
    const attempts = server.requests.filter((request) => request.pathname === "/api/auth/google").map((request) => request.key);
    assert.deepEqual(attempts, [ANONYMOUS_KEY, ""], "a segunda tentativa vai sem a chave que o servidor recusou");
    assert.equal(await storedKey(page), GOOGLE_KEY);
  });

  await scenario("duas abas: a outra sai da conta e o menu desta acompanha", async () => {
    const server = createServer();
    const context = await newContext(server);
    const first = await open(context);
    await entryReady(first);
    await openMenu(first);
    await signIn(first);
    await first.keyboard.press("Escape");
    const second = await open(context);
    await entryReady(second);
    await openMenu(second);
    await second.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await second.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    // A primeira aba guardava a sessão em memória; vale o que está no aparelho.
    await openMenu(first);
    await first.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    assert.doesNotMatch(await menu(first).innerText(), /Você entrou com Google|Sair da conta/);
  });

  await scenario("sair na resposta registrada não convida a responder de novo", async () => {
    const server = createServer();
    server.answered(GOOGLE_KEY);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await page.waitForFunction(() => document.querySelector("#ps-step")?.textContent === "Registrada");
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#ps-notice:not([hidden])").waitFor();
    assert.match(await page.locator("#ps-notice").innerText(), /Você saiu da conta neste aparelho\. A sua resposta continua registrada\./);
    assert.equal(await stepText(page), "Registrada");
    assert.equal(await page.locator("#ps-action, .ps-grid").count(), 0, "sem botão para responder de novo");
    assert.equal(await storedKey(page), null);
  });

  await scenario("pesquisa fechada: entrar com Google mostra a resposta da conta", async () => {
    const server = createServer();
    server.status = "closed";
    server.answered(GOOGLE_KEY);
    const page = await open(await newContext(server), surveyUrl(SURVEY));
    await page.locator("#ps-title", { hasText: "Esta pesquisa está fechada." }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Ver pesquisas" }).getAttribute("href"), "./");
    await openMenu(page);
    await signIn(page);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#ps-step")?.textContent === "Registrada");
    // E sair, com a pesquisa fechada, volta para a tela de fechada, sem "Começar".
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#ps-title", { hasText: "Esta pesquisa está fechada." }).waitFor();
    assert.equal(await page.locator("#ps-action").count(), 0);
  });

  await scenario("entrar enquanto a pesquisa abre não cria jogador anônimo", async () => {
    const server = createServer();
    const page = await open(await newContext(server));
    await entryReady(page);
    let release;
    server.holdSurvey = { promise: new Promise((resolve) => { release = resolve; }) };
    await page.locator("#ps-action").click();
    await page.locator("#ps-action[disabled]", { hasText: "Abrindo…" }).waitFor();
    await openMenu(page);
    await signIn(page);
    await page.keyboard.press("Escape");
    server.holdSurvey = null;
    release();
    await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
    assert.equal(server.last("/draw").key, GOOGLE_KEY);
  });

  await scenario("o foco fica no menu quando o conteúdo dele muda", async () => {
    const server = createServer();
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }));
    await entryReady(page);
    await openMenu(page);
    assert.equal(await page.locator("dialog.pm-menu[open] .pm-account-state").getAttribute("role"), "status");
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').focus();
    await page.keyboard.press("Enter");
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog.pm-menu"))), true, "depois de sair, o foco continua no menu");
    await page.locator("#e2e-google").focus();
    await page.keyboard.press("Enter");
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').waitFor();
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest("dialog.pm-menu"))), true, "depois de entrar, o foco continua no menu");
  });

  await scenario("navegador sem showModal: o menu abre e fecha mesmo assim", async () => {
    const server = createServer();
    const context = await newContext(server);
    await context.addInitScript(() => {
      delete HTMLDialogElement.prototype.showModal;
      delete HTMLDialogElement.prototype.close;
    });
    const page = await open(context);
    await entryReady(page);
    await menuButton(page).click();
    const panel = page.locator(".pm-menu[open]");
    await panel.waitFor();
    const box = await panel.boundingBox();
    assert.ok(box.width >= 389 && box.height >= 843 && box.y === 0, `sem showModal o painel ainda cobre a tela (${box.width}×${box.height} em ${box.y})`);
    assert.equal(await page.locator(".pm-menu[open] .pm-item").count(), 6);
    await page.locator('.pm-menu[open] [data-menu="close"]').click();
    await page.waitForFunction(() => !document.querySelector(".pm-menu").hasAttribute("open"));
    assert.equal(await page.locator(".pm-menu").isVisible(), false);
    await entryReady(page);
    // Esc fecha mesmo com o foco fora do painel, que aqui não prende o foco.
    await menuButton(page).click();
    await panel.waitFor();
    await page.evaluate(() => document.querySelector("#ps-title").focus());
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".pm-menu").hasAttribute("open"));
  });

  await scenario("credencial do Google recusada: a chave do aparelho não é descartada", async () => {
    const server = createServer();
    server.answered(ANONYMOUS_KEY);
    server.failAuth.push({ status: 401, code: "INVALID_GOOGLE_CREDENTIAL" });
    const page = await open(await newContext(server, { storedKey: ANONYMOUS_KEY }));
    await entryReady(page);
    await openMenu(page);
    await page.locator("dialog.pm-menu[open] #e2e-google").click();
    await page.locator('dialog.pm-menu[open] [role="alert"]').waitFor();
    const keys = () => server.requests.filter((request) => request.pathname === "/api/auth/google").map((request) => request.key);
    assert.deepEqual(keys(), [ANONYMOUS_KEY], "a recusa foi da credencial: não há nova tentativa sem a chave");
    assert.equal(await storedKey(page), ANONYMOUS_KEY);
    // Na tentativa seguinte a chave vai junto, e a resposta dada sem conta segue com a pessoa.
    await signIn(page);
    assert.deepEqual(keys(), [ANONYMOUS_KEY, ANONYMOUS_KEY]);
    await page.keyboard.press("Escape");
    await page.locator("#ps-action:not([disabled])").click();
    await page.waitForFunction(() => document.querySelector("#ps-step")?.textContent === "Registrada");
  });

  await scenario("entrada sem sessão na resposta: o menu avisa e a chave não muda", async () => {
    const server = createServer();
    server.emptyAuth = 1;
    const page = await open(await newContext(server, { storedKey: ANONYMOUS_KEY }));
    await entryReady(page);
    await openMenu(page);
    await page.locator("dialog.pm-menu[open] #e2e-google").click();
    await page.locator('dialog.pm-menu[open] [role="alert"]').waitFor();
    assert.equal(await storedKey(page), ANONYMOUS_KEY, "nada foi gravado no lugar da chave");
  });

  await scenario("sair não apaga a sessão que outra aba gravou enquanto o servidor respondia", async () => {
    const server = createServer();
    const other = `pms_${"n".repeat(43)}`;
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }));
    await entryReady(page);
    server.beforeLogout = async () => {
      server.beforeLogout = null;
      await page.evaluate(([name, key]) => localStorage.setItem(name, key), [IDENTITY_KEY, other]);
    };
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await page.waitForFunction(() => !document.querySelector('dialog.pm-menu [data-menu="signout"][disabled]'));
    assert.equal(server.last("/api/auth/logout").key, GOOGLE_KEY);
    assert.equal(await storedKey(page), other, "a sessão nova continua no aparelho");
    assert.match(await menu(page).innerText(), /Você entrou com Google\./);
  });

  await scenario("a pesquisa fechou depois de aberta a página: sair não oferece \"Começar\"", async () => {
    const server = createServer();
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }));
    await entryReady(page);
    server.status = "closed";
    await page.locator("#ps-action").click();
    await page.locator("#ps-title", { hasText: "Esta pesquisa está fechada." }).waitFor();
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#ps-title", { hasText: "Esta pesquisa está fechada." }).waitFor();
    await page.waitForTimeout(400);
    assert.equal(await page.locator("#ps-action").count(), 0, "com a pesquisa fechada não há entrada para oferecer");
    assert.doesNotMatch(await page.locator(".ps-main").innerText(), /Toque em Começar/);
  });

  await scenario("cada pesquisa tem endereço; um código desconhecido cai na capa", async () => {
    const server = createServer();
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    const second = await open(context, surveyUrl(SECOND));
    await entryReady(second);
    assert.equal(await second.locator("#ps-title").innerText(), "Em quem você confia mais?");
    assert.equal(await second.locator(".ps-home").count(), 0, "na página da pesquisa não há as listas da capa");
    assert.equal(await second.getByRole("link", { name: "Todas as pesquisas" }).getAttribute("href"), "./");
    assert.deepEqual(server.requests.map(({ method, pathname }) => `${method} ${pathname}`), [`GET /api/photo-surveys/${SECOND.id}`]);
    await openMenu(second);
    assert.equal(await menu(second).locator('a[aria-current="page"] span').innerText(), "Em quem você confia mais?");
    await second.keyboard.press("Escape");
    await second.locator("#ps-action").click();
    await waitStep(second, "Tela 1 de 4");
    assert.equal(server.last("/draw").pathname, `/api/photo-surveys/${SECOND.id}/draw`);

    const unknown = await open(await newContext(createServer()), new URL("?p=nao-existe", appUrl).href);
    await entryReady(unknown);
    assert.equal(await unknown.locator("#ps-title").innerText(), "Quem você prefere?");
    assert.equal(await unknown.locator(".ps-home").count(), 1, "código desconhecido abre a capa");
  });

  await scenario("responder a primeira: a capa mostra a escolha e destaca a segunda; uma não mexe na outra", async () => {
    const server = createServer();
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    const page = await open(context);
    await entryReady(page);
    await page.locator("#ps-action").click();
    const first = await answer(page, 0);
    assert.equal(new URL(page.url()).search, `?p=${SURVEY.id}`);
    assert.equal(server.responseOf(GOOGLE_KEY, SECOND), null, "responder a primeira não responde a segunda");

    // "Próxima pesquisa" leva à capa: a escolha aparece e a segunda vira o destaque.
    await Promise.all([page.waitForURL(appUrl), page.getByRole("link", { name: "Próxima pesquisa" }).click()]);
    await entryReady(page);
    assert.equal(await page.locator("#ps-title").innerText(), "Em quem você confia mais?");
    const pick = page.locator(".ps-home .ps-pick");
    await pick.locator("b", { hasText: first }).waitFor();
    assert.equal(await pick.count(), 1);
    assert.equal(await pick.getAttribute("href"), `./?p=${SURVEY.id}`);
    assert.match(await pick.locator("small").innerText(), /Política · Quem você prefere\?/);
    assert.equal(await pick.locator("img").evaluate((image) => image.naturalWidth > 0), true, "a carta escolhida aparece");
    assert.deepEqual(await page.locator(".ps-home .ps-label").allInnerTexts(), ["Suas escolhas", "Em breve"]);
    assert.equal(await page.locator(".ps-home a.ps-survey").count(), 0, "a segunda está no destaque, não na lista");
    assert.equal(server.count("POST", `/api/photo-surveys/${SECOND.id}/draw`), 0, "a capa não emite sorteio da pesquisa em destaque");

    // A segunda começa do zero: sorteio próprio, nenhuma escolha herdada.
    await page.locator("#ps-action").click();
    await waitStep(page, "Tela 1 de 4");
    assert.equal(await page.locator('.ps-grid button[aria-pressed="true"]').count(), 0);
    const second = await answer(page, 1);
    assert.equal(await page.getByRole("link", { name: "Ver pesquisas" }).getAttribute("href"), "./", "sem próxima, o botão leva à capa");
    assert.notEqual(server.responseOf(GOOGLE_KEY, SURVEY).answerId, server.responseOf(GOOGLE_KEY, SECOND).answerId);

    // Respondidas as duas, a capa diz isso e mostra as duas escolhas.
    await page.getByRole("link", { name: "Ver pesquisas" }).click();
    await page.locator("#ps-title", { hasText: "Você respondeu todas as pesquisas abertas." }).waitFor();
    assert.equal(await page.locator("#ps-action").count(), 0);
    await page.locator(".ps-home .ps-pick b", { hasText: second }).waitFor();
    assert.deepEqual(await page.locator(".ps-home .ps-pick b").allInnerTexts(), [first, second]);
    // Tocar numa escolha abre a tela da resposta daquela pesquisa.
    await page.locator(".ps-home .ps-pick").first().click();
    await waitStep(page, "Registrada");
    assert.equal(await page.locator("#ps-title").innerText(), first);
  });

  await scenario("a capa destaca a pesquisa que ficou pela metade, com Continuar, e não fica presa se ela fecha", async () => {
    const server = createServer();
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SECOND));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await waitStep(page, "Tela 1 de 4");
    await tapCard(page, 2);
    await waitStep(page, "Tela 2 de 4");
    // A primeira pesquisa não herda nada da segunda.
    await page.goto(surveyUrl(SURVEY), { waitUntil: "domcontentloaded" });
    await entryReady(page);
    assert.equal(await page.locator("#ps-title").innerText(), "Quem você prefere?");
    // A capa continua sendo a capa: destaca a que ficou pela metade e oferece continuar.
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await entryReady(page, "Continuar");
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await page.locator("#ps-title").innerText(), "Em quem você confia mais?");
    assert.match(await page.locator(".ps-hint").first().innerText(), /Você parou no meio/);
    assert.deepEqual(await page.locator(".ps-home a.ps-survey b").allInnerTexts(), ["Quem você prefere?"]);
    assert.equal(server.count("POST", `/api/photo-surveys/${SURVEY.id}/draw`), 0);
    await page.locator("#ps-action").click();
    await waitStep(page, "Tela 2 de 4");
    assert.equal(new URL(page.url()).search, `?p=${SECOND.id}`);
    assert.equal(await page.locator('.ps-grid button[aria-pressed="true"]').count(), 0, "a tela 2 ainda não tem escolha");

    // A pesquisa pela metade fecha: a capa segue alcançável e destaca a outra.
    server.closed.add(SECOND.id);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await entryReady(page, "Começar");
    assert.equal(new URL(page.url()).search, "", "a capa não manda para a pesquisa fechada");
    assert.equal(await page.locator("#ps-title").innerText(), "Quem você prefere?");
    assert.deepEqual(await page.locator(".ps-home a.ps-survey").evaluateAll((rows) => rows.map((row) => `${row.querySelector("b").textContent} | ${row.querySelector(".pm-tag").textContent}`)), ["Em quem você confia mais? | Fechada"]);
  });

  await scenario("uma pesquisa fechada sai do destaque e aparece como fechada", async () => {
    const server = createServer();
    server.closed.add(SURVEY.id);
    const page = await open(await newContext(server));
    await entryReady(page);
    assert.equal(await page.locator("#ps-title").innerText(), "Em quem você confia mais?");
    const rows = await page.locator(".ps-home a.ps-survey").evaluateAll((items) => items.map((row) => `${row.querySelector("b").textContent} | ${row.querySelector(".pm-tag").textContent}`));
    assert.deepEqual(rows, ["Quem você prefere? | Fechada"]);
    assert.deepEqual(server.writes(), []);

    // Todas fechadas: sem destaque e sem botão de começar.
    const none = createServer();
    none.status = "closed";
    const empty = await open(await newContext(none));
    await empty.locator("#ps-title", { hasText: "Nenhuma pesquisa aberta agora." }).waitFor();
    assert.equal(await empty.locator("#ps-action").count(), 0);
    assert.equal(await empty.locator(".ps-home a.ps-survey .pm-tag", { hasText: "Fechada" }).count(), 2);

    // Quem tem conta no aparelho e respondeu antes de fechar vê a escolha, mesmo sem registro local.
    const past = createServer();
    past.status = "closed";
    const chosen = past.answered(GOOGLE_KEY, SECOND);
    const mine = await open(await newContext(past, { storedKey: GOOGLE_KEY }));
    await mine.locator(".ps-home .ps-pick img").waitFor();
    assert.equal(await mine.locator(".ps-home .ps-pick").getAttribute("href"), `./?p=${SECOND.id}`);
    assert.equal(await mine.locator(".ps-home .ps-pick img").getAttribute("src"), (await import("../src/political-chromas.json", { with: { type: "json" } })).default.find((art) => art.id === chosen.championId).src);
    assert.deepEqual(past.writes().filter((entry) => !entry.endsWith("/draw")), [], "só o pedido da resposta, que fechada não grava nada");

    // Um estado que a página não conhece vale como fechada, sem quebrar a capa.
    const odd = createServer();
    odd.status = "constructor";
    const strange = await open(await newContext(odd));
    await strange.locator("#ps-title", { hasText: "Nenhuma pesquisa aberta agora." }).waitFor();
    assert.equal(await strange.locator(".ps-home a.ps-survey .pm-tag", { hasText: "Fechada" }).count(), 2);
  });

  await scenario("com a API fora do ar, a capa avisa e tenta de novo", async () => {
    const server = createServer();
    const context = await newContext(server);
    let down = true;
    await context.route(/\/api\/photo-surveys\//, (route) => (down ? route.abort("connectionrefused") : route.fallback()));
    const page = await open(context);
    await page.locator("#ps-notice:not([hidden])").waitFor();
    assert.match(await page.locator("#ps-notice").innerText(), /Não conseguimos falar com o servidor/);
    assert.equal(await page.locator("#ps-action").innerText(), "Tentar de novo");
    down = false;
    await page.locator("#ps-action").click();
    await entryReady(page);
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
    assert.equal(await page.locator(".ps-home a.ps-survey").count(), 1);
  });

  // O compartilhamento do aparelho é simulado: guarda o que a página mandou.
  const SHARE_STUB = (mode) => {
    window.__shared = [];
    const record = (data) => window.__shared.push({
      title: data.title, text: data.text, url: data.url,
      files: (data.files || []).map((file) => ({ name: file.name, type: file.type, size: file.size })),
    });
    const define = (name, value) => Object.defineProperty(Navigator.prototype, name, { configurable: true, writable: true, value });
    if (mode === "none") {
      define("share", undefined);
      define("canShare", undefined);
      Object.defineProperty(Navigator.prototype, "clipboard", { configurable: true, get: () => ({ writeText: async (text) => { window.__copied = text; } }) });
      return;
    }
    define("canShare", (data) => mode === "file" && Array.isArray(data?.files) && data.files.every((file) => file.type === "image/jpeg"));
    define("share", async (data) => {
      record(data);
      if (mode === "cancel") throw new DOMException("cancelado", "AbortError");
      // A folha de compartilhar fica aberta um instante, como num aparelho de verdade.
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
  };
  async function answeredPage(mode) {
    const server = createServer();
    const answered = server.answered(GOOGLE_KEY);
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    await context.addInitScript(SHARE_STUB, mode);
    const images = [];
    context.on("request", (request) => { if (request.url().includes("/chromas/")) images.push(new URL(request.url()).pathname); });
    const page = await open(context, surveyUrl(SURVEY));
    page.cardRequests = images;
    await entryReady(page);
    await page.locator("#ps-action").click();
    await waitStep(page, "Registrada");
    return { page, server, name: await page.locator("#ps-title").innerText(), answered };
  }

  await scenario("compartilhar: a imagem com a carta, o texto e o endereço, só no toque", async () => {
    const { page, server, name } = await answeredPage("file");
    const button = page.getByRole("button", { name: "Compartilhar minha escolha" });
    // A imagem fica pronta antes do toque, para o toque abrir o compartilhamento na hora.
    await page.locator('[data-action="share"][data-ready="true"]').waitFor();
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => window.__shared), [], "nada é compartilhado sem o toque");
    const before = server.requests.length;
    assert.ok(page.cardRequests.some((path) => path.endsWith("-1060.webp")), "a imagem compartilhada usa a carta no tamanho maior");
    // Dois toques seguidos abrem o compartilhamento uma vez só.
    await button.click();
    await button.click();
    await page.waitForFunction(() => window.__shared.length >= 1);
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.__shared.length), 1, "um compartilhamento por toque, sem repetir");
    const [shared] = await page.evaluate(() => window.__shared);
    assert.equal(shared.title, "PoliMatch");
    assert.equal(shared.text, `Quem você prefere? Minha escolha no PoliMatch: ${name}. E a sua?`);
    assert.equal(shared.url, `https://polimatch.com.br/?p=${SURVEY.id}`);
    assert.equal(shared.files.length, 1);
    assert.equal(shared.files[0].name, "polimatch-minha-escolha.jpg");
    assert.equal(shared.files[0].type, "image/jpeg");
    assert.ok(shared.files[0].size > 40000, `a imagem tem conteúdo (${shared.files[0].size} bytes)`);
    assert.equal(server.requests.length, before, "compartilhar não fala com a API");
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
    // Sem resposta carregada não há o que compartilhar: a tela de voto não tem o botão.
    const fresh = await open(await newContext(createServer()), surveyUrl(SURVEY));
    await entryReady(fresh);
    assert.equal(await fresh.locator('[data-action="share"]').count(), 0);
  });

  await scenario("sem compartilhamento de arquivo vai o texto; sem compartilhamento, o endereço é copiado", async () => {
    const text = await answeredPage("text");
    await text.page.locator('[data-action="share"][data-ready]').waitFor();
    await text.page.getByRole("button", { name: "Compartilhar minha escolha" }).click();
    await text.page.waitForFunction(() => window.__shared.length === 1);
    const [onlyText] = await text.page.evaluate(() => window.__shared);
    assert.deepEqual(onlyText.files, []);
    assert.match(onlyText.text, new RegExp(`Minha escolha no PoliMatch: ${text.name}\\.`));
    assert.equal(onlyText.url, `https://polimatch.com.br/?p=${SURVEY.id}`);

    const none = await answeredPage("none");
    await none.page.getByRole("button", { name: "Compartilhar minha escolha" }).click();
    await none.page.locator("#ps-notice:not([hidden])", { hasText: "Link copiado." }).waitFor();
    assert.equal(await none.page.evaluate(() => window.__copied), `Quem você prefere? Minha escolha no PoliMatch: ${none.name}. E a sua? https://polimatch.com.br/?p=${SURVEY.id}`);

    // Fechar a folha de compartilhar não é erro: nenhum aviso.
    const cancel = await answeredPage("cancel");
    await cancel.page.getByRole("button", { name: "Compartilhar minha escolha" }).click();
    await cancel.page.waitForFunction(() => window.__shared.length === 1);
    await cancel.page.waitForTimeout(300);
    assert.equal(await cancel.page.locator("#ps-notice:not([hidden])").count(), 0);
    assert.equal(await cancel.page.getByRole("button", { name: "Compartilhar minha escolha" }).isEnabled(), true);
  });

  await scenario("servidor que ainda não conhece a segunda pesquisa: a capa mostra só a primeira", async () => {
    const server = createServer();
    server.unknown.add(SECOND.id);
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    const page = await open(context);
    await entryReady(page);
    assert.equal(await page.locator("#ps-title").innerText(), "Quem você prefere?");
    assert.deepEqual(await page.locator(".ps-home .ps-label").allInnerTexts(), ["Em breve"], "a pesquisa desconhecida não entra na lista");
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
    await page.locator("#ps-action").click();
    await waitStep(page, "Tela 1 de 4");
    // No endereço dela, a pesquisa desconhecida diz que não está disponível, com saída para a capa.
    const direct = await open(context, surveyUrl(SECOND));
    await direct.locator("#ps-title", { hasText: "Esta pesquisa não está disponível." }).waitFor();
    assert.equal(await direct.getByRole("link", { name: "Ver pesquisas" }).getAttribute("href"), "./");
  });

  await scenario("uma leitura que falha não vira informação falsa: a capa pede para tentar de novo", async () => {
    const server = createServer();
    server.answered(GOOGLE_KEY);
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    // A pessoa respondeu a primeira neste aparelho.
    const first = await open(context, surveyUrl(SURVEY));
    await entryReady(first);
    await first.locator("#ps-action").click();
    await waitStep(first, "Registrada");
    // A leitura da segunda falha: a capa não pode dizer que tudo foi respondido.
    let down = true;
    await context.route(new RegExp(`/api/photo-surveys/${SECOND.id}$`), (route) => (down ? route.abort("connectionrefused") : route.fallback()));
    const page = await open(context);
    await page.locator("#ps-notice:not([hidden])").waitFor();
    assert.match(await page.locator("#ps-notice").innerText(), /Não conseguimos falar com o servidor/);
    assert.equal(await page.locator("#ps-action").innerText(), "Tentar de novo");
    assert.doesNotMatch(await page.locator(".ps-main").innerText(), /Você respondeu todas/);
    down = false;
    await page.locator("#ps-action").click();
    await entryReady(page, "Começar");
    assert.equal(await page.locator("#ps-title").innerText(), "Em quem você confia mais?");
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
  });

  await scenario("outra aba sai da conta: a capa desta se refaz", async () => {
    const server = createServer();
    server.answered(GOOGLE_KEY);
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    const first = await open(context, surveyUrl(SURVEY));
    await entryReady(first);
    await first.locator("#ps-action").click();
    await waitStep(first, "Registrada");
    await first.goto(appUrl, { waitUntil: "domcontentloaded" });
    await first.locator(".ps-home .ps-pick img").waitFor();
    assert.equal(await first.locator("#ps-title").innerText(), "Em quem você confia mais?");

    const second = await open(context);
    await entryReady(second);
    await openMenu(second);
    await second.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await second.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    // Sem a conta, a escolha dela some da capa e o destaque volta para a primeira pesquisa.
    await first.waitForFunction(() => document.querySelectorAll(".ps-home .ps-pick").length === 0 && document.querySelector("#ps-title")?.textContent === "Quem você prefere?");
    assert.deepEqual(await first.locator(".ps-home .ps-label").allInnerTexts(), ["Mais pesquisas", "Em breve"]);
  });

  assert.deepEqual(pageErrors, [], `erros de página: ${pageErrors.join(" | ")}`);
  if (only && results.length === 0) throw new Error(`POLIMATCH_E2E_ONLY="${only}" não casa com nenhum cenário.`);
  console.log(JSON.stringify({ suite: "site-shell", browser: browserName, scenarios: results.length }));
} finally {
  await Promise.all(contexts.map((context) => context.close().catch(() => {})));
  await browser.close();
}
