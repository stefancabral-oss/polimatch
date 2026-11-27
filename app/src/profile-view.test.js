import assert from "node:assert/strict";
import test from "node:test";
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { PROFILE_CONSENT_VERSION } from "../../shared/profile.js";
import {
  HANDLE_CHOOSE_NOTE,
  HANDLE_LOCKED_NOTE,
  MARKS_NEED_REGISTRATION_NOTE,
  enableBody,
  enableProblem,
  feedEntries,
  feedHref,
  handleFromSearch,
  handleLockedOutcome,
  profileLink,
  profileRefusal,
  profileState,
  publicProfileCards,
} from "./profile-view.js";

const [FIRST, SECOND, THIRD, FOURTH] = PHOTO_SURVEYS.map((survey) => survey.id);
const views = (statuses) => PHOTO_SURVEYS.map((survey, index) => ({ id: survey.id, status: statuses[index] }));

test("o link do perfil é o endereço público com o nome normalizado", () => {
  assert.equal(profileLink("Bia_23"), "https://polimatch.com.br/perfil.html?u=bia_23");
  assert.equal(profileLink(" bia "), "https://polimatch.com.br/perfil.html?u=bia");
});

test("o nome do perfil vem do endereço, normalizado; nome inválido ou reservado vale como nenhum", () => {
  assert.equal(handleFromSearch("?u=Bia_23"), "bia_23");
  assert.equal(handleFromSearch("?u=%20bia%20"), "bia");
  for (const search of ["", "?u=", "?u=ab", "?u=a-b-c", "?u=" + "a".repeat(21), "?u=admin", "?u=POLIMATCH", "?u=jo%C3%A3o", "?x=bia", null]) {
    assert.equal(handleFromSearch(search), "", String(search));
  }
});

test("o perfil da conta é conferido campo a campo", () => {
  const state = profileState({
    enabled: true,
    handle: "Bia",
    consentVersion: PROFILE_CONSENT_VERSION,
    surveys: [FIRST, "inventada", FIRST, 3],
    firstPlaces: [{ surveyId: FIRST, cardId: "a" }, { surveyId: "inventada", cardId: "a" }, { surveyId: SECOND, cardId: "retirada" }, { surveyId: FIRST, cardId: "b" }],
    canEnable: true,
  }, (id) => id !== "retirada");
  assert.equal(state.enabled, true);
  assert.equal(state.handle, "bia");
  assert.deepEqual(state.surveys, [FIRST]);
  assert.deepEqual([...state.firstPlaces], [[FIRST, "a"]]);
  assert.equal(state.canEnable, true);
  const empty = profileState(null);
  assert.equal(empty.enabled, false);
  assert.equal(empty.canEnable, false);
  assert.equal(empty.handle, "");
  assert.deepEqual(empty.surveys, []);
  assert.equal(empty.firstPlaces.size, 0);
  assert.equal(profileState({ enabled: "true", canEnable: 1 }).enabled, false);
});

test("o feed: abertas e respondidas, na ordem das pesquisas, com o rótulo de cada estado", () => {
  const entries = feedEntries(views(["open", "open", "closed", "scheduled"]), {
    firstPlaces: new Map([[SECOND, "carta-2"], [THIRD, "carta-3"]]),
    answeredIds: [],
    pendingIds: [FIRST],
  });
  assert.deepEqual(entries, [
    { id: FIRST, status: "open", label: "Continuar", firstCardId: "" },
    { id: SECOND, status: "open", label: "Ver meu resultado", firstCardId: "carta-2" },
    { id: THIRD, status: "closed", label: "Ver meu resultado", firstCardId: "carta-3" },
  ]);
});

test("o feed: sem resposta, Começar; o que o aparelho sabe respondido também vale, sem a carta", () => {
  const entries = feedEntries(views(["open", "open", "open", "closed"]), { answeredIds: [SECOND, FOURTH] });
  assert.deepEqual(entries.map((entry) => [entry.id, entry.label, entry.firstCardId]), [
    [FIRST, "Começar", ""],
    [SECOND, "Ver meu resultado", ""],
    [THIRD, "Começar", ""],
    [FOURTH, "Ver meu resultado", ""],
  ]);
  // Rodada pela metade numa pesquisa respondida: Continuar, com a primeira colocada.
  const pending = feedEntries(views(["open", "closed", "closed", "closed"]), { firstPlaces: new Map([[FIRST, "x"]]), pendingIds: [FIRST, SECOND] });
  assert.deepEqual(pending, [{ id: FIRST, status: "open", label: "Continuar", firstCardId: "x" }]);
  assert.deepEqual(feedEntries(null), []);
});

test("ligar: o nome precisa valer e o aceite precisa estar marcado; o aceite só vai marcado", () => {
  assert.equal(enableProblem({ handle: "ab", consent: true }).field, "handle");
  assert.equal(enableProblem({ handle: "admin", consent: true }).field, "handle");
  assert.equal(enableProblem({ handle: "bia_23", consent: false }).field, "consent");
  assert.equal(enableProblem({ handle: "Bia_23", consent: true }), null);
  assert.deepEqual(enableBody({ handle: " Bia ", surveys: [FIRST], consent: true, consentVersion: PROFILE_CONSENT_VERSION }), {
    enabled: true, handle: "bia", surveys: [FIRST], consentVersion: PROFILE_CONSENT_VERSION,
  });
  assert.deepEqual(enableBody({ handle: "bia", surveys: [], consent: false, consentVersion: PROFILE_CONSENT_VERSION }), { enabled: true, handle: "bia", surveys: [] });
});

test("cada recusa do servidor tem o seu texto e o seu campo", () => {
  const refusal = (status, code, reason) => profileRefusal({ status, code, body: { code, current: reason ? { reason } : undefined } });
  assert.deepEqual(refusal(409, "PROFILE_HANDLE_TAKEN"), { field: "handle", text: "Esse nome de perfil já está em uso. Escolha outro.", next: "" });
  assert.equal(refusal(400, "PROFILE_INVALID", "handle").field, "handle");
  assert.equal(refusal(400, "PROFILE_INVALID", "surveys").field, "");
  // O nome gravado não muda: a tela explica e busca o perfil de novo.
  assert.deepEqual(refusal(400, "PROFILE_INVALID", "handle-locked"), {
    field: "",
    text: "Este perfil já tem um nome, e o nome de perfil não muda depois de escolhido. Confira o nome no campo e tente de novo.",
    next: "reload",
  });
  assert.equal(refusal(400, "PROFILE_CONSENT_REQUIRED").field, "consent");
  assert.equal(refusal(403, "CPF_REGISTRATION_REQUIRED").next, "register");
  assert.equal(refusal(401, "PLAYER_SESSION_REQUIRED").next, "signin");
  assert.match(refusal(0, "NETWORK").text, /conexão/);
  assert.match(refusal(429, "RATE_LIMITED").text, /Muitas tentativas/);
  assert.match(refusal(500, "INTERNAL_ERROR").text, /Tente de novo/);
});

test("o perfil público: uma carta por pesquisa, só cartas do catálogo, e o texto do servidor como texto", () => {
  const cards = publicProfileCards({
    handle: "bia",
    surveys: [
      { surveyId: FIRST, subject: "Política", question: "Quem?", cardId: "a" },
      { surveyId: FIRST, subject: "Política", question: "Quem?", cardId: "b" },
      { surveyId: SECOND, subject: "<b>x</b>", question: 7, cardId: "c" },
      { surveyId: THIRD, subject: "Famosos", cardId: "retirada" },
      null,
    ],
  }, (id) => id !== "retirada");
  assert.deepEqual(cards, [
    { surveyId: FIRST, cardId: "a", subject: "Política", question: "Quem?" },
    { surveyId: SECOND, cardId: "c", subject: "<b>x</b>", question: "" },
  ]);
  assert.deepEqual(publicProfileCards({}), []);
});

test("depois de handle-locked: ligado em outra aba vale o servidor, sem falar de campo; desligado mantém o preenchido", () => {
  const enabled = profileState({ enabled: true, handle: "da_outra_aba", surveys: [FIRST], canEnable: true });
  assert.deepEqual(handleLockedOutcome(enabled), {
    keepForm: false,
    text: "Este perfil foi ligado em outra aba com o nome @da_outra_aba. Confira as marcações abaixo.",
  });
  assert.doesNotMatch(handleLockedOutcome(enabled).text, /campo/);
  const disabled = profileState({ enabled: false, handle: "da_outra_aba", surveys: [], canEnable: true });
  assert.deepEqual(handleLockedOutcome(disabled), {
    keepForm: true,
    text: "Este perfil já tem um nome, e o nome de perfil não muda depois de escolhido. Confira o nome no campo e tente de novo.",
  });
  assert.equal(handleLockedOutcome(null).keepForm, true);
});

test("perfil ligado sem cadastro: o aviso das marcações travadas", () => {
  assert.equal(MARKS_NEED_REGISTRATION_NOTE, "Para mudar as marcações, falta o cadastro com CPF.");
});

test("os avisos do nome de perfil: travado depois de gravado, e o cuidado antes de ligar", () => {
  assert.equal(HANDLE_LOCKED_NOTE, "O nome de perfil não muda depois de escolhido.");
  assert.equal(HANDLE_CHOOSE_NOTE, "Escolha com cuidado: o nome não muda depois.");
});

test("o endereço do cartão do feed: Ver meu resultado pede o resultado; os outros, a página da pesquisa", () => {
  const entries = feedEntries(views(["open", "open", "open", "closed"]), {
    firstPlaces: new Map([[FIRST, "a"], [FOURTH, "b"]]),
    answeredIds: [THIRD],
    pendingIds: [SECOND],
  });
  assert.deepEqual(entries.map((entry) => [entry.label, feedHref(entry)]), [
    ["Ver meu resultado", `./?p=${FIRST}&ver=resultado`],
    ["Continuar", `./?p=${SECOND}`],
    // Só este aparelho sabe que respondeu: a página de sempre, que retoma e mostra o resultado.
    ["Ver meu resultado", `./?p=${THIRD}`],
    ["Ver meu resultado", `./?p=${FOURTH}&ver=resultado`],
  ]);
  assert.equal(feedHref({ id: FIRST, label: "Começar", firstCardId: "" }), `./?p=${FIRST}`);
});
