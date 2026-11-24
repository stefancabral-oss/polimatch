import test from "node:test";
import assert from "node:assert/strict";
import { UPCOMING_SURVEYS, accountKind, menuButtonMarkup, menuMarkup, upcomingMarkup } from "./site-menu.js";

test("o tipo de conta sai do prefixo da chave guardada no aparelho", () => {
  assert.equal(accountKind("pms_sessaoGoogle"), "google");
  assert.equal(accountKind("pm2_chaveAnonima"), "anonymous");
  assert.equal(accountKind("outra-coisa"), "anonymous");
  for (const empty of ["", "   ", null, undefined]) assert.equal(accountKind(empty), "none");
});

test("a próxima pesquisa é só anúncio, e Roupas não está mais entre as que vêm", () => {
  assert.deepEqual([...UPCOMING_SURVEYS], ["Famosos e influenciadores"]);
  assert.ok(Object.isFrozen(UPCOMING_SURVEYS));
  const markup = upcomingMarkup();
  assert.match(markup, /Famosos e influenciadores/);
  assert.doesNotMatch(markup, /Roupas/);
  assert.equal(markup.match(/Em breve/g).length, 1);
  assert.doesNotMatch(markup, /<a\b|href=/);
});

test("o menu leva cada pesquisa ao endereço dela e não dá link às próximas", () => {
  const markup = menuMarkup();
  assert.match(markup, /<a class="pm-item" href="\.\/\?p=politica-2026-01"><span>Quem você prefere\?<\/span><small class="pm-sub">Política<\/small><\/a>/);
  assert.match(markup, /<a class="pm-item" href="\.\/\?p=politica-2026-02"><span>Em quem você confia mais\?<\/span><small class="pm-sub">Política<\/small><\/a>/);
  assert.match(markup, /<a class="pm-item" href="\.\/\?p=roupas-demo-01"><span>Qual você usaria\?<\/span><small class="pm-sub">Roupas<\/small><\/a>/);
  assert.ok(markup.indexOf("politica-2026-01") < markup.indexOf("politica-2026-02"), "na ordem da capa");
  assert.ok(markup.indexOf("politica-2026-02") < markup.indexOf("roupas-demo-01"), "a de roupas vem depois das de política");
  assert.equal(markup.match(/Em breve/g).length, 1, "Roupas é pesquisa aberta, não anúncio");
  assert.match(markup, /<a class="pm-item" href="\.\/"><span>Início<\/span>/);
  assert.match(markup, /<a class="pm-item" href="\.\/como-funciona\.html"><span>Como funciona<\/span>/);
  for (const name of UPCOMING_SURVEYS) {
    assert.match(markup, new RegExp(`<div class="pm-item is-soon"><span>${name}</span><em class="pm-tag">Em breve</em></div>`));
  }
  assert.doesNotMatch(markup, /Privacidade/);
});

test("o menu lista as pesquisas que recebe, com o texto escapado", () => {
  const markup = menuMarkup({ surveys: [{ id: "x-1", subject: "A & B", question: "<b>Qual?</b>" }] });
  assert.match(markup, /href="\.\/\?p=x-1"><span>&lt;b&gt;Qual\?&lt;\/b&gt;<\/span><small class="pm-sub">A &amp; B<\/small>/);
  assert.doesNotMatch(markup, /politica-2026|roupas-demo/);
  assert.match(menuMarkup({ surveys: [{ id: "a b&c", subject: "S", question: "Q?" }] }), /href="\.\/\?p=a%20b%26c"/);
});

test("o menu marca a página em que a pessoa está", () => {
  const marked = (markup) => [...markup.matchAll(/href="([^"]+)" aria-current="page"/g)].map((match) => match[1]);
  assert.deepEqual(marked(menuMarkup({ current: "home" })), ["./"]);
  assert.deepEqual(marked(menuMarkup({ current: "politica-2026-02" })), ["./?p=politica-2026-02"]);
  assert.deepEqual(marked(menuMarkup({ current: "roupas-demo-01" })), ["./?p=roupas-demo-01"]);
  assert.deepEqual(marked(menuMarkup({ current: "how" })), ["./como-funciona.html"]);
  assert.deepEqual(marked(menuMarkup()), []);
});

test("sem conta e com o Google configurado, o menu reserva o lugar do botão de entrada", () => {
  const markup = menuMarkup({ account: "none", googleReady: true });
  assert.match(markup, /id="pm-google"/);
  assert.match(markup, /Para responder, entre e cadastre o CPF\./);
  assert.doesNotMatch(markup, /Sair da conta/);
  // Quem responde sem conta também pode entrar: a chave anônima é reunida à conta.
  assert.match(menuMarkup({ account: "anonymous", googleReady: true }), /id="pm-google"/);
});

test("sem o identificador do Google no build, o menu não oferece entrada", () => {
  const markup = menuMarkup({ account: "none", googleReady: false });
  assert.match(markup, /<span>Quem você prefere\?<\/span>/);
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
