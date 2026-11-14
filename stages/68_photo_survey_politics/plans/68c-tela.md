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
| O que fica no aparelho | Até confirmar: grupos, escolhas, recibo e tela atual. Depois: só que a pessoa respondeu | Escolhas parciais só no aparelho, como manda o contexto. A escolha registrada vem sempre do servidor. |
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
- [x] Implementar e ver os 18 passarem. Com a revisão, 20.

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
| Sem resposta, ou erro do servidor, na confirmação | Aviso de que não deu para saber se chegou; "Voltar e trocar" travado; "Tentar de novo" repete o mesmo recibo |
| Sem resposta na retomada de quem já respondeu | "Sua resposta está registrada.", com aviso e nova tentativa |
| Carta que falha ou não chega em 12 s | A tela inteira espera, com aviso; a nova tentativa pede outro endereço |

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

Um agente separado, somente leitura, revisou o commit `c3a83f5` em 13/11/2026.
Veredito: sem bloqueio, com correções. Ele não achou caminho para duas
respostas, perda de resposta confirmada ou escolha trocada no servidor. O que
ele reproduziu e o que mudou, sempre com o teste antes do código:

| Achado | Correção |
|---|---|
| Quem já respondeu e recarregava com a API fora via a entrada com "Nenhuma escolha foi registrada" | A retomada sem servidor mostra "Sua resposta está registrada." com nova tentativa; quem estava no meio lê que as escolhas continuam no aparelho |
| Tempo esgotado na confirmação dizia "não conseguimos registrar" e deixava trocar; a pessoa via uma escolha e ficava registrada outra | O aviso diz que não deu para saber, e "Voltar e trocar" fica travado até a nova tentativa responder |
| Em tela baixa (celular deitado, navegador embutido) a fileira de baixo saía da tela, e na confirmação as finalistas ficavam atrás dos botões | Cabeçalho compacto abaixo de 600 px de altura, quatro cartas numa fileira com o celular deitado, botões lado a lado abaixo de 640 px; cenários de tamanho em 375×548, 320×480 e 667×375 |
| Imagem que nunca respondia deixava a tela travada sem saída | Prazo de 12 s com o mesmo aviso de falha; a nova tentativa pede outro endereço |
| Número vindo do servidor chegava ao HTML sem escape | `drawSize` e `groupSize` só valem como número pequeno; tudo que entra no HTML é escapado |
| A retomada podia criar jogador e sorteio sem toque, numa corrida estreita | Na retomada sem toque nunca se cria jogador nem se troca de identidade: a página avisa e pede "Continuar" |
| Recarregar na confirmação voltava para a final | Volta para a confirmação; linhas mortas removidas |
| A trava de toque dependia só do atributo `disabled` | `choose` confere o botão, e a grade travada não recebe ponteiro; o e2e toca de verdade numa carta travada |
| Foco no `<body>` depois de falha; etapa não anunciada | O foco volta ao título depois de cada falha; o título leva a etapa como descrição; área de toque da marca com 44 px |
| Textos imprecisos; erro de renderização virava "falha de rede" | Textos por tipo de falha; a renderização saiu de dentro do `try` da rede; aviso quando o navegador não salva o progresso |

Saiu também da revisão: depois de registrada, o aparelho guarda só que a pessoa
respondeu, não em quem. A escolha vem do servidor.

Notas que ficam: os e2e rodaram só em WebKit nesta máquina, e o Chromium fica
com o CI. As escolhas parciais ficam no aparelho até a confirmação ou até outra
identidade começar; sair do Google na capa não as apaga. Esse ponto entra nas
condições da 68e, junto com a política de privacidade (#283).

## Depois do primeiro CI

O `ci-gate` do PR #327 falhou no commit `fc5e153`, nos dois navegadores, num
cenário só: em 320×480, na confirmação, as finalistas ficavam atrás dos botões.

| O que o CI mostrou | O que mudou |
| --- | --- |
| No Linux a fonte do sistema é mais larga: o texto da confirmação quebra em uma linha a mais, e a carta escolhida e as finalistas tinham tamanho fixo, com 5 px de folga em 320×480 | Na confirmação e na resposta registrada a carta escolhida ocupa a altura que sobra, até o tamanho que já tinha. Abaixo de 520 px de altura o sobretítulo some e as finalistas ficam menores |
| A resposta registrada tinha o mesmo defeito, já no macOS, sem medida no e2e | O e2e mede as duas telas em todos os tamanhos |
| O teste dependia da fonte da máquina | Dois cenários com o texto mais largo e mais alto (360×640 e 320×480) |
| O teste aceitava as finalistas até 16 px atrás dos botões (apontado na revisão da correção) | Folga de 1 px, e a tela precisa caber sem rolar em pé |
| O texto do botão em três linhas encostava nas bordas | O botão ganhou respiro vertical |

As telas de entrada, de voto e a final não mudaram.
