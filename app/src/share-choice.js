// Compartilhar a escolha (ICM 70, #334). Só acontece no toque da pessoa e leva
// só as escolhas dela: a carta escolhida, as finalistas, a pergunta e o
// endereço do site. Nunca leva resultado somado.
//
// Desde a ICM 72 a imagem é a entrega: onde o aparelho não compartilha
// arquivo, a página mostra a imagem para baixar, em vez de mandar só o link.

export const SHARE_ORIGIN = "https://polimatch.com.br";
export const SHARE_FILE_NAME = "polimatch-minha-escolha.jpg";
const WIDTH = 1080;
const HEIGHT = 1350;
export const SHARE_IMAGE_SIZE = Object.freeze({ width: WIDTH, height: HEIGHT });
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, system-ui, sans-serif';

/** O endereço que vai junto: o da pesquisa, no site publicado. */
export const shareUrl = (surveyId) => `${SHARE_ORIGIN}/?p=${encodeURIComponent(surveyId)}`;

export const shareText = ({ name, question }) => `${question} Minha escolha no PoliMatch: ${name}. E a sua?`;

/**
 * O que o aparelho oferece: `"file"` (compartilha a imagem), `"text"`
 * (compartilha texto e endereço), `"copy"` (só copia) ou `"none"`.
 */
export function shareMode(nav, file) {
  if (typeof nav?.share === "function") {
    try {
      if (file && typeof nav.canShare === "function" && nav.canShare({ files: [file] })) return "file";
    } catch {
      // `canShare` que falha vale como "não compartilha arquivo".
    }
    return "text";
  }
  return typeof nav?.clipboard?.writeText === "function" ? "copy" : "none";
}

/**
 * O que fazer no toque. São só dois destinos: `"file"` abre o
 * compartilhamento do aparelho com a imagem; `"preview"` mostra a imagem na
 * tela, para baixar. Sem a imagem pronta também é a prévia, que tenta
 * montá-la de novo: o toque nunca manda só o link por conta própria.
 */
export function sharePlan(nav, file) {
  return shareMode(nav, file) === "file" ? "file" : "preview";
}

const escapeText = (value = "") => String(value).replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
);

/** "Bia", "Bia e Caio", "Bia, Caio e Davi". */
function listNames(names) {
  if (names.length < 2) return names.join("");
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/**
 * A prévia. `state`: `"ready"` (a imagem, com o botão de baixar),
 * `"preparing"` (a imagem ainda está sendo montada) ou `"failed"` (não saiu:
 * oferece tentar de novo). `url` é o endereço local da imagem (blob);
 * `others` são os nomes das finalistas, para a descrição da imagem.
 * `canShareLink` troca "Copiar link" por "Compartilhar link", onde o aparelho
 * compartilha texto. O link só vai se a pessoa pedir.
 */
export function sharePreviewMarkup({ state = "ready", url = "", name, others = [], canShareLink = false }) {
  const link = `<button class="ps-btn ps-btn--ghost" type="button" data-share="link">${canShareLink ? "Compartilhar link" : "Copiar link"}</button>`;
  const close = '<button class="ps-link" type="button" data-share="close">Fechar</button>';
  const linkNotice = '<p class="ps-notice" id="ps-share-notice" role="status" hidden></p>';
  if (state === "preparing") {
    return `<p class="ps-share-wait" role="status">Preparando a imagem…</p>
      <div class="ps-share-actions">${close}</div>`;
  }
  if (state === "failed") {
    return `<p class="ps-notice" role="alert">Não deu para montar a imagem agora.</p>
      ${linkNotice}
      <div class="ps-share-actions"><button class="ps-btn" type="button" data-share="retry">Tentar de novo</button>${link}${close}</div>`;
  }
  const source = escapeText(url);
  const finalists = others.length ? ` Também na final: ${listNames(others)}.` : "";
  return `<img class="ps-share-img" src="${source}" width="${WIDTH}" height="${HEIGHT}" alt="${escapeText(`Imagem com a minha escolha: ${name}.${finalists}`)}">
    <p class="ps-muted ps-share-hint">Baixe a imagem para postar. No celular, segure o dedo na imagem para salvar ou compartilhar.</p>
    ${linkNotice}
    <div class="ps-share-actions"><a class="ps-btn" href="${source}" download="${SHARE_FILE_NAME}">Baixar imagem</a>${link}${close}</div>`;
}

/**
 * Onde cada coisa fica na imagem. `ratio` é altura sobre largura da carta;
 * `others` é o número de finalistas além da escolhida (no máximo três cabem
 * na linha). Uma carta mais alta que o normal encolhe para caber.
 */
export function shareImageLayout({ ratio = 1.4, others = 0 } = {}) {
  const count = Math.max(0, Math.min(3, Math.trunc(Number(others)) || 0));
  const top = 250;
  const footerY = HEIGHT - 60;
  const centered = (width, y) => ({ x: (WIDTH - width) / 2, y, width, height: Math.round(width * ratio) });
  const base = { kickerY: 84, nameY: 160, questionY: 214, footerY };
  if (!count) {
    const width = Math.min(560, Math.floor((footerY - 70 - top) / ratio));
    return { ...base, hero: centered(width, top), labelY: null, finalists: [] };
  }
  // Da escolha ao rótulo, 62; do rótulo às finalistas, 24; depois delas, ao menos 50.
  const SMALL = 196 / 420;
  const GAP = 32;
  const heroWidth = Math.min(420, Math.floor((footerY - top - 62 - 24 - 54) / (ratio * (1 + SMALL))));
  const hero = centered(heroWidth, top);
  const labelY = hero.y + hero.height + 62;
  const smallWidth = Math.round(heroWidth * SMALL);
  const left = (WIDTH - (count * smallWidth + (count - 1) * GAP)) / 2;
  const finalists = Array.from({ length: count }, (_, index) => ({
    x: left + index * (smallWidth + GAP),
    y: labelY + 24,
    width: smallWidth,
    height: Math.round(smallWidth * ratio),
  }));
  return { ...base, hero, labelY, finalists };
}

/**
 * Compartilha a escolha. Devolve `"shared"`, `"copied"`, `"cancelled"`
 * (a pessoa fechou a folha de compartilhar), `"unavailable"` ou `"failed"`.
 */
export async function shareChoice({ surveyId, name, question, file = null, nav = globalThis.navigator }) {
  const text = shareText({ name, question });
  const url = shareUrl(surveyId);
  const mode = shareMode(nav, file);
  try {
    // Com arquivo, vai só o arquivo. No iPhone, texto ou endereço na mesma
    // chamada faz vários aplicativos (o WhatsApp entre eles) descartarem a
    // imagem e receberem só o link. O endereço já está escrito na imagem.
    if (mode === "file") await nav.share({ files: [file] });
    else if (mode === "text") await nav.share({ title: "PoliMatch", text, url });
    else if (mode === "copy") {
      await nav.clipboard.writeText(`${text} ${url}`);
      return "copied";
    } else return "unavailable";
    return "shared";
  } catch (error) {
    return error?.name === "AbortError" ? "cancelled" : "failed";
  }
}

// Uma carta que nem chega nem falha não pode segurar a imagem para sempre.
const IMAGE_TIMEOUT_MS = 6000;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error("prazo")), IMAGE_TIMEOUT_MS);
    image.decoding = "async";
    image.addEventListener("load", () => {
      clearTimeout(timer);
      resolve(image);
    }, { once: true });
    image.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("imagem"));
    }, { once: true });
    image.src = src;
  });
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

/**
 * As linhas de crédito da imagem, quando as cartas levam foto de outra pessoa
 * (ICM 74, #348). `photos` são os créditos das cartas que entram na imagem
 * (`{ author, license }`, como no catálogo). Sai uma linha com quem fez cada
 * foto e a licença, sem repetir, e outra dizendo onde estão os créditos
 * completos. Sem foto com crédito, nenhuma linha: a imagem fica como era.
 */
export function shareCreditLines(photos = []) {
  const credits = [...new Set(photos
    .filter((photo) => photo && typeof photo.author === "string" && photo.author && typeof photo.license === "string" && photo.license)
    .map((photo) => `${photo.author} (${photo.license})`))];
  if (!credits.length) return [];
  return [`${credits.length === 1 ? "Foto" : "Fotos"}: ${credits.join(" · ")}`, `Créditos completos em ${SHARE_ORIGIN.replace("https://", "")}/creditos.html`];
}

/**
 * Uma linha que cabe na largura: a letra diminui de 2 em 2 até caber; no
 * tamanho mínimo, o que ainda sobra é cortado com reticências.
 * `measure(texto, tamanho)` devolve a largura, como o canvas faria.
 */
export function fitLine(measure, text, { size, min = 20, maxWidth }) {
  let current = size;
  while (current > min && measure(text, current) > maxWidth) current = Math.max(min, current - 2);
  if (measure(text, current) <= maxWidth) return { size: current, text };
  let cut = text;
  while (cut.length > 1 && measure(`${cut.trimEnd()}…`, current) > maxWidth) cut = cut.slice(0, -1);
  return { size: current, text: `${cut.trimEnd()}…` };
}

/** Escreve o texto centrado, numa linha que cabe na largura. */
function fitText(context, text, y, { size, weight, color, maxWidth = WIDTH - 140, min = 20 }) {
  const measure = (value, current) => {
    context.font = `${weight} ${current}px ${FONT}`;
    return context.measureText(value).width;
  };
  const line = fitLine(measure, text, { size, min, maxWidth });
  context.font = `${weight} ${line.size}px ${FONT}`;
  context.fillStyle = color;
  context.fillText(line.text, WIDTH / 2, y);
}

function drawCard(context, image, { x, y, width, height }, radius) {
  context.save();
  context.shadowColor = "rgba(16, 24, 40, 0.28)";
  context.shadowBlur = Math.round(width / 12);
  context.shadowOffsetY = Math.round(width / 26);
  context.fillStyle = "#ffffff";
  roundedRect(context, x, y, width, height, radius);
  context.fill();
  context.restore();
  context.save();
  roundedRect(context, x, y, width, height, radius);
  context.clip();
  context.drawImage(image, x, y, width, height);
  context.restore();
}

/**
 * Monta a imagem que vai para a rede social: fundo branco, o nome, a
 * pergunta, a carta escolhida, as finalistas, o endereço e, quando as cartas
 * levam foto de outra pessoa, o crédito das fotos (`photos`). `others` são as
 * outras finalistas (`{ src }`); uma que não carregue fica de fora, e a
 * imagem sai assim mesmo. Devolve um `File` JPEG, ou null se o navegador não
 * conseguir desenhar.
 */
export async function shareImage({ src, name, question, others = [], photos = [] }) {
  try {
    const [card, ...rest] = await Promise.all([
      loadImage(src),
      ...others.slice(0, 3).map((other) => loadImage(other.src).catch(() => null)),
    ]);
    const finalists = rest.filter(Boolean);
    const layout = shareImageLayout({ ratio: card.naturalHeight / card.naturalWidth, others: finalists.length });
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    fitText(context, "MINHA ESCOLHA", layout.kickerY, { size: 28, weight: 600, color: "#6b7280" });
    fitText(context, name, layout.nameY, { size: 64, weight: 700, color: "#111418" });
    fitText(context, question, layout.questionY, { size: 36, weight: 600, color: "#374151" });
    drawCard(context, card, layout.hero, 26);
    if (finalists.length) {
      fitText(context, "TAMBÉM NA FINAL", layout.labelY, { size: 26, weight: 600, color: "#6b7280" });
      finalists.forEach((image, index) => drawCard(context, image, layout.finalists[index], 14));
    }
    // "Responda em polimatch.com.br", com "match" em verde.
    context.font = `700 40px ${FONT}`;
    const parts = [["Responda em poli", "#111418"], ["match", "#08805a"], [".com.br", "#111418"]];
    let x = (WIDTH - parts.reduce((total, [part]) => total + context.measureText(part).width, 0)) / 2;
    context.textAlign = "left";
    for (const [part, color] of parts) {
      context.fillStyle = color;
      context.fillText(part, x, layout.footerY);
      x += context.measureText(part).width;
    }
    // O crédito das fotos, embaixo do endereço, quando as cartas levam foto de outra pessoa.
    context.textAlign = "center";
    shareCreditLines(photos).forEach((line, index) => {
      fitText(context, line, layout.footerY + 30 + index * 22, { size: 18, min: 12, weight: 500, color: "#6b7280", maxWidth: WIDTH - 80 });
    });

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ? new File([blob], SHARE_FILE_NAME, { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
