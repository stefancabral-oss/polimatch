import test from "node:test";
import assert from "node:assert/strict";
import { SHARE_FILE_NAME, shareChoice, shareMode, shareText, shareUrl } from "./share-choice.js";

const choice = { surveyId: "politica-2026-02", name: "Fulana de Tal", question: "Em quem você confia mais?" };
const file = { name: SHARE_FILE_NAME, type: "image/jpeg" };

test("o texto leva a pergunta e a escolha da pessoa, e o endereço é o da pesquisa no site", () => {
  assert.equal(shareText(choice), "Em quem você confia mais? Minha escolha no PoliMatch: Fulana de Tal. E a sua?");
  assert.equal(shareUrl("politica-2026-02"), "https://polimatch.com.br/?p=politica-2026-02");
  assert.equal(shareUrl("a b"), "https://polimatch.com.br/?p=a%20b");
});

test("o modo de compartilhar sai do que o aparelho oferece", () => {
  const share = async () => {};
  assert.equal(shareMode({ share, canShare: () => true }, file), "file");
  assert.equal(shareMode({ share, canShare: () => false }, file), "text");
  assert.equal(shareMode({ share, canShare: () => true }, null), "text", "sem a imagem pronta, vai o texto");
  assert.equal(shareMode({ share }, file), "text");
  assert.equal(shareMode({ share, canShare: () => { throw new Error("x"); } }, file), "text");
  assert.equal(shareMode({ clipboard: { writeText: async () => {} } }, file), "copy");
  assert.equal(shareMode({}, file), "none");
  assert.equal(shareMode(undefined, file), "none");
});

test("com suporte a arquivo, vai a imagem com o texto e o endereço, uma vez", async () => {
  const calls = [];
  const nav = { canShare: () => true, share: async (data) => { calls.push(data); } };
  assert.equal(await shareChoice({ ...choice, file, nav }), "shared");
  assert.deepEqual(calls, [{ files: [file], title: "PoliMatch", text: shareText(choice), url: shareUrl(choice.surveyId) }]);
});

test("sem suporte a arquivo vai o texto; sem compartilhamento, o endereço é copiado", async () => {
  const shared = [];
  assert.equal(await shareChoice({ ...choice, file, nav: { canShare: () => false, share: async (data) => { shared.push(data); } } }), "shared");
  assert.deepEqual(shared, [{ title: "PoliMatch", text: shareText(choice), url: shareUrl(choice.surveyId) }]);
  const copied = [];
  assert.equal(await shareChoice({ ...choice, file, nav: { clipboard: { writeText: async (text) => { copied.push(text); } } } }), "copied");
  assert.deepEqual(copied, [`${shareText(choice)} ${shareUrl(choice.surveyId)}`]);
  assert.equal(await shareChoice({ ...choice, file, nav: {} }), "unavailable");
});

test("fechar a folha de compartilhar não é erro; outra falha é", async () => {
  const abort = Object.assign(new Error("cancelado"), { name: "AbortError" });
  assert.equal(await shareChoice({ ...choice, file, nav: { canShare: () => true, share: async () => { throw abort; } } }), "cancelled");
  assert.equal(await shareChoice({ ...choice, file, nav: { canShare: () => true, share: async () => { throw new Error("falhou"); } } }), "failed");
  assert.equal(await shareChoice({ ...choice, file, nav: { clipboard: { writeText: async () => { throw new Error("negado"); } } } }), "failed");
});
