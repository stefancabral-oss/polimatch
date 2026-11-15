// Compartilhar a escolha (ICM 70, #334). Só acontece no toque da pessoa e leva
// só a escolha dela: a carta, o nome, a pergunta e o endereço do site. Nunca
// leva resultado somado.

export const SHARE_ORIGIN = "https://polimatch.com.br";
export const SHARE_FILE_NAME = "polimatch-minha-escolha.jpg";
const WIDTH = 1080;
const HEIGHT = 1350;
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
 * Compartilha a escolha. Devolve `"shared"`, `"copied"`, `"cancelled"`
 * (a pessoa fechou a folha de compartilhar), `"unavailable"` ou `"failed"`.
 */
export async function shareChoice({ surveyId, name, question, file = null, nav = globalThis.navigator }) {
  const text = shareText({ name, question });
  const url = shareUrl(surveyId);
  const mode = shareMode(nav, file);
  try {
    if (mode === "file") await nav.share({ files: [file], title: "PoliMatch", text, url });
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

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("imagem")), { once: true });
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

/** Escreve o texto centrado, diminuindo a letra até caber na largura. */
function fitText(context, text, y, { size, weight, color, maxWidth = WIDTH - 140 }) {
  let current = size;
  do {
    context.font = `${weight} ${current}px ${FONT}`;
    current -= 2;
  } while (context.measureText(text).width > maxWidth && current > 24);
  context.fillStyle = color;
  context.fillText(text, WIDTH / 2, y);
}

/**
 * Monta a imagem que vai para a rede social: fundo branco, o nome, a carta, a
 * pergunta e o endereço. Devolve um `File` JPEG, ou null se o navegador não
 * conseguir desenhar.
 */
export async function shareImage({ src, name, question }) {
  try {
    const card = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    fitText(context, "MINHA ESCOLHA", 118, { size: 30, weight: 600, color: "#6b7280" });
    fitText(context, name, 204, { size: 72, weight: 700, color: "#111418" });

    const cardWidth = 560;
    const cardHeight = Math.round(cardWidth * (card.naturalHeight / card.naturalWidth));
    const left = (WIDTH - cardWidth) / 2;
    const top = 262;
    context.save();
    context.shadowColor = "rgba(16, 24, 40, 0.28)";
    context.shadowBlur = 46;
    context.shadowOffsetY = 22;
    context.fillStyle = "#ffffff";
    roundedRect(context, left, top, cardWidth, cardHeight, 30);
    context.fill();
    context.restore();
    context.save();
    roundedRect(context, left, top, cardWidth, cardHeight, 30);
    context.clip();
    context.drawImage(card, left, top, cardWidth, cardHeight);
    context.restore();

    fitText(context, question, top + cardHeight + 96, { size: 46, weight: 600, color: "#111418" });
    // "Responda em polimatch.com.br", com "match" em verde.
    context.font = `700 40px ${FONT}`;
    const parts = [["Responda em poli", "#111418"], ["match", "#08805a"], [".com.br", "#111418"]];
    let x = (WIDTH - parts.reduce((total, [part]) => total + context.measureText(part).width, 0)) / 2;
    context.textAlign = "left";
    for (const [part, color] of parts) {
      context.fillStyle = color;
      context.fillText(part, x, HEIGHT - 70);
      x += context.measureText(part).width;
    }

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ? new File([blob], SHARE_FILE_NAME, { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
