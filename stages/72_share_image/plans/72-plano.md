# 72 — Plano

Decisões de implementação. Cada tarefa começa pelo teste; onde isso não
aconteceu, o HANDOFF diz.

## `app/src/share-choice.js`

- `shareImageLayout({ ratio, others })`: a conta de onde ficam a escolhida, o
  rótulo, as finalistas (até três) e o endereço, na folha de 1080×1350.
- `shareImage({ src, name, question, others })`: desenha com essa conta. Cada
  carta tem prazo de 6 s para carregar; uma finalista que falha ou demora
  fica de fora.
- `fitLine(measure, text, { size, min, maxWidth })`: a letra diminui até a
  linha caber; no mínimo, corta com reticências.
- `shareChoice`: com arquivo, chama `navigator.share({ files })` e nada mais.
  No iPhone, texto ou endereço na mesma chamada faz vários aplicativos
  descartarem a imagem. O texto com o endereço só vai no modo sem arquivo,
  usado pelo botão de link da prévia.
- `sharePlan(nav, file)`: `"file"` ou `"preview"`. Sem imagem também é a
  prévia.
- `sharePreviewMarkup({ state, url, name, others, canShareLink })`: a prévia
  nos três estados (`ready`, `preparing`, `failed`).

## `app/src/photo-survey-page.js`

- `prepareShare(champion, others)`: monta a imagem com a carta que a tela já
  usa (`art.src`, a de 530), não a de 1060. Cada preparação tem um número
  (`shareRun`); o resultado e o prazo de uma preparação antiga são ignorados.
  O botão nasce desabilitado, com `aria-busy`, e libera quando a imagem fica
  pronta, quando a montagem falha ou no prazo de 8 s.
- `share()`: plano `"file"` chama o compartilhamento do aparelho dentro do
  toque; se ele falha (que não seja a pessoa fechando a folha), abre a
  prévia. Plano `"preview"` abre a prévia.
- A prévia (`<dialog class="ps-share">`, fora de `#photo-survey`): mostra a
  imagem com "Baixar imagem"; sem imagem, espera por ela ou oferece "Tentar
  de novo". O endereço local é solto ao fechar pelo botão, por Esc e por uma
  tela nova (`shell()` fecha a prévia). Sem `showModal`, abre pelo atributo e
  ouve o Esc no documento.
- `lockShare()`: a trava do toque repetido se solta sozinha em 10 s, para um
  compartilhamento que nunca responde não matar o botão.

## Roteiro `app/e2e/site-shell.mjs`

- O simulador registra o que foi compartilhado (inclusive as chaves da
  chamada, as medidas e os primeiros bytes do arquivo), o que foi desenhado
  no canvas e os endereços locais criados e soltos; atrasa ou falha a
  montagem da imagem; tira o `showModal`.
- Quatro cenários: o compartilhamento do aparelho; a prévia; fechar a folha
  e a recusa do arquivo; a imagem que demora, falha ou perde uma carta.
