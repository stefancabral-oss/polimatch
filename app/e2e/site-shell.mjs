/**
 * A capa nova e o menu (ICM 69, #331): `/` é a pesquisa por foto, o menu abre
 * no canto, a conta Google entra e sai por ele, e "Como funciona" tem página
 * própria. O percurso da pesquisa em si é do roteiro photo-survey.mjs.
 * Desde a ICM 74 (#348) não há pesquisa anunciada: nem o menu nem a capa
 * mostram "Em breve", e o menu leva também a "Créditos das fotos".
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
 *   4. Entrar com Google pelo menu, na entrada, não cria jogador; com a
 *      conta, a capa vira o feed (ICM 76).
 *   5. Quem respondeu sem conta entra, faz o cadastro e vê o resultado da
 *      resposta que deu.
 *   6. Sair revoga a sessão e esquece a chave.
 *   7. Sair com a sessão vencida esquece a chave; com o servidor fora do ar, não.
 *   8. Cadastro com CPF (ICM 71, #336), no lugar do antigo cenário da cota de
 *      rede: conta sem cadastro abre o formulário e cada recusa do servidor
 *      tem o seu texto; sessão vencida volta para a entrada; entrar e sair
 *      pelo menu com o cadastro na tela; Google ou servidor fora do ar na
 *      entrada; a conta que perde o cadastro espera o toque; o formulário
 *      não passa de uma conta para a outra; outra aba; foco no campo com
 *      erro; tamanhos de tela.
 *   9. O resultado (ICM 76) oferece "Continuar votando", o compartilhar e as
 *      outras pesquisas, sem "Ir para o início", com os botões à vista; sem
 *      confronto por ver, "Próxima pesquisa".
 *  10. "Como funciona" cabe na tela, abre o menu e leva ao início; o item 5
 *      fala das rodadas (ICM 75) e a nota, do perfil que a pessoa liga (ICM 76).
 *  11. As páginas antigas saíram do build e o sitemap lista as três páginas.
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
 *  26. Feed (ICM 76, #354): quem entrou vê as pesquisas em cartões, com o
 *      estado ("Começar", "Continuar", "Ver meu resultado") e a primeira
 *      colocada; o feed só lê; responder uma não mexe na outra.
 *  27. Feed: a fechada sem resposta sai, a respondida fica; sem o perfil, o
 *      feed sai sem a primeira colocada; a leitura que falha pede para tentar
 *      de novo.
 *  28. Uma pesquisa fechada sai do destaque da capa de quem não entrou; no
 *      feed, a respondida e fechada aparece com a primeira colocada.
 *  29. Com a API fora do ar, a capa avisa e tenta de novo.
 *  30. Compartilhar (ICM 70 e 72): só a imagem, com a escolha e as
 *      finalistas, só no toque, com o botão esperando a imagem.
 *  31. Sem compartilhamento de arquivo, a imagem aparece na tela para
 *      baixar, em vez de ir só o link; o link fica por pedido da pessoa.
 *  31b. Fechar a folha de compartilhar não é erro; se o aparelho recusa o
 *      arquivo, a imagem aparece na tela.
 *  31c. A imagem demora, falha ou perde uma carta: o botão não fica preso
 *      e o toque nunca manda só o link.
 *  32. Servidor que ainda não conhece uma pesquisa: a capa e o feed mostram
 *      só as que ele conhece (é o que acontece se o app for publicado antes
 *      da API).
 *  33. Uma leitura que falha não vira informação falsa: o feed pede para
 *      tentar de novo.
 *  34. Outra aba sai da conta: o feed desta vira a capa de quem não entrou.
 *
 * Pesquisa de roupas (ICM 73, #345):
 *  35. `/?p=roupas-demo-01` abre a entrada com o assunto, a pergunta, a
 *      observação e três cartas de roupa; a observação entra como texto.
 *  36. O caminho inteiro da pesquisa de roupas: quatro telas com as 16
 *      cartas, final, confirmação, a rodada 2 que abre sozinha, o resultado e
 *      compartilhar; o feed mostra a peça em primeiro.
 *  37. A entrada das pesquisas de política não tem observação e só ilustra
 *      com as cartas da lista da entrada.
 *
 * Pesquisa de famosos e créditos das fotos (ICM 74, #348):
 *  38. `/?p=famosos-01` abre a entrada com o assunto, a pergunta, a
 *      observação e três cartas de famosos, sorteadas a cada visita.
 *  39. O caminho inteiro da pesquisa de famosos: quatro telas com 16 das 20
 *      cartas, a final com "quem fica?", confirmação, a rodada 2 e o
 *      resultado; no feed, só o cartão de famosos muda.
 *  40. `/creditos.html` lista uma linha por carta do catálogo, com o autor e
 *      a licença, cabe na largura até 320 px, e o menu marca a página.
 *  41. Sem nenhuma lista para mostrar, a capa e o feed não deixam bloco vazio.
 *
 * Rodadas (ICM 75, #350) e feed (ICM 76, #354):
 *  42. A capa não emite sorteio: o feed mostra a primeira colocada de cada
 *      pesquisa, e o cartão leva ao resultado, sem transformar a rodada
 *      emitida e não tocada em voto.
 *  43. Servidor de antes das rodadas: o feed e a resposta registrada ficam
 *      como eram.
 *
 * Meu perfil e perfil público (ICM 76, #354):
 *  44. Nasce desligado; ligar sem aceite ou com nome inválido não grava; nome
 *      em uso; ligado, o link para copiar; o perfil público mostra só as
 *      pesquisas marcadas e respondidas; mudar as marcações; desligar some na
 *      hora, com a mesma mensagem de um nome que não existe.
 *  45. Sem cadastro, leva ao cadastro; sem conta, pede para entrar, e o menu
 *      só mostra "Meu perfil" com conta.
 *  46. As duas páginas cabem na largura em 390, 360 e 320 px.
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
  photoSurveyById,
  publicPhotoSurvey,
  seenPairKeys,
  surveyProgress,
  totalPairCount,
  validateBracket,
} from "../../shared/photo-survey.js";
import { PROFILE_CONSENT_TEXT, PROFILE_CONSENT_VERSION, isValidHandle, normalizeHandle } from "../../shared/profile.js";
import CELEBRITY_CARDS from "../src/celebrity-cards.json" with { type: "json" };
import CLOTHES_CARDS from "../src/clothes-cards.json" with { type: "json" };
import { ENTRY_CARD_IDS, PHOTO_SURVEY_STORAGE_KEY, identityTag, savedProgressText } from "../src/photo-survey-flow.js";

const browserName = process.env.POLIMATCH_E2E_BROWSER || "chromium";
const appUrl = process.env.POLIMATCH_E2E_URL || "http://127.0.0.1:4173/";
const browserType = { chromium, webkit }[browserName];
if (!browserType) throw new Error(`Navegador não suportado: ${browserName}`);

const SURVEY = PHOTO_SURVEYS[0];
const SECOND = PHOTO_SURVEYS[1];
const CELEBRITIES = photoSurveyById("famosos-01");
const CLOTHES = photoSurveyById("roupas-demo-01");
const surveyUrl = (survey) => new URL(`?p=${survey.id}`, appUrl).href;
const HOW_URL = new URL("como-funciona.html", appUrl).href;
const CREDITS_URL = new URL("creditos.html", appUrl).href;
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
    // Observação que este servidor devolve no lugar da que está na definição.
    notes: new Map(),
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
    // Um servidor de antes das rodadas (ICM 75): não lê `next` nem `round` e
    // não manda `round`, `progress` nem `lastAnswered`.
    legacy: false,
    // Perfis (ICM 76, #354), por chave: nome, ligado, versão e data do aceite
    // e pesquisas marcadas. Nascem desligados.
    profiles: new Map(),
    // Falhas programadas da leitura do perfil da conta (status HTTP).
    failProfile: [],
    requests: [],
    // A rodada 1 de cada pesquisa e identidade: o sorteio e a resposta, como
    // antes das rodadas. As seguintes ficam em `later`, cada uma com o número,
    // as cartas e a resposta (null enquanto está aberta).
    draws: new Map(),
    responses: new Map(),
    later: new Map(),
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
  const view = (survey = SURVEY) => ({
    ...publicPhotoSurvey(survey, new Date()),
    ...(server.notes.has(survey.id) ? { note: server.notes.get(survey.id) } : {}),
    status: server.closed.has(survey.id) ? "closed" : server.status,
  });
  const slot = (survey, key) => `${survey.id}:${key}`;
  /** As rodadas da identidade numa pesquisa, em ordem, como o servidor de verdade as lê. */
  const roundsOf = (key, survey = SURVEY) => {
    const first = server.responses.get(slot(survey, key));
    const shownIds = first ? first.shownIds : server.draws.get(slot(survey, key));
    const rounds = shownIds ? [{ round: 1, shownIds, response: first?.response || null }] : [];
    return server.legacy ? rounds : [...rounds, ...(server.later.get(slot(survey, key)) || [])];
  };
  const answeredRounds = (rounds) => rounds.filter((entry) => entry.response).map((entry) => ({ shownIds: entry.shownIds, pickIds: entry.response.pickIds }));
  // O que as duas rotas devolvem sobre uma rodada: os campos de antes das
  // rodadas e, fora do servidor antigo, `round`, `progress` e `lastAnswered`.
  const roundView = (survey, rounds, entry) => {
    const base = { survey: view(survey), draw: { groups: drawGroups(entry.shownIds, survey.groupSize) }, response: entry.response };
    if (server.legacy) return base;
    const progress = surveyProgress(survey, answeredRounds(rounds), view(survey).status);
    const last = rounds.findLast((item) => item.response);
    return {
      ...base,
      round: entry.round,
      progress: { ...progress, canContinue: progress.canContinue && rounds.every((item) => item.response) },
      lastAnswered: last ? { round: last.round, response: last.response } : null,
    };
  };
  // O ranking da pessoa numa pesquisa, com a regra de pontos compartilhada.
  const rankingOf = (key, survey) => personalRanking(survey, roundsOf(key, survey).filter((entry) => entry.response)
    .map((entry) => ({ shownIds: entry.shownIds, pickIds: entry.response.pickIds, championId: entry.response.championId })));
  const profileOf = (key) => server.profiles.get(key) || { handle: "", enabled: false, consentVersion: "", consentedAt: null, surveys: [] };
  const profileView = (key) => {
    const profile = profileOf(key);
    return {
      enabled: profile.enabled,
      handle: profile.handle || null,
      consentVersion: profile.consentVersion || null,
      consentedAt: profile.consentedAt,
      surveys: [...profile.surveys],
      firstPlaces: PHOTO_SURVEYS.map((item) => ({ surveyId: item.id, cardId: rankingOf(key, item)[0]?.cardId })).filter((entry) => entry.cardId),
      canEnable: server.registered.has(key),
    };
  };
  server.profileView = profileView;
  const addRound = (key, survey, entry) => server.later.set(slot(survey, key), [...(server.later.get(slot(survey, key)) || []), entry]);
  server.handler = async (route) => {
    const request = route.request();
    const { pathname, search } = new URL(request.url());
    const method = request.method();
    const key = (request.headers().authorization || "").replace(/^Bearer /, "");
    let sent = null;
    try {
      sent = request.postDataJSON();
    } catch {
      sent = null;
    }
    server.requests.push({ method, pathname, search, key, body: sent });
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
    // Perfil da conta e perfil público (ICM 76, #354).
    if (pathname === "/api/me/profile") {
      if (!key || server.revoked.has(key) || !key.startsWith("pms_")) return send(401, { error: "sessão de conta obrigatória", code: "PLAYER_SESSION_REQUIRED" });
      if (method === "GET") {
        if (server.failProfile.length) return send(server.failProfile.shift(), { error: "erro interno", code: "INTERNAL_ERROR" });
        return send(200, profileView(key));
      }
      if (method !== "PUT") return send(404, { error: "rota não simulada" });
      if (!server.registered.has(key)) return send(403, { error: "cadastro com CPF obrigatório", code: "CPF_REGISTRATION_REQUIRED" });
      const refuse = (reason) => send(400, { error: "perfil inválido", code: "PROFILE_INVALID", current: { reason } });
      if (typeof sent?.enabled !== "boolean") return refuse("enabled");
      if (sent.surveys !== undefined && (!Array.isArray(sent.surveys) || !sent.surveys.every((id) => photoSurveyById(id)))) return refuse("surveys");
      const current = profileOf(key);
      const surveys = sent.surveys === undefined ? current.surveys : [...new Set(sent.surveys)];
      if (!sent.enabled) {
        server.profiles.set(key, { ...current, enabled: false, surveys });
        return send(200, profileView(key));
      }
      const handle = normalizeHandle(sent.handle ?? current.handle);
      if (!isValidHandle(handle)) return refuse("handle");
      if (sent.consentVersion !== PROFILE_CONSENT_VERSION) return send(400, { error: "aceite do perfil obrigatório", code: "PROFILE_CONSENT_REQUIRED" });
      const taken = [...server.profiles].some(([other, profile]) => other !== key && profile.handle === handle);
      if (taken) return send(409, { error: "nome de perfil em uso", code: "PROFILE_HANDLE_TAKEN" });
      server.profiles.set(key, { handle, enabled: true, consentVersion: PROFILE_CONSENT_VERSION, consentedAt: new Date().toISOString(), surveys });
      return send(200, profileView(key));
    }
    const publicProfile = pathname.match(/^\/api\/profiles\/([^/]+)$/);
    if (publicProfile && method === "GET") {
      const handle = normalizeHandle(decodeURIComponent(publicProfile[1]));
      const owner = [...server.profiles].find(([, profile]) => profile.enabled && profile.handle === handle)?.[0];
      // Desligado e inexistente respondem igual.
      if (!owner) return send(404, { error: "perfil não encontrado", code: "PROFILE_NOT_FOUND" });
      const profile = server.profiles.get(owner);
      const surveys = PHOTO_SURVEYS.filter((item) => profile.surveys.includes(item.id))
        .map((item) => ({ surveyId: item.id, subject: item.subject, question: item.question, cardId: rankingOf(owner, item)[0]?.cardId }))
        .filter((entry) => entry.cardId);
      return send(200, { handle, surveys });
    }
    if (pathname === "/api/auth/logout" && method === "POST") {
      if (server.beforeLogout) await server.beforeLogout();
      if (server.logout === "down") return route.abort("connectionrefused");
      if (server.logout === "error") return send(500, { error: "erro interno", code: "INTERNAL_ERROR" });
      if (server.logout === "expired") return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
      return route.fulfill({ status: 204, body: "" });
    }
    const [, surveyId, action = ""] = pathname.match(/^\/api\/photo-surveys\/([^/]+)(?:\/(draw|response|result))?$/) || [];
    const survey = server.unknown.has(surveyId) ? null : photoSurveyById(surveyId || "");
    if (!survey) return send(404, { error: "pesquisa não encontrada", code: "PHOTO_SURVEY_NOT_FOUND" });
    if (!action && method === "GET") {
      if (server.holdSurvey) await server.holdSurvey.promise;
      return send(200, view(survey));
    }
    if (method !== "POST" && action !== "result") return send(404, { error: "rota não simulada" });
    if (!key || server.revoked.has(key)) return send(401, { error: "sessão de jogador obrigatória", code: "PLAYER_SESSION_REQUIRED" });
    // Como o servidor de verdade: sem conta com cadastro não há sorteio nem resposta.
    if (!server.registered.has(key)) return send(403, { error: "cadastro com CPF obrigatório para responder", code: "CPF_REGISTRATION_REQUIRED" });
    if (action === "result") {
      if (method !== "GET") return send(404, { error: "rota não simulada" });
      return send(200, { surveyId: survey.id, answeredRounds: roundsOf(key, survey).filter((entry) => entry.response).length, ranking: rankingOf(key, survey) });
    }
    const status = view(survey).status;
    const rounds = roundsOf(key, survey);
    const body = sent;
    // Sem `next`: emite a rodada 1 para quem não tem nenhuma e, para os
    // demais, devolve a última rodada, aberta ou respondida. Com `next`
    // verdadeiro, emite a rodada seguinte quando a última está respondida, a
    // pesquisa está aberta e sobra confronto por ver; senão, responde como
    // sem `next`.
    if (action === "draw") {
      const next = server.legacy ? undefined : body?.next;
      if (next !== undefined && typeof next !== "boolean") {
        return send(400, { error: "pedido de sorteio inválido", code: "PHOTO_SURVEY_DRAW_INVALID", current: { reason: "next" } });
      }
      const last = rounds.at(-1);
      if (!last) {
        if (status !== "open") return send(409, { error: "pesquisa fechada", code: "PHOTO_SURVEY_CLOSED", current: { status } });
        server.draws.set(slot(survey, key), drawCards(survey, (limit) => randomInt(limit)));
      } else if (next === true && last.response && status === "open") {
        const seen = seenPairKeys(survey, answeredRounds(rounds));
        if (seen.size < totalPairCount(survey)) {
          addRound(key, survey, { round: last.round + 1, shownIds: drawRound(survey, seen, (limit) => randomInt(limit)), response: null });
        }
      }
      const current = roundsOf(key, survey);
      return send(200, roundView(survey, current, current.at(-1)));
    }
    // Sem `round`, a resposta vale para a rodada aberta e, sem rodada aberta,
    // para a rodada 1. Com `round`, a rodada precisa existir.
    const invalid = (reason) => send(400, { error: "resposta não corresponde ao sorteio", code: "PHOTO_SURVEY_RESPONSE_INVALID", current: { reason } });
    const round = server.legacy ? undefined : body?.round;
    if (round !== undefined && !(Number.isInteger(round) && round >= 1)) return invalid("round");
    const target = round === undefined
      ? rounds.find((entry) => !entry.response) || rounds.find((entry) => entry.round === 1)
      : rounds.find((entry) => entry.round === round);
    if (!target) return invalid(round === undefined ? "bracket" : "round");
    if (target.response) {
      return send(409, {
        error: target.round === 1 ? "esta pesquisa já foi respondida" : "esta rodada já foi respondida",
        code: "PHOTO_SURVEY_ALREADY_ANSWERED",
        current: target.response,
      });
    }
    const bracket = validateBracket(survey, target.shownIds, { pickIds: body?.pickIds, championId: body?.championId });
    if (!bracket.ok) return invalid("bracket");
    const response = { answerId: body.answerId, pickIds: bracket.pickIds, championId: bracket.championId, respondedAt: new Date().toISOString() };
    if (target.round === 1) server.responses.set(slot(survey, key), { shownIds: target.shownIds, response });
    else target.response = response;
    const current = roundsOf(key, survey);
    return send(200, { status: "created", ...roundView(survey, current, current.find((entry) => entry.round === target.round)) });
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
  server.roundsOf = roundsOf;
  /**
   * Joga no servidor, sem tela, mais uma rodada desta chave: emite a rodada
   * seguinte, com prioridade para os confrontos ainda não vistos, e a responde
   * (ou, com `open`, deixa sem resposta). Devolve a rodada. A escolhida evita
   * as cartas de `avoid`, para o cenário distinguir uma rodada da outra.
   */
  server.playRound = (key, survey = SURVEY, { open = false, avoid = [] } = {}) => {
    const rounds = roundsOf(key, survey);
    const seen = seenPairKeys(survey, answeredRounds(rounds));
    const shownIds = drawRound(survey, seen, (limit) => randomInt(limit));
    const pickIds = drawGroups(shownIds, survey.groupSize).map((group) => group[0]);
    const entry = { round: rounds.at(-1).round + 1, shownIds, response: null };
    if (!open) {
      entry.response = { answerId: crypto.randomUUID(), pickIds, championId: pickIds.find((id) => !avoid.includes(id)) || pickIds[0], respondedAt: new Date().toISOString() };
    }
    addRound(key, survey, entry);
    return entry;
  };
  /** Joga rodadas no servidor até a chave ter visto todos os confrontos da pesquisa. */
  server.exhaust = (key, survey = SURVEY) => {
    while (seenPairKeys(survey, answeredRounds(roundsOf(key, survey))).size < totalPairCount(survey)) server.playRound(key, survey);
    return roundsOf(key, survey);
  };
  servers.push(server);
  return server;
}

const browser = await browserType.launch();
const contexts = [];
const pageErrors = [];

async function newContext(server, { width = 390, height = 844, storedKey = "", storedProgress = "" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
  contexts.push(context);
  if (storedProgress) {
    await context.addInitScript(([name, text]) => {
      if (!sessionStorage.getItem("e2e-progresso")) {
        localStorage.setItem(name, text);
        sessionStorage.setItem("e2e-progresso", "1");
      }
    }, [PHOTO_SURVEY_STORAGE_KEY, storedProgress]);
  }
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

// A etapa de uma tela de voto, em qualquer rodada ("Tela 2 de 4" ou "Rodada 3 · Tela 2 de 4").
const waitStepEnd = (page, text) => page.waitForFunction((expected) => {
  const value = document.querySelector("#ps-step")?.textContent || "";
  return value === expected || value.endsWith(` · ${expected}`);
}, text, { timeout: 15000 });

/**
 * Espera o que vem depois de confirmar: a rodada seguinte, que abre sozinha
 * (ICM 76, #354), o resultado, ou a resposta registrada de antes das rodadas.
 * O aviso "Rodada registrada" fica no caminho e não conta.
 */
const settled = (page) => page.waitForFunction(() => {
  const value = document.querySelector("#ps-step")?.textContent || "";
  const title = document.querySelector("#ps-title")?.textContent || "";
  const hint = document.querySelector(".ps-hint")?.textContent || "";
  if (/(^|· )Tela 1 de 4$/.test(value)) return document.querySelector('.ps-grid[data-ready="true"]') !== null;
  if (value === "Resultado") return !/Carregando/.test(hint);
  return value === "Registrada" && title !== "Rodada registrada";
}, null, { timeout: 15000 });

/** Joga as quatro telas, a final e confirma. Devolve o nome da carta escolhida. */
async function answer(page, position = 0) {
  for (let screen = 1; screen <= 4; screen += 1) {
    await waitStepEnd(page, `Tela ${screen} de 4`);
    await tapCard(page, position);
  }
  await waitStepEnd(page, "Final");
  await tapCard(page, position);
  await waitStepEnd(page, "Confirmar");
  const name = await page.locator("#ps-title").innerText();
  await page.locator('[data-action="confirm"]:not([disabled])').click();
  await settled(page);
  return name;
}

// Resultado e feed (ICM 76, #354).
const resultShown = async (page) => {
  await waitStep(page, "Resultado");
  await page.waitForFunction(() => !/Carregando/.test(document.querySelector(".ps-hint")?.textContent || ""), null, { timeout: 15000 });
};
const feedReady = (page) => page.waitForFunction(() => document.querySelector("#ps-step")?.textContent === "Pesquisas"
  && !/Carregando/.test(document.querySelector(".ps-hint")?.textContent || ""), null, { timeout: 15000 });
/** Os cartões do feed: pesquisa, rótulo, a primeira colocada (nome) e o estado. */
const feedCards = (page) => page.locator(".ps-feed-card").evaluateAll((cards) => cards.map((card) => ({
  id: card.dataset.survey,
  go: card.querySelector(".ps-feed-go").textContent.replace(/\s*›\s*$/, ""),
  first: card.querySelector(".ps-feed-first strong")?.textContent || "",
  tag: card.querySelector(".pm-tag").textContent,
})));

// Todas as cartas, por nome: o feed mostra o nome da primeira colocada.
const ARTS_BY_NAME = new Map([...(await import("../src/political-chromas.json", { with: { type: "json" } })).default, ...CELEBRITY_CARDS, ...CLOTHES_CARDS].map((art) => [art.name, art]));

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
    // Conta por método e caminho inteiros, sem depender de sufixo.
    const players = server.requests.filter((request) => request.method === "POST" && request.pathname === "/api/player").length;
    assert.equal(players, 0, `${name}: a página não cria jogador sem conta`);
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
    // Abaixo do destaque: as outras pesquisas abertas. Não há pesquisa
    // anunciada, e por isso não há "Em breve" (ICM 74).
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "POLÍTICA · 16 CARTAS");
    assert.equal(await page.locator(".ps-note").count(), 0, "a capa abre numa pesquisa de política, que não tem observação");
    assert.deepEqual(await page.locator(".ps-home .ps-label").allInnerTexts(), ["Mais pesquisas"]);
    const more = await page.locator(".ps-home a.ps-survey").evaluateAll((rows) => rows.map((row) => ({ href: row.getAttribute("href"), title: row.querySelector("b").textContent, sub: row.querySelector("small").textContent, tag: row.querySelector(".pm-tag").textContent })));
    assert.deepEqual(more, [
      { href: `./?p=${SECOND.id}`, title: "Em quem você confia mais?", sub: "Política · 16 cartas", tag: "Aberta" },
      { href: `./?p=${CELEBRITIES.id}`, title: "De quem você é mais fã?", sub: "Famosos · 16 cartas", tag: "Aberta" },
      { href: `./?p=${CLOTHES.id}`, title: "Qual você usaria?", sub: "Roupas · 16 cartas", tag: "Aberta" },
    ]);
    assert.equal(await page.locator(".ps-home .pm-item, .ps-home .is-soon").count(), 0, "nenhum anúncio de pesquisa na capa");
    assert.doesNotMatch(await page.locator(".ps-main").innerText(), /Em breve|Famosos e influenciadores/);
    // A lista termina na última pesquisa: nada vazio depois dela.
    assert.equal(await page.locator(".ps-home > :last-child").evaluate((node) => node.matches("a.ps-survey")), true);
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
      { text: "De quem você é mais fã?", note: "Famosos", href: `./?p=${CELEBRITIES.id}`, current: null },
      { text: "Qual você usaria?", note: "Roupas", href: `./?p=${CLOTHES.id}`, current: null },
      { text: "Início", note: "", href: "./", current: "page" },
      { text: "Como funciona", note: "", href: "./como-funciona.html", current: null },
      { text: "Créditos das fotos", note: "", href: "./creditos.html", current: null },
    ]);
    // Nenhum item "Em breve", e nenhum bloco vazio no lugar dele: depois da
    // última pesquisa vem direto o grupo "PoliMatch".
    assert.equal(await menu(page).locator(".is-soon, .pm-tag").count(), 0);
    assert.doesNotMatch(await menu(page).innerText(), /Em breve/i);
    assert.deepEqual(await menu(page).locator(".pm-group").allInnerTexts(), ["PESQUISAS", "POLIMATCH"]);
    assert.equal(await menu(page).locator(`a[href="./?p=${CLOTHES.id}"]`).evaluate((node) => node.nextElementSibling?.className), "pm-group");
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
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
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
    // Com a conta, a capa vira o feed (ICM 76, #354), sem gravar nada.
    await feedReady(page);
    assert.deepEqual(server.writes(), ["POST /api/auth/google"], "entrar e ver o feed não grava nada além da entrada");
    await page.locator(`.ps-feed-card[data-survey="${SURVEY.id}"]`).click();
    await entryReady(page);
    await page.locator("#ps-action").click();
    await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
    assert.equal(server.last("/draw").key, GOOGLE_KEY);
  });

  await scenario("quem respondeu sem conta entra, faz o cadastro e vê a resposta que deu", async () => {
    const server = createServer();
    server.registered.delete(GOOGLE_KEY);
    const answered = server.answered(ANONYMOUS_KEY);
    // O aparelho guarda que essa chave sem conta respondeu todas as pesquisas.
    const tag = identityTag(ANONYMOUS_KEY);
    const storedProgress = PHOTO_SURVEYS.reduce((text, survey) => savedProgressText(text, survey.id, { identity: tag, answered: true }), "");
    const page = await open(await newContext(server, { storedKey: ANONYMOUS_KEY, storedProgress }));
    await entryReady(page);
    await page.waitForTimeout(300);
    assert.deepEqual(server.writes(), [], "com a chave sem conta, a capa não pede nada ao servidor");
    // Sem conta ninguém respondeu, para efeito da capa: ela convida a entrar,
    // em vez de dizer que não há o que responder.
    assert.equal(await page.locator("#ps-title").innerText(), "Quem você prefere?");
    assert.equal(await page.locator(".ps-cta-note").innerText(), "Para responder, entre com Google e cadastre o CPF.");
    assert.equal(await page.locator(".ps-home .ps-pick").count(), 0);
    assert.doesNotMatch(await page.locator(".ps-main").innerText(), /Você respondeu todas/);
    await page.locator("#ps-action").click();
    await waitStep(page, "Entrar");
    assert.deepEqual(server.writes(), [], "sem conta, o toque não emite sorteio");
    await page.locator("#e2e-google").click();
    assert.equal(await fillRegistration(page), undefined);
    assert.equal(server.last("/api/auth/google").key, ANONYMOUS_KEY, "a chave sem conta vai junto, para o servidor ligar a resposta à conta");
    assert.equal(await storedKey(page), GOOGLE_KEY);
    await submitButton(page).click();
    // A resposta dada sem conta agora é da conta: a pessoa vê o resultado, não um voto novo.
    await resultShown(page);
    assert.equal(await page.locator("#ps-title").innerText(), (await import("../src/political-chromas.json", { with: { type: "json" } })).default.find((art) => art.id === answered.championId).name);
    assert.equal(server.last("/draw").key, GOOGLE_KEY);
    assert.equal(await page.locator(".ps-grid, #ps-action").count(), 0, "quem já respondeu não vota de novo");
    assert.deepEqual(server.responseOf(GOOGLE_KEY), answered);
    assert.equal(server.count("POST", "/response"), 0);
  });

  await scenario("sair revoga a sessão e esquece a chave", async () => {
    const server = createServer();
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
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
    const first = await open(await newContext(expired, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(first);
    await openMenu(first);
    await first.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await first.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    assert.equal(await storedKey(first), null, "sessão que o servidor não reconhece não prende a pessoa na conta");

    const down = createServer();
    down.logout = "down";
    const second = await open(await newContext(down, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(second);
    await openMenu(second);
    await second.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await second.locator('dialog.pm-menu[open] [role="alert"]').waitFor();
    assert.match(await second.locator('dialog.pm-menu[open] [role="alert"]').innerText(), /Você continua na conta\./);
    assert.equal(await storedKey(second), GOOGLE_KEY, "sem revogar no servidor, a sessão fica");
    assert.equal(await second.locator('dialog.pm-menu[open] [data-menu="signout"]:not([disabled])').count(), 1);

    const broken = createServer();
    broken.logout = "error";
    const third = await open(await newContext(broken, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
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
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
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

  await scenario("sessão vencida no cadastro volta para a entrada, com o formulário vazio, e entrar de novo conclui", async () => {
    const server = createServer();
    const renewed = `pms_${"r".repeat(43)}`;
    server.registered.delete(GOOGLE_KEY);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await fillRegistration(page);
    server.revoked.add(GOOGLE_KEY);
    server.session = renewed;
    await submitButton(page).click();
    await waitStep(page, "Entrar");
    assert.match(await formNotice(page).innerText(), /Sua sessão venceu\. Entre de novo para concluir o cadastro\./);
    assert.equal(await storedKey(page), null, "a sessão que o servidor não reconhece sai do aparelho");
    // Voltar a esta aba (o Google abre em outra) não tira a pessoa da entrada.
    const drawsBefore = server.count("POST", "/draw");
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await page.waitForTimeout(300);
    assert.equal(await stepText(page), "Entrar");
    assert.equal(server.count("POST", "/draw"), drawsBefore, "a sessão morta não é usada de novo");
    await page.locator("#ps-google #e2e-google").click();
    await waitStep(page, "Cadastro");
    assert.equal(server.last("/api/auth/google").key, "", "a entrada vai sem a sessão morta");
    assert.equal(await storedKey(page), renewed);
    // Quem entra agora pode ser outra pessoa: o formulário recomeça vazio.
    assert.equal(await page.locator("#ps-cpf").inputValue(), "");
    assert.equal(await page.locator("#ps-state").inputValue(), "");
    assert.equal(await page.locator("#ps-consent").isChecked(), false);
    assert.equal(await page.locator('#ps-register [aria-pressed="true"]').count(), 0);
    await fillRegistration(page);
    await submitButton(page).click();
    await waitStep(page, "Tela 1 de 4");
    assert.equal(server.last("/api/registration").key, renewed);
    assert.equal(server.last("/draw").key, renewed);
  });

  await scenario("sessão vencida no toque em Começar e na retomada: a página esquece a sessão e leva à entrada", async () => {
    const server = createServer();
    const renewed = `pms_${"r".repeat(43)}`;
    server.registered.add(renewed);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(page);
    server.revoked.add(GOOGLE_KEY);
    await page.locator("#ps-action").click();
    await waitStep(page, "Entrar");
    assert.match(await formNotice(page).innerText(), /Sua sessão venceu\. Entre de novo para continuar\./);
    assert.equal(await storedKey(page), null);
    assert.equal(server.count("POST", "/draw"), 1, "um pedido recusado, sem repetição");
    server.session = renewed;
    await page.locator("#ps-google #e2e-google").click();
    await waitStep(page, "Tela 1 de 4");
    await tapCard(page, 0);
    await waitStep(page, "Tela 2 de 4");
    // A sessão vence com a pesquisa pela metade. Recarregar tenta retomar sozinho.
    server.revoked.add(renewed);
    await page.reload({ waitUntil: "domcontentloaded" });
    await entryReady(page);
    assert.match(await formNotice(page).innerText(), /Sua sessão venceu\. Toque em Começar para entrar de novo\./);
    assert.equal(await storedKey(page), null);
    assert.equal(await page.locator("#ps-google, #ps-register").count(), 0, "sem toque, ninguém cai na entrada com Google");
    server.revoked.delete(renewed);
    await page.locator("#ps-action").click();
    await waitStep(page, "Entrar");
    await page.locator("#ps-google #e2e-google").click();
    // A mesma conta, o mesmo sorteio: a escolha da primeira tela continua.
    await waitStep(page, "Tela 2 de 4");
  });

  await scenario("conta sem cadastro e pesquisa que fechou: Começar mostra a pesquisa fechada, sem formulário", async () => {
    const server = createServer();
    server.registered.delete(GOOGLE_KEY);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(page);
    server.status = "closed";
    await page.locator("#ps-action").click();
    await page.locator("#ps-title", { hasText: "Esta pesquisa está fechada." }).waitFor();
    assert.equal(await page.locator("#ps-register, #ps-google").count(), 0, "ninguém faz cadastro para uma pesquisa que fechou");
    assert.equal(server.count("POST", "/api/registration"), 0);
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
    // A pessoa preenche o formulário e sai da conta: volta para a entrada, com o motivo.
    await fillRegistration(page, "111.444.777-35");
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    await waitStep(page, "Entrar");
    assert.match(await formNotice(page).innerText(), /Você saiu da conta neste aparelho\. Entre de novo para fazer o cadastro\./);
    assert.equal(await page.locator("#ps-register").count(), 0);
    assert.equal(await storedKey(page), null);
    // Outra conta entra, pelo botão do menu que ficou aberto. O Google só
    // guarda um destino para a credencial: quem recebe é a tela, que fecha o
    // menu em vez de deixá-lo aberto e desatualizado por cima.
    const other = `pms_${"b".repeat(43)}`;
    server.session = other;
    await page.locator("dialog.pm-menu[open] #e2e-google").click();
    await waitStep(page, "Cadastro");
    await page.waitForFunction(() => !document.querySelector("dialog.pm-menu").open);
    assert.equal(await storedKey(page), other);
    // O que a conta anterior preencheu não aparece para esta.
    assert.equal(await page.locator("#ps-cpf").inputValue(), "", "o CPF de uma conta não aparece para a seguinte");
    assert.equal(await page.locator("#ps-state").inputValue(), "");
    assert.equal(await page.locator("#ps-consent").isChecked(), false);
    assert.equal(await page.locator('#ps-register [aria-pressed="true"]').count(), 0);
    await fillRegistration(page);
    await submitButton(page).click();
    await waitStep(page, "Tela 1 de 4");
    assert.equal(server.last("/api/registration").key, other);
  });

  await scenario("outra aba entra ou sai com o cadastro na tela, e a volta à aba confere a conta", async () => {
    const server = createServer();
    const context = await newContext(server);
    const page = await open(context, surveyUrl(SURVEY));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await waitStep(page, "Entrar");
    const helper = await context.newPage();
    await helper.goto(new URL("robots.txt", appUrl).href);
    // Outra aba entra numa conta com cadastro: esta segue para a pesquisa.
    await helper.evaluate(([name, key]) => localStorage.setItem(name, key), [IDENTITY_KEY, GOOGLE_KEY]);
    await waitStep(page, "Tela 1 de 4");

    // Com o formulário na tela, outra aba sai da conta: esta volta para a entrada.
    const unregistered = createServer();
    unregistered.registered.delete(GOOGLE_KEY);
    const second = await newContext(unregistered, { storedKey: GOOGLE_KEY });
    const form = await open(second, surveyUrl(SURVEY));
    await entryReady(form);
    await form.locator("#ps-action").click();
    await fillRegistration(form);
    const other = await second.newPage();
    await other.goto(new URL("robots.txt", appUrl).href);
    await other.evaluate((name) => localStorage.removeItem(name), IDENTITY_KEY);
    await waitStep(form, "Entrar");
    assert.match(await formNotice(form).innerText(), /Você saiu da conta neste aparelho/);

    // A conta do aparelho troca sem aviso (no próprio documento, sem evento de
    // armazenamento) com o formulário preenchido. Concluir não manda o CPF de
    // uma pessoa na sessão de outra: o formulário recomeça vazio.
    const swapped = createServer();
    const intruder = `pms_${"i".repeat(43)}`;
    swapped.registered.delete(GOOGLE_KEY);
    const third = await open(await newContext(swapped, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(third);
    await third.locator("#ps-action").click();
    await fillRegistration(third, "111.444.777-35");
    await third.evaluate(([name, key]) => localStorage.setItem(name, key), [IDENTITY_KEY, intruder]);
    await submitButton(third).click();
    await third.waitForFunction(() => document.querySelector("#ps-cpf")?.value === "" && document.querySelector("#ps-step")?.textContent === "Cadastro");
    assert.equal(swapped.count("POST", "/api/registration"), 0, "o CPF preenchido numa conta não é enviado na sessão de outra");
    assert.equal(await third.locator("#ps-consent").isChecked(), false);
    assert.equal(swapped.last("/draw").key, intruder, "a conta nova é conferida pelo sorteio");

    // A conta chega sem evento de armazenamento (troca no próprio documento):
    // ao voltar a aparecer, a tela confere e segue.
    unregistered.registered.add(GOOGLE_KEY);
    await form.evaluate(([name, key]) => {
      localStorage.setItem(name, key);
      document.dispatchEvent(new Event("visibilitychange"));
    }, [IDENTITY_KEY, GOOGLE_KEY]);
    await waitStep(form, "Tela 1 de 4");
  });

  await scenario("o formulário leva o foco ao campo com erro, e corrigir um dígito no meio do CPF não perde o lugar", async () => {
    const server = createServer();
    server.registered.delete(GOOGLE_KEY);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await waitStep(page, "Cadastro");
    const focused = () => page.evaluate(() => {
      const element = document.activeElement;
      return { id: element.id, field: element.dataset?.field || "", invalid: element.getAttribute("aria-invalid"), described: (element.closest("[aria-describedby]") || element).getAttribute("aria-describedby") };
    });
    // Vazio: o foco vai para o CPF, marcado e ligado ao aviso, que fica à vista.
    await submitButton(page).click();
    assert.deepEqual(await focused(), { id: "ps-cpf", field: "", invalid: "true", described: "ps-notice" });
    assert.equal(await formNotice(page).innerText(), "Confira o CPF: os números não fecham.");
    const noticeBox = await formNotice(page).boundingBox();
    assert.ok(noticeBox.y >= 0 && noticeBox.y + noticeBox.height <= 844, "o aviso aparece sem rolar");
    // Digitar tira a marca de erro.
    await page.locator("#ps-cpf").pressSequentially("52998224725");
    assert.equal(await page.locator("#ps-cpf").getAttribute("aria-invalid"), null);
    assert.equal(await page.locator("#ps-cpf").inputValue(), "529.982.247-25");
    // Corrigir o segundo dígito: apagar e digitar outro, com o cursor no meio.
    await page.locator("#ps-cpf").evaluate((input) => input.setSelectionRange(2, 2));
    await page.keyboard.press("Backspace");
    assert.equal(await page.locator("#ps-cpf").inputValue(), "599.822.472-5");
    assert.equal(await page.locator("#ps-cpf").evaluate((input) => input.selectionStart), 1, "o cursor continua depois do primeiro dígito");
    await page.keyboard.type("2");
    assert.equal(await page.locator("#ps-cpf").inputValue(), "529.982.247-25");
    assert.equal(await page.locator("#ps-cpf").evaluate((input) => input.selectionStart), 2);
    // Cada campo que falta recebe o foco e o texto dele.
    await submitButton(page).click();
    assert.equal(await formNotice(page).innerText(), "Escolha a sua faixa de idade.");
    assert.deepEqual(await focused(), { id: "", field: "ageRange", invalid: null, described: "ps-notice" });
    await page.getByRole("button", { name: "45 a 59" }).click();
    await submitButton(page).click();
    assert.equal(await formNotice(page).innerText(), "Escolha o gênero.");
    assert.deepEqual(await focused(), { id: "", field: "gender", invalid: null, described: "ps-notice" });
    await page.getByRole("button", { name: "Outro" }).click();
    await submitButton(page).click();
    assert.equal(await formNotice(page).innerText(), "Escolha o estado.");
    assert.deepEqual(await focused(), { id: "ps-state", field: "", invalid: "true", described: "ps-notice" });
    await page.locator("#ps-state").selectOption("PE");
    await submitButton(page).click();
    assert.equal(await formNotice(page).innerText(), "Marque a autorização para concluir.");
    assert.deepEqual(await focused(), { id: "ps-consent", field: "", invalid: "true", described: "ps-notice" });
    await page.locator("#ps-consent").check();
    assert.equal(await page.locator('#ps-register [aria-describedby="ps-notice"]').count(), 0);
    // A recusa do servidor sobre o CPF também leva o foco ao campo.
    server.failRegistration.push({ status: 409, code: "CPF_ALREADY_REGISTERED" });
    await submitButton(page).click();
    await formNotice(page).waitFor();
    await page.waitForFunction(() => document.activeElement?.id === "ps-cpf");
    assert.equal(await page.locator("#ps-cpf").getAttribute("aria-invalid"), "true");
    // Dois envios seguidos viram um pedido só.
    const before = server.count("POST", "/api/registration");
    await page.evaluate(() => {
      document.querySelector("#ps-register").requestSubmit();
      document.querySelector("#ps-register").requestSubmit();
    });
    await waitStep(page, "Tela 1 de 4");
    assert.equal(server.count("POST", "/api/registration"), before + 1);
  });

  await scenario("a conta perde o cadastro na hora de confirmar: o formulário abre vazio e a escolha continua", async () => {
    const server = createServer();
    server.registered.delete(GOOGLE_KEY);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await fillRegistration(page);
    // Enquanto o CPF está só digitado, ele não vai para o aparelho.
    const typed = await page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }, location.href, document.cookie]));
    assert.doesNotMatch(typed, /52998224725|529\.982\.247/, "o CPF digitado não é guardado no aparelho");
    await submitButton(page).click();
    for (let screen = 1; screen <= 4; screen += 1) {
      await waitStep(page, `Tela ${screen} de 4`);
      await tapCard(page, 1);
    }
    await waitStep(page, "Final");
    await tapCard(page, 1);
    await waitStep(page, "Confirmar");
    const choice = await page.locator("#ps-title").innerText();
    server.registered.delete(GOOGLE_KEY);
    await page.locator('[data-action="confirm"]:not([disabled])').click();
    await waitStep(page, "Cadastro");
    assert.match(await formNotice(page).innerText(), /Falta o cadastro para registrar a sua escolha\. As suas escolhas continuam neste aparelho\./);
    assert.equal(server.count("POST", "/response"), 1);
    // O CPF enviado no primeiro cadastro saiu da memória da página.
    assert.equal(await page.locator("#ps-cpf").inputValue(), "", "depois de enviado, o CPF não volta ao formulário");
    assert.equal(await page.locator("#ps-consent").isChecked(), false);
    await fillRegistration(page);
    await submitButton(page).click();
    await waitStep(page, "Confirmar");
    assert.equal(await page.locator("#ps-title").innerText(), choice, "a escolha feita antes continua na tela");
    await page.locator('[data-action="confirm"]:not([disabled])').click();
    await waitStep(page, "Registrada");
    // O CPF só viaja no corpo do pedido de cadastro: nunca num endereço.
    assert.ok(server.requests.every((request) => request.search === "" && !/529|982|247/.test(request.pathname)), "nenhum pedido leva dado no endereço");
    assert.equal(server.count("POST", "/api/registration"), 2);
  });

  await scenario("a entrada e o cadastro cabem na largura da tela em três tamanhos, também com fonte larga", async () => {
    const WIDE_FONT = '.ps-shell, .ps-shell button, .ps-shell a, .ps-shell input, .ps-shell select { font-family: Menlo, "DejaVu Sans Mono", "Liberation Mono", monospace !important; }';
    for (const [width, height, wide = false] of [[390, 844], [360, 640], [320, 568], [360, 640, true], [320, 568, true]]) {
      const label = `${width}×${height}${wide ? " com fonte larga" : ""}`;
      const server = createServer();
      server.registered.delete(GOOGLE_KEY);
      const page = await open(await newContext(server, { width, height }), surveyUrl(SURVEY));
      await entryReady(page);
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      await page.locator("#ps-action").click();
      await waitStep(page, "Entrar");
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      await page.locator("#ps-google #e2e-google").waitFor();
      const inside = async (selector) => {
        for (const box of await page.locator(selector).evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map(({ left, right, height: tall }) => ({ left, right, tall })))) {
          assert.ok(box.left >= -0.5 && box.right <= width + 0.5, `${label}: ${selector} sai da tela (${Math.round(box.left)} a ${Math.round(box.right)})`);
        }
      };
      const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
      // Entrada: o botão do Google e o Voltar aparecem sem rolar.
      assert.equal(await noSideScroll(), true, `${label}: a entrada rola para o lado`);
      await inside("#ps-google, .ps-stack .ps-btn, #ps-title");
      const back = await page.getByRole("link", { name: "Voltar" }).boundingBox();
      assert.ok(back.y + back.height <= height + 1, `${label}: o Voltar da entrada aparece sem rolar`);
      await page.locator("#ps-google #e2e-google").click();
      await waitStep(page, "Cadastro");
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      assert.equal(await noSideScroll(), true, `${label}: o formulário rola para o lado`);
      await inside("#ps-cpf, .ps-chip, #ps-state, .ps-consent, .ps-form-note, #ps-register .ps-btn, #ps-title");
      const chips = await page.locator(".ps-chip").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
      assert.ok(chips.every((tall) => tall >= 44), `${label}: opção com menos de 44 px de altura`);
      const fonts = await page.locator("#ps-cpf, #ps-state").evaluateAll((nodes) => nodes.map((node) => parseFloat(getComputedStyle(node).fontSize)));
      assert.ok(fonts.every((size) => size >= 16), `${label}: campo com fonte menor que 16 px faz o iPhone aproximar a tela`);
      // O botão de concluir e o Voltar ficam inteiros na tela ao chegar ao fim.
      await page.getByRole("link", { name: "Voltar" }).scrollIntoViewIfNeeded();
      const [submitBox, backBox] = [await submitButton(page).boundingBox(), await page.getByRole("link", { name: "Voltar" }).boundingBox()];
      assert.ok(backBox.y + backBox.height <= height + 1 && submitBox.y + submitBox.height <= backBox.y + 1, `${label}: Concluir e Voltar não cabem juntos no fim do formulário`);
      // Com um aviso de erro, o topo continua legível e nada sai para o lado.
      await submitButton(page).click();
      await formNotice(page).waitFor();
      assert.equal(await noSideScroll(), true, `${label}: o aviso faz o formulário rolar para o lado`);
      await inside("#ps-notice");
    }
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

  await scenario("o resultado oferece continuar votando e as outras pesquisas, sem \"Ir para o início\"", async () => {
    // A fonte do Linux do CI é mais larga que a do macOS: o terceiro caso força
    // uma fonte larga, para a medida não depender da máquina.
    const WIDE_FONT = '.ps-shell, .ps-shell button, .ps-shell a { font-family: Menlo, "DejaVu Sans Mono", "Liberation Mono", monospace !important; }';
    for (const [width, height, wide = false] of [[390, 844], [360, 640], [360, 640, true], [320, 568]]) {
      const server = createServer();
      server.answered(GOOGLE_KEY);
      const page = await open(await newContext(server, { width, height, storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
      await entryReady(page);
      if (wide) await page.addStyleTag({ content: WIDE_FONT });
      await page.locator("#ps-action").click();
      // Quem já respondeu e toca em Começar vê o resultado (ICM 76, #354).
      await resultShown(page);
      await menuButton(page).waitFor();
      const label = `${width}×${height}${wide ? " com fonte larga" : ""}`;
      const next = page.locator(".ps-stack");
      assert.deepEqual(await next.locator(".ps-btn").allInnerTexts(), ["Continuar votando", "Compartilhar"], "a ordem dos botões é a da leitura e a do teclado");
      const share = next.getByRole("button", { name: "Compartilhar meu resultado" });
      const more = next.getByRole("button", { name: "Continuar votando" });
      for (const [name, box] of [["compartilhar", await share.boundingBox()], ["continuar votando", await more.boundingBox()]]) {
        assert.ok(box.height >= 44 && box.height <= 80, `${label}: o botão de ${name} tem ${Math.round(box.height)} px de altura`);
        assert.ok(box.x >= 0 && box.x + box.width <= width + 0.5, `${label}: o botão de ${name} sai da tela`);
        assert.ok(box.y >= 0 && box.y + box.height <= height + 0.5, `${label}: o botão de ${name} fica à vista`);
      }
      assert.equal(await page.getByRole("link", { name: "Outras pesquisas" }).getAttribute("href"), "./");
      assert.doesNotMatch(await page.locator(".ps-main").innerText(), /Ir para o início/);
      assert.equal(new URL(page.url()).search, `?p=${SURVEY.id}`, "a pesquisa respondida fica no endereço");
      const heroBox = await page.locator(".ps-hero .ps-card").boundingBox();
      const nextBox = await next.boundingBox();
      assert.ok(heroBox.height >= (height >= 800 ? 180 : 90), `${label}: a primeira colocada ficou pequena (${Math.round(heroBox.height)} px)`);
      assert.ok(heroBox.y + heroBox.height <= nextBox.y + 1, `${label}: a primeira colocada não fica atrás dos botões`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${label}: rolagem lateral`);
      assert.deepEqual(server.writes().filter((entry) => !entry.endsWith("/draw")), [], "ver o resultado não grava nada");
    }
    // Vistos todos os confrontos, a próxima pesquisa toma o lugar de continuar votando.
    const server = createServer();
    server.answered(GOOGLE_KEY);
    server.exhaust(GOOGLE_KEY);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await resultShown(page);
    assert.deepEqual(await page.locator(".ps-stack .ps-btn").allInnerTexts(), ["Compartilhar", "Próxima pesquisa"]);
    assert.equal(await page.locator(".ps-stack").getByRole("link", { name: "Próxima pesquisa" }).getAttribute("href"), "./", "a próxima é a que a capa puser em destaque");
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
      assert.equal(
        await page.locator(".ps-list li").last().locator("span").innerText(),
        "Um CPF, uma pessoa: você pode jogar várias rodadas da mesma pesquisa, e todas contam como a resposta de uma pessoa só.",
      );
      assert.doesNotMatch(await page.locator(".ps-list").innerText(), /responde uma vez/);
      // A nota fala do perfil que a própria pessoa liga (ICM 76, #354).
      assert.equal(
        await page.locator(".pm-note").innerText(),
        "Do PoliMatch só sai o resultado somado. A escolha de uma pessoa só aparece no perfil que ela mesma ligou, e só nas pesquisas que ela marcou. Não guardamos o número do CPF, só um código gerado a partir dele.",
      );
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

  await scenario("as páginas antigas saíram do build e o sitemap lista as três páginas", async () => {
    const sitemap = await (await fetch(new URL("sitemap.xml", appUrl))).text();
    assert.deepEqual(
      [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]),
      ["https://polimatch.com.br/", "https://polimatch.com.br/como-funciona.html", "https://polimatch.com.br/creditos.html"],
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
    // Com a conta, a capa é o feed (ICM 76, #354).
    await feedReady(second);
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
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
    await entryReady(page);
    await page.locator("#ps-action").click();
    await resultShown(page);
    await openMenu(page);
    await page.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await page.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#ps-notice:not([hidden])").waitFor();
    assert.match(await page.locator("#ps-notice").innerText(), /Você saiu da conta neste aparelho\. A sua resposta continua registrada\./);
    assert.equal(await stepText(page), "Registrada");
    assert.equal(await page.locator("#ps-action, .ps-grid").count(), 0, "sem botão para responder de novo");
    assert.equal(await page.locator('[data-action="next-round"], [data-action="continue"], #ps-seen').count(), 0, "sem a conta, não há rodada para oferecer");
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
    await resultShown(page);
    assert.equal(await page.locator('[data-action="continue"]').count(), 0, "fechada, não há como continuar votando");
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
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
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
    assert.equal(await page.locator(".pm-menu[open] .pm-item").count(), PHOTO_SURVEYS.length + 3);
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
    // Com a conta, a capa é o feed, e ele já mostra a pesquisa como respondida.
    await feedReady(page);
    assert.equal((await feedCards(page))[0].go, "Ver meu resultado");
    await page.locator(`.ps-feed-card[data-survey="${SURVEY.id}"]`).click();
    await entryReady(page);
    await page.locator("#ps-action").click();
    await resultShown(page);
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
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
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
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), surveyUrl(SURVEY));
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

  await scenario("feed: quem entrou vê as pesquisas em cartões, com o estado e a primeira colocada; responder uma não mexe na outra", async () => {
    const server = createServer();
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    const page = await open(context);
    await feedReady(page);
    assert.equal(await page.locator("#ps-title").innerText(), "Suas pesquisas");
    assert.deepEqual(await feedCards(page), PHOTO_SURVEYS.map((item) => ({ id: item.id, go: "Começar", first: "", tag: "Aberta" })));
    assert.deepEqual(await page.locator(".ps-feed-card b").allInnerTexts(), PHOTO_SURVEYS.map((item) => item.question), "na ordem das pesquisas");
    assert.deepEqual(await page.locator(".ps-feed-card").evaluateAll((cards) => cards.map((card) => card.getAttribute("href"))), PHOTO_SURVEYS.map((item) => `./?p=${item.id}`));
    assert.equal(await page.locator("#ps-action, .ps-fan").count(), 0, "o feed não tem o destaque da capa de quem não entrou");
    assert.equal(await page.locator('.ps-top [data-action="menu"]').count(), 1);
    // A capa só lê: as pesquisas e o perfil da conta, um pedido só para as primeiras colocadas.
    assert.deepEqual(server.writes(), [], "o feed não grava nada");
    assert.equal(server.count("GET", "/api/me/profile"), 1);
    assert.equal(server.requests.filter((request) => request.pathname.includes("/draw") || request.pathname.endsWith("/result")).length, 0, "o feed não pede sorteio nem resultado");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "o feed não rola para o lado");

    // Responder a primeira: a rodada 2 abre sozinha, e a segunda não é tocada.
    await page.locator(`.ps-feed-card[data-survey="${SURVEY.id}"]`).click();
    await entryReady(page);
    await page.locator("#ps-action").click();
    const first = await answer(page, 0);
    await waitStep(page, "Rodada 2 · Tela 1 de 4");
    assert.equal(new URL(page.url()).search, `?p=${SURVEY.id}`);
    assert.equal(server.responseOf(GOOGLE_KEY, SECOND), null, "responder a primeira não responde a segunda");

    // De volta ao feed: a primeira mostra a primeira colocada e "Ver meu resultado".
    const draws = server.count("POST", "/draw");
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await feedReady(page);
    assert.deepEqual((await feedCards(page)).map(({ id, go, first: name }) => [id, go, name]), [
      [SURVEY.id, "Ver meu resultado", first],
      [SECOND.id, "Começar", ""],
      [CELEBRITIES.id, "Começar", ""],
      [CLOTHES.id, "Começar", ""],
    ]);
    const firstCard = page.locator(`.ps-feed-card[data-survey="${SURVEY.id}"]`);
    assert.equal(await firstCard.locator("img").getAttribute("src"), ARTS_BY_NAME.get(first).src, "a carta do cartão é a primeira colocada");
    assert.equal(await firstCard.locator("img").evaluate((image) => image.complete && image.naturalWidth > 0), true);
    assert.equal(server.count("POST", "/draw"), draws, "a capa não emite sorteio");

    // O cartão leva ao resultado, sem emitir rodada; continuar votando abre a rodada 2.
    await firstCard.click();
    await resultShown(page);
    assert.equal(await page.locator("#ps-title").innerText(), first);
    assert.equal(server.count("POST", "/draw"), draws + 1);
    assert.deepEqual(server.last("/draw").body, {}, "abrir a pesquisa respondida não pede rodada seguinte");
    await page.locator('[data-action="continue"]').click();
    await waitStep(page, "Rodada 2 · Tela 1 de 4");
    await tapCard(page, 1);
    await waitStep(page, "Rodada 2 · Tela 2 de 4");
    // Com a rodada pela metade neste aparelho, o cartão diz "Continuar" e leva direto ao voto.
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await feedReady(page);
    assert.deepEqual((await feedCards(page))[0], { id: SURVEY.id, go: "Continuar", first, tag: "Aberta" });
    await page.locator(`.ps-feed-card[data-survey="${SURVEY.id}"]`).click();
    await waitStep(page, "Rodada 2 · Tela 2 de 4");

    // A segunda começa do zero: sorteio próprio, nenhuma escolha herdada.
    await page.goto(surveyUrl(SECOND), { waitUntil: "domcontentloaded" });
    await entryReady(page);
    await page.locator("#ps-action").click();
    await waitStep(page, "Tela 1 de 4");
    assert.equal(await page.locator('.ps-grid button[aria-pressed="true"]').count(), 0);
    const second = await answer(page, 1);
    assert.notEqual(server.responseOf(GOOGLE_KEY, SURVEY).answerId, server.responseOf(GOOGLE_KEY, SECOND).answerId);
    assert.equal(server.responseOf(GOOGLE_KEY, CELEBRITIES), null, "responder as de política não responde a de famosos");
    assert.equal(server.responseOf(GOOGLE_KEY, CLOTHES), null, "responder as de política não responde a de roupas");
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await feedReady(page);
    assert.deepEqual((await feedCards(page)).map(({ go, first: name }) => [go, name]), [["Continuar", first], ["Ver meu resultado", second], ["Começar", ""], ["Começar", ""]]);
  });

  await scenario("feed: a pesquisa fechada sem resposta sai, a respondida fica, e a leitura que falha pede para tentar de novo", async () => {
    const server = createServer();
    server.closed.add(SECOND.id);
    server.closed.add(CLOTHES.id);
    server.answered(GOOGLE_KEY, CLOTHES);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }));
    await feedReady(page);
    const cards = await feedCards(page);
    assert.deepEqual(cards.map(({ id, go, tag }) => [id, go, tag]), [
      [SURVEY.id, "Começar", "Aberta"],
      [CELEBRITIES.id, "Começar", "Aberta"],
      [CLOTHES.id, "Ver meu resultado", "Fechada"],
    ]);
    assert.ok(cards[2].first, "a respondida mostra a primeira colocada, mesmo fechada");
    assert.deepEqual(server.writes(), [], "fechada ou aberta, o feed não grava nada");

    // Sem o perfil, o feed sai assim mesmo, sem a primeira colocada.
    server.failProfile.push(500);
    await page.reload({ waitUntil: "domcontentloaded" });
    await feedReady(page);
    assert.deepEqual((await feedCards(page)).map(({ id }) => id), [SURVEY.id, CELEBRITIES.id]);

    // As pesquisas não carregam: o aviso e o botão de tentar de novo.
    let down = true;
    await page.context().route(/\/api\/photo-surveys\//, (route) => (down ? route.abort("connectionrefused") : route.fallback()));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#ps-notice:not([hidden])").waitFor();
    assert.match(await page.locator("#ps-notice").innerText(), /Não conseguimos falar com o servidor/);
    assert.equal(await page.locator("#ps-action").innerText(), "Tentar de novo");
    down = false;
    await page.locator("#ps-action").click();
    await feedReady(page);
    assert.equal(await page.locator(".ps-feed-card").count(), 3);
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
  });

  await scenario("uma pesquisa fechada sai do destaque e aparece como fechada", async () => {
    const server = createServer();
    server.closed.add(SURVEY.id);
    const page = await open(await newContext(server));
    await entryReady(page);
    assert.equal(await page.locator("#ps-title").innerText(), "Em quem você confia mais?");
    const rows = await page.locator(".ps-home a.ps-survey").evaluateAll((items) => items.map((row) => `${row.querySelector("b").textContent} | ${row.querySelector(".pm-tag").textContent}`));
    assert.deepEqual(rows, ["Quem você prefere? | Fechada", "De quem você é mais fã? | Aberta", "Qual você usaria? | Aberta"]);
    assert.deepEqual(server.writes(), []);

    // Todas fechadas: sem destaque e sem botão de começar.
    const none = createServer();
    none.status = "closed";
    const empty = await open(await newContext(none));
    await empty.locator("#ps-title", { hasText: "Nenhuma pesquisa aberta agora." }).waitFor();
    assert.equal(await empty.locator("#ps-action").count(), 0);
    assert.equal(await empty.locator(".ps-home a.ps-survey .pm-tag", { hasText: "Fechada" }).count(), PHOTO_SURVEYS.length);

    // Quem tem conta no aparelho e respondeu antes de fechar vê a primeira colocada no feed, mesmo sem registro local.
    const past = createServer();
    past.status = "closed";
    const chosen = past.answered(GOOGLE_KEY, SECOND);
    const mine = await open(await newContext(past, { storedKey: GOOGLE_KEY }));
    await feedReady(mine);
    assert.deepEqual((await feedCards(mine)).map(({ id, go, tag }) => [id, go, tag]), [[SECOND.id, "Ver meu resultado", "Fechada"]]);
    assert.equal(await mine.locator(".ps-feed-card").getAttribute("href"), `./?p=${SECOND.id}`);
    assert.equal(await mine.locator(".ps-feed-card img").getAttribute("src"), (await import("../src/political-chromas.json", { with: { type: "json" } })).default.find((art) => art.id === chosen.championId).src);
    assert.deepEqual(past.writes(), [], "o feed não grava nada");

    // Um estado que a página não conhece vale como fechada, sem quebrar a capa.
    const odd = createServer();
    odd.status = "constructor";
    const strange = await open(await newContext(odd));
    await strange.locator("#ps-title", { hasText: "Nenhuma pesquisa aberta agora." }).waitFor();
    assert.equal(await strange.locator(".ps-home a.ps-survey .pm-tag", { hasText: "Fechada" }).count(), PHOTO_SURVEYS.length);
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
    assert.equal(await page.locator(".ps-home a.ps-survey").count(), PHOTO_SURVEYS.length - 1);
  });

  // O compartilhamento do aparelho é simulado: guarda o que a página mandou e
  // o que ela desenhou na imagem. Modos: "file" (compartilha arquivo), "text"
  // (só texto), "none" (não compartilha; copia), "cancel" (a pessoa fecha a
  // folha) e "refuse" (o aparelho recusa o arquivo). `blobDelay` atrasa a
  // imagem; `blobFail` faz as primeiras montagens falharem.
  const SHARE_STUB = ({ mode, blobDelay = 0, blobFail = 0, noModal = false }) => {
    window.__shared = [];
    window.__drawn = [];
    window.__texts = [];
    window.__urls = { created: 0, revoked: 0 };
    const write = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function fillText(text) {
      window.__texts.push(String(text));
      return write.apply(this, arguments);
    };
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function drawImage(image, x, y, width, height) {
      window.__drawn.push({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) });
      return draw.apply(this, arguments);
    };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    let failures = blobFail;
    HTMLCanvasElement.prototype.toBlob = function slowToBlob(callback, ...rest) {
      if (failures > 0) {
        failures -= 1;
        callback(null);
        return;
      }
      if (blobDelay) setTimeout(() => toBlob.call(this, callback, ...rest), blobDelay);
      else toBlob.call(this, callback, ...rest);
    };
    const [create, revoke] = [URL.createObjectURL, URL.revokeObjectURL];
    URL.createObjectURL = (value) => { window.__urls.created += 1; return create.call(URL, value); };
    URL.revokeObjectURL = (value) => { window.__urls.revoked += 1; return revoke.call(URL, value); };
    if (noModal) {
      delete HTMLDialogElement.prototype.showModal;
      delete HTMLDialogElement.prototype.close;
    }
    const define = (name, value) => Object.defineProperty(Navigator.prototype, name, { configurable: true, writable: true, value });
    if (mode === "none") {
      define("share", undefined);
      define("canShare", undefined);
      Object.defineProperty(Navigator.prototype, "clipboard", { configurable: true, get: () => ({ writeText: async (text) => { window.__copied = text; } }) });
      return;
    }
    define("canShare", (data) => mode !== "text" && Array.isArray(data?.files) && data.files.every((file) => file.type === "image/jpeg"));
    define("share", async (data) => {
      const files = [];
      for (const file of data.files || []) {
        const bitmap = await createImageBitmap(file).catch(() => null);
        const magic = [...new Uint8Array(await file.slice(0, 2).arrayBuffer())].map((byte) => byte.toString(16)).join("");
        files.push({ name: file.name, type: file.type, size: file.size, width: bitmap?.width || 0, height: bitmap?.height || 0, magic });
      }
      window.__shared.push({ keys: Object.keys(data).sort(), title: data.title, text: data.text, url: data.url, files });
      if (mode === "cancel") throw new DOMException("cancelado", "AbortError");
      if (mode === "refuse" && files.length) throw new DOMException("recusado", "NotAllowedError");
      // A folha de compartilhar fica aberta um instante, como num aparelho de verdade.
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
  };
  const ARTS = (await import("../src/political-chromas.json", { with: { type: "json" } })).default;
  async function answeredPage(mode, { width = 390, height = 844, lostFinalist = false, ...stub } = {}) {
    const server = createServer();
    const answered = server.answered(GOOGLE_KEY);
    const context = await newContext(server, { storedKey: GOOGLE_KEY, width, height });
    await context.addInitScript(SHARE_STUB, { mode, ...stub });
    // A carta de uma das finalistas não chega.
    if (lostFinalist) {
      const lost = ARTS.find((art) => art.id === answered.pickIds.find((id) => id !== answered.championId));
      await context.route((url) => url.pathname === lost.src, (route) => route.abort("connectionrefused"));
    }
    const images = [];
    context.on("request", (request) => { if (request.url().includes("/chromas/")) images.push(new URL(request.url()).pathname); });
    const page = await open(context, surveyUrl(SURVEY));
    page.cardRequests = images;
    await entryReady(page);
    await page.locator("#ps-action").click();
    // Quem já respondeu e toca em Começar vê o resultado (ICM 76, #354), com o compartilhar.
    await resultShown(page);
    return { page, server, name: await page.locator("#ps-title").innerText(), answered };
  }
  const shareButton = (page) => page.getByRole("button", { name: /^Compartilhar (minha escolha|meu resultado)$/ });
  const shareReady = (page) => page.locator('[data-action="share"][data-ready="true"]:not([disabled])').waitFor();
  const preview = (page) => page.locator("dialog.ps-share[open]");
  const previewClosed = (page) => page.waitForFunction(() => !document.querySelector("dialog.ps-share").hasAttribute("open"));
  const urls = (page) => page.evaluate(() => window.__urls);

  await scenario("compartilhar: só a imagem, com a escolha e as finalistas, só no toque", async () => {
    const { page, server } = await answeredPage("file", { blobDelay: 1500 });
    const button = shareButton(page);
    // Enquanto a imagem não fica pronta, o botão espera.
    assert.equal(await button.isDisabled(), true, "o botão só libera com a imagem pronta");
    assert.equal(await button.getAttribute("aria-busy"), "true");
    await page.waitForTimeout(800);
    assert.equal(await button.isDisabled(), true, "o botão continua esperando a imagem");
    await shareReady(page);
    assert.equal(await button.getAttribute("aria-busy"), null);
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(() => window.__shared), [], "nada é compartilhado sem o toque");
    const before = server.requests.length;
    // A imagem usa as cartas que já estão na tela: não baixa a carta grande.
    assert.equal(page.cardRequests.some((path) => path.endsWith("-1060.webp")), false, "a imagem não baixa a carta de 1060");
    // A imagem leva as escolhas: a escolhida em destaque e as três finalistas numa linha.
    const drawn = await page.evaluate(() => window.__drawn);
    assert.equal(drawn.length, 4, "a escolhida e as três finalistas");
    const [hero, ...finalists] = [...drawn].sort((left, right) => right.width - left.width);
    assert.ok(hero.width >= 400 && Math.abs(hero.x + hero.width / 2 - 540) <= 1, "a escolhida fica no meio, em destaque");
    assert.ok(finalists.every((box) => box.width === finalists[0].width && box.y === finalists[0].y && box.width < hero.width / 1.8), "as finalistas ficam numa linha, menores");
    assert.ok(finalists[0].y > hero.y + hero.height, "as finalistas ficam abaixo da escolhida");
    assert.ok(drawn.every((box) => box.x >= 0 && box.x + box.width <= 1080 && box.y >= 0 && box.y + box.height <= 1350), "tudo dentro da folha");
    // O que a imagem escreve: a escolha, e as outras três como "Também na final".
    // Os rótulos não dizem que a pessoa "escolheu" as três.
    const texts = await page.evaluate(() => window.__texts);
    // Os rótulos são os textos todos em maiúsculas; o nome, a pergunta e o
    // endereço ficam de fora, para uma pergunta futura não derrubar o cenário.
    const labels = texts.filter((text) => /\p{L}/u.test(text) && text === text.toUpperCase());
    // No resultado (ICM 76, #354) os rótulos falam da primeira colocada e das seguintes.
    assert.deepEqual(labels, ["MEU PRIMEIRO LUGAR", "DEPOIS DELA"], `os rótulos da imagem (${texts.join(" | ")})`);
    // Dois toques seguidos abrem o compartilhamento uma vez só.
    await button.click();
    await button.click();
    await page.waitForFunction(() => window.__shared.length >= 1);
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.__shared.length), 1, "um compartilhamento por toque, sem repetir");
    const [shared] = await page.evaluate(() => window.__shared);
    // Só o arquivo: texto ou endereço junto fazem o iPhone entregar só o link.
    assert.deepEqual(shared.keys, ["files"], "a imagem vai sozinha, sem texto nem endereço");
    assert.equal(shared.files.length, 1);
    assert.equal(shared.files[0].name, "polimatch-minha-escolha.jpg");
    assert.equal(shared.files[0].type, "image/jpeg");
    assert.equal(shared.files[0].magic, "ffd8", "o arquivo é mesmo um JPEG");
    assert.deepEqual([shared.files[0].width, shared.files[0].height], [1080, 1350]);
    assert.ok(shared.files[0].size > 60000 && shared.files[0].size < 900000, `a imagem tem conteúdo e peso razoável (${shared.files[0].size} bytes)`);
    assert.equal(server.requests.length, before, "compartilhar não fala com a API");
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
    assert.equal(await preview(page).count(), 0, "com o compartilhamento do aparelho não há prévia");
    assert.deepEqual(await urls(page), { created: 0, revoked: 0 });
    // Sem resposta carregada não há o que compartilhar: a tela de voto não tem o botão.
    const fresh = await open(await newContext(createServer()), surveyUrl(SURVEY));
    await entryReady(fresh);
    assert.equal(await fresh.locator('[data-action="share"]').count(), 0);
  });

  await scenario("sem compartilhamento de arquivo, a imagem aparece na tela para baixar, em vez de ir só o link", async () => {
    for (const [mode, width, height] of [["text", 390, 844], ["none", 360, 640]]) {
      const { page, name } = await answeredPage(mode, { width, height });
      await shareReady(page);
      await shareButton(page).click();
      await preview(page).waitFor();
      assert.deepEqual(await page.evaluate(() => window.__shared), [], `${mode}: o toque não manda só o link`);
      assert.equal(await page.evaluate(() => window.__copied ?? null), null, `${mode}: nada é copiado sem a pessoa pedir`);
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector("dialog.ps-share")), true, "o foco entra na prévia");
      assert.equal(await preview(page).getAttribute("aria-label"), "Imagem para compartilhar");
      // A imagem é a da escolha, inteira, e dá para baixar.
      const image = preview(page).locator("img.ps-share-img");
      await page.waitForFunction(() => document.querySelector("dialog.ps-share img")?.naturalWidth > 0);
      assert.deepEqual(await image.evaluate((node) => [node.naturalWidth, node.naturalHeight]), [1080, 1350]);
      assert.match(await image.getAttribute("alt"), new RegExp(`^Imagem com a minha escolha: ${name}\\. Depois dela: .+, .+ e .+\\.$`));
      const link = preview(page).getByRole("link", { name: "Baixar imagem" });
      assert.equal(await link.getAttribute("download"), "polimatch-minha-escolha.jpg");
      assert.match(await link.getAttribute("href"), /^blob:/);
      assert.equal(await link.getAttribute("href"), await image.getAttribute("src"));
      // A prévia cabe na tela: a imagem, os dois botões e o Fechar, sem rolar.
      const boxes = await preview(page).locator("img, .ps-btn, [data-share='close']").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map(({ left, right, top, bottom }) => ({ left, right, top, bottom })));
      assert.ok(boxes.every((box) => box.left >= 0 && box.right <= width + 0.5 && box.top >= 0 && box.bottom <= height + 0.5), `${width}×${height}: a prévia cabe na tela sem rolar`);
      assert.ok(boxes[0].bottom - boxes[0].top >= 200, `${width}×${height}: a imagem aparece em tamanho que dá para ver (${Math.round(boxes[0].bottom - boxes[0].top)} px)`);
      const download = page.waitForEvent("download");
      await link.click();
      assert.equal((await download).suggestedFilename(), "polimatch-minha-escolha.jpg");
      // O link continua à mão, por pedido da pessoa.
      const second = preview(page).locator('[data-share="link"]');
      if (mode === "text") {
        assert.equal(await second.innerText(), "Compartilhar link");
        await second.click();
        await page.waitForFunction(() => window.__shared.length === 1);
        const [onlyText] = await page.evaluate(() => window.__shared);
        assert.deepEqual(onlyText.files, []);
        assert.match(onlyText.text, new RegExp(`Minha escolha no PoliMatch: ${name}\\.`));
        assert.equal(onlyText.url, `https://polimatch.com.br/?p=${SURVEY.id}`);
        // A folha de compartilhar do aparelho (simulada) fica aberta um instante.
        await page.waitForTimeout(500);
      } else {
        assert.equal(await second.innerText(), "Copiar link");
        await second.click();
        await preview(page).locator("#ps-share-notice:not([hidden])", { hasText: "Link copiado." }).waitFor();
        assert.equal(await page.evaluate(() => window.__copied), `Quem você prefere? Minha escolha no PoliMatch: ${name}. E a sua? https://polimatch.com.br/?p=${SURVEY.id}`);
      }
      // Fechar devolve o foco ao botão, solta a imagem, e dá para abrir de novo.
      await preview(page).locator('[data-share="close"]').click();
      await previewClosed(page);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset?.action), "share");
      assert.equal(await page.locator("dialog.ps-share img").count(), 0, "a imagem sai da prévia ao fechar");
      assert.deepEqual(await urls(page), { created: 1, revoked: 1 }, "o endereço local da imagem é solto ao fechar");
      await shareButton(page).click();
      await preview(page).waitFor();
      // Esc também fecha e solta a imagem.
      await page.keyboard.press("Escape");
      await previewClosed(page);
      await page.waitForFunction(() => window.__urls.created === 2 && window.__urls.revoked === 2 && !document.querySelector("dialog.ps-share img"));
      assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
    }
  });

  await scenario("fechar a folha de compartilhar não é erro; se o aparelho recusa o arquivo, a imagem aparece na tela", async () => {
    // Fechar a folha de compartilhar não é erro: nenhum aviso e nenhuma prévia.
    const cancel = await answeredPage("cancel");
    await shareReady(cancel.page);
    await shareButton(cancel.page).click();
    await cancel.page.waitForFunction(() => window.__shared.length === 1);
    await cancel.page.waitForTimeout(300);
    assert.equal((await cancel.page.evaluate(() => window.__shared))[0].files.length, 1, "a folha abriu com a imagem");
    assert.equal(await cancel.page.locator("#ps-notice:not([hidden])").count(), 0);
    assert.equal(await preview(cancel.page).count(), 0);
    assert.equal(await shareButton(cancel.page).isEnabled(), true);

    // O aparelho diz que compartilha arquivo e recusa na hora: a imagem não se perde.
    const refuse = await answeredPage("refuse");
    await shareReady(refuse.page);
    await shareButton(refuse.page).click();
    await preview(refuse.page).waitFor();
    await refuse.page.waitForFunction(() => document.querySelector("dialog.ps-share img")?.naturalWidth === 1080);
    assert.equal(await refuse.page.locator("#ps-notice:not([hidden])").count(), 0, "a recusa do arquivo não vira aviso de falha");

    // Uma tela nova fecha a prévia: sair da conta com ela aberta não a deixa por cima.
    await refuse.page.evaluate((name) => {
      localStorage.removeItem(name);
      window.dispatchEvent(new StorageEvent("storage", { key: name }));
    }, IDENTITY_KEY);
    await previewClosed(refuse.page);
    assert.deepEqual(await urls(refuse.page), { created: 1, revoked: 1 });
  });

  await scenario("a imagem demora, falha ou perde uma carta: o botão não fica preso e o toque nunca manda só o link", async () => {
    // A imagem leva mais que o prazo: o botão libera, e o toque abre a prévia, que espera por ela.
    const slow = await answeredPage("file", { blobDelay: 9800 });
    const button = shareButton(slow.page);
    await slow.page.waitForTimeout(7000);
    assert.equal(await button.isDisabled(), true, "antes do prazo, o botão ainda espera a imagem");
    await slow.page.locator('[data-action="share"][data-ready="text"]:not([disabled])').waitFor({ timeout: 4000 });
    await button.click();
    await preview(slow.page).waitFor();
    assert.equal(await preview(slow.page).locator(".ps-share-wait").innerText(), "Preparando a imagem…");
    assert.deepEqual(await slow.page.evaluate(() => window.__shared), [], "sem a imagem, o toque não manda o link");
    // A imagem chega: a prévia mostra, e o botão passa a valer com ela.
    await slow.page.waitForFunction(() => document.querySelector("dialog.ps-share img")?.naturalWidth === 1080, null, { timeout: 8000 });
    assert.equal(await preview(slow.page).locator(".ps-share-wait").count(), 0);
    await preview(slow.page).locator('[data-share="close"]').click();
    await previewClosed(slow.page);
    await shareReady(slow.page);
    await button.click();
    await slow.page.waitForFunction(() => window.__shared.length === 1);
    assert.equal((await slow.page.evaluate(() => window.__shared))[0].files.length, 1, "com a imagem pronta, vai a imagem");

    // A imagem não sai: o botão libera na hora, o toque oferece tentar de novo, e a nova tentativa monta.
    const broken = await answeredPage("none", { blobFail: 1 });
    await broken.page.locator('[data-action="share"][data-ready="text"]:not([disabled])').waitFor();
    await shareButton(broken.page).click();
    await preview(broken.page).waitFor();
    // O toque já tentou de novo, e desta vez a imagem saiu.
    await broken.page.waitForFunction(() => document.querySelector("dialog.ps-share img")?.naturalWidth === 1080);
    assert.equal(await broken.page.evaluate(() => window.__copied ?? null), null, "nada é copiado sem a pessoa pedir");
    const twice = await answeredPage("none", { blobFail: 2 });
    await twice.page.locator('[data-action="share"][data-ready="text"]:not([disabled])').waitFor();
    await shareButton(twice.page).click();
    await preview(twice.page).locator('[role="alert"]', { hasText: "Não deu para montar a imagem agora." }).waitFor();
    assert.equal(await preview(twice.page).locator("img").count(), 0);
    assert.equal(await twice.page.evaluate(() => window.__copied ?? null), null);
    await preview(twice.page).locator('[data-share="retry"]').click();
    await twice.page.waitForFunction(() => document.querySelector("dialog.ps-share img")?.naturalWidth === 1080);
    assert.equal(await preview(twice.page).locator('[data-share="retry"]').count(), 0);

    // A carta de uma finalista não chega: ela fica de fora e a imagem sai assim mesmo.
    const partial = await answeredPage("file", { lostFinalist: true });
    await shareReady(partial.page);
    assert.equal((await partial.page.evaluate(() => window.__drawn)).length, 3, "a escolhida e as duas finalistas que chegaram");

    // Navegador sem showModal: a prévia abre pelo atributo, e Esc fecha.
    const old = await answeredPage("none", { noModal: true, width: 360, height: 640 });
    await shareReady(old.page);
    await shareButton(old.page).click();
    await old.page.locator(".ps-share[open] img").waitFor();
    const box = await old.page.locator(".ps-share[open]").boundingBox();
    assert.ok(box.width >= 359 && box.height >= 639 && box.y === 0, `sem showModal a prévia ainda cobre a tela (${box.width}×${box.height})`);
    assert.equal(await old.page.evaluate(() => document.activeElement === document.querySelector(".ps-share")), true, "sem showModal, o foco entra na prévia mesmo assim");
    await old.page.keyboard.press("Escape");
    await old.page.waitForFunction(() => !document.querySelector(".ps-share").hasAttribute("open"));
    assert.deepEqual(await urls(old.page), { created: 1, revoked: 1 });
  });

  await scenario("servidor que ainda não conhece uma pesquisa: a capa mostra só as que ele conhece", async () => {
    // A API de antes da pesquisa de famosos (ICM 74): a capa fica como era,
    // com as duas de política e a de roupas.
    const older = createServer();
    older.unknown.add(CELEBRITIES.id);
    const before = await newContext(older);
    const home = await open(before);
    await entryReady(home);
    assert.equal(await home.locator("#ps-title").innerText(), "Quem você prefere?");
    assert.deepEqual(await home.locator(".ps-home a.ps-survey b").allInnerTexts(), ["Em quem você confia mais?", "Qual você usaria?"]);
    assert.deepEqual(await home.locator(".ps-home .ps-label").allInnerTexts(), ["Mais pesquisas"]);
    assert.equal(await home.locator("#ps-notice:not([hidden])").count(), 0);
    // O menu vem do próprio app: ainda lista a de famosos, e o endereço dela diz que não está disponível.
    await openMenu(home);
    assert.equal(await menu(home).locator(`a[href="./?p=${CELEBRITIES.id}"]`).count(), 1);
    await home.keyboard.press("Escape");
    const celebrities = await open(before, surveyUrl(CELEBRITIES));
    await celebrities.locator("#ps-title", { hasText: "Esta pesquisa não está disponível." }).waitFor();
    assert.equal(await celebrities.locator("#ps-action, .ps-fan, .ps-note").count(), 0);
    assert.equal(await celebrities.getByRole("link", { name: "Ver pesquisas" }).getAttribute("href"), "./");

    // A API de antes da pesquisa de roupas (ICM 73) também não conhece a de famosos.
    const oldest = createServer();
    oldest.unknown.add(CELEBRITIES.id);
    oldest.unknown.add(CLOTHES.id);
    const earlier = await newContext(oldest);
    const cover = await open(earlier);
    await entryReady(cover);
    assert.deepEqual(await cover.locator(".ps-home a.ps-survey b").allInnerTexts(), ["Em quem você confia mais?"]);
    const clothes = await open(earlier, surveyUrl(CLOTHES));
    await clothes.locator("#ps-title", { hasText: "Esta pesquisa não está disponível." }).waitFor();
    assert.equal(await clothes.locator("#ps-action, .ps-fan, .ps-note").count(), 0);

    const server = createServer();
    server.unknown.add(SECOND.id);
    server.unknown.add(CELEBRITIES.id);
    server.unknown.add(CLOTHES.id);
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    const page = await open(context);
    // Com a conta, o feed mostra só a pesquisa que o servidor conhece.
    await feedReady(page);
    assert.deepEqual((await feedCards(page)).map(({ id }) => id), [SURVEY.id], "as pesquisas desconhecidas não entram no feed");
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
    await page.locator(".ps-feed-card").click();
    await entryReady(page);
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
    await resultShown(first);
    // A leitura da segunda falha: o feed não pode mostrar uma lista pela metade.
    let down = true;
    await context.route(new RegExp(`/api/photo-surveys/${SECOND.id}$`), (route) => (down ? route.abort("connectionrefused") : route.fallback()));
    const page = await open(context);
    await page.locator("#ps-notice:not([hidden])").waitFor();
    assert.match(await page.locator("#ps-notice").innerText(), /Não conseguimos falar com o servidor/);
    assert.equal(await page.locator("#ps-action").innerText(), "Tentar de novo");
    assert.equal(await page.locator(".ps-feed-card").count(), 0, "sem saber o que está aberto, o feed não mostra cartões");
    down = false;
    await page.locator("#ps-action").click();
    await feedReady(page);
    assert.deepEqual((await feedCards(page)).map(({ go }) => go), ["Ver meu resultado", "Começar", "Começar", "Começar"]);
    assert.equal(await page.locator("#ps-notice:not([hidden])").count(), 0);
  });

  await scenario("outra aba sai da conta: a capa desta se refaz", async () => {
    const server = createServer();
    server.answered(GOOGLE_KEY);
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    const first = await open(context, surveyUrl(SURVEY));
    await entryReady(first);
    await first.locator("#ps-action").click();
    await resultShown(first);
    await first.goto(appUrl, { waitUntil: "domcontentloaded" });
    await feedReady(first);
    await first.locator(".ps-feed-card .ps-feed-first").waitFor();

    const second = await open(context);
    await feedReady(second);
    await openMenu(second);
    await second.locator('dialog.pm-menu[open] [data-menu="signout"]').click();
    await second.locator("dialog.pm-menu[open] #e2e-google").waitFor();
    // Sem a conta, o feed sai e volta a capa de quem não entrou, com a primeira pesquisa em destaque.
    await first.waitForFunction(() => document.querySelectorAll(".ps-feed-card").length === 0 && document.querySelector("#ps-title")?.textContent === "Quem você prefere?");
    assert.deepEqual(await first.locator(".ps-home .ps-label").allInnerTexts(), ["Mais pesquisas"]);
  });

  // Pesquisa de roupas (ICM 73, #345) -----------------------------------------
  const CLOTHES_NOTE = "Peças de demonstração, desenhadas com IA pelo PoliMatch.";
  const clothesBySrc = new Map(CLOTHES_CARDS.map((card) => [card.src, card]));
  const clothesName = new Map(CLOTHES_CARDS.map((card) => [card.id, card.name]));
  // As cartas de famosos (ICM 74, #348). Quem está na lista pode mudar: os
  // cenários leem a pesquisa e o catálogo, sem citar ninguém pelo nome.
  const celebrityBySrc = new Map(CELEBRITY_CARDS.map((card) => [card.src, card]));
  const celebrityName = new Map(CELEBRITY_CARDS.map((card) => [card.id, card.name]));
  const fanSources = (page) => page.locator(".ps-fan img").evaluateAll((images) => images.map((image) => image.getAttribute("src")));

  await scenario("a pesquisa de roupas abre no endereço dela, com a observação e três cartas de roupa", async () => {
    const server = createServer();
    const page = await open(await newContext(server), surveyUrl(CLOTHES));
    await entryReady(page);
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "ROUPAS · 16 CARTAS");
    assert.equal(await page.locator("#ps-title").innerText(), "Qual você usaria?");
    assert.equal(await page.locator(".ps-hint").first().innerText(), "Leva menos de um minuto.");
    assert.equal(await page.locator(".ps-note").innerText(), CLOTHES_NOTE);
    // A observação vem logo abaixo do texto de apoio, e é discreta: menor que ele, na mesma cor.
    assert.equal(await page.locator(".ps-note").evaluate((node) => node.previousElementSibling?.className), "ps-hint");
    const [hint, note] = await page.locator(".ps-hint, .ps-note").evaluateAll((nodes) => nodes.slice(0, 2).map((node) => ({ size: parseFloat(getComputedStyle(node).fontSize), color: getComputedStyle(node).color, top: node.getBoundingClientRect().top })));
    assert.ok(note.size < hint.size && note.color === hint.color && note.top > hint.top, `a observação é discreta e vem depois do texto de apoio (${JSON.stringify([hint, note])})`);
    assert.equal(await page.locator(".ps-cta-note").innerText(), "Para responder, entre com Google e cadastre o CPF.");
    assert.equal(await page.locator(".ps-home").count(), 0, "na página da pesquisa não há as listas da capa");
    assert.equal(await page.getByRole("link", { name: "Todas as pesquisas" }).getAttribute("href"), "./");
    // O leque sai das cartas da própria pesquisa: três, distintas, sorteadas a cada visita.
    assert.deepEqual([...clothesBySrc.values()].map((card) => card.id).sort(), [...CLOTHES.cardIds], "o catálogo tem as cartas da pesquisa");
    const seen = new Set();
    for (let visit = 0; visit < 6; visit += 1) {
      if (visit > 0) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await entryReady(page);
      }
      const fan = await fanSources(page);
      assert.equal(fan.length, 3);
      assert.equal(new Set(fan).size, 3, "as cartas da entrada são distintas");
      for (const src of fan) {
        assert.ok(clothesBySrc.has(src), `${src} é uma carta de roupa`);
        seen.add(src);
      }
      await page.waitForFunction(() => [...document.querySelectorAll(".ps-fan img")].every((image) => image.complete && image.naturalWidth > 0));
    }
    assert.ok(seen.size > 3, "as cartas da entrada continuam sorteadas a cada visita");
    // A entrada cabe na tela, com o botão à vista, e não rola para o lado.
    const button = await page.locator("#ps-action").boundingBox();
    assert.ok(button.y >= 0 && button.y + button.height <= 844 + 0.5, `o botão de começar aparece sem rolar (${Math.round(button.y + button.height)})`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "a entrada não rola para o lado");
    await openMenu(page);
    assert.equal(await menu(page).locator('a[aria-current="page"] span').innerText(), "Qual você usaria?");
    await page.keyboard.press("Escape");
    // Abrir e recarregar só leu a pesquisa: nenhuma gravação.
    assert.deepEqual([...new Set(server.requests.map(({ method, pathname, key }) => `${method} ${pathname} ${key}`))], [`GET /api/photo-surveys/${CLOTHES.id} `]);
    assert.equal(await storedKey(page), null);

    // A observação que vem do servidor entra como texto, nunca como marcação.
    const hostile = createServer();
    hostile.notes.set(CLOTHES.id, '<img src=x onerror="window.__nota=1"> Peças & cia');
    const escaped = await open(await newContext(hostile), surveyUrl(CLOTHES));
    await entryReady(escaped);
    assert.equal(await escaped.locator(".ps-note").innerText(), '<img src=x onerror="window.__nota=1"> Peças & cia');
    assert.equal(await escaped.locator(".ps-note *").count(), 0);
    assert.equal(await escaped.evaluate(() => window.__nota ?? null), null);
    // Sem observação válida na resposta do servidor, vale a da definição do app.
    for (const value of ["", 7, null]) {
      const plain = createServer();
      plain.notes.set(CLOTHES.id, value);
      const fallback = await open(await newContext(plain), surveyUrl(CLOTHES));
      await entryReady(fallback);
      assert.equal(await fallback.locator(".ps-note").innerText(), CLOTHES_NOTE, JSON.stringify(value));
    }
  });

  await scenario("o caminho inteiro da pesquisa de roupas: as 16 cartas, final, confirmação, resposta registrada e compartilhar", async () => {
    const server = createServer();
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    await context.addInitScript(SHARE_STUB, { mode: "file" });
    const page = await open(context, surveyUrl(CLOTHES));
    await entryReady(page);
    assert.equal(await page.locator(".ps-cta-note").innerText(), "Sua escolha só é registrada quando você confirmar.");
    await page.locator("#ps-action").click();
    await waitStep(page, "Tela 1 de 4");
    // As 16 peças entram no sorteio de toda pessoa, uma vez cada: só a ordem muda.
    const shown = server.draws.get(`${CLOTHES.id}:${GOOGLE_KEY}`);
    assert.deepEqual([...shown].sort(), [...CLOTHES.cardIds]);
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "ROUPAS · 16 CARTAS");
    assert.equal(await page.locator("#ps-title").innerText(), "Qual você usaria?");
    assert.equal(await page.locator(".ps-note").count(), 0, "a observação é da entrada, não das telas de voto");
    const picks = [];
    for (let screen = 0; screen < 4; screen += 1) {
      await waitStep(page, `Tela ${screen + 1} de 4`);
      await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
      const cards = await page.locator(".ps-grid button[data-card]").evaluateAll((buttons) => buttons.map((button) => ({
        id: button.dataset.card,
        label: button.getAttribute("aria-label"),
        src: button.querySelector("img").getAttribute("src"),
        loaded: button.querySelector("img").naturalWidth > 0,
      })));
      const group = shown.slice(screen * 4, screen * 4 + 4);
      assert.deepEqual(cards.map((card) => card.id), group, `tela ${screen + 1}: as cartas do sorteio, na ordem`);
      assert.deepEqual(cards.map((card) => card.label), group.map((id) => `Escolher ${clothesName.get(id)}`));
      assert.ok(cards.every((card) => card.loaded && clothesBySrc.get(card.src)?.id === card.id), `tela ${screen + 1}: cada carta mostra a própria peça`);
      await tapCard(page, screen);
      picks.push(group[screen]);
    }
    await waitStep(page, "Final");
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "AS SUAS QUATRO ESCOLHAS");
    assert.equal(await page.locator("#ps-title").innerText(), "Entre elas, qual fica?");
    await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
    assert.deepEqual(await page.locator(".ps-grid button[data-card]").evaluateAll((buttons) => buttons.map((button) => button.dataset.card)), picks);
    await tapCard(page, 1);
    await waitStep(page, "Confirmar");
    const chosen = clothesName.get(picks[1]);
    const others = picks.filter((id) => id !== picks[1]).map((id) => clothesName.get(id));
    assert.equal(await page.locator("#ps-title").innerText(), chosen);
    assert.deepEqual(await page.locator(".ps-row [role=img]").evaluateAll((cards) => cards.map((card) => card.getAttribute("aria-label"))), others);
    assert.equal(server.count("POST", "/response"), 0, "nada é gravado antes de confirmar");
    await page.locator('[data-action="confirm"]:not([disabled])').click();
    // A rodada 2 abre sozinha (ICM 76, #354), e o resultado mostra a peça escolhida em primeiro.
    await waitStep(page, "Rodada 2 · Tela 1 de 4");
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "ROUPAS · RODADA 2");
    await page.locator('[data-action="result"]').click();
    await resultShown(page);
    assert.equal(await page.locator("#ps-title").innerText(), chosen);
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "ROUPAS · SEU RESULTADO");
    assert.equal(await page.locator(".ps-hero img").getAttribute("src"), CLOTHES_CARDS.find((card) => card.id === picks[1]).src);
    assert.deepEqual(await page.locator(".ps-rank b").allInnerTexts(), CLOTHES.cardIds.filter((id) => picks.includes(id) && id !== picks[1]).map((id) => clothesName.get(id)), "as outras finalistas, empatadas, na ordem da pesquisa");
    assert.equal(server.last("/response").pathname, `/api/photo-surveys/${CLOTHES.id}/response`);
    const recorded = server.responseOf(GOOGLE_KEY, CLOTHES);
    assert.deepEqual([recorded.pickIds, recorded.championId], [picks, picks[1]]);
    assert.equal(server.responseOf(GOOGLE_KEY, SURVEY), null, "responder a de roupas não responde as de política");
    assert.equal(server.responseOf(GOOGLE_KEY, SECOND), null);
    assert.equal(await page.locator("[data-action=confirm], #ps-action").count(), 0, "do resultado não dá para mudar a resposta registrada");

    // Compartilhar: a imagem leva a peça em primeiro, as seguintes e a pergunta desta pesquisa.
    await shareReady(page);
    assert.equal((await page.evaluate(() => window.__drawn)).length, 4, "a primeira colocada e as três seguintes");
    const texts = await page.evaluate(() => window.__texts);
    assert.ok(texts.includes(chosen) && texts.includes("Qual você usaria?"), `a imagem leva o nome da peça e a pergunta (${texts.join(" | ")})`);
    assert.deepEqual(texts.filter((text) => /\p{L}/u.test(text) && text === text.toUpperCase()), ["MEU PRIMEIRO LUGAR", "DEPOIS DELA"]);
    await shareButton(page).click();
    await page.waitForFunction(() => window.__shared.length === 1);
    const [shared] = await page.evaluate(() => window.__shared);
    assert.deepEqual(shared.keys, ["files"]);
    assert.deepEqual([shared.files[0].type, shared.files[0].width, shared.files[0].height], ["image/jpeg", 1080, 1350]);

    // No feed, o cartão de roupas mostra a peça em primeiro e leva ao resultado.
    await Promise.all([page.waitForURL(appUrl), page.getByRole("link", { name: "Outras pesquisas" }).click()]);
    await feedReady(page);
    const card = page.locator(`.ps-feed-card[data-survey="${CLOTHES.id}"]`);
    assert.deepEqual((await feedCards(page)).find((entry) => entry.id === CLOTHES.id), { id: CLOTHES.id, go: "Ver meu resultado", first: chosen, tag: "Aberta" });
    assert.equal(await card.locator("img").getAttribute("src"), CLOTHES_CARDS.find((item) => item.id === picks[1]).src);
    assert.equal(await card.locator("img").evaluate((image) => image.complete && image.naturalWidth > 0), true, "a carta escolhida aparece");
    await card.click();
    await resultShown(page);
    assert.equal(await page.locator("#ps-title").innerText(), chosen);
  });

  await scenario("a entrada das pesquisas de política não tem observação e só ilustra com as cartas da lista da entrada", async () => {
    const entrySources = new Set(ARTS.filter((art) => ENTRY_CARD_IDS.includes(art.id)).map((art) => art.src));
    assert.equal(entrySources.size, ENTRY_CARD_IDS.length);
    // Na capa (que abre numa pesquisa de política) e no endereço de cada uma das duas.
    for (const [label, url, title] of [["capa", appUrl, "Quem você prefere?"], [SURVEY.id, surveyUrl(SURVEY), "Quem você prefere?"], [SECOND.id, surveyUrl(SECOND), "Em quem você confia mais?"]]) {
      const page = await open(await newContext(createServer()), url);
      for (let visit = 0; visit < 4; visit += 1) {
        if (visit > 0) await page.reload({ waitUntil: "domcontentloaded" });
        await entryReady(page);
        assert.equal(await page.locator("#ps-title").innerText(), title, label);
        assert.equal(await page.locator(".ps-kicker").first().innerText(), "POLÍTICA · 16 CARTAS", label);
        assert.equal(await page.locator(".ps-note").count(), 0, `${label}: pesquisa de política não tem observação`);
        const fan = await fanSources(page);
        assert.equal(fan.length, 3, label);
        for (const src of fan) {
          assert.ok(entrySources.has(src), `${label}: ${src} é uma carta da lista da entrada`);
          assert.ok(!clothesBySrc.has(src), `${label}: ${src} não é carta de roupa`);
          assert.ok(!celebrityBySrc.has(src), `${label}: ${src} não é carta de famosos`);
        }
      }
    }
  });

  // Pesquisa de famosos e créditos das fotos (ICM 74, #348) -------------------
  // A nota da pesquisa e, ao lado, o caminho para a página de créditos.
  const CELEBRITY_NOTE = "Fotos de licença livre. Ver os créditos";

  await scenario("a pesquisa de famosos abre no endereço dela, com a observação e três cartas de famosos", async () => {
    // O catálogo do app tem as cartas da pesquisa, nem mais nem menos.
    assert.deepEqual(CELEBRITY_CARDS.map((card) => card.id).sort(), [...CELEBRITIES.cardIds], "o catálogo tem as cartas da pesquisa");
    const server = createServer();
    const page = await open(await newContext(server), surveyUrl(CELEBRITIES));
    await entryReady(page);
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "FAMOSOS · 16 CARTAS");
    assert.equal(await page.locator("#ps-title").innerText(), "De quem você é mais fã?");
    assert.equal(await page.locator(".ps-hint").first().innerText(), "Leva menos de um minuto.");
    assert.equal(await page.locator(".ps-note").innerText(), CELEBRITY_NOTE);
    assert.equal(await page.locator(".ps-note a").getAttribute("href"), "./creditos.html");
    assert.equal(await page.locator(".ps-note").evaluate((node) => node.previousElementSibling?.className), "ps-hint");
    assert.equal(await page.locator(".ps-cta-note").innerText(), "Para responder, entre com Google e cadastre o CPF.");
    assert.equal(await page.locator(".ps-home").count(), 0, "na página da pesquisa não há as listas da capa");
    assert.equal(await page.getByRole("link", { name: "Todas as pesquisas" }).getAttribute("href"), "./");
    // O leque sai das cartas da própria pesquisa: três, distintas, sorteadas a
    // cada visita. A lista fixa da entrada é só das pesquisas de política.
    const politicsSources = new Set(ARTS.map((art) => art.src));
    const seen = new Set();
    for (let visit = 0; visit < 6; visit += 1) {
      if (visit > 0) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await entryReady(page);
      }
      const fan = await fanSources(page);
      assert.equal(fan.length, 3);
      assert.equal(new Set(fan).size, 3, "as cartas da entrada são distintas");
      for (const src of fan) {
        assert.ok(celebrityBySrc.has(src), `${src} é uma carta de famosos`);
        assert.ok(!politicsSources.has(src) && !clothesBySrc.has(src), `${src} não é carta de outra pesquisa`);
        seen.add(src);
      }
      await page.waitForFunction(() => [...document.querySelectorAll(".ps-fan img")].every((image) => image.complete && image.naturalWidth > 0));
    }
    assert.ok(seen.size > 3, "as cartas da entrada continuam sorteadas a cada visita");
    // A entrada cabe na tela, com o botão à vista, e não rola para o lado.
    const button = await page.locator("#ps-action").boundingBox();
    assert.ok(button.y >= 0 && button.y + button.height <= 844 + 0.5, `o botão de começar aparece sem rolar (${Math.round(button.y + button.height)})`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "a entrada não rola para o lado");
    await openMenu(page);
    assert.equal(await menu(page).locator('a[aria-current="page"] span').innerText(), "De quem você é mais fã?");
    assert.equal(await menu(page).locator('a[aria-current="page"]').count(), 1);
    await page.keyboard.press("Escape");
    // Abrir e recarregar só leu a pesquisa: nenhuma gravação.
    assert.deepEqual([...new Set(server.requests.map(({ method, pathname, key }) => `${method} ${pathname} ${key}`))], [`GET /api/photo-surveys/${CELEBRITIES.id} `]);
    assert.equal(await storedKey(page), null);

    // Em telas menores a entrada também não rola para o lado, e o botão fica à vista.
    for (const [width, height] of [[375, 667], [360, 640], [320, 568]]) {
      const small = await open(await newContext(createServer(), { width, height }), surveyUrl(CELEBRITIES));
      await entryReady(small);
      assert.equal(await small.locator(".ps-note").innerText(), CELEBRITY_NOTE);
      assert.equal(await small.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${width}×${height}: a entrada não rola para o lado`);
      const box = await small.locator("#ps-action").boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= height + 0.5, `${width}×${height}: o botão de começar aparece sem rolar (${Math.round(box.y + box.height)})`);
    }
  });

  await scenario("o caminho inteiro da pesquisa de famosos: 16 das 20 cartas, a final com \"quem fica?\", confirmação e resposta registrada", async () => {
    const server = createServer();
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    await context.addInitScript(SHARE_STUB, { mode: "file" });
    const page = await open(context, surveyUrl(CELEBRITIES));
    await entryReady(page);
    assert.equal(await page.locator(".ps-cta-note").innerText(), "Sua escolha só é registrada quando você confirmar.");
    await page.locator("#ps-action").click();
    await waitStep(page, "Tela 1 de 4");
    // Cada pessoa recebe 16 das 20 cartas, por sorteio, sem repetir.
    const shown = server.draws.get(`${CELEBRITIES.id}:${GOOGLE_KEY}`);
    assert.equal(shown.length, 16);
    assert.equal(new Set(shown).size, 16);
    assert.ok(shown.every((id) => CELEBRITIES.cardIds.includes(id)), "só cartas da pesquisa de famosos");
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "FAMOSOS · 16 CARTAS");
    assert.equal(await page.locator("#ps-title").innerText(), "De quem você é mais fã?");
    assert.equal(await page.locator(".ps-note").count(), 0, "a observação é da entrada, não das telas de voto");
    const picks = [];
    for (let screen = 0; screen < 4; screen += 1) {
      await waitStep(page, `Tela ${screen + 1} de 4`);
      await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
      const cards = await page.locator(".ps-grid button[data-card]").evaluateAll((buttons) => buttons.map((button) => ({
        id: button.dataset.card,
        label: button.getAttribute("aria-label"),
        src: button.querySelector("img").getAttribute("src"),
        loaded: button.querySelector("img").naturalWidth > 0,
      })));
      const group = shown.slice(screen * 4, screen * 4 + 4);
      assert.deepEqual(cards.map((card) => card.id), group, `tela ${screen + 1}: as cartas do sorteio, na ordem`);
      assert.deepEqual(cards.map((card) => card.label), group.map((id) => `Escolher ${celebrityName.get(id)}`));
      assert.ok(cards.every((card) => card.loaded && celebrityBySrc.get(card.src)?.id === card.id), `tela ${screen + 1}: cada carta mostra a própria pessoa`);
      await tapCard(page, (screen + 1) % 4);
      picks.push(group[(screen + 1) % 4]);
    }
    // As cartas são pessoas: a final pergunta "quem fica?", como na política.
    await waitStep(page, "Final");
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "AS SUAS QUATRO ESCOLHAS");
    assert.equal(await page.locator("#ps-title").innerText(), "Entre elas, quem fica?");
    await page.locator('.ps-grid[data-ready="true"]').waitFor({ timeout: 20000 });
    assert.deepEqual(await page.locator(".ps-grid button[data-card]").evaluateAll((buttons) => buttons.map((button) => button.dataset.card)), picks);
    await tapCard(page, 2);
    await waitStep(page, "Confirmar");
    const chosen = celebrityName.get(picks[2]);
    const others = picks.filter((id) => id !== picks[2]).map((id) => celebrityName.get(id));
    assert.equal(await page.locator("#ps-title").innerText(), chosen);
    assert.deepEqual(await page.locator(".ps-row [role=img]").evaluateAll((cards) => cards.map((card) => card.getAttribute("aria-label"))), others);
    assert.equal(server.count("POST", "/response"), 0, "nada é gravado antes de confirmar");
    await page.locator('[data-action="confirm"]:not([disabled])').click();
    // A rodada 2 abre sozinha (ICM 76, #354); o resultado mostra a pessoa escolhida em primeiro.
    await waitStep(page, "Rodada 2 · Tela 1 de 4");
    await page.locator('[data-action="result"]').click();
    await resultShown(page);
    assert.equal(await page.locator("#ps-title").innerText(), chosen);
    const chosenSrc = CELEBRITY_CARDS.find((card) => card.id === picks[2]).src;
    assert.equal(await page.locator(".ps-hero img").getAttribute("src"), chosenSrc);
    assert.equal(await page.locator(".ps-hero img").evaluate((image) => image.naturalWidth > 0), true, "a carta escolhida aparece");
    assert.deepEqual(await page.locator(".ps-rank b").allInnerTexts(), CELEBRITIES.cardIds.filter((id) => picks.includes(id) && id !== picks[2]).map((id) => celebrityName.get(id)));
    assert.equal(server.last("/response").pathname, `/api/photo-surveys/${CELEBRITIES.id}/response`);
    const recorded = server.responseOf(GOOGLE_KEY, CELEBRITIES);
    assert.deepEqual([recorded.pickIds, recorded.championId], [picks, picks[2]]);
    for (const other of [SURVEY, SECOND, CLOTHES]) assert.equal(server.responseOf(GOOGLE_KEY, other), null, `responder a de famosos não responde ${other.id}`);
    assert.equal(await page.locator("[data-action=confirm], #ps-action").count(), 0, "do resultado não dá para mudar a resposta registrada");

    // Compartilhar: a imagem leva a pessoa em primeiro, as seguintes e a pergunta desta pesquisa.
    await shareReady(page);
    assert.equal((await page.evaluate(() => window.__drawn)).length, 4, "a primeira colocada e as três seguintes");
    const texts = await page.evaluate(() => window.__texts);
    assert.ok(texts.includes(chosen) && texts.includes("De quem você é mais fã?"), `a imagem leva o nome e a pergunta (${texts.join(" | ")})`);
    await shareButton(page).click();
    await page.waitForFunction(() => window.__shared.length === 1);
    const [shared] = await page.evaluate(() => window.__shared);
    assert.deepEqual(shared.keys, ["files"]);
    assert.deepEqual([shared.files[0].type, shared.files[0].width, shared.files[0].height], ["image/jpeg", 1080, 1350]);

    // No feed, o cartão de famosos mostra a pessoa em primeiro, e os outros continuam em "Começar".
    await Promise.all([page.waitForURL(appUrl), page.getByRole("link", { name: "Outras pesquisas" }).click()]);
    await feedReady(page);
    assert.deepEqual((await feedCards(page)).map(({ id, go, first }) => [id, go, first]), [
      [SURVEY.id, "Começar", ""],
      [SECOND.id, "Começar", ""],
      [CELEBRITIES.id, "Ver meu resultado", chosen],
      [CLOTHES.id, "Começar", ""],
    ]);
    const card = page.locator(`.ps-feed-card[data-survey="${CELEBRITIES.id}"]`);
    assert.equal(await card.locator("img").getAttribute("src"), chosenSrc);
    await card.click();
    await resultShown(page);
    assert.equal(await page.locator("#ps-title").innerText(), chosen);
  });

  await scenario("\"Créditos das fotos\" lista uma linha por carta do catálogo, cabe na largura, e o menu marca a página", async () => {
    for (const [width, height] of [[390, 844], [320, 568]]) {
      const size = `${width}×${height}`;
      const server = createServer();
      const page = await open(await newContext(server, { width, height }), CREDITS_URL);
      await page.locator("h1").waitFor();
      assert.equal(await page.locator("h1").innerText(), "Créditos das fotos");
      assert.equal(await page.title(), "Créditos das fotos — PoliMatch");
      assert.equal(await page.locator(".ps-shell").getAttribute("data-view"), "credits");
      assert.equal(await page.locator('meta[name="robots"]').count(), 0, "a página não tem noindex");
      // Uma linha por carta do catálogo: o nome e, abaixo, o crédito da foto com os links.
      const rows = await page.locator(".ps-credits li").evaluateAll((items) => items.map((item) => {
        const name = item.querySelector("b");
        const credit = item.querySelector("span");
        const box = item.getBoundingClientRect();
        return {
          name: name?.textContent ?? "",
          credit: credit?.textContent ?? "",
          nameWeight: Number(getComputedStyle(name).fontWeight),
          nameSize: parseFloat(getComputedStyle(name).fontSize),
          creditSize: parseFloat(getComputedStyle(credit).fontSize),
          creditBelow: credit.getBoundingClientRect().top >= name.getBoundingClientRect().bottom - 1,
          left: box.left,
          right: box.right,
          links: [...item.querySelectorAll("a")].map((link) => {
            const rect = link.getBoundingClientRect();
            return {
              text: link.textContent.trim(),
              href: link.getAttribute("href"),
              underline: getComputedStyle(link).textDecorationLine.includes("underline"),
              height: Math.min(...[...link.getClientRects()].map((line) => line.height)),
              left: rect.left,
              right: rect.right,
            };
          }),
        };
      }));
      assert.equal(rows.length, CELEBRITY_CARDS.length, `${size}: uma linha por carta do catálogo`);
      assert.deepEqual(rows.map((row) => row.name).sort(), CELEBRITY_CARDS.map((card) => card.name).sort(), `${size}: os nomes das cartas`);
      for (const row of rows) {
        assert.ok(row.nameWeight >= 600, `${size}: ${row.name} em negrito`);
        assert.ok(row.creditSize < row.nameSize && row.creditBelow, `${size}: ${row.name}: o crédito vem abaixo do nome, menor`);
        assert.match(row.credit, /^Foto de .+, licença .+\.$/, `${size}: ${row.name}: a linha do crédito`);
        assert.ok(row.left >= 0 && row.right <= width + 0.5, `${size}: ${row.name} cabe na largura`);
        assert.ok(row.links.length >= 1, `${size}: ${row.name} tem link`);
        for (const link of row.links) {
          assert.match(String(link.href), /^https:\/\/\S+$/, `${size}: ${row.name}: o link "${link.text}" leva a um endereço de verdade`);
          assert.ok(link.text.length > 0 && link.underline, `${size}: ${row.name}: o link "${link.text}" é sublinhado`);
          assert.ok(link.height >= 28, `${size}: ${row.name}: o link "${link.text}" tem ${Math.round(link.height)} px de altura para o toque`);
          assert.ok(link.left >= 0 && link.right <= width + 0.5, `${size}: ${row.name}: o link "${link.text}" cabe na largura`);
        }
      }
      assert.ok(await page.locator(".pm-note").count() >= 1, `${size}: a página explica de onde vêm as fotos`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${size}: a página não rola para o lado`);
      // O botão acompanha o texto, em vez de ficar por cima da lista.
      const action = page.locator(".ps-stack a.ps-btn");
      assert.equal(await page.locator(".ps-stack").evaluate((node) => getComputedStyle(node).position), "static");
      assert.equal(new URL(await action.getAttribute("href"), CREDITS_URL).href, appUrl);
      const [listBox, actionBox] = [await page.locator(".ps-credits").boundingBox(), await action.boundingBox()];
      assert.ok(actionBox.y >= listBox.y + listBox.height, `${size}: o botão fica depois da lista`);
      // O menu marca a página, e ela não fala com a API.
      await openMenu(page);
      assert.equal(await menu(page).locator('a[aria-current="page"] span').innerText(), "Créditos das fotos");
      assert.equal(await menu(page).locator('a[aria-current="page"]').getAttribute("href"), "./creditos.html");
      assert.equal(await menu(page).locator('a[aria-current="page"]').count(), 1);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector("dialog.pm-menu").open);
      await page.waitForTimeout(300);
      assert.deepEqual(server.requests, [], "a página não fala com a API");
      await Promise.all([page.waitForURL(appUrl), action.click()]);
      await entryReady(page);
    }

    // O menu da capa leva à página, logo depois de "Como funciona".
    const home = await open(await newContext(createServer()));
    await entryReady(home);
    await openMenu(home);
    const link = menu(home).locator('a[href="./creditos.html"]');
    assert.equal(await link.locator("span").innerText(), "Créditos das fotos");
    assert.equal(await link.evaluate((node) => node.previousElementSibling?.getAttribute("href")), "./como-funciona.html");
    await Promise.all([home.waitForURL(CREDITS_URL), link.click()]);
    await home.locator("h1", { hasText: "Créditos das fotos" }).waitFor();
    // E "Como funciona" continua marcando só a própria página.
    const how = await open(await newContext(createServer()), HOW_URL);
    await how.locator("h1").waitFor();
    await openMenu(how);
    assert.deepEqual(await menu(how).locator('a[aria-current="page"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))), ["./como-funciona.html"]);
  });

  await scenario("sem nenhuma lista para mostrar, a capa não deixa bloco vazio", async () => {
    // Um servidor que só conhece a primeira pesquisa: não há "Mais pesquisas",
    // não há escolha e não há anúncio. A área das listas fica vazia e some.
    const server = createServer();
    for (const survey of PHOTO_SURVEYS.slice(1)) server.unknown.add(survey.id);
    const page = await open(await newContext(server));
    await entryReady(page);
    assert.equal(await page.locator("#ps-title").innerText(), "Quem você prefere?");
    assert.deepEqual(
      await page.locator(".ps-home").evaluate((node) => ({ nodes: node.childNodes.length, display: getComputedStyle(node).display, height: node.getBoundingClientRect().height })),
      { nodes: 0, display: "none", height: 0 },
    );
    assert.doesNotMatch(await page.locator(".ps-main").innerText(), /Em breve|Mais pesquisas|Suas escolhas/);
    // Depois do botão e do texto dele nada ocupa espaço, e a capa não rola.
    const after = await page.evaluate(() => {
      const rest = [];
      for (let node = document.querySelector(".ps-cta").nextElementSibling; node; node = node.nextElementSibling) rest.push(node.getBoundingClientRect().height);
      return rest;
    });
    assert.deepEqual(after, [0], "depois do botão só há a área das listas, sem altura");
    assert.equal(await fits(page), true, "a capa cabe na tela sem rolar");

    // Quem respondeu a única pesquisa que o servidor conhece vê o feed com um
    // cartão só, sem bloco vazio embaixo. Um servidor que só conhece a primeira
    // pesquisa é de antes das rodadas.
    const done = createServer();
    done.legacy = true;
    for (const survey of PHOTO_SURVEYS.slice(1)) done.unknown.add(survey.id);
    done.answered(GOOGLE_KEY);
    const storedProgress = savedProgressText("", SURVEY.id, { identity: identityTag(GOOGLE_KEY), answered: true });
    const mine = await open(await newContext(done, { storedKey: GOOGLE_KEY, storedProgress }));
    await feedReady(mine);
    assert.deepEqual((await feedCards(mine)).map(({ id, go }) => [id, go]), [[SURVEY.id, "Ver meu resultado"]]);
    assert.deepEqual(
      await mine.locator(".ps-home").evaluate((node) => ({ nodes: node.childNodes.length, display: getComputedStyle(node).display })),
      { nodes: 0, display: "none" },
    );
  });

  // Feed com rodadas (ICM 75 e 76) --------------------------------------------
  const allAnswered = () => PHOTO_SURVEYS.reduce((text, survey) => savedProgressText(text, survey.id, { identity: identityTag(GOOGLE_KEY), answered: true }), "");
  const drawBodies = (server, from = 0) => server.requests.slice(from).filter((request) => request.method === "POST" && request.pathname.endsWith("/draw")).map((request) => request.body);
  const allRounds = (server) => PHOTO_SURVEYS.map((survey) => server.roundsOf(GOOGLE_KEY, survey).length);
  const nameOfCard = new Map([...ARTS, ...CELEBRITY_CARDS, ...CLOTHES_CARDS].map((art) => [art.id, art.name]));

  await scenario("a capa não emite sorteio: o feed mostra a primeira colocada de cada pesquisa, e o cartão leva ao resultado", async () => {
    const server = createServer();
    // A conta respondeu as quatro pesquisas; da primeira, jogou duas rodadas e
    // tem uma terceira emitida e não tocada.
    for (const survey of PHOTO_SURVEYS) server.answered(GOOGLE_KEY, survey);
    server.playRound(GOOGLE_KEY, SURVEY);
    server.playRound(GOOGLE_KEY, SURVEY, { open: true });
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY, storedProgress: allAnswered() }));
    await feedReady(page);
    const firsts = PHOTO_SURVEYS.map((survey) => nameOfCard.get(server.profileView(GOOGLE_KEY).firstPlaces.find((entry) => entry.surveyId === survey.id).cardId));
    assert.deepEqual(await feedCards(page), PHOTO_SURVEYS.map((survey, index) => ({ id: survey.id, go: "Ver meu resultado", first: firsts[index], tag: "Aberta" })));
    assert.deepEqual(drawBodies(server), [], "a capa não pede sorteio nenhum");
    assert.deepEqual(server.writes(), []);
    assert.deepEqual(allRounds(server), [3, 1, 1, 1]);
    // O cartão abre o resultado: a rodada emitida e não tocada não vira voto sem toque.
    await page.locator(`.ps-feed-card[data-survey="${SURVEY.id}"]`).click();
    await resultShown(page);
    assert.equal(await page.locator("#ps-title").innerText(), firsts[0]);
    assert.match(await page.locator(".ps-hint").first().innerText(), /2 rodadas respondidas\./);
    assert.deepEqual(drawBodies(server), [{}]);
    // "Continuar votando" abre a rodada 3 que já existia, sem emitir outra.
    const third = server.roundsOf(GOOGLE_KEY, SURVEY)[2].shownIds;
    await page.locator('[data-action="continue"]').click();
    await waitStep(page, "Rodada 3 · Tela 1 de 4");
    await page.locator('.ps-grid[data-ready="true"]').waitFor();
    assert.deepEqual(await page.locator(".ps-grid button[data-card]").evaluateAll((cards) => cards.map((card) => card.dataset.card)), third.slice(0, 4));
    assert.deepEqual(allRounds(server), [3, 1, 1, 1]);
    assert.equal(server.count("POST", "/response"), 0);
  });

  await scenario("servidor de antes das rodadas: o feed e a resposta registrada ficam como eram", async () => {
    const server = createServer();
    server.legacy = true;
    for (const survey of PHOTO_SURVEYS) server.answered(GOOGLE_KEY, survey);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY, storedProgress: allAnswered() }));
    await feedReady(page);
    assert.deepEqual((await feedCards(page)).map(({ go }) => go), PHOTO_SURVEYS.map(() => "Ver meu resultado"));
    // A resposta registrada: os dois botões e o texto de antes das rodadas.
    await page.locator(".ps-feed-card").first().click();
    await waitStep(page, "Registrada");
    assert.equal(await page.locator(".ps-kicker").first().innerText(), "ESCOLHA REGISTRADA");
    assert.equal(await page.locator(".ps-hint").first().innerText(), "Obrigado por participar. Sua resposta está registrada e não pode ser trocada nesta pesquisa.");
    assert.equal(await page.locator('[data-action="next-round"], [data-action="continue"], [data-action="result"], #ps-seen, .ps-pair').count(), 0);
    assert.deepEqual(await page.locator(".ps-stack--pair .ps-btn").allInnerTexts(), ["Compartilhar", "Ver pesquisas"]);
    assert.equal(await page.locator('[data-action="share"]').evaluate((button) => button.classList.contains("ps-btn--ghost")), false, "sem outra rodada, compartilhar é o botão principal");
    assert.ok(drawBodies(server).every((body) => JSON.stringify(body) === "{}"), "nenhum pedido leva campo novo");
    assert.equal(server.count("GET", "/result"), 0);
  });

  // Meu perfil e perfil público (ICM 76, #354) --------------------------------
  const MY_PROFILE_URL = new URL("meu-perfil.html", appUrl).href;
  const profileUrl = (handle) => new URL(`perfil.html?u=${encodeURIComponent(handle)}`, appUrl).href;
  const profileWrites = (server) => server.requests.filter((request) => request.pathname === "/api/me/profile" && request.method === "PUT").map((request) => request.body);
  const marks = (page) => page.locator('input[name="survey"]').evaluateAll((inputs) => inputs.filter((input) => input.checked).map((input) => input.value));
  const profileTitle = (page) => page.locator("#ps-title").innerText();
  const profileNotice = (page) => page.locator("#pf-notice:not([hidden])");
  async function publicProfile(server, handle, size = {}) {
    const page = await open(await newContext(server, size), profileUrl(handle));
    await page.waitForFunction(() => !/Carregando/.test(document.querySelector("#ps-title")?.textContent || ""), null, { timeout: 15000 });
    return page;
  }

  await scenario("Meu perfil: nasce desligado; ligar pede nome válido e livre e o aceite; o perfil público mostra só as pesquisas marcadas e respondidas; desligar some na hora", async () => {
    const server = createServer();
    server.answered(GOOGLE_KEY, SURVEY);
    server.answered(GOOGLE_KEY, CELEBRITIES);
    const context = await newContext(server, { storedKey: GOOGLE_KEY });
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, "clipboard", { configurable: true, get: () => ({ writeText: async (text) => { window.__copied = text; } }) });
    });
    const page = await open(context, MY_PROFILE_URL);
    await page.locator("#pf-form").waitFor();
    assert.equal(await profileTitle(page), "Seu perfil está desligado");
    assert.equal(await page.title(), "Meu perfil — PoliMatch");
    assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex");
    assert.deepEqual(server.writes(), [], "abrir Meu perfil não grava nada");
    // Nenhuma pesquisa marcada; o aceite por extenso; a primeira colocada de quem respondeu.
    assert.equal(await page.locator('input[name="survey"]').count(), PHOTO_SURVEYS.length);
    assert.deepEqual(await marks(page), []);
    assert.equal(await page.locator(".ps-check span").innerText(), PROFILE_CONSENT_TEXT);
    assert.equal(await page.locator("#pf-consent").isChecked(), false);
    const firstPolitics = nameOfCard.get(server.profileView(GOOGLE_KEY).firstPlaces.find((entry) => entry.surveyId === SURVEY.id).cardId);
    assert.match(await page.locator(".ps-mark").first().innerText(), new RegExp(`Seu 1º lugar: ${firstPolitics}`));
    assert.match(await page.locator(".ps-mark").nth(1).innerText(), /Você ainda não respondeu/);
    await openMenu(page);
    assert.equal(await menu(page).locator('a[aria-current="page"] span').innerText(), "Meu perfil");
    await page.keyboard.press("Escape");

    // Sem aceite: nada vai ao servidor.
    await page.locator("#pf-handle").fill("Bia_Teste");
    await page.locator(`input[name="survey"][value="${SURVEY.id}"]`).check();
    await page.locator(`input[name="survey"][value="${SECOND.id}"]`).check();
    await page.getByRole("button", { name: "Ligar meu perfil" }).click();
    await profileNotice(page).waitFor();
    assert.equal(await profileNotice(page).innerText(), "Para ligar o perfil, marque o aceite.");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "pf-consent");
    assert.deepEqual(profileWrites(server), [], "sem aceite, nada é gravado");
    // Nome que não vale: nada vai ao servidor.
    await page.locator("#pf-consent").check();
    await page.locator("#pf-handle").fill("ab");
    await page.getByRole("button", { name: "Ligar meu perfil" }).click();
    await page.locator("#pf-notice:not([hidden])", { hasText: "nome de perfil com 3 a 20" }).waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "pf-handle");
    assert.deepEqual(profileWrites(server), []);
    // Nome em uso por outra conta: o aviso, e as marcações continuam.
    server.profiles.set(`pms_${"o".repeat(43)}`, { handle: "bia_teste", enabled: true, consentVersion: PROFILE_CONSENT_VERSION, consentedAt: new Date().toISOString(), surveys: [] });
    await page.locator("#pf-handle").fill("Bia_Teste");
    await page.getByRole("button", { name: "Ligar meu perfil" }).click();
    await page.locator("#pf-notice:not([hidden])", { hasText: "já está em uso" }).waitFor();
    assert.equal(await profileNotice(page).innerText(), "Esse nome de perfil já está em uso. Escolha outro.");
    assert.equal(await page.evaluate(() => document.activeElement?.id), "pf-handle");
    assert.deepEqual(await marks(page), [SURVEY.id, SECOND.id]);
    assert.equal(await page.locator("#pf-consent").isChecked(), true);
    // Nome livre: liga.
    await page.locator("#pf-handle").fill("bia_ok");
    await page.getByRole("button", { name: "Ligar meu perfil" }).click();
    await page.locator("#ps-title", { hasText: "Seu perfil está ligado" }).waitFor();
    assert.deepEqual(profileWrites(server).at(-1), { enabled: true, handle: "bia_ok", surveys: [SURVEY.id, SECOND.id], consentVersion: PROFILE_CONSENT_VERSION });
    assert.equal(await page.locator("#pf-done").innerText(), "Perfil ligado.");
    assert.equal(await page.locator("#pf-link").innerText(), "https://polimatch.com.br/perfil.html?u=bia_ok");
    await page.getByRole("button", { name: "Copiar link" }).click();
    await page.locator("#pf-copied", { hasText: "Link copiado." }).waitFor();
    assert.equal(await page.evaluate(() => window.__copied), "https://polimatch.com.br/perfil.html?u=bia_ok");
    assert.equal(await page.getByRole("link", { name: "Ver como os outros veem" }).getAttribute("href"), "./perfil.html?u=bia_ok");

    // O perfil público, sem conta: a pesquisa marcada e respondida; a marcada
    // sem resposta e a respondida sem marca não aparecem.
    const visitorServer = server;
    const before = visitorServer.requests.length;
    const visitor = await publicProfile(visitorServer, "Bia_OK");
    assert.equal(await profileTitle(visitor), "bia_ok");
    assert.equal(await visitor.locator('meta[name="robots"]').getAttribute("content"), "noindex");
    assert.deepEqual(await visitor.locator(".ps-profile-grid small").allInnerTexts(), ["Política"]);
    assert.equal(await visitor.locator(".ps-profile-grid [role=img]").getAttribute("aria-label"), firstPolitics);
    const lookup = visitorServer.requests.slice(before).find((request) => request.pathname.startsWith("/api/profiles/"));
    assert.equal(lookup.pathname, "/api/profiles/bia_ok");
    assert.equal(lookup.key, "", "o perfil público não leva sessão");
    assert.equal(await visitor.getByRole("link", { name: "Responder as pesquisas" }).getAttribute("href"), "./");
    assert.doesNotMatch(await visitor.locator("main").innerText(), /Bia|@|CPF|Google/, "nada além do nome de perfil e das cartas");

    // Mudar as marcações: tira a de política e põe a de famosos.
    await page.locator(`input[name="survey"][value="${SURVEY.id}"]`).uncheck();
    await page.locator(`input[name="survey"][value="${CELEBRITIES.id}"]`).check();
    await page.getByRole("button", { name: "Salvar marcações" }).click();
    await page.locator("#pf-done", { hasText: "Marcações salvas." }).waitFor();
    assert.deepEqual(profileWrites(server).at(-1), { enabled: true, handle: "bia_ok", surveys: [SECOND.id, CELEBRITIES.id], consentVersion: PROFILE_CONSENT_VERSION });
    await visitor.reload({ waitUntil: "domcontentloaded" });
    await visitor.locator(".ps-profile-grid").waitFor();
    assert.deepEqual(await visitor.locator(".ps-profile-grid small").allInnerTexts(), ["Famosos"]);

    // Desligar: some na hora, com a mesma mensagem de um nome que não existe.
    await page.getByRole("button", { name: "Desligar" }).click();
    await page.locator("#ps-title", { hasText: "Seu perfil está desligado" }).waitFor();
    assert.deepEqual(profileWrites(server).at(-1), { enabled: false });
    assert.match(await page.locator("#pf-done").innerText(), /Perfil desligado/);
    assert.deepEqual(await marks(page), [SECOND.id, CELEBRITIES.id], "as marcações ficam guardadas");
    await visitor.reload({ waitUntil: "domcontentloaded" });
    await visitor.locator("#ps-title", { hasText: "Perfil não encontrado." }).waitFor();
    assert.equal(await visitor.locator(".ps-profile-grid").count(), 0);
    const nobody = await publicProfile(server, "ninguem_aqui");
    assert.equal(await profileTitle(nobody), "Perfil não encontrado.");
    assert.equal(await nobody.locator(".ps-hint").innerText(), await visitor.locator(".ps-hint").innerText(), "desligado e inexistente têm a mesma mensagem");
    // Nome que não vale nem é pedido ao servidor.
    const requests = server.requests.length;
    const reserved = await publicProfile(server, "admin");
    assert.equal(await profileTitle(reserved), "Perfil não encontrado.");
    assert.equal(server.requests.slice(requests).filter((request) => request.pathname.startsWith("/api/profiles/")).length, 0);
  });

  await scenario("Meu perfil sem cadastro leva ao cadastro; sem conta, pede para entrar, e o menu não mostra o perfil", async () => {
    const server = createServer();
    server.registered.delete(GOOGLE_KEY);
    const page = await open(await newContext(server, { storedKey: GOOGLE_KEY }), MY_PROFILE_URL);
    await page.locator("#ps-title", { hasText: "Seu perfil está desligado" }).waitFor();
    assert.match(await page.locator(".ps-hint").first().innerText(), /falta o cadastro com CPF/);
    assert.equal(await page.getByRole("link", { name: "Fazer o cadastro" }).getAttribute("href"), `./?p=${SURVEY.id}`);
    assert.equal(await page.locator("#pf-form").count(), 0);

    // O cadastro sumiu depois de a página abrir: o servidor recusa, e a tela leva ao cadastro.
    const lost = createServer();
    const other = await open(await newContext(lost, { storedKey: GOOGLE_KEY }), MY_PROFILE_URL);
    await other.locator("#pf-form").waitFor();
    lost.registered.delete(GOOGLE_KEY);
    await other.locator("#pf-handle").fill("sem_cadastro");
    await other.locator("#pf-consent").check();
    await other.getByRole("button", { name: "Ligar meu perfil" }).click();
    await other.getByRole("link", { name: "Fazer o cadastro" }).waitFor();
    assert.equal(await other.locator("#pf-notice").innerText(), "Para ligar o perfil, falta o cadastro com CPF.");
    assert.equal(lost.profiles.size, 0);

    // Sem conta: a página pede para entrar, e o menu não tem "Meu perfil".
    const visitor = await open(await newContext(createServer()), MY_PROFILE_URL);
    await visitor.locator("#ps-title", { hasText: "Meu perfil" }).waitFor();
    await visitor.locator(".ps-hint", { hasText: "Entre com Google pelo menu" }).waitFor();
    await visitor.locator('main [data-action="menu"]').click();
    await visitor.locator("dialog.pm-menu[open]").waitFor();
    assert.equal(await menu(visitor).locator('a[href="./meu-perfil.html"]').count(), 0);
    // Entrar pelo menu carrega o perfil.
    await visitor.locator("dialog.pm-menu[open] #e2e-google").click();
    await visitor.locator("#pf-form").waitFor();
    assert.equal(await menu(visitor).locator('a[href="./meu-perfil.html"]').count(), 1);
  });

  await scenario("Meu perfil e o perfil público cabem na largura em 390, 360 e 320 px", async () => {
    for (const [width, height] of [[390, 844], [360, 640], [320, 568]]) {
      const server = createServer();
      for (const survey of PHOTO_SURVEYS) server.answered(GOOGLE_KEY, survey);
      server.profiles.set(GOOGLE_KEY, { handle: "perfil_largo_de_vint", enabled: false, consentVersion: "", consentedAt: null, surveys: [] });
      const page = await open(await newContext(server, { storedKey: GOOGLE_KEY, width, height }), MY_PROFILE_URL);
      await page.locator("#pf-form").waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${width}×${height}: Meu perfil rola para o lado`);
      const button = page.getByRole("button", { name: "Ligar meu perfil" });
      await button.scrollIntoViewIfNeeded();
      const box = await button.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width + 0.5 && box.height >= 44, `${width}×${height}: o botão de ligar`);
      server.profiles.set(GOOGLE_KEY, { handle: "perfil_largo_de_vint", enabled: true, consentVersion: PROFILE_CONSENT_VERSION, consentedAt: new Date().toISOString(), surveys: PHOTO_SURVEYS.map((survey) => survey.id) });
      const visitor = await publicProfile(server, "perfil_largo_de_vint", { width, height });
      assert.equal(await visitor.locator(".ps-profile-grid li").count(), PHOTO_SURVEYS.length);
      assert.equal(await visitor.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${width}×${height}: o perfil público rola para o lado`);
    }
  });

  assert.deepEqual(pageErrors, [], `erros de página: ${pageErrors.join(" | ")}`);
  if (only && results.length === 0) throw new Error(`POLIMATCH_E2E_ONLY="${only}" não casa com nenhum cenário.`);
  console.log(JSON.stringify({ suite: "site-shell", browser: browserName, scenarios: results.length }));
} finally {
  await Promise.all(contexts.map((context) => context.close().catch(() => {})));
  await browser.close();
}
