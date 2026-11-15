import test from "node:test";
import assert from "node:assert/strict";
import { UPCOMING_SURVEYS, accountKind, menuButtonMarkup, menuMarkup, upcomingMarkup } from "./site-menu.js";

test("o tipo de conta sai do prefixo da chave guardada no aparelho", () => {
  assert.equal(accountKind("pms_sessaoGoogle"), "google");
  assert.equal(accountKind("pm2_chaveAnonima"), "anonymous");
  assert.equal(accountKind("outra-coisa"), "anonymous");
  for (const empty of ["", "   ", null, undefined]) assert.equal(accountKind(empty), "none");
});

test("as próximas pesquisas seguem a ordem da decisão 0002 e são só anúncio", () => {
  assert.deepEqual([...UPCOMING_SURVEYS], ["Famosos e influenciadores", "Roupas"]);
  assert.ok(Object.isFrozen(UPCOMING_SURVEYS));
  const markup = upcomingMarkup();
  assert.ok(markup.indexOf("Famosos e influenciadores") < markup.indexOf("Roupas"));
  assert.equal(markup.match(/Em breve/g).length, 2);
  assert.doesNotMatch(markup, /<a\b|href=/);
});

test("o menu leva a pesquisa aberta ao início e não dá link às próximas", () => {
  const markup = menuMarkup();
  assert.match(markup, /<a class="pm-item" href="\.\/"[^>]*><span>Política<\/span><em class="pm-tag pm-tag--open">Aberta<\/em><\/a>/);
  assert.match(markup, /<a class="pm-item" href="\.\/como-funciona\.html"[^>]*><span>Como funciona<\/span>/);
  for (const name of UPCOMING_SURVEYS) {
    assert.match(markup, new RegExp(`<div class="pm-item is-soon"><span>${name}</span><em class="pm-tag">Em breve</em></div>`));
  }
  assert.doesNotMatch(markup, /Privacidade/);
});

test("o menu marca a página em que a pessoa está", () => {
  assert.match(menuMarkup({ current: "survey" }), /href="\.\/" aria-current="page"/);
  assert.doesNotMatch(menuMarkup({ current: "survey" }), /como-funciona\.html" aria-current/);
  assert.match(menuMarkup({ current: "how" }), /href="\.\/como-funciona\.html" aria-current="page"/);
  assert.doesNotMatch(menuMarkup({ current: "how" }), /href="\.\/" aria-current/);
});

test("sem conta e com o Google configurado, o menu reserva o lugar do botão de entrada", () => {
  const markup = menuMarkup({ account: "none", googleReady: true });
  assert.match(markup, /id="pm-google"/);
  assert.match(markup, /Para a sua resposta valer em qualquer aparelho\./);
  assert.doesNotMatch(markup, /Sair da conta/);
  // Quem responde sem conta também pode entrar: a chave anônima é reunida à conta.
  assert.match(menuMarkup({ account: "anonymous", googleReady: true }), /id="pm-google"/);
});

test("sem o identificador do Google no build, o menu não oferece entrada", () => {
  const markup = menuMarkup({ account: "none", googleReady: false });
  assert.match(markup, /<span>Política<\/span>/);
  assert.doesNotMatch(markup, /pm-google|Google|Sair da conta|pm-account/);
});

test("com conta Google, o menu diz que a pessoa entrou e oferece sair", () => {
  const markup = menuMarkup({ account: "google", googleReady: true });
  assert.match(markup, /<p class="pm-account-state" role="status">Você entrou com Google\.<\/p>/);
  assert.match(markup, /<button class="ps-btn ps-btn--ghost" type="button" data-menu="signout">Sair da conta<\/button>/);
  assert.doesNotMatch(markup, /id="pm-google"/);
  // Sair precisa funcionar mesmo num build sem o identificador do Google.
  assert.match(menuMarkup({ account: "google", googleReady: false }), /data-menu="signout"/);
});

test("enquanto o servidor responde, o botão de sair fica travado e o de entrada avisa", () => {
  assert.match(menuMarkup({ account: "google", busy: true }), /data-menu="signout" disabled>Saindo…<\/button>/);
  assert.match(menuMarkup({ account: "none", googleReady: true, busy: true }), /Confirmando…/);
});

test("o erro aparece como alerta e nunca entra como marcação", () => {
  const markup = menuMarkup({ account: "none", googleReady: true, error: 'Falhou <img src=x onerror="alert(1)">' });
  assert.match(markup, /<p class="pm-error" role="alert">Falhou &lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;<\/p>/);
  assert.doesNotMatch(menuMarkup({ account: "none", googleReady: true }), /role="alert"/);
});

test("o menu tem um botão de fechar e o botão que abre diz o que faz", () => {
  assert.match(menuMarkup(), /<button class="pm-menu-btn" type="button" data-menu="close" aria-label="Fechar menu">/);
  assert.match(menuButtonMarkup(), /^<button class="pm-menu-btn" type="button" data-action="menu" aria-haspopup="dialog" aria-label="Abrir menu">/);
});
