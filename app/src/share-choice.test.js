import test from "node:test";
import assert from "node:assert/strict";
import {
  SHARE_FILE_NAME,
  SHARE_IMAGE_SIZE,
  fitLine,
  shareChoice,
  shareCreditLines,
  shareImageLayout,
  shareMode,
  sharePlan,
  sharePreviewMarkup,
  shareText,
  shareUrl,
} from "./share-choice.js";
import CELEBRITY_CARDS from "./celebrity-cards.json" with { type: "json" };

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

// No iPhone, texto ou endereço na mesma chamada faz vários aplicativos
// (o WhatsApp entre eles) descartarem o arquivo e receberem só o link. O
// endereço já está escrito na imagem.
test("com suporte a arquivo, vai só a imagem, uma vez, sem texto nem endereço junto", async () => {
  const calls = [];
  const nav = { canShare: () => true, share: async (data) => { calls.push(data); } };
  assert.equal(await shareChoice({ ...choice, file, nav }), "shared");
  assert.deepEqual(calls, [{ files: [file] }]);
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

// A imagem é a entrega (ICM 72): com ela pronta, o aparelho que não
// compartilha arquivo mostra a imagem para baixar, em vez de mandar só o link.
test("o toque só tem dois destinos: o compartilhamento do aparelho com a imagem, ou a prévia", () => {
  const share = async () => {};
  const clipboard = { writeText: async () => {} };
  assert.equal(sharePlan({ share, canShare: () => true }, file), "file");
  assert.equal(sharePlan({ share, canShare: () => false }, file), "preview");
  assert.equal(sharePlan({ share }, file), "preview");
  assert.equal(sharePlan({ share, canShare: () => { throw new Error("x"); } }, file), "preview");
  assert.equal(sharePlan({ clipboard }, file), "preview");
  assert.equal(sharePlan({}, file), "preview");
  assert.equal(sharePlan(undefined, file), "preview");
  // Sem a imagem pronta também é a prévia, que tenta montá-la de novo: o
  // toque nunca manda só o link por conta própria.
  assert.equal(sharePlan({ share, canShare: () => true }, null), "preview");
  assert.equal(sharePlan({ clipboard }, null), "preview");
  assert.equal(sharePlan({}, null), "preview");
});

// Uma linha da imagem: a letra diminui até caber; no tamanho mínimo, o texto
// é cortado com reticências. `measure` faz o papel do canvas.
const measure = (text, size) => text.length * size * 0.5;

test("uma linha que cabe fica como está; uma maior diminui a letra até caber", () => {
  assert.deepEqual(fitLine(measure, "Curta", { size: 64, min: 20, maxWidth: 940 }), { size: 64, text: "Curta" });
  const fitted = fitLine(measure, "x".repeat(40), { size: 64, min: 20, maxWidth: 940 });
  assert.equal(fitted.text, "x".repeat(40));
  assert.ok(fitted.size < 64 && fitted.size >= 20);
  assert.ok(measure(fitted.text, fitted.size) <= 940);
  assert.ok(measure(fitted.text, fitted.size + 2) > 940, "a letra só diminui o necessário");
});

test("no tamanho mínimo, o que ainda não cabe é cortado com reticências, dentro da largura", () => {
  const long = "Uma pergunta comprida demais para caber numa linha da imagem, por maior que seja a folha".repeat(2);
  const fitted = fitLine(measure, long, { size: 36, min: 20, maxWidth: 940 });
  assert.equal(fitted.size, 20);
  assert.ok(fitted.text.endsWith("…"));
  assert.ok(fitted.text.length < long.length);
  assert.ok(measure(fitted.text, fitted.size) <= 940);
  assert.ok(long.startsWith(fitted.text.slice(0, -1).trimEnd()));
  assert.deepEqual(fitLine(measure, "", { size: 36, min: 20, maxWidth: 940 }), { size: 36, text: "" });
});

const RATIO = 1484 / 1060;
const bottom = (box) => box.y + box.height;

test("a imagem traz a escolha em destaque e as finalistas embaixo, tudo dentro da folha", () => {
  assert.deepEqual(SHARE_IMAGE_SIZE, { width: 1080, height: 1350 });
  const layout = shareImageLayout({ ratio: RATIO, others: 3 });
  const { hero, finalists } = layout;
  assert.equal(hero.x + hero.width / 2, 540, "a escolha fica no meio");
  assert.equal(hero.height, Math.round(hero.width * RATIO));
  assert.equal(finalists.length, 3);
  assert.ok(finalists.every((box) => box.width === finalists[0].width && box.height === finalists[0].height && box.y === finalists[0].y));
  assert.equal(finalists[0].height, Math.round(finalists[0].width * RATIO));
  assert.ok(finalists[0].width < hero.width / 1.8, "as finalistas são bem menores que a escolha");
  assert.equal(finalists[0].x + bottomRight(finalists), 1080, "o grupo das finalistas fica no meio");
  assert.equal(finalists[1].x - (finalists[0].x + finalists[0].width), finalists[2].x - (finalists[1].x + finalists[1].width));
  assert.ok(finalists[1].x - (finalists[0].x + finalists[0].width) >= 20);
  // De cima para baixo, sem nada por cima de nada.
  assert.ok(layout.kickerY < layout.nameY && layout.nameY < layout.questionY && layout.questionY < hero.y);
  assert.ok(bottom(hero) + 30 <= layout.labelY, "o rótulo das finalistas não encosta na escolha");
  assert.ok(layout.labelY < finalists[0].y);
  assert.ok(bottom(finalists[0]) + 50 <= layout.footerY, "o endereço não encosta nas finalistas");
  assert.ok(layout.footerY <= 1350 - 40);
  assert.ok(finalists[0].x >= 60 && hero.x >= 60);
});

function bottomRight(boxes) {
  const last = boxes.at(-1);
  return last.x + last.width;
}

test("com uma ou duas finalistas o grupo continua no meio; sem nenhuma, a escolha fica maior", () => {
  for (const others of [1, 2]) {
    const { finalists } = shareImageLayout({ ratio: RATIO, others });
    assert.equal(finalists.length, others);
    assert.equal(finalists[0].x + bottomRight(finalists), 1080);
  }
  const alone = shareImageLayout({ ratio: RATIO, others: 0 });
  assert.deepEqual(alone.finalists, []);
  assert.equal(alone.labelY, null);
  assert.ok(alone.hero.width > shareImageLayout({ ratio: RATIO, others: 3 }).hero.width);
  assert.ok(bottom(alone.hero) + 60 <= alone.footerY);
  // Mais de três finalistas não cabem na linha: valem as três primeiras.
  assert.equal(shareImageLayout({ ratio: RATIO, others: 7 }).finalists.length, 3);
});

test("uma carta mais alta que o normal encolhe para caber na folha", () => {
  for (const ratio of [1.2, 1.4, 1.6, 2]) {
    const layout = shareImageLayout({ ratio, others: 3 });
    assert.ok(bottom(layout.finalists[0]) + 50 <= layout.footerY, `proporção ${ratio}`);
    assert.ok(bottom(layout.hero) + 30 <= layout.labelY, `proporção ${ratio}`);
    assert.equal(layout.hero.x + layout.hero.width / 2, 540);
  }
});

test("a prévia mostra a imagem, com baixar, o link e fechar", () => {
  const markup = sharePreviewMarkup({ url: "blob:https://polimatch.com.br/abc", name: 'Fulana "de" Tal' });
  assert.match(markup, /<img class="ps-share-img" src="blob:https:\/\/polimatch\.com\.br\/abc" width="1080" height="1350" alt="Imagem com a minha escolha: Fulana &quot;de&quot; Tal\.">/);
  assert.match(markup, /<a class="ps-btn" href="blob:https:\/\/polimatch\.com\.br\/abc" download="polimatch-minha-escolha\.jpg">Baixar imagem<\/a>/);
  assert.match(markup, /<button class="ps-btn ps-btn--ghost" type="button" data-share="link">Copiar link<\/button>/);
  assert.match(markup, /<button class="ps-link" type="button" data-share="close">Fechar<\/button>/);
  assert.match(markup, /<p class="ps-notice" id="ps-share-notice" role="status" hidden><\/p>/);
  assert.match(markup, /No celular, segure o dedo na imagem para salvar ou compartilhar\./);
  // Onde o aparelho compartilha texto, o segundo botão abre o compartilhamento do link.
  assert.match(sharePreviewMarkup({ url: "blob:x", name: "A", canShareLink: true }), /data-share="link">Compartilhar link<\/button>/);
});

test("o endereço da prévia e o nome nunca entram como marcação", () => {
  const markup = sharePreviewMarkup({ url: 'blob:"><script>x</script>', name: "<b>A</b>" });
  assert.doesNotMatch(markup, /<script>|<b>A/);
});

test("a descrição da imagem cita quem mais chegou à final, sem a palavra finalistas", () => {
  const alt = (others) => /alt="([^"]*)"/.exec(sharePreviewMarkup({ url: "blob:x", name: "Ana", others }))[1];
  assert.equal(alt([]), "Imagem com a minha escolha: Ana.");
  assert.equal(alt(["Bia"]), "Imagem com a minha escolha: Ana. Também na final: Bia.");
  assert.equal(alt(["Bia", "Caio"]), "Imagem com a minha escolha: Ana. Também na final: Bia e Caio.");
  assert.equal(alt(["Bia", "Caio", "Davi"]), "Imagem com a minha escolha: Ana. Também na final: Bia, Caio e Davi.");
});

test("enquanto a imagem é montada a prévia avisa; se não sair, oferece tentar de novo; o link só vai se a pessoa pedir", () => {
  const preparing = sharePreviewMarkup({ state: "preparing", name: "Ana" });
  assert.match(preparing, /<p class="ps-share-wait" role="status">Preparando a imagem…<\/p>/);
  assert.doesNotMatch(preparing, /<img|Baixar imagem|data-share="retry"/);
  assert.match(preparing, /data-share="close"/);
  const failed = sharePreviewMarkup({ state: "failed", name: "Ana", canShareLink: true });
  assert.match(failed, /<p class="ps-notice" role="alert">Não deu para montar a imagem agora\.<\/p>/);
  assert.match(failed, /<button class="ps-btn" type="button" data-share="retry">Tentar de novo<\/button>/);
  assert.match(failed, /<button class="ps-btn ps-btn--ghost" type="button" data-share="link">Compartilhar link<\/button>/);
  assert.doesNotMatch(failed, /<img|Baixar imagem/);
  // Com a imagem pronta não há "tentar de novo" nem aviso de espera.
  assert.doesNotMatch(sharePreviewMarkup({ url: "blob:x", name: "Ana" }), /data-share="retry"|ps-share-wait/);
});

test("a imagem leva o crédito das fotos quando as cartas têm foto de outra pessoa", () => {
  // Sem foto com crédito (política, roupas), nenhuma linha: a imagem fica como era.
  assert.deepEqual(shareCreditLines(), []);
  assert.deepEqual(shareCreditLines([]), []);
  assert.deepEqual(shareCreditLines([undefined, null, {}, { author: "Fulana" }, { license: "CC BY 3.0" }]), []);
  // Uma foto: singular. O endereço dos créditos completos vem na segunda linha.
  assert.deepEqual(shareCreditLines([{ author: "Fulana", license: "CC BY 3.0" }]), [
    "Foto: Fulana (CC BY 3.0)",
    "Créditos completos em polimatch.com.br/creditos.html",
  ]);
  // Duas: as duas na primeira linha, na ordem em que as cartas entram na imagem.
  assert.deepEqual(shareCreditLines([{ author: "Canal", license: "CC BY 3.0" }, { author: "Fulana", license: "CC BY-SA 4.0" }]), [
    "Fotos: Canal (CC BY 3.0) · Fulana (CC BY-SA 4.0)",
    "Créditos completos em polimatch.com.br/creditos.html",
  ]);
  // Mais de duas: sem repetir o mesmo autor com a mesma licença, e as que passam de duas descem para a segunda linha.
  assert.deepEqual(shareCreditLines([
    { author: "Canal", license: "CC BY 3.0" },
    { author: "Fulana", license: "CC BY-SA 4.0" },
    { author: "Canal", license: "CC BY 3.0" },
    { author: "Canal", license: "CC BY 4.0" },
  ]), [
    "Fotos: Canal (CC BY 3.0) · Fulana (CC BY-SA 4.0)",
    "Canal (CC BY 4.0) · créditos em polimatch.com.br/creditos.html",
  ]);
  assert.deepEqual(shareCreditLines([
    { author: "A", license: "CC BY 3.0" }, { author: "B", license: "CC BY 3.0" }, { author: "C", license: "CC BY 3.0" }, { author: "D", license: "CC BY 3.0" },
  ]), [
    "Fotos: A (CC BY 3.0) · B (CC BY 3.0)",
    "C (CC BY 3.0) · D (CC BY 3.0) · créditos em polimatch.com.br/creditos.html",
  ]);
});

test("o crédito de qualquer combinação de cartas de famosos cabe nas duas linhas da imagem", () => {
  // A imagem leva a escolhida e até três finalistas. As linhas são desenhadas com letra de 18 px que encolhe
  // até 12 px numa largura de 1000 px; com até 140 letras por linha nada é cortado. Um autor de nome mais
  // comprido no catálogo faz este teste falhar antes de o crédito sair cortado na imagem.
  const credits = [...new Map(CELEBRITY_CARDS.map((card) => [`${card.photo.author} (${card.photo.license})`, card.photo])).values()];
  assert.ok(credits.length >= 4, "há créditos distintos bastantes para a pior combinação");
  let longest = 0;
  for (const first of credits) for (const second of credits) for (const third of credits) for (const fourth of credits) {
    for (const size of [1, 2, 3, 4]) {
      const lines = shareCreditLines([first, second, third, fourth].slice(0, size));
      assert.equal(lines.length, 2);
      longest = Math.max(longest, ...lines.map((line) => line.length));
    }
  }
  assert.ok(longest <= 140, `a linha mais comprida tem ${longest} letras`);
});
