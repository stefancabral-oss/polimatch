// Cartas da pesquisa de famosos e influenciadores (ICM 74, #348): a parte que
// não depende de navegador. O roteiro que monta as cartas
// (build-celebrity-cards.mjs) e o teste (src/celebrity-cards.test.js) usam as
// mesmas contas e o mesmo texto, para o teste conferir o que foi gravado.

export const WIDTH = 1060;
export const HEIGHT = 1484;
export const STAGE = "stages/74_celebrity_survey";

// A janela da foto: igual em todas as cartas.
export const WINDOW = Object.freeze({ x: 70, y: 150, width: 920, height: 1000, radius: 28 });
// Onde, dentro da janela, fica o ponto de foco da foto (o rosto).
export const FOCUS_AT = Object.freeze({ x: 0.5, y: 0.42 });

export const escapeXml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const round = (value) => Math.round(value * 100) / 100;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** A linha de crédito da carta: quem fez a foto e a licença. */
export const creditLine = (card) => `Foto: ${card.authorShown} · ${card.license}`;

/** O título da obra, como a licença pede: o nome do arquivo na Wikimedia Commons, sem "File:" e sem a extensão. */
export const workTitle = (card) => card.commons.title.replace(/^File:/, "").replace(/\.[A-Za-z0-9]+$/, "");

/** O endereço de cada licença aceita. */
export function licenseAddress(license) {
  if (license === "CC0") return "https://creativecommons.org/publicdomain/zero/1.0";
  const match = /^CC (BY|BY-SA) ([1-4]\.\d)$/.exec(license);
  if (!match) throw new Error(`licença não aceita: ${license}`);
  return `https://creativecommons.org/licenses/${match[1].toLowerCase()}/${match[2]}`;
}

/** Onde a foto inteira fica para o ponto de foco cair na janela, sem deixar a janela vazia. */
export function placement(card, width, height) {
  const zoom = card.crop?.zoom ?? 1;
  if (!(zoom >= 1)) throw new Error(`${card.id}: o zoom precisa ser 1 ou mais`);
  const scale = Math.max(WINDOW.width / width, WINDOW.height / height) * zoom;
  const shownWidth = width * scale;
  const shownHeight = height * scale;
  const x = clamp(WINDOW.x + WINDOW.width * FOCUS_AT.x - (card.crop?.x ?? 0.5) * shownWidth, WINDOW.x + WINDOW.width - shownWidth, WINDOW.x);
  const y = clamp(WINDOW.y + WINDOW.height * FOCUS_AT.y - (card.crop?.y ?? 0.35) * shownHeight, WINDOW.y + WINDOW.height - shownHeight, WINDOW.y);
  return { x: round(x), y: round(y), width: round(shownWidth), height: round(shownHeight), scale: round(scale) };
}

/**
 * A página de créditos: para cada foto, o autor, a licença com o endereço, o
 * título e o endereço de origem, e o que foi mudado. Texto fixo, sem depender
 * de script. O estilo da página conta com `rel="noopener license"` no link da
 * licença (app/src/photo-survey.css).
 */
export function creditsPage(cards) {
  const shareAlike = cards.filter((card) => /\bBY-SA\b/.test(card.license));
  const names = (list) => escapeXml(new Intl.ListFormat("pt-BR").format(list.map((card) => card.name)));
  const item = (card) => `          <li><b>${escapeXml(card.name)}</b><span>Foto de <a href="${escapeXml(card.commons.page)}" rel="noopener">${escapeXml(card.authorShown)}</a>, licença <a href="${escapeXml(card.licenseUrl)}" rel="noopener license">${escapeXml(card.license)}</a>. Título na Wikimedia Commons: “${escapeXml(workTitle(card))}”.</span></li>`;
  const description = "De quem é cada foto das cartas de famosos do PoliMatch, com a licença de cada uma.";
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="description" content="${description}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="pt_BR" />
    <meta property="og:site_name" content="PoliMatch" />
    <meta property="og:title" content="Créditos das fotos — PoliMatch" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="https://polimatch.com.br/creditos.html" />
    <meta property="og:image" content="https://polimatch.com.br/brand/logo-volumetric.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1600" />
    <meta property="og:image:height" content="1000" />
    <meta property="og:image:alt" content="PoliMatch" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Créditos das fotos — PoliMatch" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="https://polimatch.com.br/brand/logo-volumetric.png" />
    <link rel="icon" href="./icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />
    <title>Créditos das fotos — PoliMatch</title>
  </head>
  <body>
    <!-- Página gerada por app/scripts/build-celebrity-cards.mjs a partir de ${STAGE}/output/sources.json. Não editar à mão. -->
    <div class="ps-shell" data-view="credits">
      <header class="ps-top">
        <a class="ps-brand" href="./" aria-label="PoliMatch, início">Poli<b>Match</b></a>
        <button class="pm-menu-btn" type="button" data-action="menu" aria-haspopup="dialog" aria-label="Abrir menu"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" /></svg></button>
      </header>
      <main class="ps-main ps-main--entry" aria-labelledby="credits-title">
        <p class="ps-kicker">PoliMatch</p>
        <h1 class="ps-title" id="credits-title">Créditos das fotos</h1>
        <p class="ps-hint">As fotos das cartas de famosos vêm da Wikimedia Commons, com licença livre. O nome de quem fez a foto leva à página dela.</p>
        <ul class="ps-credits">
${cards.map(item).join("\n")}
        </ul>
        <p class="pm-note">Cada foto foi recortada e redimensionada para caber na carta, que leva o nome da pessoa e o crédito. Nenhuma foto foi editada por IA. A moldura é desenhada por código, escrito com IA.</p>
${shareAlike.length ? `        <p class="pm-note">${shareAlike.length === 1 ? "A carta" : "As cartas"} de ${names(shareAlike)} ${shareAlike.length === 1 ? "pode ser reutilizada" : "podem ser reutilizadas"} nos termos da mesma licença da foto.</p>\n` : ""}        <p class="pm-note">A licença trata do direito de quem fez a foto. O PoliMatch não tem vínculo com as pessoas retratadas, e a presença de alguém aqui não indica apoio dela ao PoliMatch.</p>
        <div class="ps-stack"><a class="ps-btn" href="./">Voltar para as pesquisas</a></div>
      </main>
    </div>
    <script type="module" src="/src/credits-page.js"></script>
  </body>
</html>
`;
}
