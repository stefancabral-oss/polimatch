/**
 * Pesquisa por foto, etapa 1 (ICM 68, #324): o percurso de uma pesquisa, no
 * endereço dela (`/?p=politica-2026-01`). A capa com várias pesquisas, o menu
 * e a conta são do roteiro site-shell.mjs.
 *
 * O servidor aqui é simulado, com as mesmas regras de shared/photo-survey.js
 * que a API usa: sorteio por jogador, resposta única e validação da chave.
 * Ele conta cada requisição, para provar o que a página grava e quando.
 * Desde a ICM 71 (#336) só responde quem entrou com Google e tem cadastro:
 * os cenários nascem com a sessão de uma conta cadastrada, e nenhum deles
 * pode terminar com pedido de jogador sem conta.
 *
 * Cenários:
 *   1. Abrir a página da pesquisa não cria jogador nem sorteio.
 *   2. Caminho direto: um toque por tela, final, confirmação e uma gravação.
 *   3. As quatro cartas têm o mesmo tamanho e cabem na tela em sete tamanhos,
 *      e em dois deles com o texto mais largo e mais alto; a confirmação e a
 *      resposta registrada, com os três botões e a frase dos confrontos,
 *      cabem sem cobrir a escolhida nem as finalistas.
 *   4. Voltar e trocar, inclusive a carta que era a escolhida.
 *   5. Recarregar no meio retoma o mesmo sorteio e as mesmas escolhas.
 *   6. Segunda aba: retoma o mesmo ponto e vê a resposta quando a outra confirma.
 *   7. Dois aparelhos com a mesma identidade: vale a primeira resposta.
 *   8. Quem já respondeu vê a escolha, com recarga ou em outro aparelho.
 *   9. Confirmação sem resposta do servidor: a nova tentativa não duplica.
 *  10. Pesquisa fechada na abertura e fechada no meio.
 *  11. Rotas desligadas e API fora do ar.
 *  12. Sem conta: Começar leva à entrada e ao cadastro, e o cadastro leva à
 *      pesquisa (ICM 71). O CPF não fica no aparelho.
 *  13. Troca de identidade no meio.
 *  14. Sorteio da conta mudou: a página busca de novo e recomeça.
 *  15. Sessão recusada: saída clara, sem perder as escolhas.
 *  16. Carta que não carrega, ou que não chega, trava a tela inteira até carregar.
 *  17. Armazenamento bloqueado: dá para responder na mesma aba.
 *  18. Toques repetidos e voltar durante a troca de tela.
 *  19. Falhas do servidor no sorteio e na resposta, e recibo recusado.
 *  20. Quem respondeu e abre sem servidor não volta para a entrada.
 *  21. A entrada só ilustra com as cartas da lista da entrada, e não tem
 *      observação (as pesquisas de famosos e de roupas, que têm, são do
 *      roteiro site-shell.mjs, com a final de cada uma: "quem fica?" na de
 *      famosos, como aqui, e "qual fica?" na de roupas).
 *
 * Rodadas (ICM 75, #350) e rodada contínua (ICM 76, #354). O servidor
 * simulado segue o contrato das rodadas e do resultado, com as funções de
 * shared/photo-survey.js; `legacy` o faz responder como o de antes das
 * rodadas. A capa (o feed de quem entrou) é do roteiro site-shell.mjs.
 *  22. Rodada contínua: confirmar mostra "Rodada registrada" e abre a rodada
 *      seguinte sem toque, com outros grupos; a resposta leva a rodada;
 *      recarregar com a rodada aberta e não tocada mostra o resultado, sem
 *      emitir rodada; "Continuar votando" abre a rodada já emitida.
 *  23. Resultado: a primeira colocada e até mais quatro, com a regra de
 *      pontos; ver o resultado não grava; "Continuar votando" volta para a
 *      rodada pela metade; a leitura que falha oferece tentar de novo.
 *  24. Sem confronto por ver: a última rodada leva ao resultado, sem
 *      "Continuar votando".
 *  25. Servidor de antes das rodadas: a resposta registrada fica como era.
 *  26. Pesquisa fechada depois da primeira rodada, fechada entre a
 *      confirmação e a rodada seguinte, e fechada com a rodada 2 pela metade.
 *  27. Dois aparelhos na rodada 2: vale a primeira resposta da rodada.
 *  28. Segunda aba na rodada 2: acompanha as escolhas sem pedir sorteio de
 *      novo, e mostra o resultado quando a outra confirma.
 */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { chromium, webkit } from "playwright";
import {
  PHOTO_SURVEYS,
  drawCards,
  drawGroups,
  drawRound,
  personalRanking,
  publicPhotoSurvey,
  seenPairKeys,
  surveyProgress,
  totalPairCount,
  validateBracket,
} from "../../shared/photo-survey.js";
import ARTS from "../src/political-chromas.json" with { type: "json" };
import { ENTRY_CARD_IDS } from "../src/photo-survey-flow.js";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const SURVEY = PHOTO_SURVEYS[0];
const SURVEY_URL = new URL(`?p=${SURVEY.id}`, appUrl).href;
const IDENTITY_KEY = "polimatch:v3:recovery-key";
const PROGRESS_KEY = "polimatch:photo-survey:v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const nameOf = new Map(ARTS.map((art) => [art.id, art.name]));
// Só responde quem entrou com Google e tem cadastro com CPF (ICM 71, #336):
// as identidades deste roteiro são sessões de conta. O servidor simulado dá
// por cadastrada toda sessão que não esteja em `unregistered`.
const keyFor = (label) => `pms_${label.padEnd(43, "x").slice(0, 43)}`;
const ANONYMOUS_KEY = `pm2_${"a".repeat(43)}`;
const GOOGLE_SCRIPT = `window.google={accounts:{id:{initialize(options){window.__e2eGoogle=options.callback},renderButton(element){const button=document.createElement('button');button.type='button';button.id='e2e-google';button.textContent='Continuar com Google';button.addEventListener('click',()=>window.__e2eGoogle({credential:'credencial-de-teste'}));element.replaceChildren(button)}}}};`;
// A entrada ilustra com três cartas de uma lista fixa (ENTRY_CARD_IDS). Estas
// dez seguem na pesquisa e no sorteio, mas não aparecem na entrada.
const OFF_ENTRY_CARD_IDS = [
  "andre-janones", "erika-hilton", "fernando-haddad", "geraldo-alckmin", "guilherme-boulos",
  "joao-campos", "lindbergh-farias", "marina-silva", "samia-bonfim", "simone-tebet",
];

// Os servidores criados pelo cenário em curso: no fim dele, nenhum pode ter
// recebido pedido de jogador sem conta (ICM 71).
const servers = [];

/** API simulada. As regras de sorteio e validação são as do módulo compartilhado. */
function createServer() {
  const server = {
    status: "open",
    disabled: false,
    down: false,
    quota: false,
    dropAfterApply: 0,
    // O sorteio é atendido (a rodada nasce) e a resposta se perde no caminho.
    dropDrawAfterApply: 0,
    // Falhas programadas: cada entrada é o status HTTP da próxima chamada.
    failDraw: [],
    failResponse: [],
    failResult: [],
    refuseReceipt: 0,
    beforeDraw: null,
    beforeResponse: null,
    revoked: new Set(),
    // Sessões de conta que ainda não fizeram o cadastro.
    unregistered: new Set(),
    // A conta que a próxima entrada com Google devolve.
    nextAccount: "",
    // Um servidor de antes das rodadas (ICM 75): não lê `next` nem `round` e
    // não manda `round`, `progress` nem `lastAnswered`.
    legacy: false,
    requests: [],
    // A rodada 1 de cada identidade: o sorteio e a resposta, como antes das
    // rodadas. As rodadas seguintes ficam em `later`, por identidade, cada uma
    // com o número, as cartas e a resposta (null enquanto está aberta).
    draws: new Map(),
    responses: new Map(),
    later: new Map(),
    issued: 0,
    count(method, suffix) {
      return server.requests.filter((request) => request.method === method && request.pathname.endsWith(suffix)).length;
    },
    bodies(suffix) {
      return server.requests.filter((request) => request.method === "POST" && request.pathname.endsWith(suffix)).map((request) => request.body);
    },
    /** As rodadas da identidade, em ordem, como o servidor de verdade as lê. */
    roundsOf(key) {
      const first = server.responses.get(key);
      const shownIds = first ? first.shownIds : server.draws.get(key);
      const rounds = shownIds ? [{ round: 1, shownIds, response: first?.response || null }] : [];
      return server.legacy ? rounds : [...rounds, ...(server.later.get(key) || [])];
    },
    groupsFor(key, round = 1) {
      return drawGroups(server.roundsOf(key).find((entry) => entry.round === round).shownIds, SURVEY.groupSize);
    },
    /**
     * Deixa a identidade a uma rodada do fim: joga no servidor, sem tela, as
     * rodadas que faltam até não sobrar confronto, e deixa a última aberta.
     * Devolve as escolhas com que essa última rodada fecha todos os confrontos.
     */
    playUntilLastRound(key) {
      for (;;) {
        const rounds = server.roundsOf(key);
        const seen = seenPairKeys(SURVEY, answeredRounds(rounds));
        if (seen.size >= totalPairCount(SURVEY)) throw new Error("não sobrou rodada para deixar aberta");
        const shownIds = drawRound(SURVEY, seen, (limit) => randomInt(limit));
        const pickIds = drawGroups(shownIds, SURVEY.groupSize).map((group) => group[randomInt(group.length)]);
        const entry = { round: rounds.at(-1).round + 1, shownIds, response: null };
        server.later.set(key, [...(server.later.get(key) || []), entry]);
        const after = seenPairKeys(SURVEY, [...answeredRounds(rounds), { shownIds, pickIds }]);
        if (after.size >= totalPairCount(SURVEY)) return { round: entry.round, pickIds };
        entry.response = { answerId: crypto.randomUUID(), pickIds, championId: pickIds[0], respondedAt: new Date().toISOString() };
      }
    },
    /** Quantos confrontos a identidade já viu, pela conta do servidor. */
    seenPairs(key) {
      return seenPairKeys(SURVEY, answeredRounds(server.roundsOf(key))).size;
    },
    view() {
      return { ...publicPhotoSurvey(SURVEY, new Date()), status: server.status };
    },
  };
  const answeredRounds = (rounds) => rounds.filter((entry) => entry.response).map((entry) => ({ shownIds: entry.shownIds, pickIds: entry.response.pickIds }));
  // O que as duas rotas devolvem sobre uma rodada: os campos de antes das
  // rodadas e, fora do servidor antigo, `round`, `progress` e `lastAnswered`.
  const roundView = (rounds, entry) => {
    const base = { survey: server.view(), draw: { groups: drawGroups(entry.shownIds, SURVEY.groupSize) }, response: entry.response };
    if (server.legacy) return base;
    const progress = surveyProgress(SURVEY, answeredRounds(rounds), server.status);
    const last = rounds.findLast((item) => item.response);
    return {
      ...base,
      round: entry.round,
      progress: { ...progress, canContinue: progress.canContinue && rounds.every((item) => item.response) },
      lastAnswered: last ? { round: last.round, response: last.response } : null,
    };
  };
  server.handler = async (route) => {
    const request = route.request();
    const { pathname, search } = new URL(request.url());
    const method = request.method();
    const key = (request.headers().authorization || "").replace(/^Bearer /, "");
    let body = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }
    server.requests.push({ method, pathname, search, key, body });
    if (server.down) return route.abort("connectionrefused");
    const send = (status, json) => route.fulfill({ status, json, headers: status === 429 ? { "Retry-After": String(json.retryAfterSeconds) } : {} });

    if (pathname === "/api/player" && method === "POST") {
      if (server.quota) {
        return send(429, { error: "limite diário de novos jogadores nesta rede atingido", code: "PLAYER_ISSUANCE_LIMIT", retryAfterSeconds: 5400 });
      }
      server.issued += 1;
      return send(201, { recoveryKey: keyFor(`novo${server.issued}`) });
    }
    if (pathname === "/api/auth/google" && method === "POST") {
      const session = server.nextAccount || keyFor(`conta${server.requests.filter((item) => item.pathname === pathname).length}`);
      return send(200, { sessionToken: session, account: { displayName: "Bia" }, player: { version: 0 }, merge: null });
    }
    if (pathname === "/api/registration" && method === "POST") {
      if (!key || server.revoked.has(key)) return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
      if (!key.startsWith("pms_")) return send(403, { error: "entre com Google para se cadastrar", code: "GOOGLE_ACCOUNT_REQUIRED" });
      server.unregistered.delete(key);
      return send(200, { registered: true, status: "created", registeredAt: new Date().toISOString() });
    }
    if (!pathname.startsWith("/api/photo-surveys/")) return send(404, { error: "rota não simulada" });
    if (server.disabled) return send(404, { error: "pesquisa por foto indisponível", code: "PHOTO_SURVEYS_DISABLED" });
    const [surveyId, action] = pathname.slice("/api/photo-surveys/".length).split("/");
    if (surveyId !== SURVEY.id) return send(404, { error: "pesquisa não encontrada", code: "PHOTO_SURVEY_NOT_FOUND" });
    if (!action && method === "GET") return send(200, server.view());
    if (action === "draw" && server.beforeDraw) await server.beforeDraw(key);
    if (action === "response" && server.beforeResponse) await server.beforeResponse(key);
    if (!key || server.revoked.has(key)) return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
    if (!key.startsWith("pms_") || server.unregistered.has(key)) {
      return send(403, { error: "cadastro com CPF obrigatório para responder", code: "CPF_REGISTRATION_REQUIRED" });
    }

    const failure = (status) => send(status, status === 429
      ? { error: "muitas requisições", code: "RATE_LIMITED", retryAfterSeconds: 30 }
      : { error: "erro interno", code: "INTERNAL_ERROR" });
    const invalid = (reason) => send(400, { error: "resposta não corresponde ao sorteio", code: "PHOTO_SURVEY_RESPONSE_INVALID", current: { reason } });
    const closed = () => send(409, { error: "pesquisa fechada", code: "PHOTO_SURVEY_CLOSED", current: { status: server.status } });
    // O resultado da pessoa (ICM 76, #354): só leitura, com a regra de pontos
    // de shared/photo-survey.js sobre as rodadas respondidas.
    if (action === "result" && method === "GET") {
      if (server.failResult.length) return failure(server.failResult.shift());
      const answered = server.roundsOf(key).filter((entry) => entry.response);
      return send(200, {
        surveyId: SURVEY.id,
        answeredRounds: answered.length,
        ranking: personalRanking(SURVEY, answered.map((entry) => ({ shownIds: entry.shownIds, pickIds: entry.response.pickIds, championId: entry.response.championId }))),
      });
    }
    // Sem `next`: emite a rodada 1 para quem não tem nenhuma e, para os
    // demais, devolve a última rodada, aberta ou respondida. Com `next`
    // verdadeiro, emite a rodada seguinte quando a última está respondida, a
    // pesquisa está aberta e sobra confronto por ver; senão, responde como
    // sem `next`.
    if (action === "draw" && method === "POST") {
      if (server.failDraw.length) return failure(server.failDraw.shift());
      const next = server.legacy ? undefined : body?.next;
      if (next !== undefined && typeof next !== "boolean") {
        return send(400, { error: "pedido de sorteio inválido", code: "PHOTO_SURVEY_DRAW_INVALID", current: { reason: "next" } });
      }
      const rounds = server.roundsOf(key);
      const last = rounds.at(-1);
      if (!last) {
        if (server.status !== "open") return closed();
        server.draws.set(key, drawCards(SURVEY, (limit) => randomInt(limit)));
      } else if (next === true && last.response && server.status === "open") {
        const seen = seenPairKeys(SURVEY, answeredRounds(rounds));
        if (seen.size < totalPairCount(SURVEY)) {
          const entry = { round: last.round + 1, shownIds: drawRound(SURVEY, seen, (limit) => randomInt(limit)), response: null };
          server.later.set(key, [...(server.later.get(key) || []), entry]);
        }
      }
      if (server.dropDrawAfterApply > 0) {
        server.dropDrawAfterApply -= 1;
        return route.abort("connectionreset");
      }
      const current = server.roundsOf(key);
      return send(200, roundView(current, current.at(-1)));
    }
    // Sem `round`, a resposta vale para a rodada aberta e, sem rodada aberta,
    // para a rodada 1. Com `round`, a rodada precisa existir.
    if (action === "response" && method === "POST") {
      if (server.failResponse.length) return failure(server.failResponse.shift());
      const round = server.legacy ? undefined : body?.round;
      if (round !== undefined && !(Number.isInteger(round) && round >= 1)) return invalid("round");
      const rounds = server.roundsOf(key);
      const target = round === undefined
        ? rounds.find((entry) => !entry.response) || rounds.find((entry) => entry.round === 1)
        : rounds.find((entry) => entry.round === round);
      if (!target) {
        if (round !== undefined) return invalid("round");
        return send(409, { error: "sorteio ainda não emitido", code: "PHOTO_SURVEY_DRAW_REQUIRED" });
      }
      if (target.response) {
        const same = JSON.stringify(target.response.pickIds) === JSON.stringify(body?.pickIds) && target.response.championId === body?.championId;
        if (same) return send(200, { status: "alreadyProcessed", ...roundView(rounds, target) });
        return send(409, {
          error: target.round === 1 ? "esta pesquisa já foi respondida" : "esta rodada já foi respondida",
          code: "PHOTO_SURVEY_ALREADY_ANSWERED",
          current: target.response,
        });
      }
      if (server.status !== "open") return closed();
      const bracket = validateBracket(SURVEY, target.shownIds, { pickIds: body?.pickIds, championId: body?.championId });
      if (bracket.ok && server.refuseReceipt > 0) {
        server.refuseReceipt -= 1;
        return invalid("answer-id");
      }
      if (!bracket.ok || !UUID.test(String(body?.answerId))) return invalid(bracket.ok ? "answer-id" : bracket.reason);
      // O recibo é único entre todas as respostas, de todas as rodadas.
      if (rounds.some((entry) => entry.response?.answerId === body.answerId)) return invalid("answer-id");
      const response = { answerId: body.answerId, pickIds: bracket.pickIds, championId: bracket.championId, respondedAt: new Date().toISOString() };
      if (target.round === 1) server.responses.set(key, { shownIds: target.shownIds, response });
      else target.response = response;
      if (server.dropAfterApply > 0) {
        // O caso que importa: o servidor gravou e a resposta não chegou.
        server.dropAfterApply -= 1;
        return route.abort("connectionreset");
      }
      const current = server.roundsOf(key);
      return send(200, { status: "created", ...roundView(current, current.find((entry) => entry.round === target.round)) });
    }
    return send(404, { error: "rota não simulada" });
  };
  servers.push(server);
  return server;
}

const browser = await browserType.launch();
const contexts = [];
const pageErrors = [];

/**
 * Cada contexto nasce com a sessão de uma conta cadastrada (`novo1`, `novo2`…),
 * como quem já entrou e fez o cadastro. `signedOut` é para o visitante sem
 * conta; com o armazenamento bloqueado também não há o que semear.
 */
async function newContext(server, { width = 390, height = 844, storedKey = "", signedOut = false, blockStorage = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  contexts.push(context);
  if (!storedKey && !signedOut && !blockStorage) {
    server.issued += 1;
    storedKey = keyFor(`novo${server.issued}`);
  }
  await context.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({ contentType: "application/javascript", body: GOOGLE_SCRIPT }));
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

/**
 * Joga as telas de voto que faltam, escolhendo a carta na posição pedida.
 * `prefix` é o que a etapa traz antes, da segunda rodada em diante ("Rodada 2 · ").
 */
async function playScreens(page, groups, positions, from = 0, prefix = "") {
  const picks = [];
  for (let screen = from; screen < groups.length; screen += 1) {
    await step(page, `${prefix}Tela ${screen + 1} de ${groups.length}`);
    const cards = await grid(page);
    assert.deepEqual(cards.map((card) => card.id), groups[screen], `tela ${screen + 1}: cartas na ordem do sorteio`);
    const pick = groups[screen][positions[screen]];
    await tap(page, pick);
    picks.push(pick);
  }
  await step(page, `${prefix}Final`);
  return picks;
}

async function confirm(page) {
  await page.locator('[data-action="confirm"]:not([disabled])').click();
}

/**
 * Rodada contínua (ICM 76, #354): depois de confirmar com confronto por ver, o
 * aviso "Rodada registrada" e, sem toque, a primeira tela da rodada seguinte.
 */
const nextRoundOpens = (page, round) => step(page, `Rodada ${round} · Tela 1 de 4`);
/** O resultado da pessoa na tela, já lido do servidor. */
async function resultShown(page) {
  await step(page, "Resultado");
  await page.waitForFunction(() => !/Carregando/.test(document.querySelector(".ps-hint")?.textContent || ""), null, { timeout: 15000 });
}
async function openResultView(page) {
  await page.locator('[data-action="result"]').click();
  await resultShown(page);
}
const rankNames = (page) => page.locator(".ps-rank b").allInnerTexts();
const LEGACY_HINT = "Obrigado por participar. Sua resposta está registrada e não pode ser trocada nesta pesquisa.";
const continueButton = (page) => page.locator('[data-action="continue"]');
const hint = (page) => page.locator(".ps-hint").first().innerText();
const kickerText = (page) => page.locator(".ps-kicker").first().innerText();
/** Os botões do pé da resposta registrada, na ordem da tela: texto e se é o principal (verde). */
const doneActions = (page) => page.locator(".ps-stack .ps-btn").evaluateAll((nodes) => nodes.map((node) => `${node.textContent}${node.classList.contains("ps-btn--ghost") ? "" : " (principal)"}`));

/**
 * Joga uma rodada inteira e confirma. Devolve as escolhas e a escolhida. Quem
 * chama espera o que vem depois: a rodada seguinte, o resultado ou, com o
 * servidor de antes das rodadas, a resposta registrada.
 */
async function playRound(page, groups, positions, champion, prefix = "") {
  const picks = await playScreens(page, groups, positions, 0, prefix);
  await tap(page, picks[champion]);
  await step(page, `${prefix}Confirmar`);
  await confirm(page);
  return { picks, championId: picks[champion] };
}

/** Abre a pesquisa, toca em Começar, responde a primeira rodada e espera a segunda abrir sozinha. */
async function answerFirstRound(server, context, positions = [0, 0, 0, 0], champion = 0) {
  const page = await openSurvey(context);
  await begin(page);
  await step(page, "Tela 1 de 4");
  const key = await storedKey(page);
  const first = await playRound(page, server.groupsFor(key), positions, champion);
  await nextRoundOpens(page, 2);
  return { page, key, first };
}

/** O ranking da pessoa pela conta do servidor simulado, com a regra de pontos compartilhada. */
function expectedRanking(server, key) {
  const answered = server.roundsOf(key).filter((entry) => entry.response);
  return personalRanking(SURVEY, answered.map((entry) => ({ shownIds: entry.shownIds, pickIds: entry.response.pickIds, championId: entry.response.championId }))).map((entry) => entry.cardId);
}

const results = [];
// POLIMATCH_E2E_ONLY=trecho roda só os cenários com esse trecho no nome. É
// para uso local: no CI o filtro não vale, e um trecho que não casa com nada
// falha em vez de passar sem rodar cenário nenhum.
const only = process.env.CI ? "" : process.env.POLIMATCH_E2E_ONLY || "";
async function scenario(name, run) {
  if (only && !name.includes(only)) return;
  servers.length = 0;
  await run();
  for (const server of servers) {
    assert.equal(server.count("POST", "/api/player"), 0, `${name}: a página não cria jogador sem conta`);
  }
  results.push(name);
  console.log(`ok - ${name}`);
}

try {
  await scenario("abrir a página da pesquisa não grava nada", async () => {
    const server = createServer();
    const context = await newContext(server, { signedOut: true });
    const page = await openSurvey(context);
    await actionButton(page).and(page.locator(":not([disabled])")).waitFor();
    assert.equal(await title(page), "Quem você prefere?");
    assert.equal(await actionButton(page).innerText(), "Começar");
    assert.equal(await page.locator(".ps-cta-note").innerText(), "Para responder, entre com Google e cadastre o CPF.");
    const fan = await page.locator(".ps-fan img").evaluateAll((images) => images.map((image) => image.getAttribute("src")));
    assert.equal(fan.length, 3);
    assert.equal(new Set(fan).size, 3, "as cartas da entrada são distintas");
    assert.ok(fan.every((src) => ARTS.some((art) => art.src === src)), "as cartas da entrada saem do conjunto da pesquisa");
    await page.waitForTimeout(500);
    assert.deepEqual(server.requests.map(({ method, pathname }) => `${method} ${pathname}`), [`GET /api/photo-surveys/${SURVEY.id}`]);
    assert.equal(await storedKey(page), null, "nenhum jogador foi criado");
    assert.equal(await page.evaluate((name) => localStorage.getItem(name), PROGRESS_KEY), null);
    assert.equal(await page.locator('meta[name="robots"]').count(), 0, "a capa não tem noindex");
    assert.equal(new URL(page.url()).pathname, "/");

    const sitemap = await (await fetch(new URL("sitemap.xml", appUrl))).text();
    assert.match(sitemap, /<loc>https:\/\/polimatch\.com\.br\/<\/loc>/);
    assert.doesNotMatch(sitemap, /pesquisa\.html/);
  });

  await scenario("a entrada só ilustra com as cartas da lista da entrada", async () => {
    const server = createServer();
    const context = await newContext(server, { signedOut: true });
    const page = await openSurvey(context);
    assert.deepEqual([...ENTRY_CARD_IDS, ...OFF_ENTRY_CARD_IDS].sort(), [...SURVEY.cardIds], "as duas listas somam as vinte cartas, sem sobra");
    const namesBySrc = (ids) => new Map(ARTS.filter((art) => ids.includes(art.id)).map((art) => [art.src, art.name]));
    const entryNames = namesBySrc(ENTRY_CARD_IDS);
    const offEntryNames = namesBySrc(OFF_ENTRY_CARD_IDS);
    assert.equal(entryNames.size, ENTRY_CARD_IDS.length);
    assert.equal(offEntryNames.size, OFF_ENTRY_CARD_IDS.length);
    const seen = new Set();
    for (let visit = 0; visit < 10; visit += 1) {
      if (visit > 0) await page.reload({ waitUntil: "domcontentloaded" });
      await actionButton(page).and(page.locator(":not([disabled])")).waitFor();
      const fan = await page.locator(".ps-fan img").evaluateAll((images) => images.map((image) => image.getAttribute("src")));
      assert.equal(fan.length, 3);
      assert.equal(await page.locator(".ps-note").count(), 0, "a pesquisa de política não tem observação");
      for (const src of fan) {
        assert.ok(!offEntryNames.has(src), `${offEntryNames.get(src)} apareceu na entrada`);
        assert.ok(entryNames.has(src), `${src} é uma carta da lista da entrada`);
        seen.add(src);
      }
    }
    assert.ok(seen.size > 3, "as cartas da entrada continuam sorteadas a cada visita");
    assert.equal(server.count("POST", "/draw"), 0);
  });

  await scenario("caminho direto: um toque por tela, final, confirmação e uma gravação", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    assert.equal(key, keyFor("novo1"));
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
    // A rodada fica registrada e a seguinte abre sozinha (ICM 76, #354).
    await step(page, "Registrada");
    assert.equal(await title(page), "Rodada registrada");
    assert.equal(await page.locator(".ps-kicker").innerText(), "POLÍTICA · RODADA 1");
    await nextRoundOpens(page, 2);
    const bodies = server.bodies("/response");
    assert.equal(bodies.length, 1);
    // A resposta leva a rodada que o sorteio numerou, e mais nada de novo.
    assert.deepEqual(Object.keys(bodies[0]).sort(), ["answerId", "championId", "pickIds", "round"]);
    assert.equal(bodies[0].round, 1);
    assert.match(bodies[0].answerId, UUID);
    assert.deepEqual(bodies[0].pickIds, picks);
    assert.equal(bodies[0].championId, picks[2]);
    assert.equal(server.responses.size, 1);
    assert.deepEqual(server.bodies("/draw"), [{}, { next: true }], "o sorteio da primeira rodada não pede rodada seguinte; o da segunda, sem toque, pede");
    assert.equal(server.later.get(key).length, 1, "uma rodada nova só");
    // O resultado: a escolhida da final em primeiro, as outras três finalistas depois.
    await openResultView(page);
    assert.equal(await title(page), nameOf.get(picks[2]));
    assert.equal(await hint(page), "Sua primeira colocada até agora. 1 rodada respondida. Você viu 30 de 190 confrontos.");
    assert.deepEqual(await rankNames(page), SURVEY.cardIds.filter((id) => picks.includes(id) && id !== picks[2]).map((id) => nameOf.get(id)));
    assert.equal(await page.locator('[data-action="continue"]').innerText(), "Continuar votando");
    assert.equal(await page.locator('[data-action="share"]').count(), 1);
    assert.equal(server.count("GET", "/result"), 1);
    // "Continuar votando" volta para a rodada que já abriu, sem pedir outra.
    await page.locator('[data-action="continue"]').click();
    await nextRoundOpens(page, 2);
    assert.equal(server.count("POST", "/draw"), 2);
    assert.equal(server.count("POST", "/response"), 1);
  });

  // A fonte do sistema muda de aparelho para aparelho, e com ela o número de
  // linhas de cada texto. `wide` troca a fonte por uma de largura fixa, que é
  // mais larga que as de sistema e mede quase igual no macOS e no Linux (0,60
  // do corpo por letra); na confirmação e na resposta registrada, fixa o texto
  // de apoio em quatro linhas. Assim a medida depende pouco da máquina.
  const WIDE_FONT = '.ps-shell, .ps-shell button, .ps-shell a { font-family: Menlo, "DejaVu Sans Mono", "Liberation Mono", monospace !important; } .ps-main--summary .ps-hint { min-height: 5.4em; }';
  for (const [width, height, wide = false] of [[390, 844], [375, 667], [360, 640], [320, 568], [375, 548], [320, 480], [667, 375], [360, 640, true], [320, 480, true]]) {
    await scenario(`as quatro cartas têm o mesmo tamanho e cabem na tela em ${width}×${height}${wide ? " com fonte larga" : ""}`, async () => {
      const portrait = height > width;
      const minimum = height >= 640 ? 120 : 90;
      const server = createServer();
      const context = await newContext(server, { width, height });
      const page = await openSurvey(context);
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      // A escolhida e as finalistas, na confirmação e na resposta registrada.
      // `bottom` é o bloco do pé da tela, com os botões: dois na confirmação;
      // na resposta registrada, três, com "Mais uma rodada" em cima.
      const summary = async (label, actions, bottom = ".ps-stack") => {
        for (const action of actions) {
          const button = await page.locator(action).boundingBox();
          assert.ok(button.y >= 0 && button.y + button.height <= height + 0.5, `${label}: o botão ${action} fica à vista`);
          assert.ok(button.x >= 0 && button.x + button.width <= width + 0.5, `${label}: o botão ${action} cabe na largura`);
          assert.ok(button.height >= 44 && button.height <= 80, `${label}: o botão ${action} tem altura de toque (${button.height})`);
        }
        const stack = await page.locator(bottom).boundingBox();
        const hero = await page.locator(".ps-hero .ps-card").boundingBox();
        const finalist = await page.locator(".ps-row .ps-card").first().boundingBox();
        assert.ok(hero.width > finalist.width, `${label}: a escolhida não é maior que uma finalista (${hero.width} e ${finalist.width})`);
        assert.equal(await page.locator(".ps-label").textContent(), "Também na final", `${label}: o rótulo das outras três cartas`);
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
        if (portrait) assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1), true, `${label}: a tela cabe sem rolar`);
      };
      await check("tela de voto");
      await playScreens(page, groups, [0, 0, 0, 0]);
      await check("final");
      const backLink = await page.locator('.ps-foot [data-action="back"]').boundingBox();
      assert.ok(backLink.y >= 0 && backLink.y + backLink.height <= height + 0.5, "o voltar da final fica à vista");
      await tap(page, groups[0][0]);
      await step(page, "Confirmar");
      await summary("confirmação", ['[data-action="confirm"]']);
      await confirm(page);
      // A rodada seguinte abre sozinha (ICM 76, #354): as cartas dela cabem
      // como as da primeira, com "Ver meu resultado" à vista no rodapé.
      await nextRoundOpens(page, 2);
      await check("tela de voto da rodada 2");
      const link = await page.locator('.ps-foot [data-action="result"]').boundingBox();
      assert.ok(link.y >= 0 && link.y + link.height <= height + 0.5 && link.x + link.width <= width + 0.5, "Ver meu resultado fica à vista");
      // Na confirmação da rodada 2 o link também aparece, e a escolhida e as finalistas continuam à vista.
      const second = server.groupsFor(await storedKey(page), 2);
      await playScreens(page, second, [0, 0, 0, 0], 0, "Rodada 2 · ");
      await tap(page, second[0][0]);
      await step(page, "Rodada 2 · Confirmar");
      await summary("confirmação da rodada 2", ['[data-action="confirm"]', '[data-action="result"]']);
      // O resultado: a primeira colocada na proporção e os dois botões presos ao pé.
      await openResultView(page);
      for (const action of ['[data-action="continue"]', '[data-action="share"]']) {
        const button = await page.locator(action).boundingBox();
        assert.ok(button.y >= 0 && button.y + button.height <= height + 0.5, `resultado: o botão ${action} fica à vista`);
        assert.ok(button.x >= 0 && button.x + button.width <= width + 0.5, `resultado: o botão ${action} cabe na largura`);
        assert.ok(button.height >= 44 && button.height <= 80, `resultado: o botão ${action} tem altura de toque (${button.height})`);
      }
      const hero = await page.locator(".ps-hero .ps-card").boundingBox();
      assert.ok(Math.abs(hero.height / hero.width - 742 / 530) < 0.02, `resultado: a primeira colocada saiu da proporção (${hero.width}×${hero.height})`);
      assert.ok(hero.x >= 0 && hero.x + hero.width <= width + 0.5, "resultado: a primeira colocada cortada na lateral");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "resultado: rolagem lateral");
      if (portrait) {
        const stack = await page.locator(".ps-stack").boundingBox();
        assert.ok(hero.y >= 0 && hero.y + hero.height <= stack.y + 1, `resultado: a primeira colocada não fica atrás dos botões (${hero.y + hero.height} > ${stack.y})`);
      }
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

    // A aba parada acompanha a outra: não fica numa tela antiga, pronta para trocar a escolha em silêncio.
    await tap(second, groups[1][2]);
    await step(second, "Tela 3 de 4");
    await step(first, "Tela 3 de 4");
    await first.locator('[data-action="back"]').click();
    await step(first, "Tela 2 de 4");
    assert.deepEqual((await grid(first)).filter((card) => card.pressed).map((card) => card.id), [groups[1][2]], "a escolha feita na outra aba aparece nesta");
    await step(second, "Tela 2 de 4");
    assert.equal(await second.evaluate(() => document.activeElement?.id), "ps-title", "ao acompanhar, o foco fica no título");

    // Um registro de outro sorteio, escrito por outra aba, não mexe nesta.
    const helper = await context.newPage();
    await helper.goto(new URL("robots.txt", appUrl).href);
    const rewrite = (change) => helper.evaluate(([name, id, code]) => {
      const all = JSON.parse(localStorage.getItem(name));
      new Function("record", code)(all[id]);
      localStorage.setItem(name, JSON.stringify(all));
    }, [PROGRESS_KEY, SURVEY.id, change]);
    const stored = await first.evaluate((name) => localStorage.getItem(name), PROGRESS_KEY);
    await rewrite("record.progress.groups = [...record.progress.groups].reverse(); record.progress.step = 0;");
    await first.waitForTimeout(300);
    await step(first, "Tela 2 de 4");
    await step(second, "Tela 2 de 4");
    await helper.evaluate(([name, value]) => localStorage.setItem(name, value), [PROGRESS_KEY, stored]);
    // Uma aba que ficou congelada não recebe o evento: confere ao voltar a aparecer.
    await first.evaluate(([name, id]) => {
      const all = JSON.parse(localStorage.getItem(name));
      all[id].progress.step = 0;
      localStorage.setItem(name, JSON.stringify(all));
      document.dispatchEvent(new Event("visibilitychange"));
    }, [PROGRESS_KEY, SURVEY.id]);
    await step(first, "Tela 1 de 4");
    // O mesmo toque na tela 1 leva à primeira tela sem escolha, que é a 3; a outra aba vai junto.
    await tap(first, groups[0][0]);
    await step(first, "Tela 3 de 4");
    await step(second, "Tela 3 de 4");
    await first.locator('[data-action="back"]').click();
    await step(first, "Tela 2 de 4");
    await step(second, "Tela 2 de 4");
    await helper.close();

    const picks = [groups[0][0], ...(await playScreens(first, groups, [0, 1, 1, 1], 1))];
    await tap(first, picks[1]);
    await step(first, "Confirmar");
    await confirm(first);
    await nextRoundOpens(first, 2);

    // A outra aba não segue para a rodada nova sem toque: mostra o resultado.
    await resultShown(second);
    assert.equal(await title(second), nameOf.get(picks[1]));
    assert.equal(await second.locator(".ps-grid, [data-action=confirm]").count(), 0);
    assert.equal(server.count("POST", "/response"), 1);
    assert.equal(server.responses.size, 1);

    await second.reload({ waitUntil: "domcontentloaded" });
    await resultShown(second);
    assert.equal(await title(second), nameOf.get(picks[1]));
    assert.equal(server.count("POST", "/response"), 1, "recarregar não responde de novo");
    assert.equal(server.later.get(key).length, 1, "nem emite outra rodada");
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
    const groups = server.groupsFor(key);
    const picksOne = await playScreens(one, groups, [0, 0, 0, 0]);
    const picksTwo = await playScreens(two, groups, [1, 1, 1, 1]);
    await tap(one, picksOne[0]);
    await tap(two, picksTwo[3]);
    await step(one, "Confirmar");
    await step(two, "Confirmar");
    await confirm(one);
    await nextRoundOpens(one, 2);
    await confirm(two);
    await step(two, "Registrada");
    assert.equal(await title(two), nameOf.get(picksOne[0]), "o segundo aparelho mostra a resposta que valeu");
    assert.match(await two.locator("#ps-notice").innerText(), /já tinha respondido/);
    assert.equal(server.responses.size, 1);
    assert.equal(server.responses.get(key).response.championId, picksOne[0]);

    // Um terceiro aparelho da mesma identidade, ao tocar em Começar, cai na
    // rodada que o primeiro abriu, e o resultado mostra a resposta que valeu.
    const three = await openSurvey(await newContext(server, { storedKey: key }));
    await begin(three);
    await nextRoundOpens(three, 2);
    await openResultView(three);
    assert.equal(await title(three), nameOf.get(picksOne[0]));
    assert.equal(server.later.get(key).length, 1, "nenhuma rodada a mais");
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

  await scenario("resposta perdida e nova tentativa recusada sem dizer se gravou: a troca segue travada", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    const picks = await playScreens(page, server.groupsFor(key), [2, 2, 2, 2]);
    await tap(page, picks[0]);
    await step(page, "Confirmar");
    const backButton = page.locator('.ps-stack [data-action="back"]');
    // O servidor gravou e a resposta se perdeu.
    server.dropAfterApply = 1;
    await confirm(page);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Não deu para saber se a sua resposta chegou" }).waitFor();
    // Limite de requisições na nova tentativa: continua sem saber.
    server.failResponse.push(429);
    await confirm(page);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Muitas tentativas agora" }).waitFor();
    assert.equal(await backButton.isDisabled(), true, "o limite de requisições não diz se gravou: a troca segue travada");
    assert.equal(await page.locator('[data-action="confirm"]').innerText(), "Tentar de novo");
    // Sessão recusada com a mesma identidade: também não diz se gravou.
    server.revoked.add(key);
    await confirm(page);
    await page.locator("#ps-notice:not([hidden])", { hasText: "Sua sessão precisa ser recuperada" }).waitFor();
    assert.equal(await backButton.isDisabled(), true, "a sessão recusada não diz se gravou: a troca segue travada");
    assert.equal(await title(page), nameOf.get(picks[0]), "a escolha continua na tela");
    server.revoked.delete(key);
    await confirm(page);
    await nextRoundOpens(page, 2);
    await openResultView(page);
    assert.equal(await title(page), nameOf.get(picks[0]));
    assert.equal(server.responses.size, 1);
    assert.equal(server.responses.get(key).response.championId, picks[0], "ficou registrada a escolha que a tela mostrava");
  });

  await scenario("pesquisa fechada na abertura e fechada no meio", async () => {
    const closed = createServer();
    closed.status = "closed";
    const page = await openSurvey(await newContext(closed, { signedOut: true }));
    await step(page, "Fechada");
    assert.equal(await title(page), "Esta pesquisa está fechada.");
    assert.equal(await page.locator("#ps-action, .ps-grid").count(), 0);
    assert.equal(closed.requests.filter((request) => request.method === "POST").length, 0);

    const scheduled = createServer();
    scheduled.status = "scheduled";
    const soon = await openSurvey(await newContext(scheduled, { signedOut: true }));
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
    assert.match(await mid.locator("#ps-notice:not([hidden])").innerText(), /Sua escolha não foi registrada/, "quem confirmou depois do fechamento lê que a escolha não foi registrada");
    // Quem tinha sorteio e volta depois do fechamento vê que fechou, e que nada foi registrado.
    await mid.reload({ waitUntil: "domcontentloaded" });
    await step(mid, "Fechada");
    assert.match(await mid.locator("#ps-notice:not([hidden])").innerText(), /Sua escolha não foi registrada/);
    // Quem chega de novo não tinha escolha nenhuma: sem aviso.
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);

    // A2: a entrada estava aberta, a pesquisa fechou e só então veio o toque em Começar.
    const late = createServer();
    const idle = await openSurvey(await newContext(late, { signedOut: true }));
    await actionButton(idle).and(idle.locator(":not([disabled])")).waitFor();
    late.status = "closed";
    await begin(idle);
    await step(idle, "Fechada");
    assert.equal(await storedKey(idle), null);
    assert.equal(await idle.locator("#ps-google, #ps-register").count(), 0, "ninguém é chamado a entrar numa pesquisa que fechou");

    // M1: quem já respondeu e perdeu o registro da pesquisa neste aparelho vê a própria resposta, mesmo fechada.
    const kept = createServer();
    const answering = await openSurvey(await newContext(kept));
    await begin(answering);
    await step(answering, "Tela 1 de 4");
    const keptKey = await storedKey(answering);
    const keptPicks = await playScreens(answering, kept.groupsFor(keptKey), [1, 1, 1, 1]);
    await tap(answering, keptPicks[2]);
    await step(answering, "Confirmar");
    await confirm(answering);
    await nextRoundOpens(answering, 2);
    kept.status = "closed";
    const returning = await openSurvey(await newContext(kept, { storedKey: keptKey }));
    // Com a pesquisa fechada, a rodada 2 emitida e não respondida não vale: o resultado mostra a rodada 1.
    await resultShown(returning);
    assert.equal(await returning.locator('[data-action="continue"]').count(), 0, "fechada, não há como continuar votando");
    assert.equal(await title(returning), nameOf.get(keptPicks[2]));
    assert.equal(kept.responses.size, 1);

    // Fechada, e a conferência da resposta falha: a pessoa continua na tela de
    // fechada, sem ler que nada foi registrado, e pode conferir de novo.
    kept.failDraw.push(503);
    const unsure = await openSurvey(await newContext(kept, { storedKey: keptKey }));
    await step(unsure, "Fechada");
    const unsureNotice = unsure.locator("#ps-notice:not([hidden])");
    assert.match(await unsureNotice.innerText(), /Não conseguimos conferir/);
    assert.doesNotMatch(await unsureNotice.innerText(), /Nenhuma escolha foi registrada/, "quem respondeu não lê que nada foi registrado");
    assert.equal(await unsure.locator("#ps-action").count(), 0, "fechada não volta para a entrada");
    await unsureNotice.locator('[data-action="init"]').click();
    await resultShown(unsure);
    assert.equal(await title(unsure), nameOf.get(keptPicks[2]));

    // Fechada, com uma identidade que nunca abriu a pesquisa: vê fechada, e nenhum sorteio nasce.
    const stranger = keyFor("nunca");
    const never = await openSurvey(await newContext(kept, { storedKey: stranger }));
    await step(never, "Fechada");
    assert.equal(await never.locator("#ps-notice:not([hidden])").count(), 0);
    assert.equal(kept.draws.has(stranger), false, "fechada, abrir a página não emite sorteio");

    // Fechada, com a sessão recusada: vê fechada, não um pedido para recuperar a sessão.
    kept.revoked.add(stranger);
    const revoked = await openSurvey(await newContext(kept, { storedKey: stranger }));
    await step(revoked, "Fechada");
    assert.equal(await revoked.locator("#ps-notice:not([hidden])").count(), 0);
    assert.equal(await revoked.locator("#ps-action").count(), 0);
  });

  await scenario("rotas desligadas e API fora do ar", async () => {
    const off = createServer();
    off.disabled = true;
    const page = await openSurvey(await newContext(off));
    await page.locator("#ps-title", { hasText: "Esta pesquisa não está disponível." }).waitFor();
    assert.equal(await page.locator("#ps-action, .ps-grid").count(), 0);
    assert.equal(await page.getByRole("link", { name: "Ver pesquisas" }).getAttribute("href"), "./");
    assert.equal(await page.locator('.ps-top [data-action="menu"]').count(), 1, "o menu continua à mão");

    const server = createServer();
    server.down = true;
    const offline = await openSurvey(await newContext(server));
    await offline.locator("#ps-notice:not([hidden])", { hasText: "Não conseguimos falar com o servidor" }).waitFor();
    assert.doesNotMatch(await offline.locator("#ps-notice:not([hidden])").innerText(), /Confira a conexão/, "com o aparelho conectado, a falha não é da conexão da pessoa");
    assert.equal(await title(offline), "Quem você prefere?", "a entrada continua na tela");
    // Com o aparelho sem rede, aí sim o aviso manda conferir a conexão.
    const offlineContext = offline.context();
    await offlineContext.setOffline(true);
    await begin(offline, "Tentar de novo");
    await offline.locator("#ps-notice:not([hidden])", { hasText: "Confira a conexão" }).waitFor();
    await offline.locator("#ps-offline:not([hidden])").waitFor();
    await offlineContext.setOffline(false);
    server.down = false;
    await begin(offline, "Tentar de novo");
    await offline.locator("#ps-action:not([disabled])", { hasText: "Começar" }).waitFor();
    assert.equal(await offline.locator("#ps-notice:not([hidden])").count(), 0);

    // A API cai depois de a pessoa tocar em Começar.
    server.down = true;
    await begin(offline);
    await offline.locator("#ps-notice:not([hidden])", { hasText: "Nenhuma escolha foi registrada" }).waitFor();
    assert.equal(await storedKey(offline), keyFor("novo1"), "a conta do aparelho continua a mesma");
    server.down = false;
    await begin(offline, "Tentar de novo");
    await step(offline, "Tela 1 de 4");
  });

  await scenario("sem conta, Começar leva à entrada e ao cadastro, e o cadastro leva à pesquisa", async () => {
    const server = createServer();
    const account = keyFor("recente");
    server.nextAccount = account;
    server.unregistered.add(account);
    const page = await openSurvey(await newContext(server, { signedOut: true, width: 375, height: 667 }));
    await begin(page);
    await step(page, "Entrar");
    assert.equal(await title(page), "Entre para responder");
    assert.equal(await page.locator("#ps-action, .ps-grid").count(), 0);
    assert.equal(await page.locator('.ps-top [data-action="menu"]').count(), 1, "o menu continua à mão");
    assert.equal(await page.getByRole("link", { name: "Voltar" }).getAttribute("href"), "./");
    assert.deepEqual(server.requests.filter((request) => request.method === "POST"), [], "até aqui nada foi gravado");
    assert.equal(await storedKey(page), null);

    // Entrar com Google: a conta ainda não tem cadastro, então vem o formulário.
    await page.locator("#e2e-google").click();
    await step(page, "Cadastro");
    assert.equal(await title(page), "Faça seu voto contar");
    assert.equal(await storedKey(page), account);
    assert.equal(server.count("POST", "/draw"), 1, "o pedido de sorteio é quem diz que falta o cadastro");
    assert.equal(server.draws.size, 0, "sem cadastro, nenhum sorteio nasce");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "o formulário não rola para o lado");

    // Vazio, e depois com um CPF que não fecha: a recusa é no aparelho, sem pedido ao servidor.
    const submit = page.locator('#ps-register button[type="submit"]');
    const notice = page.locator("#ps-notice:not([hidden])");
    await submit.click();
    assert.equal(await notice.innerText(), "Confira o CPF: os números não fecham.");
    await page.locator("#ps-cpf").pressSequentially("52998224724");
    assert.equal(await page.locator("#ps-cpf").inputValue(), "529.982.247-24", "a máscara acompanha a digitação");
    assert.equal(await notice.count(), 0, "mexer no formulário tira o aviso da tentativa anterior");
    await submit.click();
    assert.equal(await notice.innerText(), "Confira o CPF: os números não fecham.");
    await page.locator("#ps-cpf").fill("529.982.247-25");
    // Digitado, e ainda não enviado: o CPF não foi para o aparelho.
    const typed = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, location.href, document.cookie]));
    assert.doesNotMatch(typed, /52998224725|529\.982\.247/);
    await submit.click();
    assert.equal(await notice.innerText(), "Escolha a sua faixa de idade.");
    await page.getByRole("button", { name: "25 a 34" }).click();
    await page.getByRole("button", { name: "Prefiro não dizer" }).click();
    await page.locator("#ps-state").selectOption("MG");
    await submit.click();
    assert.equal(await notice.innerText(), "Marque a autorização para concluir.");
    assert.equal(server.count("POST", "/api/registration"), 0, "nada incompleto vai ao servidor");
    // O que já foi preenchido continua na tela depois de cada recusa.
    assert.equal(await page.locator("#ps-cpf").inputValue(), "529.982.247-25");
    assert.equal(await page.getByRole("button", { name: "25 a 34" }).getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#ps-state").inputValue(), "MG");

    await page.locator("#ps-consent").check();
    await submit.scrollIntoViewIfNeeded();
    const button = await submit.boundingBox();
    assert.ok(button.y >= 0 && button.y + button.height <= 667 + 1, "o botão de concluir fica inteiro na tela ao chegar ao fim do formulário");
    await submit.click();
    await step(page, "Tela 1 de 4");
    assert.deepEqual(server.bodies("/api/registration"), [{
      cpf: "529.982.247-25", ageRange: "25-34", gender: "nao-informado", state: "MG", consent: true, consentVersion: "2026-11-16",
    }]);
    const sent = server.requests.find((request) => request.pathname === "/api/registration");
    assert.equal(sent.key, account);
    assert.equal(sent.search, "", "o CPF vai no corpo do pedido, nunca no endereço");
    assert.ok(server.requests.every((request) => request.search === ""), "nenhum pedido leva dado no endereço");
    assert.equal(server.draws.size, 1);
    // O CPF não fica no aparelho nem no endereço.
    const kept = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, location.href, document.cookie]));
    // O que fica guardado tem códigos aleatórios: a busca é pelo CPF inteiro.
    assert.doesNotMatch(kept, /52998224725|529\.982\.247/);
    assert.equal(new URL(page.url()).search, `?p=${SURVEY.id}`);

    // Daí em diante é a pesquisa de sempre, e recarregar não pede cadastro de novo.
    const picks = await playScreens(page, server.groupsFor(account), [0, 0, 0, 0]);
    await tap(page, picks[1]);
    await step(page, "Confirmar");
    await page.reload({ waitUntil: "domcontentloaded" });
    await step(page, "Confirmar");
    await confirm(page);
    await nextRoundOpens(page, 2);
    assert.equal(server.count("POST", "/api/registration"), 1);
    assert.equal(server.count("POST", "/api/auth/google"), 1);
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

  await scenario("a conta muda enquanto a confirmação viaja: a pessoa lê que a resposta foi registrada", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const before = await storedKey(page);
    const picks = await playScreens(page, server.groupsFor(before), [0, 0, 0, 0]);
    await tap(page, picks[3]);
    await step(page, "Confirmar");
    const other = keyFor("depois");
    const helper = await context.newPage();
    await helper.goto(new URL("robots.txt", appUrl).href);
    // A confirmação chega ao servidor; antes de a resposta voltar, outra aba troca a conta.
    server.beforeResponse = async () => {
      server.beforeResponse = null;
      await helper.evaluate(([name, key]) => localStorage.setItem(name, key), [IDENTITY_KEY, other]);
      await page.locator("#ps-notice:not([hidden])", { hasText: "Sua conta mudou" }).waitFor();
    };
    await confirm(page);
    const notice = page.locator("#ps-notice:not([hidden])", { hasText: "foi registrada" });
    await notice.waitFor();
    assert.match(await notice.innerText(), /Sua conta mudou/);
    assert.equal(server.responses.get(before).response.championId, picks[3], "a resposta ficou na conta que estava na tela");
    assert.equal(server.responses.has(other), false);
    const saved = await page.evaluate(([name, id]) => JSON.parse(localStorage.getItem(name))[id], [PROGRESS_KEY, SURVEY.id]);
    assert.equal(saved.answered, true, "o aparelho guarda que aquela conta respondeu");
    assert.equal(saved.progress, null);
    // A conta atual segue com o sorteio dela.
    await begin(page, "Continuar");
    await step(page, "Tela 1 de 4");
    assert.deepEqual((await grid(page)).map((card) => card.id), server.groupsFor(other)[0]);
    assert.equal(server.count("POST", "/response"), 1);
  });

  await scenario("saída da conta ou falha enquanto a confirmação viaja", async () => {
    // Saiu da conta e a confirmação chegou: a tela de registrada, sem convite para responder de novo.
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const mine = await storedKey(page);
    const picks = await playScreens(page, server.groupsFor(mine), [2, 2, 2, 2]);
    await tap(page, picks[1]);
    await step(page, "Confirmar");
    const helper = await context.newPage();
    await helper.goto(new URL("robots.txt", appUrl).href);
    server.beforeResponse = async () => {
      server.beforeResponse = null;
      await helper.evaluate((name) => localStorage.removeItem(name), IDENTITY_KEY);
      await page.locator("#ps-notice:not([hidden])", { hasText: "Você saiu da conta" }).waitFor();
    };
    await confirm(page);
    await step(page, "Registrada");
    assert.equal(await title(page), "Sua resposta está registrada.");
    const text = await page.locator("#ps-notice:not([hidden])").innerText();
    assert.match(text, /Você saiu da conta/);
    assert.match(text, /foi registrada/);
    assert.equal(await page.locator("#ps-action, .ps-grid, [data-action=confirm]").count(), 0, "sem convite para responder de novo");
    assert.equal(server.responses.get(mine).response.championId, picks[1]);

    // A conta mudou e a confirmação falhou no caminho: o aviso não diz que registrou, e o aparelho não marca como respondida.
    const failing = createServer();
    const failingContext = await newContext(failing);
    const other = await openSurvey(failingContext);
    await begin(other);
    await step(other, "Tela 1 de 4");
    const first = await storedKey(other);
    const otherPicks = await playScreens(other, failing.groupsFor(first), [0, 1, 0, 1]);
    await tap(other, otherPicks[0]);
    await step(other, "Confirmar");
    const tab = await failingContext.newPage();
    await tab.goto(new URL("robots.txt", appUrl).href);
    failing.failResponse.push(503);
    failing.beforeResponse = async () => {
      failing.beforeResponse = null;
      await tab.evaluate(([name, key]) => localStorage.setItem(name, key), [IDENTITY_KEY, keyFor("outra")]);
      await other.locator("#ps-notice:not([hidden])", { hasText: "Sua conta mudou" }).waitFor();
    };
    await other.locator('[data-action="confirm"]:not([disabled])').click();
    await other.waitForTimeout(600);
    assert.doesNotMatch(await other.locator("#ps-notice:not([hidden])").innerText(), /registrada/);
    assert.equal(failing.responses.size, 0);
    const saved = await other.evaluate(([name, id]) => JSON.parse(localStorage.getItem(name))[id], [PROGRESS_KEY, SURVEY.id]);
    assert.equal(saved.answered, false);
  });

  await scenario("a conta troca e volta enquanto a confirmação viaja: a tela mostra a resposta registrada", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await openSurvey(context);
    await begin(page);
    await step(page, "Tela 1 de 4");
    const mine = await storedKey(page);
    const picks = await playScreens(page, server.groupsFor(mine), [1, 1, 1, 1]);
    await tap(page, picks[0]);
    await step(page, "Confirmar");
    const other = keyFor("visita");
    const helper = await context.newPage();
    await helper.goto(new URL("robots.txt", appUrl).href);
    const setKey = (key) => helper.evaluate(([name, value]) => localStorage.setItem(name, value), [IDENTITY_KEY, key]);
    const changed = () => page.locator("#ps-notice:not([hidden])", { hasText: "Sua conta mudou" }).waitFor();
    // A confirmação fica presa no caminho. Enquanto isso a conta troca, a
    // pessoa segue com a outra, a conta volta e a pessoa segue de novo.
    server.beforeResponse = async () => {
      server.beforeResponse = null;
      await setKey(other);
      await changed();
      await begin(page, "Continuar");
      await step(page, "Tela 1 de 4");
      await setKey(mine);
      await changed();
      await begin(page, "Continuar");
      await step(page, "Tela 1 de 4");
      // Sem esperar as imagens: a confirmação presa tem prazo no navegador.
      const shown = await page.locator(".ps-grid button[data-card]").evaluateAll((cards) => cards.map((card) => card.dataset.card));
      assert.deepEqual(shown, server.groupsFor(mine)[0], "de volta à conta de antes, com o sorteio dela");
    };
    await confirm(page);
    // A confirmação chega: a resposta é desta conta, e a tela mostra o
    // resultado, sem deixar a pessoa jogar de novo à toa.
    await resultShown(page);
    assert.equal(await title(page), nameOf.get(picks[0]));
    assert.equal(await page.locator(".ps-grid, [data-action=confirm]").count(), 0);
    assert.equal(server.responses.get(mine).response.championId, picks[0]);
    assert.equal(server.count("POST", "/response"), 1);
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
    assert.match(await notice.innerText(), /Abra o menu, saia da conta e entre de novo\./);
    assert.equal(await notice.getByRole("button", { name: "Abrir o menu" }).count(), 1);
    assert.equal(await title(page), nameOf.get(picks[3]), "a escolha continua na tela");
    server.revoked.delete(key);
    await confirm(page);
    await step(page, "Registrada");

    // Sessão recusada já no começo: não há escolha na tela a preservar. A
    // página esquece a sessão morta e leva à entrada, em vez de repetir o
    // mesmo pedido recusado.
    const blocked = createServer();
    const dead = keyFor("morta");
    blocked.revoked.add(dead);
    const start = await openSurvey(await newContext(blocked, { storedKey: dead }));
    await begin(start);
    await step(start, "Entrar");
    assert.match(await start.locator("#ps-notice:not([hidden])").innerText(), /Sua sessão venceu\. Entre de novo para continuar\./);
    assert.equal(blocked.count("POST", "/draw"), 1);
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
    // Sem armazenamento não há conta guardada: a pessoa entra e faz o cadastro
    // nesta aba, e a sessão vale enquanto a aba estiver aberta.
    const key = keyFor("memoria");
    server.nextAccount = key;
    server.unregistered.add(key);
    const page = await openSurvey(await newContext(server, { blockStorage: true }));
    await begin(page);
    await step(page, "Entrar");
    await page.locator("#e2e-google").click();
    await step(page, "Cadastro");
    await page.locator("#ps-cpf").fill("111.444.777-35");
    await page.getByRole("button", { name: "60 ou mais" }).click();
    await page.getByRole("button", { name: "Homem" }).click();
    await page.locator("#ps-state").selectOption("BA");
    await page.locator("#ps-consent").check();
    await page.locator('#ps-register button[type="submit"]').click();
    await step(page, "Tela 1 de 4");
    const picks = await playScreens(page, server.groupsFor(key), [0, 3, 0, 3]);
    await tap(page, picks[1]);
    await step(page, "Confirmar");
    await confirm(page);
    await step(page, "Registrada");
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
    await nextRoundOpens(page, 2);

    // O aparelho guarda que a pessoa respondeu, não em quem. O que fica é o
    // sorteio da rodada 2, que abriu sozinha, ainda sem escolha nenhuma.
    const saved = JSON.parse(await page.evaluate((name) => localStorage.getItem(name), PROGRESS_KEY))[SURVEY.id];
    assert.equal(saved.answered, true);
    assert.equal(saved.progress.round, 2);
    assert.deepEqual(saved.progress.picks, [null, null, null, null], "a escolha não fica no aparelho");
    assert.equal(saved.progress.championId, null);
    assert.deepEqual(Object.keys(saved).sort(), ["answered", "identity", "progress"]);

    server.down = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await step(page, "Registrada");
    assert.equal(await title(page), "Sua resposta está registrada.");
    const notice = page.locator("#ps-notice:not([hidden])");
    assert.match(await notice.innerText(), /Não conseguimos falar com o servidor para mostrar a sua escolha/);
    assert.equal(await page.locator("#ps-action, .ps-grid").count(), 0, "sem servidor, quem respondeu não vê a entrada");
    server.down = false;
    await notice.getByRole("button", { name: "Tentar de novo" }).click();
    // A nova tentativa refaz a abertura: o resultado, sem rodada nova.
    await resultShown(page);
    await page.locator("#ps-title", { hasText: nameOf.get(picks[2]) }).waitFor();
    assert.equal(server.count("POST", "/response"), 1);
    assert.equal(server.later.get(key).length, 1);

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
    // Sair da conta em outra aba: a página pede um toque, e o toque leva à entrada com Google.
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
    const signedOut = page.locator("#ps-notice:not([hidden])", { hasText: "Você saiu da conta" });
    await signedOut.waitFor();
    assert.doesNotMatch(await signedOut.innerText(), /conta atual/, "sem conta, o aviso não fala em conta atual");
    assert.match(await signedOut.innerText(), /Toque em Começar para entrar de novo\./);
    assert.doesNotMatch(await signedOut.innerText(), /sem conta/, "não há mais resposta sem conta");
    await begin(page, "Começar");
    await step(page, "Entrar");
    assert.equal(await storedKey(page), null, "o toque não cria identidade");
    // Entra com outra conta, já cadastrada: a pesquisa abre com o sorteio dela.
    const returning = keyFor("volta");
    server.nextAccount = returning;
    await page.locator("#e2e-google").click();
    await step(page, "Tela 1 de 4");
    assert.equal(await storedKey(page), returning);
    assert.notEqual(returning, first);
    assert.equal(server.count("POST", "/api/registration"), 0, "quem já tem cadastro não vê o formulário");

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
    const faded = await page.locator('.ps-grid button[aria-pressed="false"]').first().evaluate((card) => Number(getComputedStyle(card).opacity));
    assert.ok(faded >= 0.55 && faded < 1, `as outras cartas ficam mais claras, sem parecer desligadas (${faded})`);
  });

  // Rodadas (ICM 75, #350) ---------------------------------------------------

  await scenario("rodada contínua: confirmar abre a rodada seguinte sem toque, com outros grupos, e a resposta leva a rodada", async () => {
    const server = createServer();
    const page = await openSurvey(await newContext(server));
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    const firstGroups = server.groupsFor(key);
    assert.equal(await kickerText(page), "POLÍTICA · 16 CARTAS", "a primeira rodada não mostra número de rodada");
    assert.equal(await page.locator('[data-action="result"]').count(), 0, "sem rodada respondida não há resultado para ver");
    const picks = await playScreens(page, firstGroups, [0, 1, 2, 3]);
    await tap(page, picks[1]);
    await step(page, "Confirmar");
    assert.equal(await hint(page), "Confira antes de registrar. Depois não dá para trocar a escolha desta rodada.");
    await confirm(page);

    // O aviso curto, com "Ver meu resultado" à mão, e a rodada seguinte sem toque.
    await step(page, "Registrada");
    assert.equal(await title(page), "Rodada registrada");
    assert.equal(await hint(page), "Abrindo a próxima rodada…");
    assert.equal(await page.locator('.ps-foot [data-action="result"]').innerText(), "Ver meu resultado");
    await nextRoundOpens(page, 2);
    assert.deepEqual(server.bodies("/draw"), [{}, { next: true }], "a rodada seguinte é pedida com next, sem toque");
    assert.equal(server.roundsOf(key).length, 2, "uma rodada nova só");
    const secondGroups = server.groupsFor(key, 2);
    assert.notDeepEqual(secondGroups, firstGroups, "a rodada nova tem outros grupos");
    assert.equal(await kickerText(page), "POLÍTICA · RODADA 2");
    assert.equal(await title(page), "Quem você prefere?");
    assert.equal(await page.locator('.ps-top [data-action="menu"]').count(), 0, "no voto não há menu");
    assert.equal(await page.locator('.ps-foot [data-action="result"]').innerText(), "Ver meu resultado");
    assert.ok((await grid(page)).every((card) => !card.pressed), "a rodada nova começa sem escolha");
    let saved = await page.evaluate(([name, id]) => JSON.parse(localStorage.getItem(name))[id], [PROGRESS_KEY, SURVEY.id]);
    assert.equal(saved.answered, true);
    assert.equal(saved.progress.round, 2);
    assert.deepEqual(saved.progress.groups, secondGroups);

    // A segunda rodada: a resposta leva `round: 2`, com recibo próprio, e a terceira abre sozinha.
    const second = await playRound(page, secondGroups, [3, 2, 1, 0], 0, "Rodada 2 · ");
    await nextRoundOpens(page, 3);
    const bodies = server.bodies("/response");
    assert.deepEqual(bodies.map((body) => body.round), [1, 2]);
    assert.deepEqual(bodies[1].pickIds, second.picks);
    assert.equal(bodies[1].championId, second.championId);
    assert.notEqual(bodies[1].answerId, bodies[0].answerId, "cada rodada tem o seu recibo");
    assert.equal(server.responses.get(key).response.championId, picks[1], "a resposta da primeira rodada não muda");
    assert.deepEqual(server.bodies("/draw"), [{}, { next: true }, { next: true }]);

    // Recarregar com a rodada 3 aberta e não tocada mostra o resultado, sem emitir outra.
    await page.reload({ waitUntil: "domcontentloaded" });
    await resultShown(page);
    assert.deepEqual(server.bodies("/draw").at(-1), {}, "abrir a página não pede rodada seguinte");
    assert.equal(server.roundsOf(key).length, 3);
    const ranking = expectedRanking(server, key);
    assert.equal(await title(page), nameOf.get(ranking[0]));
    const seen = server.seenPairs(key);
    assert.ok(seen > 30 && seen <= 60, `duas rodadas mostram mais confrontos que uma (${seen})`);
    assert.equal(await hint(page), `Sua primeira colocada até agora. 2 rodadas respondidas. Você viu ${seen} de 190 confrontos.`);
    assert.equal(await page.locator('.ps-top [data-action="menu"]').count(), 1, "no resultado o menu volta");
    // "Continuar votando" abre a rodada que já estava emitida, sem emitir outra.
    await continueButton(page).click();
    await nextRoundOpens(page, 3);
    assert.deepEqual(server.bodies("/draw").at(-1), { next: true });
    assert.equal(server.roundsOf(key).length, 3, "a rodada emitida é a mesma");
    assert.deepEqual((await grid(page)).map((card) => card.id), server.groupsFor(key, 3)[0]);
    assert.equal(server.count("POST", "/response"), 2);
  });

  await scenario("resultado: a primeira colocada, até mais quatro em lista, e Continuar votando volta para a rodada pela metade", async () => {
    const server = createServer();
    const { page, key, first } = await answerFirstRound(server, await newContext(server), [1, 1, 1, 1], 2);
    const groups = server.groupsFor(key, 2);
    await tap(page, groups[0][1]);
    await step(page, "Rodada 2 · Tela 2 de 4");
    const posts = server.requests.filter((request) => request.method === "POST").length;
    await openResultView(page);
    assert.equal(await kickerText(page), "POLÍTICA · SEU RESULTADO");
    assert.equal(await title(page), nameOf.get(first.championId));
    assert.deepEqual(await rankNames(page), expectedRanking(server, key).slice(1, 5).map((id) => nameOf.get(id)));
    assert.deepEqual(await page.locator(".ps-rank small").allInnerTexts(), ["2º lugar", "3º lugar", "4º lugar"]);
    assert.deepEqual(await doneActions(page), ["Continuar votando (principal)", "Compartilhar"]);
    assert.equal(await page.getByRole("link", { name: "Outras pesquisas" }).getAttribute("href"), "./");
    await page.locator('[data-action="share"]:not([disabled])').waitFor();
    assert.equal(server.requests.filter((request) => request.method === "POST").length, posts, "ver o resultado não grava nada");
    assert.equal(server.count("GET", "/result"), 1);
    // A rodada pela metade continua: a mesma tela, com a escolha feita, sem pedido de sorteio.
    await continueButton(page).click();
    await step(page, "Rodada 2 · Tela 2 de 4");
    await page.locator('[data-action="back"]').click();
    await step(page, "Rodada 2 · Tela 1 de 4");
    assert.deepEqual((await grid(page)).filter((card) => card.pressed).map((card) => card.id), [groups[0][1]]);
    assert.equal(server.requests.filter((request) => request.method === "POST").length, posts);

    // Com muitas rodadas (jogadas em outro aparelho), a lista mostra as
    // seguintes até completar cinco. As escolhas guardadas aqui são de outro
    // sorteio: abrir a página mostra o resultado.
    server.later.delete(key);
    server.playUntilLastRound(key);
    await page.reload({ waitUntil: "domcontentloaded" });
    await resultShown(page);
    const ranking = expectedRanking(server, key);
    assert.ok(ranking.length > 5);
    assert.equal(await title(page), nameOf.get(ranking[0]));
    assert.deepEqual(await rankNames(page), ranking.slice(1, 5).map((id) => nameOf.get(id)));

    // A leitura do resultado falha: o aviso oferece tentar de novo, e o voto continua à mão.
    server.failResult.push(503);
    await page.reload({ waitUntil: "domcontentloaded" });
    const notice = page.locator("#ps-notice:not([hidden])");
    await notice.waitFor();
    assert.match(await notice.innerText(), /Não conseguimos carregar o seu resultado agora/);
    assert.equal(await title(page), "Ainda sem resultado");
    assert.equal(await continueButton(page).count(), 1);
    await notice.locator('[data-action="result"]').click();
    await resultShown(page);
    assert.equal(await title(page), nameOf.get(ranking[0]));
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
  });

  await scenario("sem confronto por ver: a última rodada leva ao resultado, sem Continuar votando", async () => {
    const server = createServer();
    const { page, key } = await answerFirstRound(server, await newContext(server), [2, 2, 2, 2], 1);
    // A pessoa jogou as outras rodadas (aqui, direto no servidor) e falta uma:
    // as escolhas dela fecham os confrontos que restam.
    server.later.delete(key);
    const last = server.playUntilLastRound(key);
    assert.ok(last.round >= 3, `a última rodada é a ${last.round}`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await resultShown(page);
    await continueButton(page).click();
    const prefix = `Rodada ${last.round} · `;
    await step(page, `${prefix}Tela 1 de 4`);
    const groups = server.groupsFor(key, last.round);
    await playScreens(page, groups, groups.map((group, index) => group.indexOf(last.pickIds[index])), 0, prefix);
    await tap(page, last.pickIds[0]);
    await step(page, `${prefix}Confirmar`);
    const draws = server.count("POST", "/draw");
    await confirm(page);
    await resultShown(page);
    assert.equal(server.seenPairs(key), 190, "a última rodada fechou todos os confrontos");
    assert.equal(server.count("POST", "/draw"), draws, "sem confronto por ver, nenhuma rodada é pedida");
    assert.match(await hint(page), /Você viu todos os confrontos desta pesquisa\.$/);
    assert.equal(await continueButton(page).count(), 0, "sem confronto por ver não há como continuar votando");
    assert.deepEqual(await doneActions(page), ["Compartilhar (principal)", "Próxima pesquisa"]);
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
    // Recarregar mostra o mesmo resultado, e o servidor não emite mais nada.
    const rounds = server.roundsOf(key).length;
    await page.reload({ waitUntil: "domcontentloaded" });
    await resultShown(page);
    assert.equal(await continueButton(page).count(), 0);
    assert.equal(server.roundsOf(key).length, rounds);
  });

  await scenario("servidor de antes das rodadas: a resposta registrada fica como era", async () => {
    const server = createServer();
    server.legacy = true;
    const page = await openSurvey(await newContext(server));
    await begin(page);
    await step(page, "Tela 1 de 4");
    const key = await storedKey(page);
    assert.equal(await kickerText(page), "POLÍTICA · 16 CARTAS");
    const picks = await playScreens(page, server.groupsFor(key), [1, 0, 1, 0]);
    await tap(page, picks[3]);
    await step(page, "Confirmar");
    assert.equal(await hint(page), "Confira antes de registrar. Depois não dá para votar de novo nesta pesquisa.");
    await confirm(page);
    await step(page, "Registrada");
    // O corpo da resposta é o de sempre: o servidor não disse rodada nenhuma.
    assert.deepEqual(Object.keys(server.bodies("/response")[0]).sort(), ["answerId", "championId", "pickIds"]);
    const check = async () => {
      assert.equal(await title(page), nameOf.get(picks[3]));
      assert.equal(await kickerText(page), "ESCOLHA REGISTRADA");
      assert.equal(await hint(page), LEGACY_HINT);
      assert.equal(await page.locator('[data-action="next-round"], [data-action="continue"], [data-action="result"], #ps-seen, .ps-pair').count(), 0, "sem rodada, sem resultado e sem contagem");
      assert.deepEqual(await doneActions(page), ["Compartilhar (principal)", "Próxima pesquisa"]);
      assert.equal(await page.locator(".ps-stack").evaluate((node) => node.className), "ps-stack ps-stack--pair");
      assert.doesNotMatch(await page.locator(".ps-main").innerText(), /rodada|confrontos/i);
    };
    await check();
    await page.reload({ waitUntil: "domcontentloaded" });
    await step(page, "Registrada");
    await check();
    assert.ok(server.bodies("/draw").every((body) => JSON.stringify(body) === "{}"), "nenhum sorteio leva campo novo");
    assert.equal(server.count("GET", "/result"), 0, "sem rodadas, ninguém pede resultado");
    const saved = await page.evaluate(([name, id]) => JSON.parse(localStorage.getItem(name))[id], [PROGRESS_KEY, SURVEY.id]);
    assert.deepEqual({ progress: saved.progress, answered: saved.answered }, { progress: null, answered: true });
  });

  await scenario("pesquisa fechada: depois da primeira rodada vale o resultado, e a rodada pela metade não vale", async () => {
    // Fechada com a rodada 2 aberta e não tocada: o resultado, sem Continuar votando e sem aviso.
    const server = createServer();
    const { page, key, first } = await answerFirstRound(server, await newContext(server), [3, 3, 3, 3], 0);
    server.status = "closed";
    await page.reload({ waitUntil: "domcontentloaded" });
    await resultShown(page);
    assert.equal(await title(page), nameOf.get(first.championId));
    assert.equal(await continueButton(page).count(), 0);
    assert.deepEqual(await doneActions(page), ["Compartilhar (principal)", "Próxima pesquisa"]);
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
    assert.equal(server.roundsOf(key)[1].response, null);

    // A pesquisa fecha entre a confirmação e o pedido da rodada seguinte: o
    // resultado, com o aviso, e nenhuma rodada nasce.
    const late = createServer();
    let draws = 0;
    late.beforeDraw = async () => {
      draws += 1;
      if (draws === 2) late.status = "closed";
    };
    const latePage = await openSurvey(await newContext(late));
    await begin(latePage);
    await step(latePage, "Tela 1 de 4");
    const lateKey = await storedKey(latePage);
    const lateFirst = await playRound(latePage, late.groupsFor(lateKey), [0, 1, 0, 1], 1);
    await resultShown(latePage);
    assert.equal(await latePage.locator("#ps-notice").innerText(), "Esta pesquisa fechou. Não dá para jogar outra rodada.");
    assert.equal(await title(latePage), nameOf.get(lateFirst.championId));
    assert.equal(await continueButton(latePage).count(), 0);
    assert.equal(late.roundsOf(lateKey).length, 1, "fechada, nenhuma rodada nasce");

    // Fechada com a rodada 2 pela metade, na hora de confirmar: a rodada não
    // vale, e o resultado mostra o que vale.
    const mid = createServer();
    const third = await answerFirstRound(mid, await newContext(mid), [2, 1, 2, 1], 3);
    const picks = await playScreens(third.page, mid.groupsFor(third.key, 2), [0, 0, 0, 0], 0, "Rodada 2 · ");
    await tap(third.page, picks[2]);
    await step(third.page, "Rodada 2 · Confirmar");
    mid.status = "closed";
    await confirm(third.page);
    await resultShown(third.page);
    assert.equal(await third.page.locator("#ps-notice:not([hidden])").innerText(), "A pesquisa fechou antes de a sua confirmação chegar. A escolha desta rodada não foi registrada.");
    assert.equal(await title(third.page), nameOf.get(third.first.championId), "o resultado é o da rodada que vale");
    assert.equal(await continueButton(third.page).count(), 0);
    assert.equal(mid.roundsOf(third.key)[1].response, null, "a rodada 2 não foi gravada");
    await third.page.reload({ waitUntil: "domcontentloaded" });
    await resultShown(third.page);
    assert.equal(await third.page.locator("#ps-notice:not([hidden])").count(), 0);
    assert.equal(await third.page.locator(".ps-grid, [data-action=confirm], #ps-action").count(), 0);

    // Fechada com escolhas da rodada 2 guardadas, e a pessoa volta depois: o
    // aviso diz que a rodada nova não chegou a valer.
    const gone = createServer();
    const fourth = await answerFirstRound(gone, await newContext(gone), [1, 2, 3, 0], 2);
    await tap(fourth.page, gone.groupsFor(fourth.key, 2)[0][0]);
    await step(fourth.page, "Rodada 2 · Tela 2 de 4");
    gone.status = "closed";
    await fourth.page.reload({ waitUntil: "domcontentloaded" });
    await resultShown(fourth.page);
    assert.equal(await fourth.page.locator("#ps-notice:not([hidden])").innerText(), "A pesquisa fechou antes de você confirmar a rodada nova. A escolha dela não foi registrada.");
    assert.equal(await title(fourth.page), nameOf.get(fourth.first.championId));
    assert.equal(await continueButton(fourth.page).count(), 0);
    assert.equal(gone.count("POST", "/response"), 1);
  });

  await scenario("dois aparelhos na rodada 2: vale a primeira resposta da rodada", async () => {
    const server = createServer();
    const one = await answerFirstRound(server, await newContext(server, { storedKey: keyFor("dupla") }), [0, 0, 0, 0], 0);
    const key = one.key;
    // O segundo aparelho, ao tocar em Começar, cai na rodada que o primeiro abriu.
    const two = await openSurvey(await newContext(server, { storedKey: key }));
    await begin(two);
    await nextRoundOpens(two, 2);
    assert.equal(server.roundsOf(key).length, 2, "os dois aparelhos jogam a mesma rodada 2");
    const groups = server.groupsFor(key, 2);
    const picksOne = await playScreens(one.page, groups, [0, 0, 0, 0], 0, "Rodada 2 · ");
    const picksTwo = await playScreens(two, groups, [1, 1, 1, 1], 0, "Rodada 2 · ");
    await tap(one.page, picksOne[1]);
    await tap(two, picksTwo[2]);
    await step(one.page, "Rodada 2 · Confirmar");
    await step(two, "Rodada 2 · Confirmar");
    await confirm(one.page);
    await nextRoundOpens(one.page, 3);
    await confirm(two);
    await step(two, "Registrada");
    assert.equal(await title(two), nameOf.get(picksOne[1]), "o segundo aparelho mostra a resposta que valeu");
    assert.equal(await two.locator("#ps-notice:not([hidden])").innerText(), "Você já tinha respondido esta rodada. Vale a primeira resposta, que é esta.");
    assert.equal(await kickerText(two), "ESCOLHA REGISTRADA · RODADA 2");
    assert.equal(server.roundsOf(key)[1].response.championId, picksOne[1]);
    assert.equal(server.roundsOf(key).length, 3);
    assert.equal(await two.locator('[data-action="next-round"], [data-action="continue"]').count(), 0);
    // Reabrir a página mostra o resultado, e dali dá para seguir votando.
    await two.reload({ waitUntil: "domcontentloaded" });
    await resultShown(two);
    assert.equal(await continueButton(two).count(), 1);
    assert.equal(await two.locator("#ps-notice:not([hidden])").count(), 0);
    assert.equal(server.roundsOf(key).length, 3, "reabrir não emite rodada");
  });

  await scenario("segunda aba na rodada 2: acompanha as escolhas sem pedir sorteio de novo e vê o resultado quando a outra confirma", async () => {
    const server = createServer();
    const context = await newContext(server);
    const { page: first, key } = await answerFirstRound(server, context, [1, 0, 1, 0], 0);
    const groups = server.groupsFor(key, 2);
    await tap(first, groups[0][3]);
    await step(first, "Rodada 2 · Tela 2 de 4");

    // A segunda aba abre na mesma rodada, no mesmo ponto.
    const second = await openSurvey(context);
    await step(second, "Rodada 2 · Tela 2 de 4");
    assert.deepEqual((await grid(second)).map((card) => card.id), groups[1]);
    const draws = server.count("POST", "/draw");
    await tap(second, groups[1][0]);
    await step(second, "Rodada 2 · Tela 3 de 4");
    await step(first, "Rodada 2 · Tela 3 de 4");
    await tap(first, groups[2][1]);
    await step(first, "Rodada 2 · Tela 4 de 4");
    await step(second, "Rodada 2 · Tela 4 de 4");
    await first.waitForTimeout(300);
    assert.equal(server.count("POST", "/draw"), draws, "acompanhar a outra aba não pede sorteio");

    await tap(first, groups[3][2]);
    await step(first, "Rodada 2 · Final");
    await tap(first, groups[2][1]);
    await step(first, "Rodada 2 · Confirmar");
    await confirm(first);
    await nextRoundOpens(first, 3);
    // A outra aba não segue sozinha para a rodada 3: mostra o resultado.
    await resultShown(second);
    assert.equal(await second.locator(".ps-grid, [data-action=confirm]").count(), 0);
    assert.ok(server.bodies("/draw").slice(draws).filter((body) => body.next).length === 1, "só a aba que confirmou pede a rodada seguinte");
    assert.equal(server.count("POST", "/response"), 2);
    assert.equal(server.roundsOf(key).length, 3);
  });

  assert.ok(results.length > 0, `nenhum cenário tem "${only}" no nome`);
  assert.deepEqual(pageErrors, [], `erros de página: ${pageErrors.join(" | ")}`);
  console.log(JSON.stringify({ suite: "photo-survey", browser: browserName, scenarios: results.length }));
} finally {
  await Promise.all(contexts.map((context) => context.close().catch(() => {})));
  await browser.close();
}
