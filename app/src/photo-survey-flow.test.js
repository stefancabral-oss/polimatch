import assert from "node:assert/strict";
import test from "node:test";
import CLOTHES from "./clothes-cards.json" with { type: "json" };
import ARTS from "./political-chromas.json" with { type: "json" };
import { PHOTO_SURVEYS, photoSurveyById } from "../../shared/photo-survey.js";
import {
  ENTRY_CARD_IDS,
  NO_ROUNDS,
  PHOTO_SURVEY_STORAGE_KEY,
  afterConfirm,
  answeredElsewhere,
  answeredSurveyIds,
  chooseChampion,
  coverFeature,
  entryCardIdsFor,
  featuredSurveyId,
  finalTitleFor,
  freshProgress,
  goBack,
  identityTag,
  inProgressSurveyId,
  inProgressSurveyIds,
  nextRoundNumber,
  nextSurveyId,
  pickCard,
  progressView,
  readSavedProgress,
  registeredCopy,
  responseBody,
  restoreProgress,
  resultOnOpen,
  resultSummary,
  roundState,
  sameGroups,
  sampleCards,
  savedProgressText,
  surveyIdFromSearch,
} from "./photo-survey-flow.js";

const PHOTO_SURVEY_ID = "politica-2026-01";
const SECOND_SURVEY_ID = "politica-2026-02";
const CELEBRITY_SURVEY_ID = "famosos-01";
const CLOTHES_SURVEY_ID = "roupas-demo-01";

const GROUPS = [
  ["a1", "a2", "a3", "a4"],
  ["b1", "b2", "b3", "b4"],
  ["c1", "c2", "c3", "c4"],
  ["d1", "d2", "d3", "d4"],
];
const UUID = "5f0c2c0e-8a55-4a52-9d6c-0d2b8a1f3c11";
const uuid = () => UUID;
const fresh = () => freshProgress(GROUPS, uuid);
const play = (progress, ...cardIds) => cardIds.reduce((current, id) => pickCard(current, id), progress);
const atFinal = () => play(fresh(), "a1", "b2", "c3", "d4");

test("as cartas da entrada são uma lista fixa, dentro da pesquisa e com arte", () => {
  const survey = photoSurveyById(PHOTO_SURVEY_ID);
  assert.ok(Object.isFrozen(ENTRY_CARD_IDS));
  assert.ok(ENTRY_CARD_IDS.length > 3, "sobra carta para o sorteio variar");
  assert.equal(new Set(ENTRY_CARD_IDS).size, ENTRY_CARD_IDS.length, "sem carta repetida");
  for (const id of ENTRY_CARD_IDS) {
    assert.ok(survey.cardIds.includes(id), `${id} está na pesquisa`);
    assert.ok(ARTS.some((art) => art.id === id), `${id} tem arte`);
  }
});

test("as pesquisas de política ilustram a entrada só com a lista fixa; a de outro assunto, com as próprias cartas", () => {
  for (const id of [PHOTO_SURVEY_ID, SECOND_SURVEY_ID]) {
    assert.equal(entryCardIdsFor(photoSurveyById(id)), ENTRY_CARD_IDS, id);
  }
  // Política com outro conjunto de cartas continua na lista: mudar isso é rever a lista.
  assert.equal(entryCardIdsFor({ subject: "Política", cardIds: ["x", "y", "z"] }), ENTRY_CARD_IDS);

  const clothes = photoSurveyById(CLOTHES_SURVEY_ID);
  const entry = entryCardIdsFor(clothes);
  assert.deepEqual(entry, clothes.cardIds);
  assert.ok(entry.length > 3, "sobra carta para o sorteio variar");
  for (const id of entry) {
    assert.ok(!ENTRY_CARD_IDS.includes(id), `${id} não é da lista de política`);
    assert.ok(CLOTHES.some((art) => art.id === id), `${id} tem arte`);
    assert.ok(!ARTS.some((art) => art.id === id), `${id} não é carta de política`);
  }
  // Devolve uma cópia: quem recebe não altera a definição.
  assert.notEqual(entry, clothes.cardIds);
  assert.deepEqual(entryCardIdsFor({ subject: "Outro assunto", cardIds: ["x", "y", "z", "w"] }), ["x", "y", "z", "w"]);
  assert.deepEqual(entryCardIdsFor({ subject: "Outro assunto" }), []);
  assert.deepEqual(entryCardIdsFor(null), []);
});

test("a pesquisa de famosos ilustra a entrada com as próprias cartas, não com a lista de política", () => {
  const celebrities = photoSurveyById(CELEBRITY_SURVEY_ID);
  const entry = entryCardIdsFor(celebrities);
  // A lista fixa vale pelo assunto "Política", não por as cartas serem pessoas.
  assert.equal(celebrities.people, true);
  assert.notEqual(entry, ENTRY_CARD_IDS);
  assert.deepEqual(entry, celebrities.cardIds);
  assert.notEqual(entry, celebrities.cardIds, "devolve uma cópia");
  assert.ok(entry.length > 3, "sobra carta para o sorteio variar");
  for (const id of entry) {
    assert.ok(!ENTRY_CARD_IDS.includes(id), `${id} não é da lista de política`);
    assert.ok(!ARTS.some((art) => art.id === id), `${id} não é carta de política`);
    assert.ok(!CLOTHES.some((art) => art.id === id), `${id} não é carta de roupa`);
  }
  assert.deepEqual(entryCardIdsFor({ subject: "Famosos", people: true, cardIds: ["x", "y", "z", "w"] }), ["x", "y", "z", "w"]);
});

test("a final pergunta \"quem fica\" quando as cartas são pessoas e \"qual fica\" nas outras", () => {
  // Os três tipos de pesquisa: política e famosos, com pessoas; roupas, com peças.
  for (const id of [PHOTO_SURVEY_ID, SECOND_SURVEY_ID, CELEBRITY_SURVEY_ID]) {
    assert.equal(finalTitleFor(photoSurveyById(id)), "Entre elas, quem fica?", id);
  }
  assert.equal(finalTitleFor(photoSurveyById(CLOTHES_SURVEY_ID)), "Entre elas, qual fica?");
  for (const survey of PHOTO_SURVEYS) {
    assert.equal(finalTitleFor(survey), survey.people ? "Entre elas, quem fica?" : "Entre elas, qual fica?", survey.id);
  }
  // Quem decide é `people`, não o assunto.
  assert.equal(finalTitleFor({ subject: "Outro assunto", people: true }), "Entre elas, quem fica?");
  assert.equal(finalTitleFor({ subject: "Política", people: false }), "Entre elas, qual fica?");
  assert.equal(finalTitleFor({ subject: "Política" }), "Entre elas, qual fica?", "sem `people`, as cartas não são pessoas");
  assert.equal(finalTitleFor({ subject: "Outro assunto" }), "Entre elas, qual fica?");
  // Só o valor verdadeiro conta: um texto não vira "pessoas" por engano.
  for (const value of ["true", 1, "sim", {}]) assert.equal(finalTitleFor({ people: value }), "Entre elas, qual fica?", JSON.stringify(value));
  for (const empty of [null, undefined, {}]) assert.equal(finalTitleFor(empty), "Entre elas, qual fica?");
});

test("a chave de armazenamento é fixa", () => {
  assert.equal(PHOTO_SURVEY_STORAGE_KEY, "polimatch:photo-survey:v1");
});

test("o endereço diz qual pesquisa abrir, e um código desconhecido cai na capa", () => {
  assert.equal(surveyIdFromSearch("?p=politica-2026-02"), SECOND_SURVEY_ID);
  assert.equal(surveyIdFromSearch("?x=1&p=politica-2026-01"), PHOTO_SURVEY_ID);
  assert.equal(surveyIdFromSearch("?p=roupas-demo-01"), CLOTHES_SURVEY_ID);
  assert.equal(surveyIdFromSearch("?p=famosos-01"), CELEBRITY_SURVEY_ID);
  for (const search of ["", "?", "?p=", "?p=nao-existe", "?p=politica-2026-02%20", "?q=politica-2026-01", "?p=__proto__"]) {
    assert.equal(surveyIdFromSearch(search), "", search);
  }
  assert.equal(surveyIdFromSearch("?p=so-esta", [{ id: "so-esta" }]), "so-esta");
});

test("o aparelho sabe quais pesquisas esta identidade respondeu e qual está em andamento", () => {
  const tag = identityTag("pm2_ana");
  const other = identityTag("pm2_bia");
  let text = savedProgressText(null, PHOTO_SURVEY_ID, { identity: tag, answered: true });
  assert.deepEqual(answeredSurveyIds(text, tag), [PHOTO_SURVEY_ID]);
  assert.deepEqual(answeredSurveyIds(text, other), [], "o que outra identidade respondeu não conta");
  assert.deepEqual(answeredSurveyIds(text, ""), []);
  assert.equal(inProgressSurveyId(text, tag), "", "respondida não é em andamento");

  text = savedProgressText(text, SECOND_SURVEY_ID, { identity: tag, progress: play(fresh(), "a1") });
  assert.equal(inProgressSurveyId(text, tag), SECOND_SURVEY_ID);
  assert.equal(inProgressSurveyId(text, other), "");
  assert.equal(inProgressSurveyId(text, ""), "");
  // Respondida, mesmo com escolhas ainda guardadas: não é "em andamento".
  const leftover = savedProgressText(null, SECOND_SURVEY_ID, { identity: tag, progress: play(fresh(), "a1"), answered: true });
  assert.equal(inProgressSurveyId(leftover, tag), "");
  // Sorteio emitido sem nenhuma escolha ainda: a capa não puxa a pessoa de volta.
  const untouched = savedProgressText(null, SECOND_SURVEY_ID, { identity: tag, progress: fresh() });
  assert.equal(inProgressSurveyId(untouched, tag), "");
  for (const broken of [null, "", "{não é json", "[]"]) {
    assert.deepEqual(answeredSurveyIds(broken, tag), []);
    assert.equal(inProgressSurveyId(broken, tag), "");
  }
  text = savedProgressText(text, SECOND_SURVEY_ID, { identity: tag, answered: true });
  assert.deepEqual(answeredSurveyIds(text, tag), [PHOTO_SURVEY_ID, SECOND_SURVEY_ID]);
  // A de roupas respondida antes da de famosos: a lista sai na ordem da capa, não na de resposta.
  text = savedProgressText(text, CLOTHES_SURVEY_ID, { identity: tag, answered: true });
  assert.deepEqual(answeredSurveyIds(text, tag), [PHOTO_SURVEY_ID, SECOND_SURVEY_ID, CLOTHES_SURVEY_ID]);
  text = savedProgressText(text, CELEBRITY_SURVEY_ID, { identity: tag, answered: true });
  assert.deepEqual(answeredSurveyIds(text, tag), [PHOTO_SURVEY_ID, SECOND_SURVEY_ID, CELEBRITY_SURVEY_ID, CLOTHES_SURVEY_ID]);
  assert.deepEqual(answeredSurveyIds(text, tag), PHOTO_SURVEYS.map((survey) => survey.id), "todas, na ordem da capa");
});

test("o destaque da capa é a primeira pesquisa aberta que a pessoa ainda não respondeu", () => {
  // Com as quatro pesquisas abertas: política, política, famosos e roupas, nessa ordem.
  const open = PHOTO_SURVEYS.map((survey) => ({ id: survey.id, status: "open" }));
  assert.equal(featuredSurveyId(open, []), PHOTO_SURVEY_ID);
  assert.equal(featuredSurveyId(open, [PHOTO_SURVEY_ID]), SECOND_SURVEY_ID);
  assert.equal(featuredSurveyId(open, [PHOTO_SURVEY_ID, SECOND_SURVEY_ID]), CELEBRITY_SURVEY_ID, "respondidas as de política, a de famosos");
  assert.equal(featuredSurveyId(open, [PHOTO_SURVEY_ID, SECOND_SURVEY_ID, CLOTHES_SURVEY_ID]), CELEBRITY_SURVEY_ID, "quem já respondeu a de roupas ainda vê a de famosos");
  assert.equal(featuredSurveyId(open, [PHOTO_SURVEY_ID, SECOND_SURVEY_ID, CELEBRITY_SURVEY_ID]), CLOTHES_SURVEY_ID, "depois da de famosos, a de roupas");
  assert.equal(featuredSurveyId(open, PHOTO_SURVEYS.map((survey) => survey.id)), "");
  const views = [{ id: "a", status: "open" }, { id: "b", status: "open" }, { id: "c", status: "closed" }];
  assert.equal(featuredSurveyId(views, []), "a");
  assert.equal(featuredSurveyId(views, ["a"]), "b");
  assert.equal(featuredSurveyId(views, ["a", "b"]), "", "respondidas todas as abertas, não há destaque");
  assert.equal(featuredSurveyId([{ id: "a", status: "scheduled" }, { id: "b", status: "closed" }], []), "");
  assert.equal(featuredSurveyId([{ id: "a", status: "closed" }, { id: "b", status: "open" }], []), "b");
  assert.equal(featuredSurveyId([], []), "");
});

test("depois de responder, a próxima é a primeira pesquisa sem resposta, fora a atual", () => {
  assert.equal(nextSurveyId(PHOTO_SURVEY_ID, []), SECOND_SURVEY_ID);
  assert.equal(nextSurveyId(PHOTO_SURVEY_ID, [PHOTO_SURVEY_ID]), SECOND_SURVEY_ID);
  assert.equal(nextSurveyId(SECOND_SURVEY_ID, [SECOND_SURVEY_ID]), PHOTO_SURVEY_ID);
  // Respondidas as duas de política, a próxima é a de famosos; depois, a de roupas;
  // respondidas as quatro, não há próxima.
  assert.equal(nextSurveyId(SECOND_SURVEY_ID, [PHOTO_SURVEY_ID, SECOND_SURVEY_ID]), CELEBRITY_SURVEY_ID);
  assert.equal(nextSurveyId(CELEBRITY_SURVEY_ID, [PHOTO_SURVEY_ID, SECOND_SURVEY_ID, CELEBRITY_SURVEY_ID]), CLOTHES_SURVEY_ID);
  assert.equal(nextSurveyId(CELEBRITY_SURVEY_ID, [CELEBRITY_SURVEY_ID]), PHOTO_SURVEY_ID);
  assert.equal(nextSurveyId(CLOTHES_SURVEY_ID, [CLOTHES_SURVEY_ID]), PHOTO_SURVEY_ID);
  // Quem já tinha respondido as de política e a de roupas ainda tem a de famosos para responder.
  assert.equal(nextSurveyId(CLOTHES_SURVEY_ID, [PHOTO_SURVEY_ID, SECOND_SURVEY_ID, CLOTHES_SURVEY_ID]), CELEBRITY_SURVEY_ID);
  assert.equal(nextSurveyId(CLOTHES_SURVEY_ID, PHOTO_SURVEYS.map((survey) => survey.id)), "");
  assert.equal(nextSurveyId(CELEBRITY_SURVEY_ID, PHOTO_SURVEYS.map((survey) => survey.id)), "");
  assert.equal(nextSurveyId("a", [], [{ id: "a" }]), "");
});

test("as cartas da entrada são distintas, saem do conjunto e mudam com o sorteio", () => {
  const ids = ["a", "b", "c", "d", "e", "f"];
  assert.deepEqual(sampleCards(ids, 3, () => 0), ["a", "b", "c"]);
  assert.deepEqual(sampleCards(ids, 3, (limit) => limit - 1), ["f", "a", "b"]);
  assert.deepEqual(sampleCards(ids, 9, () => 0), ids, "nunca devolve mais do que existe");
  assert.deepEqual(ids, ["a", "b", "c", "d", "e", "f"], "não altera a lista recebida");

  // mulberry32 com semente: o teste de frequência precisa ser reproduzível.
  let state = 20261113;
  const randomInt = (limit) => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return Math.floor((((value ^ (value >>> 14)) >>> 0) / 4294967296) * limit);
  };
  const first = new Map(ids.map((id) => [id, 0]));
  for (let round = 0; round < 6000; round += 1) {
    const sample = sampleCards(ids, 3, randomInt);
    assert.equal(new Set(sample).size, 3);
    first.set(sample[0], first.get(sample[0]) + 1);
  }
  for (const [id, count] of first) assert.ok(count > 800 && count < 1200, `${id} abriu a entrada ${count} vezes`);
});

test("um progresso novo começa na primeira tela, sem escolha e com recibo próprio", () => {
  const progress = fresh();
  assert.deepEqual(progress, { groups: GROUPS, picks: [null, null, null, null], championId: null, answerId: UUID, step: 0 });
  assert.notEqual(progress.groups, GROUPS, "os grupos são copiados");
  assert.deepEqual(progressView(progress), { kind: "vote", screen: 0, screens: 4, cards: GROUPS[0], selectedId: null });
  assert.equal(responseBody(progress), null);
});

test("um toque escolhe e avança; depois da quarta tela vem a final", () => {
  let progress = pickCard(fresh(), "a3");
  assert.deepEqual(progress.picks, ["a3", null, null, null]);
  assert.deepEqual(progressView(progress), { kind: "vote", screen: 1, screens: 4, cards: GROUPS[1], selectedId: null });
  progress = play(progress, "b1", "c1", "d1");
  assert.deepEqual(progressView(progress), { kind: "final", cards: ["a3", "b1", "c1", "d1"], selectedId: null });
});

test("carta de outra tela ou de fora do sorteio não é aceita", () => {
  const progress = fresh();
  assert.equal(pickCard(progress, "b1"), progress);
  assert.equal(pickCard(progress, "zz"), progress);
  assert.equal(pickCard(progress, undefined), progress);
  const final = atFinal();
  assert.equal(pickCard(final, "a2"), final, "na final não se escolhe carta de tela");
  assert.equal(chooseChampion(final, "a2"), final, "a escolhida tem de ser uma das quatro");
  assert.equal(chooseChampion(progress, "a1"), progress, "fora da final não há escolhida");
});

test("a final escolhe entre as quatro e leva à confirmação", () => {
  const confirmed = chooseChampion(atFinal(), "c3");
  assert.equal(confirmed.championId, "c3");
  assert.deepEqual(progressView(confirmed), { kind: "confirm", championId: "c3", otherIds: ["a1", "b2", "d4"] });
  assert.deepEqual(responseBody(confirmed), { answerId: UUID, pickIds: ["a1", "b2", "c3", "d4"], championId: "c3" });
});

test("voltar anda uma tela por vez e para na primeira", () => {
  let progress = chooseChampion(atFinal(), "c3");
  progress = goBack(progress);
  assert.deepEqual(progressView(progress), { kind: "final", cards: ["a1", "b2", "c3", "d4"], selectedId: "c3" });
  progress = goBack(progress);
  assert.deepEqual(progressView(progress), { kind: "vote", screen: 3, screens: 4, cards: GROUPS[3], selectedId: "d4" });
  progress = goBack(goBack(goBack(progress)));
  assert.equal(progressView(progress).screen, 0);
  assert.equal(goBack(progress), progress, "na primeira tela não há para onde voltar");
});

test("trocar uma escolha volta direto para a final e mantém as outras", () => {
  let progress = goBack(goBack(atFinal()));
  assert.equal(progressView(progress).screen, 2);
  progress = pickCard(progress, "c1");
  assert.deepEqual(progress.picks, ["a1", "b2", "c1", "d4"]);
  assert.equal(progressView(progress).kind, "final");
});

test("tocar de novo na mesma carta só segue adiante", () => {
  const before = chooseChampion(atFinal(), "b2");
  const again = pickCard(goBack(goBack(before)), "d4");
  assert.deepEqual(again.picks, before.picks);
  assert.equal(again.championId, "b2", "a escolhida continua valendo");
  assert.equal(progressView(again).kind, "final");
});

test("trocar a carta que era a escolhida apaga a escolhida", () => {
  const before = chooseChampion(atFinal(), "d4");
  const changed = pickCard(goBack(goBack(before)), "d1");
  assert.deepEqual(changed.picks, ["a1", "b2", "c3", "d1"]);
  assert.equal(changed.championId, null);
  assert.equal(responseBody(changed), null);
});

test("trocar uma tela do começo antes de terminar segue para a primeira tela sem escolha", () => {
  let progress = play(fresh(), "a1", "b1");
  progress = pickCard(goBack(goBack(progress)), "a4");
  assert.deepEqual(progress.picks, ["a4", "b1", null, null]);
  assert.equal(progressView(progress).screen, 2);
});

test("as funções não alteram o progresso recebido", () => {
  const progress = Object.freeze({ ...fresh(), picks: Object.freeze([null, null, null, null]) });
  pickCard(progress, "a1");
  goBack(progress);
  assert.deepEqual(progress.picks, [null, null, null, null]);
});

test("grupos iguais são os mesmos ids na mesma ordem", () => {
  assert.equal(sameGroups(GROUPS, GROUPS.map((group) => [...group])), true);
  assert.equal(sameGroups(GROUPS, [GROUPS[1], GROUPS[0], GROUPS[2], GROUPS[3]]), false);
  assert.equal(sameGroups(GROUPS, GROUPS.slice(0, 3)), false);
  assert.equal(sameGroups(GROUPS, [["a2", "a1", "a3", "a4"], ...GROUPS.slice(1)]), false);
  assert.equal(sameGroups(GROUPS, null), false);
  assert.equal(sameGroups(GROUPS, "abcd"), false);
});

test("o progresso salvo volta quando o sorteio é o mesmo", () => {
  const saved = goBack(chooseChampion(atFinal(), "a1"));
  const restored = restoreProgress(JSON.parse(JSON.stringify(saved)), GROUPS, () => "outro");
  assert.deepEqual(restored, saved);
});

test("quem recarrega na confirmação volta para a confirmação", () => {
  const saved = chooseChampion(atFinal(), "b2");
  const restored = restoreProgress(JSON.parse(JSON.stringify(saved)), GROUPS, () => "outro");
  assert.deepEqual(restored, saved);
  assert.deepEqual(progressView(restored), { kind: "confirm", championId: "b2", otherIds: ["a1", "c3", "d4"] });
  // Sem escolhida válida não há confirmação para onde voltar.
  assert.equal(progressView(restoreProgress({ ...saved, championId: "a2" }, GROUPS, () => "outro")).kind, "final");
  assert.equal(progressView(restoreProgress({ ...saved, championId: null }, GROUPS, () => "outro")).kind, "final");
});

test("sorteio diferente, ou nada salvo, começa do zero com recibo novo", () => {
  const other = [GROUPS[3], GROUPS[2], GROUPS[1], GROUPS[0]];
  const next = "0b0f6f0a-1111-4222-8333-444455556666";
  assert.deepEqual(restoreProgress(atFinal(), other, () => next), freshProgress(other, () => next));
  for (const saved of [null, undefined, "x", 7, [], {}]) {
    assert.deepEqual(restoreProgress(saved, GROUPS, () => next), freshProgress(GROUPS, () => next));
  }
});

test("progresso salvo adulterado é consertado antes de valer", () => {
  const next = "0b0f6f0a-1111-4222-8333-444455556666";
  const base = { groups: GROUPS, answerId: UUID };
  // Escolha que não pertence à tela some, e a tela volta a ser a primeira sem escolha.
  const holed = restoreProgress({ ...base, picks: ["a1", "c1", "c2", "d1"], championId: "c2", step: 5 }, GROUPS, () => next);
  assert.deepEqual(holed, { groups: GROUPS, picks: ["a1", null, "c2", "d1"], championId: "c2", answerId: UUID, step: 1 });
  assert.equal(responseBody(holed), null, "com tela sem escolha não há resposta para enviar");
  // Escolhida que não está entre as quatro some, e a confirmação volta para a final.
  assert.deepEqual(
    restoreProgress({ ...base, picks: ["a1", "b1", "c1", "d1"], championId: "a2", step: 5 }, GROUPS, () => next),
    { groups: GROUPS, picks: ["a1", "b1", "c1", "d1"], championId: null, answerId: UUID, step: 4 },
  );
  // Tela fora do intervalo, lista de escolhas torta e recibo inválido.
  assert.deepEqual(
    restoreProgress({ groups: GROUPS, picks: ["a1"], championId: 3, step: 99, answerId: "não é uuid" }, GROUPS, () => next),
    { groups: GROUPS, picks: ["a1", null, null, null], championId: null, answerId: next, step: 1 },
  );
  assert.deepEqual(
    restoreProgress({ ...base, picks: ["a1", "b1", null, null], championId: null, step: -3 }, GROUPS, () => next),
    { groups: GROUPS, picks: ["a1", "b1", null, null], championId: null, answerId: UUID, step: 0 },
  );
  // Quem salvou numa tela de voto anterior continua nela.
  assert.equal(restoreProgress({ ...base, picks: ["a1", "b1", "c1", null], championId: null, step: 1 }, GROUPS, () => next).step, 1);
});

test("a marca da identidade não guarda a chave e muda quando a chave muda", () => {
  const key = `pm2_${"k".repeat(43)}`;
  const tag = identityTag(key);
  assert.match(tag, /^[0-9a-f]{8}$/);
  assert.equal(identityTag(key), tag);
  assert.notEqual(identityTag(`pm2_${"j".repeat(43)}`), tag);
  assert.equal(identityTag(""), "");
  assert.equal(identityTag(null), "");
});

test("o que vai para o armazenamento volta igual, por pesquisa", () => {
  const progress = chooseChampion(atFinal(), "a1");
  const text = savedProgressText(null, PHOTO_SURVEY_ID, { identity: "abc12345", progress });
  assert.deepEqual(readSavedProgress(text, PHOTO_SURVEY_ID), { identity: "abc12345", progress, answered: false });
  assert.equal(readSavedProgress(text, "outra-pesquisa"), null);

  const both = savedProgressText(text, "outra-pesquisa", { identity: "ffff0000", answered: true });
  assert.equal(readSavedProgress(both, PHOTO_SURVEY_ID).identity, "abc12345", "gravar uma pesquisa não apaga a outra");
  assert.deepEqual(readSavedProgress(both, "outra-pesquisa"), { identity: "ffff0000", progress: null, answered: true });

  for (const broken of [null, "", "{não é json", "[]", "7", JSON.stringify({ [PHOTO_SURVEY_ID]: "x" })]) {
    assert.equal(readSavedProgress(broken, PHOTO_SURVEY_ID), null);
  }
  assert.doesNotThrow(() => savedProgressText("{não é json", PHOTO_SURVEY_ID, { identity: "", progress: fresh() }));
});

test("depois de registrada, o aparelho guarda que respondeu, não em quem", () => {
  const text = savedProgressText(null, PHOTO_SURVEY_ID, { identity: "abc12345", answered: true });
  assert.deepEqual(JSON.parse(text), { [PHOTO_SURVEY_ID]: { identity: "abc12345", progress: null, answered: true } });
  // Um registro antigo com a resposta inteira conta como respondido e não devolve a escolha.
  const legacy = JSON.stringify({ [PHOTO_SURVEY_ID]: { identity: "abc12345", progress: null, response: { championId: "a1" } } });
  assert.deepEqual(readSavedProgress(legacy, PHOTO_SURVEY_ID), { identity: "abc12345", progress: null, answered: false });
  for (const value of ["true", 1, {}, null]) {
    const forged = JSON.stringify({ [PHOTO_SURVEY_ID]: { identity: "x", progress: null, answered: value } });
    assert.equal(readSavedProgress(forged, PHOTO_SURVEY_ID).answered, false);
  }
});

// Rodadas (ICM 75, #350) ----------------------------------------------------

const ANSWER = { answerId: UUID, pickIds: ["a1", "b2", "c3", "d4"], championId: "c3", respondedAt: "2026-11-26T12:00:00.000Z" };
const EARLIER = { ...ANSWER, championId: "a1" };
// O que o servidor devolve depois de a pessoa responder a primeira rodada, com confronto por ver.
const afterFirst = (changes = {}) => ({
  survey: { id: PHOTO_SURVEY_ID, status: "open" },
  draw: { groups: GROUPS },
  response: ANSWER,
  round: 1,
  progress: { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: true },
  lastAnswered: { round: 1, response: ANSWER },
  ...changes,
});
// Uma rodada nova emitida e ainda sem resposta: a última respondida é a anterior.
const openSecond = (changes = {}) => afterFirst({
  response: null,
  round: 2,
  progress: { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: false },
  lastAnswered: { round: 1, response: EARLIER },
  ...changes,
});
const LEGACY_HINT = "Obrigado por participar. Sua resposta está registrada e não pode ser trocada nesta pesquisa.";
const ROUND_HINT = "A escolha desta rodada está registrada e não pode ser trocada.";

test("o que o servidor diz das rodadas é conferido campo a campo", () => {
  assert.deepEqual(roundState(afterFirst()), {
    round: 1,
    progress: { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: true },
    lastAnswered: { round: 1, response: ANSWER },
    open: false,
  });
  assert.deepEqual(roundState(openSecond()), {
    round: 2,
    progress: { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: false },
    lastAnswered: { round: 1, response: EARLIER },
    open: true,
  });
  // Ninguém respondeu ainda: rodada 1 aberta, sem última respondida.
  assert.deepEqual(roundState(openSecond({ round: 1, lastAnswered: null, progress: { answeredRounds: 0, seenPairs: 0, totalPairs: 190, canContinue: false } })), {
    round: 1,
    progress: { answeredRounds: 0, seenPairs: 0, totalPairs: 190, canContinue: false },
    lastAnswered: null,
    open: true,
  });
  // Só o valor verdadeiro libera outra rodada.
  for (const value of ["true", 1, {}, null, undefined]) {
    assert.equal(roundState(afterFirst({ progress: { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: value } })).progress.canContinue, false, JSON.stringify(value));
  }
  // Progresso torto vale como não dito; a rodada continua valendo.
  for (const progress of [null, undefined, "x", 7, {}, { answeredRounds: 1, seenPairs: 30 }, { answeredRounds: -1, seenPairs: 30, totalPairs: 190 }, { answeredRounds: 1, seenPairs: 1.5, totalPairs: 190 }, { answeredRounds: 1, seenPairs: 30, totalPairs: 0 }, { answeredRounds: "1", seenPairs: 30, totalPairs: 190 }]) {
    const state = roundState(afterFirst({ progress }));
    assert.equal(state.progress, null, JSON.stringify(progress));
    assert.equal(state.round, 1);
  }
  // Mais confrontos vistos do que existem não passa do total.
  assert.equal(roundState(afterFirst({ progress: { answeredRounds: 9, seenPairs: 500, totalPairs: 190, canContinue: false } })).progress.seenPairs, 190);
  for (const lastAnswered of [null, undefined, "x", {}, { round: 0, response: ANSWER }, { round: 1 }, { round: 1, response: "x" }, { round: "1", response: ANSWER }]) {
    assert.equal(roundState(afterFirst({ lastAnswered })).lastAnswered, null, JSON.stringify(lastAnswered));
  }
});

test("um servidor de antes das rodadas não diz nada delas, e a tela fica como era", () => {
  const legacy = { survey: { id: PHOTO_SURVEY_ID, status: "open" }, draw: { groups: GROUPS }, response: ANSWER };
  assert.equal(roundState(legacy), NO_ROUNDS);
  assert.deepEqual(NO_ROUNDS, { round: 0, progress: null, lastAnswered: null, open: false });
  assert.ok(Object.isFrozen(NO_ROUNDS));
  // Sem número de rodada, o resto não vale: progresso solto não liga o botão.
  for (const round of [undefined, null, 0, -1, 1.5, "1", "2", true]) {
    assert.equal(roundState(afterFirst({ round })), NO_ROUNDS, JSON.stringify(round));
  }
  for (const empty of [null, undefined, {}, "x", 7]) assert.equal(roundState(empty), NO_ROUNDS);
  assert.equal(nextRoundNumber(NO_ROUNDS, "open"), 0);
  assert.deepEqual(registeredCopy(NO_ROUNDS, "open"), { hint: LEGACY_HINT, line: "", next: 0 });
  assert.deepEqual(registeredCopy(roundState(legacy), "open"), { hint: LEGACY_HINT, line: "", next: 0 });
  // E a resposta vai com o corpo de sempre, sem `round`.
  const confirmed = chooseChampion(atFinal(), "c3");
  assert.deepEqual(responseBody(confirmed, roundState(legacy).round), { answerId: UUID, pickIds: ["a1", "b2", "c3", "d4"], championId: "c3" });
});

test("\"Mais uma rodada\" só aparece com a pesquisa aberta e rodada por jogar", () => {
  // Respondida a última rodada, com confronto por ver: a próxima é a seguinte.
  assert.equal(nextRoundNumber(roundState(afterFirst()), "open"), 2);
  assert.equal(nextRoundNumber(roundState(afterFirst({ round: 4, progress: { answeredRounds: 4, seenPairs: 110, totalPairs: 190, canContinue: true } })), "open"), 5);
  // Fora da janela não há rodada nova, diga o servidor o que disser.
  for (const status of ["closed", "scheduled", "", undefined, null, "constructor"]) {
    assert.equal(nextRoundNumber(roundState(afterFirst()), status), 0, String(status));
  }
  // O servidor disse que não cabe outra.
  assert.equal(nextRoundNumber(roundState(afterFirst({ progress: { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: false } })), "open"), 0);
  // Vistos todos os confrontos, não cabe outra, mesmo com `canContinue` verdadeiro por engano.
  assert.equal(nextRoundNumber(roundState(afterFirst({ round: 10, progress: { answeredRounds: 10, seenPairs: 190, totalPairs: 190, canContinue: false } })), "open"), 0);
  assert.equal(nextRoundNumber(roundState(afterFirst({ round: 10, progress: { answeredRounds: 10, seenPairs: 190, totalPairs: 190, canContinue: true } })), "open"), 0);
  // Uma rodada nova já emitida e ainda sem resposta é a que continua.
  assert.equal(nextRoundNumber(roundState(openSecond()), "open"), 2);
  assert.equal(nextRoundNumber(roundState(openSecond({ round: 7 })), "open"), 7);
  assert.equal(nextRoundNumber(roundState(openSecond()), "closed"), 0);
  // A primeira rodada emitida e sem resposta não é "mais uma": a pessoa ainda não respondeu nenhuma.
  assert.equal(nextRoundNumber(roundState(openSecond({ round: 1, lastAnswered: null })), "open"), 0);
  // Sem progresso (a recusa de resposta repetida não o traz), sem botão.
  assert.equal(nextRoundNumber({ ...NO_ROUNDS, round: 2 }, "open"), 0);
  for (const empty of [null, undefined, {}]) assert.equal(nextRoundNumber(empty, "open"), 0);
});

test("a resposta registrada conta os confrontos com os números do servidor", () => {
  assert.deepEqual(registeredCopy(roundState(afterFirst()), "open"), {
    hint: ROUND_HINT,
    line: "Você já viu 30 de 190 confrontos.",
    next: 2,
  });
  // Os números são os que o servidor mandou: outra pesquisa, outro total.
  assert.equal(
    registeredCopy(roundState(afterFirst({ round: 3, progress: { answeredRounds: 3, seenPairs: 83, totalPairs: 120, canContinue: true } })), "open").line,
    "Você já viu 83 de 120 confrontos.",
  );
  // Vistos todos: a tela diz isso, sem botão.
  assert.deepEqual(registeredCopy(roundState(afterFirst({ round: 10, progress: { answeredRounds: 10, seenPairs: 190, totalPairs: 190, canContinue: false } })), "open"), {
    hint: ROUND_HINT,
    line: "Você viu todos os confrontos desta pesquisa.",
    next: 0,
  });
  // Pesquisa fora da janela: o texto de antes das rodadas, sem contagem e sem botão,
  // tenha a pessoa visto tudo ou não.
  for (const status of ["closed", "scheduled", undefined]) {
    assert.deepEqual(registeredCopy(roundState(afterFirst()), status), { hint: LEGACY_HINT, line: "", next: 0 }, String(status));
    assert.deepEqual(registeredCopy(roundState(afterFirst({ progress: { answeredRounds: 10, seenPairs: 190, totalPairs: 190, canContinue: false } })), status), { hint: LEGACY_HINT, line: "", next: 0 });
  }
  // Aberta, sem rodada por jogar e sem ter visto tudo (o servidor não deixou continuar): o texto de sempre.
  assert.deepEqual(registeredCopy(roundState(afterFirst({ progress: { answeredRounds: 1, seenPairs: 30, totalPairs: 190, canContinue: false } })), "open"), { hint: LEGACY_HINT, line: "", next: 0 });
  // Sem progresso, o texto de sempre.
  assert.deepEqual(registeredCopy({ ...NO_ROUNDS, round: 2 }, "open"), { hint: LEGACY_HINT, line: "", next: 0 });
});

test("o destaque da capa: pela metade, depois sem resposta, depois com rodada por jogar", () => {
  const open = PHOTO_SURVEYS.map((survey) => ({ id: survey.id, status: "open" }));
  const all = PHOTO_SURVEYS.map((survey) => survey.id);
  const more = roundState(afterFirst());
  const done = roundState(afterFirst({ round: 10, progress: { answeredRounds: 10, seenPairs: 190, totalPairs: 190, canContinue: false } }));
  const NONE = { id: "", mode: "", round: 0 };
  // Sem nada respondido, a primeira aberta; não importa o que o servidor diga das outras.
  assert.deepEqual(coverFeature(open), { id: PHOTO_SURVEY_ID, mode: "start", round: 0 });
  assert.deepEqual(coverFeature(open, { answeredIds: [PHOTO_SURVEY_ID], rounds: new Map([[PHOTO_SURVEY_ID, more]]) }), { id: SECOND_SURVEY_ID, mode: "start", round: 0 }, "uma pesquisa por responder vem antes de outra rodada da já respondida");
  // A que ficou pela metade vem antes de todas, inclusive de uma ainda sem resposta.
  assert.deepEqual(coverFeature(open, { pendingId: CLOTHES_SURVEY_ID, answeredIds: [PHOTO_SURVEY_ID] }), { id: CLOTHES_SURVEY_ID, mode: "resume", round: 0 });
  // Uma rodada nova pela metade numa pesquisa já respondida também.
  assert.deepEqual(coverFeature(open, { pendingId: PHOTO_SURVEY_ID, answeredIds: all, rounds: new Map([[SECOND_SURVEY_ID, more]]) }), { id: PHOTO_SURVEY_ID, mode: "resume", round: 0 });
  // Pela metade e fechada não prende a capa.
  const secondClosed = open.map((view) => (view.id === SECOND_SURVEY_ID ? { ...view, status: "closed" } : view));
  assert.deepEqual(coverFeature(secondClosed, { pendingId: SECOND_SURVEY_ID }), { id: PHOTO_SURVEY_ID, mode: "start", round: 0 });
  // Respondidas todas: a primeira, na ordem da capa, em que ainda há rodada por jogar.
  assert.deepEqual(coverFeature(open, { answeredIds: all, rounds: new Map(all.map((id) => [id, more])) }), { id: PHOTO_SURVEY_ID, mode: "more", round: 2 });
  assert.deepEqual(
    coverFeature(open, { answeredIds: all, rounds: new Map([[PHOTO_SURVEY_ID, done], [SECOND_SURVEY_ID, done], [CELEBRITY_SURVEY_ID, roundState(afterFirst({ round: 3, progress: { answeredRounds: 3, seenPairs: 80, totalPairs: 190, canContinue: true } }))], [CLOTHES_SURVEY_ID, more]]) }),
    { id: CELEBRITY_SURVEY_ID, mode: "more", round: 4 },
  );
  // Uma rodada emitida e não tocada conta como rodada por jogar, com o número dela.
  assert.deepEqual(coverFeature(open, { answeredIds: all, rounds: new Map([[SECOND_SURVEY_ID, roundState(openSecond({ round: 5 }))]]) }), { id: SECOND_SURVEY_ID, mode: "more", round: 5 });
  // Fechada não entra, mesmo com confronto por ver.
  assert.deepEqual(coverFeature(secondClosed, { answeredIds: all, rounds: new Map([[SECOND_SURVEY_ID, more], [CLOTHES_SURVEY_ID, more]]) }), { id: CLOTHES_SURVEY_ID, mode: "more", round: 2 });
  // Vistos todos os confrontos de todas, ou sem notícia do servidor (servidor antigo, pedido que falhou): nenhuma.
  assert.deepEqual(coverFeature(open, { answeredIds: all, rounds: new Map(all.map((id) => [id, done])) }), NONE);
  assert.deepEqual(coverFeature(open, { answeredIds: all, rounds: new Map(all.map((id) => [id, NO_ROUNDS])) }), NONE);
  assert.deepEqual(coverFeature(open, { answeredIds: all }), NONE);
  assert.deepEqual(coverFeature([], {}), NONE);
  assert.deepEqual(coverFeature([{ id: "a", status: "closed" }]), NONE);
});

test("a resposta leva a rodada que o servidor numerou no sorteio", () => {
  const confirmed = chooseChampion(atFinal(), "c3");
  const base = { answerId: UUID, pickIds: ["a1", "b2", "c3", "d4"], championId: "c3" };
  assert.deepEqual(responseBody(confirmed, 1), { ...base, round: 1 }, "a primeira rodada também vai numerada");
  assert.deepEqual(responseBody(confirmed, 2), { ...base, round: 2 });
  assert.deepEqual(responseBody(confirmed, 11), { ...base, round: 11 });
  // Sem número do servidor, o corpo de sempre.
  assert.deepEqual(responseBody(confirmed), base);
  for (const round of [0, -1, 1.5, "2", null, undefined, Number.NaN]) assert.deepEqual(responseBody(confirmed, round), base, String(round));
  // Faltando escolha não há corpo, com rodada ou sem.
  assert.equal(responseBody(fresh(), 2), null);
  assert.equal(responseBody(atFinal(), 2), null);
});

test("o que se guarda de uma rodada não passa para outra", () => {
  const next = "0b0f6f0a-1111-4222-8333-444455556666";
  // A primeira rodada é guardada como antes das rodadas: sem número.
  assert.deepEqual(freshProgress(GROUPS, uuid, 1), fresh());
  assert.equal(Object.hasOwn(freshProgress(GROUPS, uuid, 1), "round"), false);
  for (const round of [0, undefined, null, "2", 1.5, -3]) assert.equal(Object.hasOwn(freshProgress(GROUPS, uuid, round), "round"), false, String(round));
  // Da segunda em diante o número vai junto, e as escolhas o mantêm.
  const second = freshProgress(GROUPS, uuid, 2);
  assert.deepEqual(second, { ...fresh(), round: 2 });
  const played = chooseChampion(play(second, "a1", "b2", "c3", "d4"), "c3");
  assert.equal(played.round, 2);
  assert.equal(goBack(played).round, 2);
  const saved = JSON.parse(JSON.stringify(played));
  // O mesmo sorteio, na mesma rodada: volta tudo, com o mesmo recibo.
  assert.deepEqual(restoreProgress(saved, GROUPS, () => next, 2), played);
  // Os mesmos grupos em outra rodada não trazem as escolhas nem o recibo.
  assert.deepEqual(restoreProgress(saved, GROUPS, () => next, 3), { ...freshProgress(GROUPS, () => next), round: 3 });
  assert.deepEqual(restoreProgress(saved, GROUPS, () => next, 1), freshProgress(GROUPS, () => next));
  assert.deepEqual(restoreProgress(saved, GROUPS, () => next), freshProgress(GROUPS, () => next), "sem rodada dita, vale a primeira");
  // O que ficou da primeira rodada não entra na segunda.
  const first = JSON.parse(JSON.stringify(chooseChampion(atFinal(), "c3")));
  assert.deepEqual(restoreProgress(first, GROUPS, () => next, 2), { ...freshProgress(GROUPS, () => next), round: 2 });
  assert.deepEqual(restoreProgress(first, GROUPS, () => next, 1), chooseChampion(atFinal(), "c3"), "e continua voltando na primeira");
  // Outro sorteio, na mesma rodada, começa do zero, como sempre.
  const other = [GROUPS[3], GROUPS[2], GROUPS[1], GROUPS[0]];
  assert.deepEqual(restoreProgress(saved, other, () => next, 2), { ...freshProgress(other, () => next), round: 2 });
  // Número de rodada adulterado no que foi guardado não vale como a rodada pedida.
  for (const round of ["2", 2.5, null, 0]) {
    assert.deepEqual(restoreProgress({ ...saved, round }, GROUPS, () => next, 2), { ...freshProgress(GROUPS, () => next), round: 2 }, String(round));
  }
});

test("uma rodada nova pela metade conta como pesquisa em andamento, e outra aba só confirma quando não sobra escolha guardada", () => {
  const tag = identityTag("pms_ana");
  const second = play(freshProgress(GROUPS, uuid, 2), "a1");
  // Respondida a primeira rodada e com escolhas da segunda: está em andamento, e continua contando como respondida.
  let text = savedProgressText(null, PHOTO_SURVEY_ID, { identity: tag, progress: second, answered: true });
  assert.equal(inProgressSurveyId(text, tag), PHOTO_SURVEY_ID);
  assert.deepEqual(answeredSurveyIds(text, tag), [PHOTO_SURVEY_ID]);
  assert.equal(inProgressSurveyId(text, identityTag("pms_bia")), "", "de outra identidade, não");
  // A segunda rodada emitida e não tocada não puxa a pessoa de volta.
  text = savedProgressText(null, PHOTO_SURVEY_ID, { identity: tag, progress: freshProgress(GROUPS, uuid, 2), answered: true });
  assert.equal(inProgressSurveyId(text, tag), "");
  // Escolhas sem número de rodada num registro respondido são resto da primeira rodada: não contam.
  text = savedProgressText(null, PHOTO_SURVEY_ID, { identity: tag, progress: play(fresh(), "a1"), answered: true });
  assert.equal(inProgressSurveyId(text, tag), "");

  // Outra aba confirmou: o registro diz que respondeu e não guarda mais escolha.
  assert.equal(answeredElsewhere({ identity: tag, progress: null, answered: true }), true);
  // Rodada nova em andamento: já respondeu antes, mas as escolhas estão lá. Ninguém confirmou nada.
  assert.equal(answeredElsewhere({ identity: tag, progress: second, answered: true }, 2), false);
  // A outra aba confirmou a rodada desta e já está na seguinte: esta precisa buscar a resposta.
  assert.equal(answeredElsewhere({ identity: tag, progress: second, answered: true }, 1), true);
  assert.equal(answeredElsewhere({ identity: tag, progress: { ...second, round: 3 }, answered: true }, 2), true);
  // Um servidor de antes das rodadas não diz a rodada: vale como a primeira.
  assert.equal(answeredElsewhere({ identity: tag, progress: play(fresh(), "a1"), answered: true }, 0), false);
  assert.equal(answeredElsewhere({ identity: tag, progress: play(fresh(), "a1"), answered: false }), false);
  assert.equal(answeredElsewhere({ identity: tag, progress: null, answered: false }), false);
  for (const empty of [null, undefined, {}]) assert.equal(answeredElsewhere(empty), false);
});

// Rodada contínua e resultado (ICM 76, #354) ---------------------------------

const roundsAfter = ({ answeredRounds = 1, seenPairs = 30, totalPairs = 190, canContinue = true, open = false, round = 1 } = {}) => roundState({
  round,
  progress: { answeredRounds, seenPairs, totalPairs, canContinue },
  lastAnswered: { round: answeredRounds, response: { championId: "x" } },
  response: open ? null : { championId: "x" },
});

test("depois de confirmar: a rodada seguinte abre sozinha enquanto houver confronto e a pesquisa estiver aberta", () => {
  assert.equal(afterConfirm(roundsAfter(), "open"), "next");
  assert.equal(afterConfirm(roundsAfter({ answeredRounds: 7, seenPairs: 189 }), "open"), "next");
});

test("depois de confirmar: vistos todos os confrontos, ou fora da janela, a tela vai ao resultado", () => {
  assert.equal(afterConfirm(roundsAfter({ seenPairs: 190, canContinue: false }), "open"), "result");
  assert.equal(afterConfirm(roundsAfter({ seenPairs: 190, canContinue: true }), "open"), "result");
  assert.equal(afterConfirm(roundsAfter({ canContinue: false }), "open"), "result");
  assert.equal(afterConfirm(roundsAfter(), "closed"), "result");
  assert.equal(afterConfirm(roundsAfter(), "scheduled"), "result");
});

test("depois de confirmar: um servidor de antes das rodadas fica na resposta registrada de sempre", () => {
  assert.equal(afterConfirm(NO_ROUNDS, "open"), "done");
  assert.equal(afterConfirm(roundState({ response: { championId: "x" } }), "open"), "done");
  assert.equal(afterConfirm(undefined, "open"), "done");
});

test("abrir uma pesquisa respondida sem toque mostra o resultado, mesmo com rodada emitida e não tocada", () => {
  const emitted = roundsAfter({ open: true, round: 2 });
  assert.equal(resultOnOpen(emitted, { auto: true, hasPicks: false }), true);
  // Quem já escolheu carta nesta rodada neste aparelho volta para o voto.
  assert.equal(resultOnOpen(emitted, { auto: true, hasPicks: true }), false);
  // O toque (Começar, Continuar votando) leva à rodada.
  assert.equal(resultOnOpen(emitted, { auto: false, hasPicks: false }), false);
  // Sem rodada respondida não há resultado: a primeira rodada abre.
  assert.equal(resultOnOpen(roundState({ round: 1, progress: null, lastAnswered: null, response: null }), { auto: true }), false);
  assert.equal(resultOnOpen(NO_ROUNDS, { auto: true }), false);
});

test("o resultado: a primeira colocada, até mais quatro, e as linhas de rodadas e confrontos", () => {
  const ranking = ["a", "b", "c", "d", "e", "f", "g"].map((cardId, index) => ({ cardId, points: 10 - index, finalWins: 0, screenWins: 0 }));
  const summary = resultSummary({ answeredRounds: 3, ranking }, roundsAfter({ answeredRounds: 3, seenPairs: 85 }));
  assert.equal(summary.first, "a");
  assert.deepEqual(summary.rest, ["b", "c", "d", "e"]);
  assert.equal(summary.roundsLine, "3 rodadas respondidas.");
  assert.equal(summary.seenLine, "Você viu 85 de 190 confrontos.");
  const one = resultSummary({ answeredRounds: 1, ranking: ranking.slice(0, 2) }, roundsAfter({ seenPairs: 190, canContinue: false }));
  assert.equal(one.roundsLine, "1 rodada respondida.");
  assert.equal(one.seenLine, "Você viu todos os confrontos desta pesquisa.");
  assert.deepEqual(one.rest, ["b"]);
});

test("o resultado só mostra cartas do catálogo do app, sem repetir, e o que vem torto vale como vazio", () => {
  const known = (id) => id !== "retirada";
  const summary = resultSummary({ answeredRounds: 2, ranking: [{ cardId: "retirada" }, { cardId: "a" }, { cardId: "a" }, { cardId: 7 }, null, { cardId: "b" }] }, NO_ROUNDS, known);
  assert.equal(summary.first, "a");
  assert.deepEqual(summary.rest, ["b"]);
  assert.equal(summary.seenLine, "");
  for (const raw of [null, undefined, {}, { ranking: "x" }, { answeredRounds: 0, ranking: [] }]) {
    const empty = resultSummary(raw, NO_ROUNDS);
    assert.equal(empty.first, "");
    assert.deepEqual(empty.rest, []);
    assert.equal(empty.roundsLine, "");
  }
});

test("todas as pesquisas pela metade neste aparelho, na ordem da capa", () => {
  const tag = identityTag("pms_conta");
  const groups = [["a", "b"], ["c", "d"]];
  let text = "";
  text = savedProgressText(text, PHOTO_SURVEYS[3].id, { identity: tag, progress: { ...freshProgress(groups), picks: ["a", null] } });
  text = savedProgressText(text, PHOTO_SURVEYS[0].id, { identity: tag, progress: { ...freshProgress(groups), picks: ["b", null] } });
  text = savedProgressText(text, PHOTO_SURVEYS[1].id, { identity: tag, progress: freshProgress(groups) });
  text = savedProgressText(text, PHOTO_SURVEYS[2].id, { identity: identityTag("pms_outra"), progress: { ...freshProgress(groups), picks: ["a", null] } });
  assert.deepEqual(inProgressSurveyIds(text, tag), [PHOTO_SURVEYS[0].id, PHOTO_SURVEYS[3].id]);
  assert.equal(inProgressSurveyId(text, tag), PHOTO_SURVEYS[0].id);
  assert.deepEqual(inProgressSurveyIds(text, ""), []);
});
