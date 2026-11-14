# Entrega 68c — A tela da pesquisa por foto

> Execução: nativa, numa sessão só, com testes antes do código e um revisor
> independente no fim. Os passos usam caixas (`- [x]`) para o acompanhamento.

**Objetivo:** uma página nova em `app/` que leva a pessoa da entrada à
resposta registrada da pesquisa `politica-2026-01`, usando as três rotas da 68b.

**Arquitetura:** página própria (`pesquisa.html`), ao lado do jogo atual, sem
tocar em `main.js`. As regras de escolher, voltar, trocar e retomar ficam num
módulo puro, testado sem navegador. A página cuida de tela, rede e
armazenamento. O sorteio e a resposta são do servidor; o aparelho guarda só as
escolhas parciais.

**Pilha:** JavaScript sem framework, Vite (entrada nova no build), `node:test`
e Playwright (Chromium e WebKit no CI).

**Especificação:** `stages/68_photo_survey_politics/CONTEXT.md` (seções "O
formato desta etapa", "Regras" e os critérios de aceite da 68c) e as quatro
telas de `references/`.

## Restrições globais

- Abrir a página não cria jogador nem grava nada. O jogador nasce no toque em
  "Começar".
- Um toque por tela; voltar e trocar até a confirmação; nada depois dela.
- Todas as cartas com o mesmo padrão e o mesmo tamanho na tela.
- Fora do menu e do sitemap, com `noindex`. Nenhuma página pública aponta
  para ela antes da 68e.
- Os testes e os e2e do jogo atual passam sem mudança. Só mudam os que fixam
  a lista de páginas do build.
- Sem som, sem háptica, sem resultado somado, sem compartilhar.
- Texto em português, curto; visual das referências: fundo branco, verde
  `#08805a`, fonte do sistema.

## Decisões que a especificação deixava abertas

| Tema | Decisão | Motivo |
|---|---|---|
| Endereço | `pesquisa.html`, entrada `photoSurvey` no Vite | Uma página para as pesquisas; a de política é a primeira. |
| Cartas da entrada | 3 das 20, sorteadas no aparelho a cada visita | Nenhuma carta fica em destaque fixo. |
| Toque liberado | Só depois de as quatro imagens da tela carregarem | Nenhuma carta sai na frente por ter carregado antes. Se uma falha, a tela toda espera. |
| Tamanho da grade | A largura acompanha a altura livre | As quatro cartas cabem sem rolar; nenhuma fica abaixo da dobra. |
| Depois de trocar | Segue para a primeira tela sem escolha; com as quatro feitas, direto para a final | Trocar uma escolha não obriga a refazer as outras. |
| Trocar a carta que era a escolhida | A escolhida é apagada | A final nunca aponta para uma carta que saiu. |
| Recibo (`answerId`) | Um por percurso, guardado com as escolhas | A nova tentativa depois de falha de rede repete o mesmo recibo. |
| Retomada | Quem já começou nesta identidade vai direto ao sorteio ao abrir | O sorteio já existe: retomar não grava nada novo. |
| O que fica no aparelho | Grupos, escolhas, recibo, tela atual e a resposta registrada | Escolhas parciais só no aparelho, como manda o contexto. |
| Identidade no que fica salvo | Uma marca curta da chave (FNV-1a), nunca a chave | Não espalhar a chave de acesso por outra entrada do armazenamento. |
| Troca de identidade | A página volta à entrada com aviso e pede um toque em "Continuar" | A identidade nova só recebe sorteio com um toque da pessoa. |
| Resposta recusada por não bater com o sorteio | A página busca o sorteio de novo e recomeça | Nota da revisão da 68b. |
| Botão voltar do navegador | Sai da página; ao voltar, a pessoa retoma de onde parou | Fica para avaliar no teste por agentes (68d). |
| Aviso | Logo abaixo do título | Aparece sem rolar, inclusive em tela baixa. |

## Arquivos

- Criar `app/pesquisa.html`: a página, com `noindex` e a prévia de
  compartilhamento que o build exige de toda entrada.
- Criar `app/src/photo-survey-flow.js` e `app/src/photo-survey-flow.test.js`:
  regras puras.
- Criar `app/src/photo-survey-page.js` e `app/src/photo-survey.css`: a tela.
- Criar `app/e2e/photo-survey.mjs`: os cenários de navegador.
- Mudar `app/src/api.js` e `app/src/api.test.js`: `loadPhotoSurvey`,
  `drawPhotoSurvey`, `respondPhotoSurvey`.
- Mudar `app/vite.config.js`: a entrada nova.
- Mudar `app/src/share-preview.test.js`, `app/src/edge-delivery.test.js` e
  `app/src/error-reporter.test.js`: passam a conhecer a página nova.
- Mudar `.github/workflows/ui-interaction-smoke.yml`: o passo do e2e novo.

## Tarefa 1 — Regras do percurso

**Interfaces** (`app/src/photo-survey-flow.js`):

- `PHOTO_SURVEY_ID = "politica-2026-01"`, `PHOTO_SURVEY_STORAGE_KEY = "polimatch:photo-survey:v1"`.
- `sampleCards(cardIds, count, randomInt) → string[]`.
- `freshProgress(groups, uuid) → { groups, picks, championId, answerId, step }`.
  `step`: 0 a n-1 são as telas de voto, n é a final, n+1 a confirmação.
- `progressView(progress) → { kind: "vote" | "final" | "confirm", … }`.
- `pickCard(progress, cardId)`, `chooseChampion(progress, cardId)`, `goBack(progress)`:
  devolvem um progresso novo, ou o mesmo objeto quando o toque não vale.
- `responseBody(progress) → { answerId, pickIds, championId } | null`.
- `restoreProgress(saved, groups, uuid)`: retoma só com o mesmo sorteio e
  confere cada campo salvo contra ele.
- `sameGroups`, `identityTag(key)`, `readSavedProgress(text, surveyId)`,
  `savedProgressText(text, surveyId, { identity, progress, response })`.

- [x] Escrever `photo-survey-flow.test.js` (18 testes) e ver falhar por módulo ausente.
- [x] Implementar e ver os 18 passarem.

## Tarefa 2 — Cliente da API e entradas do build

- [x] Testes em `api.test.js` (3 novos): a definição vai sem identidade; o
  sorteio vai com a identidade e sem carta; a resposta leva só recibo,
  escolhas e escolhida.
- [x] Testes das listas de páginas: cinco entradas; o sitemap lista só as
  indexáveis; nenhuma página pública aponta para `pesquisa.html`; a página
  nova instala o relato de erros primeiro e tem um único script de módulo.
- [x] Ver falhar; implementar em `api.js` e `vite.config.js`; ver passar.

## Tarefa 3 — A tela

Estados: entrada, abrindo (retomada), voto (4 telas), final, confirmação,
registrada, fechada, ainda não abriu, indisponível.

Respostas do servidor e o que a tela faz:

| Resposta | Tela |
|---|---|
| `GET` 404 (rotas desligadas ou pesquisa inexistente) | "Esta pesquisa não está disponível." |
| `GET` sem resposta | Entrada com aviso e "Tentar de novo" |
| `POST /api/player` 429 `PLAYER_ISSUANCE_LIMIT` | Aviso próprio de cota, com o horário e o caminho do Google |
| Sorteio com `response` | Registrada |
| Sorteio com pesquisa não aberta, ou 409 `PHOTO_SURVEY_CLOSED` | Fechada ou "ainda não abriu" |
| Resposta `created` ou `alreadyProcessed` | Registrada |
| 409 `PHOTO_SURVEY_ALREADY_ANSWERED` | Registrada, com a resposta que valeu e um aviso |
| 400 `PHOTO_SURVEY_RESPONSE_INVALID` (motivo `answer-id`) | Recibo novo, escolhas mantidas, aviso |
| 400 pelos outros motivos, ou 409 `PHOTO_SURVEY_DRAW_REQUIRED` | Busca o sorteio de novo e recomeça, com aviso |
| 401 com a chave trocada no aparelho | Entrada com "Sua conta mudou" e "Continuar" |
| 401 com a mesma chave | Aviso de sessão, com o caminho do início; escolhas mantidas |
| Sem resposta na confirmação | Aviso; "Tentar de novo" repete o mesmo recibo |

- [x] Escrever `app/e2e/photo-survey.mjs` com a API simulada pelas mesmas
  regras de `shared/photo-survey.js`.
- [x] Implementar `photo-survey-page.js`, `photo-survey.css` e `pesquisa.html`.
- [x] Rodar o e2e em WebKit local e conferir as telas por captura em 390×844
  e 375×667.
- [x] Passo novo em `ui-interaction-smoke.yml`.

## Tarefa 4 — Página e API de verdade, juntas

- [x] Subir a API local com PostgreSQL descartável e
  `PHOTO_SURVEYS_ENABLED=true`, servir o build e jogar pela página sem
  simulação; conferir as linhas gravadas e as tabelas do jogo.

## Foco da revisão

1. Identidade que muda sem aviso (mesma aba, histórico): a página confere ao
   voltar a aparecer. Coberto no cenário de troca de identidade.
2. Confirmação gravada sem a resposta chegar: a nova tentativa não duplica.
   Coberto.
3. Duas abas e dois aparelhos da mesma identidade: uma resposta só. Coberto.
4. Armazenamento salvo adulterado: `restoreProgress` confere cada campo.
   Coberto nos testes de unidade.
5. Imagem que não carrega: nenhuma carta aceita toque. Coberto.

## Depois da revisão independente

A preencher com o que a revisão achar.
