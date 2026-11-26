import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PHOTO_SURVEYS } from "../../shared/photo-survey.js";
import { UPCOMING_SURVEYS, accountKind, menuButtonMarkup, menuMarkup, upcomingMarkup, upcomingSectionMarkup } from "./site-menu.js";

test("o tipo de conta sai do prefixo da chave guardada no aparelho", () => {
  assert.equal(accountKind("pms_sessaoGoogle"), "google");
  assert.equal(accountKind("pm2_chaveAnonima"), "anonymous");
  assert.equal(accountKind("outra-coisa"), "anonymous");
  for (const empty of ["", "   ", null, undefined]) assert.equal(accountKind(empty), "none");
});

test("não há pesquisa anunciada: sem anúncio, não sai item nem o rótulo \"Em breve\"", () => {
  assert.deepEqual([...UPCOMING_SURVEYS], [], "Famosos e Roupas viraram pesquisas abertas");
  assert.ok(Object.isFrozen(UPCOMING_SURVEYS));
  // Texto vazio de verdade, sem nem espaço: a capa esconde a área das listas quando ela fica vazia.
  assert.equal(upcomingMarkup(), "");
  assert.equal(upcomingSectionMarkup(), "", "a capa não mostra o rótulo sem ter o que anunciar");
  assert.equal(upcomingMarkup([]), "");
  assert.equal(upcomingSectionMarkup([]), "");
});

test("quando houver pesquisa anunciada, ela aparece sem link, e a capa ganha o rótulo", () => {
  const names = ["Futebol", "Séries & filmes"];
  const markup = upcomingMarkup(names);
  assert.equal(markup, '<div class="pm-item is-soon"><span>Futebol</span><em class="pm-tag">Em breve</em></div><div class="pm-item is-soon"><span>Séries &amp; filmes</span><em class="pm-tag">Em breve</em></div>');
  assert.doesNotMatch(markup, /<a\b|href=/);
  assert.equal(upcomingSectionMarkup(names), `<p class="ps-label ps-home-label">Em breve</p>${markup}`);
  const menu = menuMarkup({ upcoming: names });
  assert.ok(menu.includes(markup), "o menu mostra os anúncios");
  assert.ok(menu.indexOf("roupas-demo-01") < menu.indexOf("Futebol") && menu.indexOf("Futebol") < menu.indexOf(">PoliMatch<"), "depois das pesquisas abertas, no mesmo grupo");
  assert.equal(menu.match(/Em breve/g).length, 2);
});

test("a capa monta o bloco das próximas pesquisas pelo menu: sem anúncio, sem rótulo", () => {
  // A capa (photo-survey-page.js) não escreve o rótulo "Em breve" por conta
  // própria: usa `upcomingSectionMarkup`, que devolve vazio sem anúncio.
  const page = readFileSync(new URL("./photo-survey-page.js", import.meta.url), "utf8");
  const sections = page.slice(page.indexOf("function homeSections()"), page.indexOf("function renderEntry("));
  assert.ok(sections.length > 0 && sections.length < 1500, "o trecho das listas da capa foi encontrado");
  assert.match(sections, /upcomingSectionMarkup\(\)/);
  assert.doesNotMatch(sections, /Em breve|upcomingMarkup\(/);
  assert.doesNotMatch(page, /ps-home-label">Em breve/);
  // "Suas escolhas" e "Mais pesquisas" também só saem com conteúdo, e os blocos são unidos sem espaço.
  assert.match(sections, /chosen\.length \? `<p class="ps-label ps-home-label">Suas escolhas<\/p>/);
  assert.match(sections, /others\.length \? `<p class="ps-label ps-home-label">Mais pesquisas<\/p>/);
  assert.match(sections, /\]\.join\(""\)/);
  const css = readFileSync(new URL("./photo-survey.css", import.meta.url), "utf8");
  assert.match(css, /\.ps-home:empty \{\s*display: none;\s*\}/);
});

test("o menu leva cada pesquisa ao endereço dela, na ordem da capa, sem nenhum \"Em breve\"", () => {
  const markup = menuMarkup();
  assert.match(markup, /<a class="pm-item" href="\.\/\?p=politica-2026-01"><span>Quem você prefere\?<\/span><small class="pm-sub">Política<\/small><\/a>/);
  assert.match(markup, /<a class="pm-item" href="\.\/\?p=politica-2026-02"><span>Em quem você confia mais\?<\/span><small class="pm-sub">Política<\/small><\/a>/);
  assert.match(markup, /<a class="pm-item" href="\.\/\?p=famosos-01"><span>De quem você é mais fã\?<\/span><small class="pm-sub">Famosos<\/small><\/a>/);
  assert.match(markup, /<a class="pm-item" href="\.\/\?p=roupas-demo-01"><span>Qual você usaria\?<\/span><small class="pm-sub">Roupas<\/small><\/a>/);
  assert.ok(markup.indexOf("politica-2026-01") < markup.indexOf("politica-2026-02"), "na ordem da capa");
  assert.ok(markup.indexOf("politica-2026-02") < markup.indexOf("famosos-01"), "a de famosos vem depois das de política");
  assert.ok(markup.indexOf("famosos-01") < markup.indexOf("roupas-demo-01"), "a de roupas vem depois da de famosos");
  // Famosos é pesquisa aberta, não anúncio: nenhum item "Em breve", nem bloco vazio no lugar.
  assert.doesNotMatch(markup, /Em breve|is-soon|pm-tag|Famosos e influenciadores/);
  assert.equal(markup.match(/class="pm-item"/g).length, PHOTO_SURVEYS.length + 3, "as pesquisas, Início, Como funciona e Créditos das fotos");
  assert.doesNotMatch(markup, /<(div|p|ul)[^>]*>\s*<\/\1>/, "sem bloco vazio");
  assert.match(markup, /<\/a>\s*<p class="pm-group">PoliMatch<\/p>/, "depois da última pesquisa vem direto o grupo seguinte");
  assert.match(markup, /<a class="pm-item" href="\.\/"><span>Início<\/span>/);
  assert.match(markup, /<a class="pm-item" href="\.\/como-funciona\.html"><span>Como funciona<\/span>/);
  assert.doesNotMatch(markup, /Privacidade/);
});

test("o menu tem o link dos créditos das fotos, logo depois de Como funciona", () => {
  const markup = menuMarkup();
  assert.match(markup, /<a class="pm-item" href="\.\/creditos\.html"><span>Créditos das fotos<\/span><i aria-hidden="true">›<\/i><\/a>/);
  assert.match(markup, /<a class="pm-item" href="\.\/como-funciona\.html"><span>Como funciona<\/span><i aria-hidden="true">›<\/i><\/a>\s*<a class="pm-item" href="\.\/creditos\.html">/);
  assert.equal(markup.match(/creditos\.html/g).length, 1);
  // O link não depende da conta nem do Google.
  for (const account of ["none", "anonymous", "google"]) {
    assert.match(menuMarkup({ account, googleReady: true }), /href="\.\/creditos\.html"/, account);
  }
});

test("o menu lista as pesquisas que recebe, com o texto escapado", () => {
  const markup = menuMarkup({ surveys: [{ id: "x-1", subject: "A & B", question: "<b>Qual?</b>" }] });
  assert.match(markup, /href="\.\/\?p=x-1"><span>&lt;b&gt;Qual\?&lt;\/b&gt;<\/span><small class="pm-sub">A &amp; B<\/small>/);
  assert.doesNotMatch(markup, /politica-2026|famosos-01|roupas-demo/);
  assert.match(menuMarkup({ surveys: [{ id: "a b&c", subject: "S", question: "Q?" }] }), /href="\.\/\?p=a%20b%26c"/);
});

test("o menu marca a página em que a pessoa está", () => {
  const marked = (markup) => [...markup.matchAll(/href="([^"]+)" aria-current="page"/g)].map((match) => match[1]);
  assert.deepEqual(marked(menuMarkup({ current: "home" })), ["./"]);
  assert.deepEqual(marked(menuMarkup({ current: "politica-2026-02" })), ["./?p=politica-2026-02"]);
  assert.deepEqual(marked(menuMarkup({ current: "famosos-01" })), ["./?p=famosos-01"]);
  assert.deepEqual(marked(menuMarkup({ current: "roupas-demo-01" })), ["./?p=roupas-demo-01"]);
  assert.deepEqual(marked(menuMarkup({ current: "how" })), ["./como-funciona.html"]);
  assert.deepEqual(marked(menuMarkup({ current: "credits" })), ["./creditos.html"]);
  assert.deepEqual(marked(menuMarkup()), []);
  assert.deepEqual(marked(menuMarkup({ current: "outra-pagina" })), []);
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
