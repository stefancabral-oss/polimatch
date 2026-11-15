# 70 — Plano

Decisões de implementação das partes 70a a 70d. Cada tarefa começa pelo
teste, que precisa falhar pelo motivo esperado antes do código.

## 70a — Regras (`shared/`, sem mudança em `back/src`)

- `definePhotoSurvey` recebe e devolve `subject`; `publicPhotoSurvey` inclui
  `subject`.
- `PHOTO_SURVEYS` ganha `politica-2026-02`: `subject: "Política"`,
  `question: "Em quem você confia mais?"`, as mesmas 20 cartas, 16 e 4. A
  primeira ganha `subject: "Política"`.
- Testes: `shared/photo-survey.test.js` (as duas definições; ids únicos; a
  visão pública traz o assunto) e um caso em
  `back/src/photo-survey-http.test.js` ou no smoke (o mesmo jogador nas duas).

## 70b — Página por pesquisa (`app/src/photo-survey-page.js`)

- `photo-survey-flow.js`: sai `PHOTO_SURVEY_ID`; entram
  `surveyIdFromSearch(search, surveys)` (lê `p`, devolve o id se existir),
  `answeredSurveyIds(text, identityTag, surveys)` e
  `featuredSurveyId(views, answeredIds)` (primeira aberta sem resposta; senão
  `""`).
- Na página, `surveyId` vira estado. `definition`, `savedRecord`, `persist`,
  `forgetSaved`, `resumable`, `start`, `submit` e os pedidos à API usam o
  `surveyId` atual. O leque da entrada é sorteado uma vez por pesquisa e por
  visita.
- `init()`: com `?p=` válido, abre essa pesquisa (como hoje). Sem `p`, a
  capa. Uma pesquisa em andamento para a identidade atual, se aberta, vira o
  destaque com "Continuar"; a capa não redireciona.
- "Começar" troca o endereço para `?p=<id>` (`history.replaceState`).

## 70c — Capa e menu

- `renderHome()`: lê as visões públicas de todas as pesquisas em paralelo;
  uma que falhe com 404 some da lista; qualquer outra falha, em qualquer
  leitura, mostra o aviso com "Tentar de novo". Monta: entrada da pesquisa em destaque
  (`#ps-title`, `.ps-fan`, `#ps-action` continuam com esses ids), "Suas
  escolhas", "Mais pesquisas", "Em breve".
- "Suas escolhas": para cada id respondido, `drawPhotoSurvey` devolve a
  resposta; falha de rede deixa a linha sem a carta, com "Ver".
- Navegação entre capa e pesquisa por endereço, com recarga: links comuns. Só o
  "Começar" da capa troca o endereço sem recarregar (`history.replaceState`).
- `site-menu.js`: `menuMarkup` recebe `surveys` (`[{ id, subject, question }]`)
  e lista cada uma com link `./?p=<id>`.

## 70d — Compartilhar (`app/src/share-choice.js`)

- `shareText({ name, question })`: o texto.
- `shareImage({ src, name, question })`: desenha num `<canvas>` 1080×1350 e
  devolve um `File` JPEG. A página monta a imagem quando a tela de resposta
  aparece, para o toque chamar o compartilhamento na hora.
- `shareChoice(...)`: `navigator.canShare({ files })` → `navigator.share` com
  arquivo; senão `navigator.share` com texto e link; senão copia o link.
  Cancelar o compartilhamento não é erro.

## Testes de navegador

- `photo-survey.mjs` passa a abrir `/?p=politica-2026-01`.
- `site-shell.mjs` ganha os cenários da capa, das duas pesquisas, de "Suas
  escolhas" e do compartilhamento (com `navigator.share` simulado).
