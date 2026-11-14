/**
 * Pesquisa por foto, etapa 1 (ICM 68, #324): a página /pesquisa.html.
 *
 * O servidor aqui é simulado, com as mesmas regras de shared/photo-survey.js
 * que a API usa: sorteio por jogador, resposta única e validação da chave.
 * Ele conta cada requisição, para provar o que a página grava e quando.
 *
 * Cenários:
 *   1. Abrir a página não cria jogador nem sorteio; a página fica fora do
 *      menu e do sitemap, com noindex.
 *   2. Caminho direto: um toque por tela, final, confirmação e uma gravação.
 *   3. As quatro cartas têm o mesmo tamanho e cabem na tela em seis tamanhos,
 *      e em dois deles com o texto mais largo e mais alto; a confirmação e a
 *      resposta registrada cabem sem cobrir a escolhida nem as finalistas.
 *   4. Voltar e trocar, inclusive a carta que era a escolhida.
 *   5. Recarregar no meio retoma o mesmo sorteio e as mesmas escolhas.
 *   6. Segunda aba: retoma o mesmo ponto e vê a resposta quando a outra confirma.
 *   7. Dois aparelhos com a mesma identidade: vale a primeira resposta.
 *   8. Quem já respondeu vê a escolha, com recarga ou em outro aparelho.
 *   9. Confirmação sem resposta do servidor: a nova tentativa não duplica.
 *  10. Pesquisa fechada na abertura e fechada no meio.
 *  11. Rotas desligadas e API fora do ar.
 *  12. Cota de jogos novos da rede esgotada.
 *  13. Troca de identidade no meio.
 *  14. Sorteio da conta mudou: a página busca de novo e recomeça.
 *  15. Sessão recusada: saída clara, sem perder as escolhas.
 *  16. Carta que não carrega, ou que não chega, trava a tela inteira até carregar.
 *  17. Armazenamento bloqueado: dá para responder na mesma aba.
 *  18. Toques repetidos e voltar durante a troca de tela.
 *  19. Falhas do servidor no sorteio e na resposta, e recibo recusado.
 *  20. Quem respondeu e abre sem servidor não volta para a entrada.
 */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { chromium, webkit } from "playwright";
import {
  PHOTO_SURVEYS,
  drawCards,
  drawGroups,
  publicPhotoSurvey,
  validateBracket,
} from "../../shared/photo-survey.js";
import ARTS from "../src/political-chromas.json" with { type: "json" };

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const SURVEY = PHOTO_SURVEYS[0];
const SURVEY_URL = new URL("pesquisa.html", appUrl).href;
const IDENTITY_KEY = "polimatch:v3:recovery-key";
const PROGRESS_KEY = "polimatch:photo-survey:v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const nameOf = new Map(ARTS.map((art) => [art.id, art.name]));
const keyFor = (label) => `pm2_${label.padEnd(43, "x").slice(0, 43)}`;

/** API simulada. As regras de sorteio e validação são as do módulo compartilhado. */
function createServer() {
  const server = {
    status: "open",
    disabled: false,
    down: false,
    quota: false,
    dropAfterApply: 0,
    // Falhas programadas: cada entrada é o status HTTP da próxima chamada.
    failDraw: [],
    failResponse: [],
    refuseReceipt: 0,
    beforeDraw: null,
    revoked: new Set(),
    requests: [],
    draws: new Map(),
    responses: new Map(),
    issued: 0,
    count(method, suffix) {
      return server.requests.filter((request) => request.method === method && request.pathname.endsWith(suffix)).length;
    },
    bodies(suffix) {
      return server.requests.filter((request) => request.method === "POST" && request.pathname.endsWith(suffix)).map((request) => request.body);
    },
    groupsFor(key) {
      return drawGroups(server.draws.get(key), SURVEY.groupSize);
    },
    view() {
      return { ...publicPhotoSurvey(SURVEY, new Date()), status: server.status };
    },
  };
  server.handler = async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const key = (request.headers().authorization || "").replace(/^Bearer /, "");
    let body = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }
    server.requests.push({ method, pathname, key, body });
    if (server.down) return route.abort("connectionrefused");
    const send = (status, json) => route.fulfill({ status, json, headers: status === 429 ? { "Retry-After": String(json.retryAfterSeconds) } : {} });

    if (pathname === "/api/player" && method === "POST") {
      if (server.quota) {
        return send(429, { error: "limite diário de novos jogadores nesta rede atingido", code: "PLAYER_ISSUANCE_LIMIT", retryAfterSeconds: 5400 });
      }
      server.issued += 1;
      return send(201, { recoveryKey: keyFor(`novo${server.issued}`) });
    }
    if (!pathname.startsWith("/api/photo-surveys/")) return send(404, { error: "rota não simulada" });
    if (server.disabled) return send(404, { error: "pesquisa por foto indisponível", code: "PHOTO_SURVEYS_DISABLED" });
    const [surveyId, action] = pathname.slice("/api/photo-surveys/".length).split("/");
    if (surveyId !== SURVEY.id) return send(404, { error: "pesquisa não encontrada", code: "PHOTO_SURVEY_NOT_FOUND" });
    if (!action && method === "GET") return send(200, server.view());
    if (action === "draw" && server.beforeDraw) await server.beforeDraw(key);
    if (!key || server.revoked.has(key)) return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });

    const prior = server.responses.get(key);
    const failure = (status) => send(status, status === 429
      ? { error: "muitas requisições", code: "RATE_LIMITED", retryAfterSeconds: 30 }
      : { error: "erro interno", code: "INTERNAL_ERROR" });
    if (action === "draw" && method === "POST") {
      if (server.failDraw.length) return failure(server.failDraw.shift());
      if (prior) return send(200, { survey: server.view(), draw: { groups: drawGroups(prior.shownIds, SURVEY.groupSize) }, response: prior.response });
      if (!server.draws.has(key)) {
        if (server.status !== "open") return send(409, { error: "pesquisa fechada", code: "PHOTO_SURVEY_CLOSED", current: { status: server.status } });
        server.draws.set(key, drawCards(SURVEY, (limit) => randomInt(limit)));
      }
      return send(200, { survey: server.view(), draw: { groups: server.groupsFor(key) }, response: null });
    }
    if (action === "response" && method === "POST") {
      if (server.failResponse.length) return failure(server.failResponse.shift());
      if (prior) {
        const same = JSON.stringify(prior.response.pickIds) === JSON.stringify(body?.pickIds) && prior.response.championId === body?.championId;
        if (same) return send(200, { status: "alreadyProcessed", survey: server.view(), draw: { groups: drawGroups(prior.shownIds, SURVEY.groupSize) }, response: prior.response });
        return send(409, { error: "esta pesquisa já foi respondida", code: "PHOTO_SURVEY_ALREADY_ANSWERED", current: prior.response });
      }
      const shownIds = server.draws.get(key);
      if (!shownIds) return send(409, { error: "sorteio ainda não emitido", code: "PHOTO_SURVEY_DRAW_REQUIRED" });
      if (server.status !== "open") return send(409, { error: "pesquisa fechada", code: "PHOTO_SURVEY_CLOSED", current: { status: server.status } });
      const bracket = validateBracket(SURVEY, shownIds, { pickIds: body?.pickIds, championId: body?.championId });
      if (bracket.ok && server.refuseReceipt > 0) {
        server.refuseReceipt -= 1;
        return send(400, { error: "resposta não corresponde ao sorteio", code: "PHOTO_SURVEY_RESPONSE_INVALID", current: { reason: "answer-id" } });
      }
      if (!bracket.ok || !UUID.test(String(body?.answerId))) {
        return send(400, { error: "resposta não corresponde ao sorteio", code: "PHOTO_SURVEY_RESPONSE_INVALID", current: { reason: bracket.ok ? "answer-id" : bracket.reason } });
      }
      const response = { answerId: body.answerId, pickIds: bracket.pickIds, championId: bracket.championId, respondedAt: new Date().toISOString() };
      server.responses.set(key, { shownIds, response });
      if (server.dropAfterApply > 0) {
        // O caso que importa: o servidor gravou e a resposta não chegou.
        server.dropAfterApply -= 1;
        return route.abort("connectionreset");
      }
      return send(200, { status: "created", survey: server.view(), draw: { groups: server.groupsFor(key) }, response });
    }
    return send(404, { error: "rota não simulada" });
  };
  return server;
}

const browser = await browserType.launch();
const contexts = [];
const pageErrors = [];

async function newContext(server, { width = 390, height = 844, storedKey = "", blockStorage = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  contexts.push(context);
  if (blockStorage) {
    await context.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get() { throw new DOMException("The operation is insecure.", "SecurityError"); },
      });
    });
  }
  if (storedKey) {
    await context.addInitScript(([name, key]) => {
      if (!localStorage.getItem(name)) localStorage.setItem(name, key);
    }, [IDENTITY_KEY, storedKey]);
  }
  await context.route(/\/api(?:\/|$)/, server.handler);
  return context;
}

async function openSurvey(context) {
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(SURVEY_URL, { waitUntil: "domcontentloaded" });
  return page;
}

const step = (page, text) => page.waitForFunction((expected) => document.querySelector("#ps-step")?.textContent === expected, text, { timeout: 15000 });
const title = (page) => page.locator("#ps-title").innerText();
const storedKey = (page) => page.evaluate((name) => localStorage.getItem(name), IDENTITY_KEY);
const actionButton = (page) => page.locator("#ps-action");

async function begin(page, label = "Começar") {
  await page.locator(`#ps-action:not([disabled])`, { hasText: label }).click();
}

async function grid(page) {
  await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
  return page.locator(".ps-grid button[data-card]").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return {
      id: button.dataset.card,
      label: button.getAttribute("aria-label"),
      pressed: button.getAttribute("aria-pressed") === "true",
      disabled: button.disabled,
      loaded: button.querySelector("img").naturalWidth > 0,
      top: box.top,
      bottom: box.bottom,
      left: box.left,
      right: box.right,
      width: box.width,
      height: box.height,
    };
  }));
}

async function tap(page, cardId) {
  await page.locator(`.ps-grid[data-ready="true"] button[data-card="${cardId}"]:not([disabled])`).click();
}

/** Joga as telas de voto que faltam, escolhendo a carta na posição pedida. */
async function playScreens(page, groups, positions, from = 0) {
  const picks = [];
  for (let screen = from; screen < groups.length; screen += 1) {
    await step(page, `Tela ${screen + 1} de ${groups.length}`);
    const cards = await grid(page);
    assert.deepEqual(cards.map((card) => card.id), groups[screen], `tela ${screen + 1}: cartas na ordem do sorteio`);
    const pick = groups[screen][positions[screen]];
    await tap(page, pick);
    picks.push(pick);
  }
  await step(page, "Final");
  return picks;
}

async function confirm(page) {
  await page.locator('[data-action="confirm"]:not([disabled])').click();
}

const results = [];
async function scenario(name, run) {
  await run();
  results.push(name);
  console.log(`ok - ${name}`);
}

try {
  await scenario("abrir a página não grava nada e ela fica fora do menu e do sitemap", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await actionButton(page).and(page.locator(":not([disabled])")).waitFor();
    assert.equal(await title(page), "Quem você prefere?");
    assert.equal(await actionButton(page).innerText(), "Começar");
    const fan = await page.locator(".ps-fan img").evaluateAll((images) => images.map((image) => image.getAttribute("src")));
    assert.equal(fan.length, 3);
    assert.equal(new Set(fan).size, 3, "as cartas da entrada são distintas");
    assert.ok(fan.every((src) => ARTS.some((art) => art.src === src)), "as cartas da entrada saem do conjunto da pesquisa");
    await page.waitForTimeout(500);
    assert.deepEqual(server.requests.map(({ method, pathname }) => `${method} ${pathname}`), [`GET /api/photo-surveys/${SURVEY.id}`]);
    assert.equal(await storedKey(page), null, "nenhum jogador foi criado");
    assert.equal(await page.evaluate((name) => localStorage.getItem(name), PROGRESS_KEY), null);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex");

    const sitemap = await (await fetch(new URL("sitemap.xml", appUrl))).text();
    assert.doesNotMatch(sitemap, /pesquisa/);
    for (const other of ["", "quem-disse-isso.html", "fato-ou-fake.html", "duelos-da-corrida.html"]) {
      const html = await (await fetch(new URL(other, appUrl))).text();
      assert.doesNotMatch(html, /pesquisa\.html/, `${other || "capa"} não aponta para a pesquisa`);
    }
    const home = await context.newPage();
    await home.goto(appUrl, { waitUntil: "domcontentloaded" });
    await home.waitForTimeout(600);
    assert.equal(await home.locator('a[href*="pesquisa"]').count(), 0, "a capa não tem entrada para a pesquisa");
  });

  await scenario("caminho direto: um toque por tela, final, confirmação e uma gravação", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    assert.equal(key, keyFor("novo1"));
    assert.equal(server.count("POST", "/api/player"), 1);
    assert.equal(server.count("POST", "/draw"), 1);
    const groups = server.groupsFor(key);

    const first = await grid(page);
    assert.deepEqual(first.map((card) => card.label), groups[0].map((id) => `Escolher ${nameOf.get(id)}`));
    assert.ok(first.every((card) => card.loaded && !card.pressed && !card.disabled));
    assert.equal(await page.locator('[data-action="back"]').count(), 0, "a primeira tela não tem voltar");

    const picks = await playScreens(page, groups, [1, 0, 3, 2]);
    assert.equal(await title(page), "Entre elas, quem fica?");
    assert.deepEqual((await grid(page)).map((card) => card.id), picks, "a final mostra as quatro escolhidas, na ordem das telas");
    await tap(page, picks[2]);
    await step(page, "Confirmar");
    assert.equal(await title(page), nameOf.get(picks[2]));
    assert.deepEqual(
      await page.locator(".ps-row [role=img]").evaluateAll((cards) => cards.map((card) => card.getAttribute("aria-label"))),
      picks.filter((id) => id !== picks[2]).map((id) => nameOf.get(id)),
    );
    assert.equal(server.count("POST", "/response"), 0, "nada é gravado antes de confirmar");

    await confirm(page);
    await step(page, "Registrada");
    assert.equal(await title(page), nameOf.get(picks[2]));
    const bodies = server.bodies("/response");
    assert.equal(bodies.length, 1);
    assert.deepEqual(Object.keys(bodies[0]).sort(), ["answerId", "championId", "pickIds"]);
    assert.match(bodies[0].answerId, UUID);
    assert.deepEqual(bodies[0].pickIds, picks);
    assert.equal(bodies[0].championId, picks[2]);
    assert.equal(server.responses.size, 1);
    assert.equal(await page.locator(".ps-grid, [data-action=confirm], #ps-action").count(), 0, "depois de registrar não há como responder de novo");
    assert.equal(await page.getByRole("link", { name: "Ir para o início" }).getAttribute("href"), "./");
  });

  // A fonte do sistema muda de aparelho para aparelho, e com ela o número de
  // linhas de cada texto. `wide` imita uma fonte mais larga e, na confirmação e
  // na resposta registrada, fixa o texto de apoio em quatro linhas, para a
  // medida não depender da máquina do teste.
  const WIDE_FONT = ".ps-shell { letter-spacing: 0.08em; } .ps-main--summary .ps-hint { min-height: 5.4em; }";
  for (const [width, height, wide = false] of [[390, 844], [375, 667], [360, 640], [375, 548], [320, 480], [667, 375], [360, 640, true], [320, 480, true]]) {
    await scenario(`as quatro cartas têm o mesmo tamanho e cabem na tela em ${width}×${height}${wide ? " com fonte larga" : ""}`, async () => {
      const portrait = height > width;
      const minimum = height >= 640 ? 120 : 90;
      const server = createServer();
      const context = await newContext(server, { width, height });
      const page = await openSurvey(context);
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      // A escolhida e as finalistas, na confirmação e na resposta registrada.
      const summary = async (label, action) => {
        const button = await page.locator(action).boundingBox();
        assert.ok(button.y >= 0 && button.y + button.height <= height + 0.5, `${label}: o botão principal fica à vista`);
        assert.ok(button.height >= 44, `${label}: o botão principal tem altura de toque`);
        const stack = await page.locator(".ps-stack").boundingBox();
        const hero = await page.locator(".ps-hero .ps-card").boundingBox();
        const finalist = await page.locator(".ps-row .ps-card").first().boundingBox();
        assert.ok(hero.width > finalist.width, `${label}: a escolhida não é maior que uma finalista (${hero.width} e ${finalist.width})`);
        assert.ok(Math.abs(hero.height / hero.width - 742 / 530) < 0.02, `${label}: a escolhida saiu da proporção (${hero.width}×${hero.height})`);
        assert.ok(hero.x >= 0 && hero.x + hero.width <= width + 0.5, `${label}: a escolhida cortada na lateral`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${label}: rolagem lateral`);
        if (!portrait) return;
        assert.ok(hero.y >= 0 && hero.y + hero.height <= stack.y + 1, `${label}: a escolhida não fica atrás dos botões (${hero.y + hero.height} > ${stack.y})`);
        const row = await page.locator(".ps-row").boundingBox();
        assert.ok(row.y + row.height <= stack.y + 1, `${label}: as finalistas não ficam atrás dos botões (${row.y + row.height} > ${stack.y})`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1), true, `${label}: a tela cabe sem rolar`);
      };
      await begin(page);
      await step(page, "Tela 1 de 4");
      const groups = server.groupsFor(await storedKey(page));
      const check = async (label) => {
        const cards = await grid(page);
        assert.equal(cards.length, 4);
        for (const card of cards) {
          assert.ok(Math.abs(card.width - cards[0].width) < 0.6 && Math.abs(card.height - cards[0].height) < 0.6, `${label}: cartas de tamanhos diferentes`);
          assert.ok(card.top >= 0 && card.bottom <= height + 0.5, `${label}: carta fora da tela (${card.top}–${card.bottom} em ${height})`);
          assert.ok(card.left >= 0 && card.right <= width + 0.5, `${label}: carta cortada na lateral`);
          assert.ok(card.width >= minimum, `${label}: carta estreita demais para tocar (${card.width})`);
          assert.ok(Math.abs(card.height / card.width - 742 / 530) < 0.02, `${label}: carta fora da proporção`);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${label}: rolagem lateral`);
      };
      await check("tela de voto");
      await playScreens(page, groups, [0, 0, 0, 0]);
      await check("final");
      const backLink = await page.locator('.ps-foot [data-action="back"]').boundingBox();
      assert.ok(backLink.y >= 0 && backLink.y + backLink.height <= height + 0.5, "o voltar da final fica à vista");
      await tap(page, groups[0][0]);
      await step(page, "Confirmar");
      await summary("confirmação", '[data-action="confirm"]');
      await confirm(page);
      await step(page, "Registrada");
      await summary("resposta registrada", ".ps-stack .ps-btn");
    });
  }

  await scenario("voltar e trocar, inclusive a carta que era a escolhida", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const groups = server.groupsFor(await storedKey(page));
    const picks = await playScreens(page, groups, [0, 0, 0, 0]);
    await tap(page, picks[3]);
    await step(page, "Confirmar");

    await page.locator('[data-action="back"]').click();
    await step(page, "Final");
    assert.deepEqual((await grid(page)).filter((card) => card.pressed).map((card) => card.id), [picks[3]], "a final lembra a escolhida");
    await page.locator('[data-action="back"]').click();
    await step(page, "Tela 4 de 4");
    assert.deepEqual((await grid(page)).filter((card) => card.pressed).map((card) => card.id), [picks[3]], "a tela lembra a escolha");

    // Trocar a carta que era a escolhida volta para a final sem escolhida.
    await tap(page, groups[3][2]);
    await step(page, "Final");
    const final = await grid(page);
    assert.deepEqual(final.map((card) => card.id), [picks[0], picks[1], picks[2], groups[3][2]]);
    assert.ok(final.every((card) => !card.pressed), "a escolhida foi apagada junto com a carta trocada");

    // Voltar até a primeira tela e trocar lá.
    for (const expected of ["Tela 4 de 4", "Tela 3 de 4", "Tela 2 de 4", "Tela 1 de 4"]) {
      await page.locator('[data-action="back"]').click();
      await step(page, expected);
    }
    await tap(page, groups[0][3]);
    await step(page, "Final");
    await tap(page, groups[0][3]);
    await step(page, "Confirmar");
    await confirm(page);
    await step(page, "Registrada");
    assert.deepEqual(server.bodies("/response").map(({ pickIds, championId }) => ({ pickIds, championId })), [
      { pickIds: [groups[0][3], picks[1], picks[2], groups[3][2]], championId: groups[0][3] },
    ]);
  });

  await scenario("recarregar no meio retoma o mesmo sorteio e as mesmas escolhas", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    const groups = server.groupsFor(key);
    await tap(page, groups[0][2]);
    await step(page, "Tela 2 de 4");
    await tap(page, groups[1][1]);
    await step(page, "Tela 3 de 4");

    const definitionReads = server.count("GET", `/api/photo-surveys/${SURVEY.id}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await step(page, "Tela 3 de 4");
    assert.equal(server.count("GET", `/api/photo-surveys/${SURVEY.id}`), definitionReads, "quem retoma vai direto ao sorteio");
    assert.equal(await storedKey(page), key);
    assert.equal(server.count("POST", "/api/player"), 1, "a recarga não cria outro jogador");
    assert.deepEqual(server.groupsFor(key), groups, "o sorteio é o mesmo");
    assert.deepEqual((await grid(page)).map((card) => card.id), groups[2]);
    await page.locator('[data-action="back"]').click();
    await step(page, "Tela 2 de 4");
    assert.deepEqual((await grid(page)).filter((card) => card.pressed).map((card) => card.id), [groups[1][1]]);
    assert.equal(server.count("POST", "/response"), 0);

    // Recarregar na confirmação volta para a confirmação, com a mesma escolhida.
    await tap(page, groups[1][1]);
    const rest = await playScreens(page, groups, [0, 0, 3, 0], 2);
    await tap(page, rest[0]);
    await step(page, "Confirmar");
    await page.reload({ waitUntil: "domcontentloaded" });
    await step(page, "Confirmar");
    assert.equal(await title(page), nameOf.get(rest[0]));
    await confirm(page);
    await step(page, "Registrada");
    assert.deepEqual(server.bodies("/response").map(({ pickIds, championId }) => ({ pickIds, championId })), [
      { pickIds: [groups[0][2], groups[1][1], rest[0], rest[1]], championId: rest[0] },
    ]);
  });

  await scenario("segunda aba retoma o mesmo ponto e vê a resposta quando a outra confirma", async () => {
    const server = createServer();
    const context = await newContext(server);
    const first = await openSurvey(context);
    await begin(first);
    await step(first, "Tela 1 de 4");
    const key = await storedKey(first);
    const groups = server.groupsFor(key);
    await tap(first, groups[0][0]);
    await step(first, "Tela 2 de 4");

    const second = await openSurvey(context);
    await step(second, "Tela 2 de 4");
    assert.deepEqual((await grid(second)).map((card) => card.id), groups[1], "a segunda aba recebe o mesmo sorteio");
    assert.equal(server.count("POST", "/api/player"), 1);

    const picks = [groups[0][0], ...(await playScreens(first, groups, [0, 1, 1, 1], 1))];
    await tap(first, picks[1]);
    await step(first, "Confirmar");
    await confirm(first);
    await step(first, "Registrada");

    await step(second, "Registrada");
    assert.equal(await title(second), nameOf.get(picks[1]));
    assert.equal(await second.locator(".ps-grid, [data-action=confirm]").count(), 0);
    assert.equal(server.count("POST", "/response"), 1);
    assert.equal(server.responses.size, 1);

    await second.reload({ waitUntil: "domcontentloaded" });
    await step(second, "Registrada");
    assert.equal(await title(second), nameOf.get(picks[1]));
    assert.equal(server.count("POST", "/response"), 1, "recarregar não responde de novo");
  });

  await scenario("dois aparelhos com a mesma identidade: vale a primeira resposta", async () => {
    const server = createServer();
    const key = keyFor("conta");
    const one = await openSurvey(await newContext(server, { storedKey: key }));
    const two = await openSurvey(await newContext(server, { storedKey: key }));
    await begin(one);
    await step(one, "Tela 1 de 4");
    await begin(two);
    await step(two, "Tela 1 de 4");
    assert.equal(server.count("POST", "/api/player"), 0, "quem já tem identidade não cria outra");
    const groups = server.groupsFor(key);
    const picksOne = await playScreens(one, groups, [0, 0, 0, 0]);
    const picksTwo = await playScreens(two, groups, [1, 1, 1, 1]);
    await tap(one, picksOne[0]);
    await tap(two, picksTwo[3]);
    await step(one, "Confirmar");
    await step(two, "Confirmar");
    await confirm(one);
    await step(one, "Registrada");
    await confirm(two);
    await step(two, "Registrada");
    assert.equal(await title(two), nameOf.get(picksOne[0]), "o segundo aparelho mostra a resposta que valeu");
    assert.match(await two.locator("#ps-notice").innerText(), /já tinha respondido/);
    assert.equal(server.responses.size, 1);
    assert.equal(server.responses.get(key).response.championId, picksOne[0]);

    // Um terceiro aparelho da mesma identidade vê a resposta ao tocar em Começar.
    const three = await openSurvey(await newContext(server, { storedKey: key }));
    await begin(three);
    await step(three, "Registrada");
    assert.equal(await title(three), nameOf.get(picksOne[0]));
    assert.equal(server.count("POST", "/response"), 2, "o terceiro aparelho não envia resposta");
  });

  await scenario("confirmação sem resposta do servidor: a nova tentativa não duplica", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    const picks = await playScreens(page, server.groupsFor(key), [3, 3, 3, 3]);
    await tap(page, picks[1]);
    await step(page, "Confirmar");
    server.dropAfterApply = 1;
    await confirm(page);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Não deu para saber se a sua resposta chegou" }).waitFor();
    assert.equal(await title(page), nameOf.get(picks[1]), "a escolha continua na tela");
    assert.equal(await page.locator('[data-action="confirm"]').innerText(), "Tentar de novo");
    assert.equal(await page.locator('.ps-stack [data-action="back"]').isDisabled(), true, "sem saber se gravou, não dá para trocar");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "ps-title", "o foco volta para o título depois da falha");
    await confirm(page);
    await step(page, "Registrada");
    const bodies = server.bodies("/response");
    assert.equal(bodies.length, 2);
    assert.equal(bodies[0].answerId, bodies[1].answerId, "a nova tentativa usa o mesmo recibo");
    assert.equal(server.responses.size, 1);
  });

  await scenario("pesquisa fechada na abertura e fechada no meio", async () => {
    const closed = createServer();
    closed.status = "closed";
    const page = await openSurvey(await newContext(closed));
    await step(page, "Fechada");
    assert.equal(await title(page), "Esta pesquisa está fechada.");
    assert.equal(await page.locator("#ps-action, .ps-grid").count(), 0);
    assert.equal(closed.requests.filter((request) => request.method === "POST").length, 0);

    const scheduled = createServer();
    scheduled.status = "scheduled";
    const soon = await openSurvey(await newContext(scheduled));
    await step(soon, "Em breve");
    assert.equal(await title(soon), "Esta pesquisa ainda não abriu.");

    const server = createServer();
    const mid = await openSurvey(await newContext(server));
    await begin(mid);
    await step(mid, "Tela 1 de 4");
    const picks = await playScreens(mid, server.groupsFor(await storedKey(mid)), [0, 1, 2, 3]);
    await tap(mid, picks[0]);
    await step(mid, "Confirmar");
    server.status = "closed";
    await confirm(mid);
    await step(mid, "Fechada");
    assert.equal(server.responses.size, 0);
    // Quem tinha sorteio e volta depois do fechamento vê que fechou.
    await mid.reload({ waitUntil: "domcontentloaded" });
    await step(mid, "Fechada");
  });

  await scenario("rotas desligadas e API fora do ar", async () => {
    const off = createServer();
    off.disabled = true;
    const page = await openSurvey(await newContext(off));
    await page.locator("#ps-title", { hasText: "Esta pesquisa não está disponível." }).waitFor();
    assert.equal(await page.locator("#ps-action, .ps-grid").count(), 0);
    assert.equal(await page.getByRole("link", { name: "Ir para o início" }).count(), 1);

    const server = createServer();
    server.down = true;
    const offline = await openSurvey(await newContext(server));
    await offline.locator("#ps-notice:not([hidden])", { hasText: "Não conseguimos falar com o servidor" }).waitFor();
    assert.equal(await title(offline), "Quem você prefere?", "a entrada continua na tela");
    server.down = false;
    await begin(offline, "Tentar de novo");
    await offline.locator("#ps-action:not([disabled])", { hasText: "Começar" }).waitFor();
    assert.equal(await offline.locator("#ps-notice:not([hidden])").count(), 0);

    // A API cai depois de a pessoa tocar em Começar.
    server.down = true;
    await begin(offline);
    await offline.locator("#ps-notice:not([hidden])", { hasText: "Nenhuma escolha foi registrada" }).waitFor();
    assert.equal(await storedKey(offline), null);
    server.down = false;
    await begin(offline, "Tentar de novo");
    await step(offline, "Tela 1 de 4");
  });

  await scenario("cota de jogos novos da rede esgotada", async () => {
    const server = createServer();
    server.quota = true;
    const page = await openSurvey(await newContext(server, { width: 375, height: 667 }));
    await begin(page);
    const notice = page.locator("#ps-notice:not([hidden])");
    await notice.waitFor();
    const text = await notice.innerText();
    const box = await notice.boundingBox();
    const button = await actionButton(page).boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= button.y, "o aviso aparece inteiro, sem rolar e sem ficar atrás do botão");
    assert.match(text, /Muitos jogos novos nesta rede hoje\./);
    assert.match(text, /Entre com Google na página inicial/);
    assert.match(text, /voltam a ser liberados às \d{2}:\d{2}/);
    assert.equal(await notice.getByRole("link", { name: "Ir para o início" }).getAttribute("href"), "./");
    assert.equal(server.count("POST", "/draw"), 0);
    assert.equal(await storedKey(page), null);
    assert.doesNotMatch(text, /servidor|conexão/i, "cota não é falha de conexão");
  });

  await scenario("troca de identidade no meio recomeça com o sorteio da identidade atual", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const before = await storedKey(page);
    await tap(page, server.groupsFor(before)[0][0]);
    await step(page, "Tela 2 de 4");

    const other = keyFor("google");
    const helper = await context.newPage();
    await helper.goto(new URL("robots.txt", appUrl).href);
    await helper.evaluate(([name, key]) => localStorage.setItem(name, key), [IDENTITY_KEY, other]);

    await page.locator("#ps-notice:not([hidden])", { hasText: "Sua conta mudou" }).waitFor();
    assert.equal(server.draws.has(other), false, "a troca sozinha não emite sorteio");
    await begin(page, "Continuar");
    await step(page, "Tela 1 de 4");
    const cards = await grid(page);
    assert.deepEqual(cards.map((card) => card.id), server.groupsFor(other)[0]);
    assert.ok(cards.every((card) => !card.pressed), "com outro sorteio, as escolhas anteriores não vêm junto");
    assert.equal(server.count("POST", "/api/player"), 1);

    // Troca feita na mesma aba, sem evento de armazenamento: a página confere ao voltar do histórico.
    await tap(page, server.groupsFor(other)[0][1]);
    await step(page, "Tela 2 de 4");
    const third = keyFor("terceira");
    await page.evaluate(([name, key]) => {
      localStorage.setItem(name, key);
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    }, [IDENTITY_KEY, third]);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Sua conta mudou" }).waitFor();
    await begin(page, "Continuar");
    await step(page, "Tela 1 de 4");
    assert.deepEqual((await grid(page)).map((card) => card.id), server.groupsFor(third)[0]);
  });

  await scenario("sorteio da conta mudou: a página busca de novo e recomeça", async () => {
    const server = createServer();
    const key = keyFor("vinculo");
    const page = await openSurvey(await newContext(server, { storedKey: key, width: 360, height: 640 }));
    await begin(page);
    await step(page, "Tela 1 de 4");
    const old = server.groupsFor(key);
    const picks = await playScreens(page, old, [0, 0, 0, 0]);
    await tap(page, picks[0]);
    await step(page, "Confirmar");
    // O jogador ativo da conta passou a ser outro: o sorteio guardado é outro.
    server.draws.set(key, [...server.draws.get(key)].reverse());
    await confirm(page);
    await step(page, "Tela 1 de 4");
    await page.locator("#ps-notice:not([hidden])", { hasText: "Estas são as cartas da sua conta" }).waitFor();
    const cards = await grid(page);
    assert.deepEqual(cards.map((card) => card.id), server.groupsFor(key)[0]);
    assert.ok(cards.every((card) => !card.pressed));
    assert.ok(cards.every((card) => card.top >= 0 && card.bottom <= 640.5), "com o aviso na tela as quatro cartas continuam à vista");
    assert.equal(server.responses.size, 0);
    const again = await playScreens(page, server.groupsFor(key), [1, 1, 1, 1]);
    await tap(page, again[2]);
    await step(page, "Confirmar");
    await confirm(page);
    await step(page, "Registrada");
    assert.equal(server.responses.get(key).response.championId, again[2]);
  });

  await scenario("sessão recusada: saída clara, sem perder as escolhas", async () => {
    const server = createServer();
    const key = keyFor("vencida");
    const page = await openSurvey(await newContext(server, { storedKey: key }));
    await begin(page);
    await step(page, "Tela 1 de 4");
    const picks = await playScreens(page, server.groupsFor(key), [2, 2, 2, 2]);
    await tap(page, picks[3]);
    await step(page, "Confirmar");
    server.revoked.add(key);
    await confirm(page);
    const notice = page.locator("#ps-notice:not([hidden])", { hasText: "Sua sessão precisa ser recuperada" });
    await notice.waitFor();
    assert.equal(await notice.getByRole("link", { name: "Ir para o início" }).getAttribute("href"), "./");
    assert.equal(await title(page), nameOf.get(picks[3]), "a escolha continua na tela");
    server.revoked.delete(key);
    await confirm(page);
    await step(page, "Registrada");

    // Sessão recusada já no começo.
    const blocked = createServer();
    const dead = keyFor("morta");
    blocked.revoked.add(dead);
    const start = await openSurvey(await newContext(blocked, { storedKey: dead }));
    await begin(start);
    await start.locator("#ps-notice:not([hidden])", { hasText: "Sua sessão precisa ser recuperada" }).waitFor();
    assert.equal(blocked.count("POST", "/api/player"), 0, "a página não troca a identidade por conta própria");
  });

  await scenario("carta que não carrega trava a tela inteira até carregar", async () => {
    const server = createServer();
    const key = keyFor("imagem");
    server.draws.set(key, drawCards(SURVEY, (limit) => randomInt(limit)));
    const broken = server.groupsFor(key)[0][1];
    const context = await newContext(server, { storedKey: key });
    const pattern = new RegExp(`/chromas/politicos/${broken}-`);
    await context.route(pattern, (route) => route.abort("failed"));
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    await page.locator("#ps-notice:not([hidden])", { hasText: "Não conseguimos carregar as cartas" }).waitFor();
    const state = await page.locator(".ps-grid").evaluate((element) => ({
      ready: element.dataset.ready,
      disabled: [...element.querySelectorAll("button")].map((button) => button.disabled),
    }));
    assert.deepEqual(state, { ready: "false", disabled: [true, true, true, true] }, "nenhuma carta aceita toque enquanto uma falta");
    // Um toque de verdade numa carta travada não escolhe nada.
    const loadedCard = server.groupsFor(key)[0][0];
    await page.locator(`button[data-card="${loadedCard}"]`).click({ force: true });
    await page.locator(`button[data-card="${loadedCard}"] img`).dispatchEvent("click");
    await page.waitForTimeout(400);
    assert.equal(await page.locator("#ps-step").innerText(), "Tela 1 de 4");
    assert.equal(await page.locator('.ps-grid button[aria-pressed="true"]').count(), 0);
    await context.unroute(pattern);
    await page.locator('[data-action="reload-cards"]').click();
    const cards = await grid(page);
    assert.ok(cards.every((card) => card.loaded && !card.disabled));
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
  });

  await scenario("carta que nunca chega: a tela avisa e oferece nova tentativa", async () => {
    const server = createServer();
    const key = keyFor("lenta");
    server.draws.set(key, drawCards(SURVEY, (limit) => randomInt(limit)));
    const slow = server.groupsFor(key)[0][2];
    const context = await newContext(server, { storedKey: key });
    const pattern = new RegExp(`/chromas/politicos/${slow}-`);
    await context.route(pattern, () => {}); // a requisição fica pendurada
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    await page.locator("#ps-notice:not([hidden])", { hasText: "Não conseguimos carregar as cartas" }).waitFor({ timeout: 20000 });
    assert.equal(await page.locator(".ps-grid").getAttribute("data-ready"), "false");
    await context.unroute(pattern);
    await page.locator('[data-action="reload-cards"]').click();
    assert.ok((await grid(page)).every((card) => card.loaded && !card.disabled));
  });

  await scenario("armazenamento bloqueado: dá para responder na mesma aba", async () => {
    const server = createServer();
    const page = await openSurvey(await newContext(server, { blockStorage: true }));
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = keyFor("novo1");
    const picks = await playScreens(page, server.groupsFor(key), [0, 3, 0, 3]);
    await tap(page, picks[1]);
    await step(page, "Confirmar");
    await confirm(page);
    await step(page, "Registrada");
    assert.equal(server.count("POST", "/api/player"), 1);
    assert.equal(server.responses.get(key).response.championId, picks[1]);
  });

  await scenario("toques repetidos e voltar durante a troca de tela valem uma vez só", async () => {
    const server = createServer();
    const page = await openSurvey(await newContext(server));
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    const groups = server.groupsFor(key);
    await grid(page);
    // Dois toques seguidos, em cartas diferentes, antes de a tela trocar: vale o primeiro.
    await page.evaluate(([first, second]) => {
      document.querySelector(`button[data-card="${first}"]`).click();
      document.querySelector(`button[data-card="${second}"]`).click();
    }, [groups[0][1], groups[0][2]]);
    await step(page, "Tela 2 de 4");
    await grid(page);
    // Toque e voltar no mesmo instante: o voltar é ignorado e a escolha vale.
    await page.evaluate((card) => {
      document.querySelector(`button[data-card="${card}"]`).click();
      document.querySelector('[data-action="back"]').click();
    }, groups[1][3]);
    await step(page, "Tela 3 de 4");
    const rest = await playScreens(page, groups, [0, 0, 0, 0], 2);
    assert.deepEqual((await grid(page)).map((card) => card.id), [groups[0][1], groups[1][3], ...rest]);
    await tap(page, rest[1]);
    await step(page, "Confirmar");
    // Dois toques em Confirmar: uma requisição só.
    await page.evaluate(() => {
      const button = document.querySelector('[data-action="confirm"]');
      button.click();
      button.click();
    });
    await step(page, "Registrada");
    assert.equal(server.count("POST", "/response"), 1);
  });

  await scenario("falhas do servidor no sorteio e na resposta, e recibo recusado", async () => {
    const server = createServer();
    const page = await openSurvey(await newContext(server));
    // Sorteio com erro do servidor: nada foi registrado, e dá para tentar de novo.
    server.failDraw.push(500);
    await begin(page);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Nenhuma escolha foi registrada" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "ps-title");
    server.failDraw.push(429);
    await begin(page, "Tentar de novo");
    await page.locator("#ps-notice:not([hidden])", { hasText: "Muitas tentativas agora" }).waitFor();
    await begin(page, "Tentar de novo");
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    assert.equal(server.count("POST", "/api/player"), 1, "as novas tentativas usam o mesmo jogador");
    const picks = await playScreens(page, server.groupsFor(key), [1, 2, 3, 0]);
    await tap(page, picks[3]);
    await step(page, "Confirmar");

    // Limite de requisições: não foi registrado, e dá para trocar.
    server.failResponse.push(429);
    await confirm(page);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Muitas tentativas agora" }).waitFor();
    assert.equal(await page.locator('.ps-stack [data-action="back"]').isDisabled(), false);

    // Erro interno: não dá para saber; a troca fica travada até a nova tentativa responder.
    server.failResponse.push(503);
    await confirm(page);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Não deu para saber se a sua resposta chegou" }).waitFor();
    assert.equal(await page.locator('.ps-stack [data-action="back"]').isDisabled(), true);

    // Recibo recusado: recibo novo, mesmas escolhas.
    server.refuseReceipt = 1;
    await confirm(page);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Sua escolha continua aqui" }).waitFor();
    assert.equal(await page.locator('.ps-stack [data-action="back"]').isDisabled(), false);
    await confirm(page);
    await step(page, "Registrada");
    const bodies = server.bodies("/response");
    assert.equal(bodies.length, 4);
    assert.equal(new Set(bodies.slice(0, 3).map((body) => body.answerId)).size, 1, "as tentativas repetem o recibo");
    assert.notEqual(bodies[3].answerId, bodies[2].answerId, "depois da recusa, o recibo é outro");
    assert.ok(bodies.every((body) => JSON.stringify(body.pickIds) === JSON.stringify(picks) && body.championId === picks[3]));
    assert.equal(server.responses.size, 1);

    // A definição com erro do servidor não manda a pessoa conferir a conexão.
    const broken = createServer();
    const original = broken.handler;
    let failures = 1;
    broken.handler = async (route) => {
      if (failures > 0 && route.request().method() === "GET") {
        failures -= 1;
        return route.fulfill({ status: 503, json: { error: "indisponível" } });
      }
      return original(route);
    };
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    contexts.push(context);
    await context.route(/\/api(?:\/|$)/, (route) => broken.handler(route));
    const other = await openSurvey(context);
    const text = await other.locator("#ps-notice:not([hidden])").innerText();
    assert.match(text, /O servidor não respondeu como esperado/);
    assert.doesNotMatch(text, /conexão/);
    await begin(other, "Tentar de novo");
    await other.locator("#ps-action:not([disabled])", { hasText: "Começar" }).waitFor();
  });

  await scenario("quem respondeu e abre sem servidor não volta para a entrada", async () => {
    const server = createServer();
    const page = await openSurvey(await newContext(server));
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    const picks = await playScreens(page, server.groupsFor(key), [0, 1, 0, 1]);
    await tap(page, picks[2]);
    await step(page, "Confirmar");
    await confirm(page);
    await step(page, "Registrada");

    // O aparelho guarda que a pessoa respondeu, não em quem.
    const saved = await page.evaluate((name) => localStorage.getItem(name), PROGRESS_KEY);
    assert.equal(JSON.parse(saved)[SURVEY.id].answered, true);
    for (const id of SURVEY.cardIds) assert.ok(!saved.includes(id), `a escolha não fica no aparelho (${id})`);

    server.down = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await step(page, "Registrada");
    assert.equal(await title(page), "Sua resposta está registrada.");
    const notice = page.locator("#ps-notice:not([hidden])");
    assert.match(await notice.innerText(), /Não conseguimos falar com o servidor para mostrar a sua escolha/);
    assert.equal(await page.locator("#ps-action, .ps-grid").count(), 0, "sem servidor, quem respondeu não vê a entrada");
    server.down = false;
    await notice.getByRole("button", { name: "Tentar de novo" }).click();
    await step(page, "Registrada");
    await page.locator("#ps-title", { hasText: nameOf.get(picks[2]) }).waitFor();
    assert.equal(server.count("POST", "/response"), 1);

    // Quem estava no meio e recarrega sem servidor não lê que nada foi registrado.
    const mid = createServer();
    const half = await openSurvey(await newContext(mid));
    await begin(half);
    await step(half, "Tela 1 de 4");
    await tap(half, mid.groupsFor(await storedKey(half))[0][0]);
    await step(half, "Tela 2 de 4");
    mid.down = true;
    await half.reload({ waitUntil: "domcontentloaded" });
    const text = await half.locator("#ps-notice:not([hidden])").innerText();
    assert.match(text, /Suas escolhas continuam neste aparelho/);
    assert.doesNotMatch(text, /Nenhuma escolha foi registrada/);
    mid.down = false;
    await begin(half, "Tentar de novo");
    await step(half, "Tela 2 de 4");
  });

  await scenario("saída da conta no meio, mesmo sorteio na conta nova e retomada com chave trocada", async () => {
    // Sair da conta em outra aba: a página pede um toque, e só o toque cria o jogador novo.
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const first = await storedKey(page);
    await tap(page, server.groupsFor(first)[0][0]);
    await step(page, "Tela 2 de 4");
    const helper = await context.newPage();
    await helper.goto(new URL("robots.txt", appUrl).href);
    await helper.evaluate((name) => localStorage.removeItem(name), IDENTITY_KEY);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Sua conta mudou" }).waitFor();
    assert.equal(server.count("POST", "/api/player"), 1, "sem toque, nenhum jogador novo");
    await begin(page, "Continuar");
    await step(page, "Tela 1 de 4");
    assert.equal(server.count("POST", "/api/player"), 2);
    assert.notEqual(await storedKey(page), first);

    // Entrar com Google mantendo o mesmo jogador: o sorteio é o mesmo e as escolhas continuam.
    const linked = createServer();
    const linkedContext = await newContext(linked);
    const same = await openSurvey(linkedContext);
    await begin(same);
    await step(same, "Tela 1 de 4");
    const anonymous = await storedKey(same);
    const groups = linked.groupsFor(anonymous);
    await tap(same, groups[0][2]);
    await step(same, "Tela 2 de 4");
    const session = keyFor("sessao");
    linked.draws.set(session, linked.draws.get(anonymous));
    linked.revoked.add(anonymous);
    const tab = await linkedContext.newPage();
    await tab.goto(new URL("robots.txt", appUrl).href);
    await tab.evaluate(([name, key]) => localStorage.setItem(name, key), [IDENTITY_KEY, session]);
    await same.locator("#ps-notice:not([hidden])", { hasText: "Sua conta mudou" }).waitFor();
    await begin(same, "Continuar");
    await step(same, "Tela 2 de 4");
    await same.locator('[data-action="back"]').click();
    await step(same, "Tela 1 de 4");
    assert.deepEqual((await grid(same)).filter((card) => card.pressed).map((card) => card.id), [groups[0][2]], "mesmo sorteio: a escolha continua");

    // Retomada sem toque com a sessão recusada e a chave já trocada no aparelho:
    // a página avisa e não cria jogador nem sorteio por conta própria.
    const stale = createServer();
    const staleContext = await newContext(stale);
    const resumed = await openSurvey(staleContext);
    await begin(resumed);
    await step(resumed, "Tela 1 de 4");
    const old = await storedKey(resumed);
    await tap(resumed, stale.groupsFor(old)[0][0]);
    await step(resumed, "Tela 2 de 4");
    stale.revoked.add(old);
    const next = keyFor("trocada");
    let swapped = false;
    stale.beforeDraw = async () => {
      if (swapped) return;
      swapped = true;
      // Troca feita no próprio documento: não gera evento de armazenamento.
      await resumed.evaluate(([name, key]) => localStorage.setItem(name, key), [IDENTITY_KEY, next]);
    };
    const playersBefore = stale.count("POST", "/api/player");
    await resumed.reload({ waitUntil: "domcontentloaded" });
    await resumed.locator("#ps-notice:not([hidden])", { hasText: "Sua conta mudou" }).waitFor();
    await resumed.waitForTimeout(300);
    assert.equal(stale.count("POST", "/api/player"), playersBefore, "a retomada não cria jogador");
    assert.equal(stale.draws.has(next), false, "a retomada não emite sorteio para a identidade nova");
  });

  await scenario("teclado: foco na carta e Enter escolhem", async () => {
    const server = createServer();
    const page = await openSurvey(await newContext(server));
    await begin(page);
    await step(page, "Tela 1 de 4");
    const groups = server.groupsFor(await storedKey(page));
    await grid(page);
    assert.equal(await page.evaluate(() => document.activeElement?.id), "ps-title", "o foco vai para o título da tela");
    await page.locator(`button[data-card="${groups[0][3]}"]`).focus();
    await page.keyboard.press("Enter");
    await step(page, "Tela 2 de 4");
    await page.locator('[data-action="back"]').click();
    await step(page, "Tela 1 de 4");
    assert.deepEqual((await grid(page)).filter((card) => card.pressed).map((card) => card.id), [groups[0][3]]);
  });

  assert.deepEqual(pageErrors, [], `erros de página: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({ suite: "photo-survey", browser: browserName, scenarios: results.length }));
} finally {
  await Promise.all(contexts.map((context) => context.close().catch(() => {})));
  await browser.close();
}
