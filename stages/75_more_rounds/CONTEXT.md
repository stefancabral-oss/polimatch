# ICM 75 — Rodadas novas enquanto houver confrontos por ver — #350

Base: `main` em `835614a` (construído sobre `6e38d32`; a diferença entre os
dois é só documentação).
Ler o contexto raiz, o `AGENTS.md`, as decisões 0001, 0004 e 0007, a política
`docs/security/VOTE_ABUSE_POLICY.md` e os contextos dos estágios 68, 70 e 71.

## Objetivo

Deixar a pesquisa aberta para a pessoa enquanto houver confronto entre cartas
que ela ainda não viu: depois de responder, ela pode jogar rodadas novas da
mesma pesquisa, com grupos diferentes, até cada carta ter enfrentado todas as
outras (decisão 0007).

## Entradas

- Issue #350. Em 26/11/2026 o Stefan pediu que a pesquisa fique
  aberta para votar enquanto houver confrontos que a pessoa ainda não votou,
  e respondeu "É isso." à leitura do agente: rodadas novas, com grupos
  diferentes, até cada carta ter enfrentado todas as outras. As palavras dele
  e a pergunta estão na decisão 0007. O resto é escolha do agente, listada
  lá.
- O que os estágios 68 a 74 construíram: regras em `shared/photo-survey.js`,
  servidor em `back/src/photo-survey-store.js` e rotas em
  `back/src/http-app.js`, página em `app/src/photo-survey-page.js`, regras da
  página em `app/src/photo-survey-flow.js`, menu em `app/src/site-menu.js`,
  imagem do compartilhar em `app/src/share-choice.js`.

## O que existe hoje e o que muda

| Tema | Hoje | Depois deste estágio |
|---|---|---|
| Quantas vezes | Uma resposta por pessoa e por pesquisa | Uma resposta por rodada; rodadas novas enquanto houver confronto por ver |
| Sorteio | Um por pessoa e por pesquisa: 16 cartas ao acaso, em quatro telas | A primeira rodada, igual. As seguintes são montadas pelo servidor com prioridade para as duplas que a pessoa ainda não viu |
| Fim | Ao confirmar | Ao confirmar cada rodada. A pesquisa fecha para a pessoa quando ela viu todos os confrontos, ou quando sai da janela |
| Banco | `photo_survey_draws` e `photo_survey_responses`, uma linha por jogador e pesquisa | As duas ficam como estão e guardam a primeira rodada. As rodadas seguintes vão para duas tabelas novas, com a rodada na chave |
| Tela de resposta registrada | Compartilhar e próxima pesquisa | Entra "Mais uma rodada", enquanto houver confronto por ver, e quantos a pessoa já viu |
| Capa | Destaca a pesquisa pela metade ou a primeira não respondida | Depois dessas, destaca a primeira que ainda tem confrontos por ver |
| "Como funciona" | "Um CPF, um voto: cada pessoa responde uma vez em cada pesquisa." | Texto novo: várias rodadas, uma pessoa só |

## Regras

1. **Rodada.** O que hoje é a pesquisa inteira: um sorteio de `drawSize`
   cartas em telas de `groupSize`, uma escolha por tela, a final entre as
   escolhidas e a confirmação. As rodadas de uma pessoa numa pesquisa são
   numeradas a partir de 1. A resposta que já existe é a rodada 1.
2. **Confronto.** Uma dupla de cartas que apareceu junta na mesma tela de uma
   rodada **respondida**: numa das telas de voto (as duplas dentro de cada
   grupo) ou na final (as duplas entre as escolhidas). Rodada com sorteio e
   sem resposta não conta.
3. **Total de confrontos.** Todas as duplas das cartas atuais da pesquisa:
   `n × (n − 1) / 2`. São 190 com 20 cartas e 120 com 16. Dupla que envolva
   carta que saiu da pesquisa não conta, nem como vista nem como total.
4. **Aberta para a pessoa.** Há rodada nova enquanto existir dupla ainda não
   vista e a pesquisa estiver na janela (`open`). Uma rodada só começa depois
   de a anterior ter sido respondida.
5. **Montagem da rodada nova** (rodada 2 em diante). O servidor escolhe as
   cartas e os grupos dando prioridade às duplas ainda não vistas. Enquanto
   houver dupla por ver, a rodada nova traz pelo menos uma. Entre montagens
   equivalentes decide o sorteio, com a mesma fonte de acaso do servidor. As
   cartas mostradas nunca vêm do cliente.
6. **Resposta.** Uma por rodada, conferida contra o sorteio daquela rodada,
   imutável. Repetir a mesma resposta da mesma rodada é recuperação
   idempotente. Outra escolha para uma rodada já respondida é recusada (HTTP
   409, `PHOTO_SURVEY_ALREADY_ANSWERED`), como hoje.
7. **Uma pessoa, um peso.** Nenhuma soma é calculada neste estágio. A
   política passa a dizer que qualquer contagem futura conta por pessoa, com
   todas as rodadas dela, e não por rodada.
8. **Continuar é opcional.** Nada obriga a pessoa a jogar outra rodada.
9. **Cadastro.** Como hoje: sem entrar e sem cadastro não há sorteio nem
   resposta, em rodada nenhuma.

## Contrato da API

As rotas são as mesmas. O que muda é aditivo: um aplicativo antigo, que não
manda os campos novos, se comporta como hoje enquanto a pessoa não tiver
uma rodada nova aberta (ver os riscos no HANDOFF).

`POST /api/photo-surveys/:surveyId/draw`

- Corpo: pode trazer `"next": true`.
- Sem `next`:
  - sem rodada nenhuma: emite a rodada 1, como hoje;
  - com rodada aberta (sorteio sem resposta): devolve essa rodada, com
    `response: null`;
  - com a última rodada respondida: devolve o sorteio e a resposta dela.
- Com `next: true`:
  - com rodada aberta: devolve essa rodada (não emite outra);
  - com a última rodada respondida, confronto por ver e pesquisa aberta:
    emite a rodada seguinte e a devolve, com `response: null`;
  - sem confronto por ver, ou com a pesquisa fora da janela: devolve a
    última rodada respondida, como sem `next`. Não é erro.
- Resposta: os campos de hoje (`survey`, `draw`, `response`) mais
  - `round`: o número da rodada devolvida;
  - `progress`: `{ answeredRounds, seenPairs, totalPairs, canContinue }`.
    `canContinue` é verdadeiro quando a última rodada está respondida, há
    confronto por ver e a pesquisa está aberta. Com rodada aberta é falso;
  - `lastAnswered`: `null` quando a pessoa não respondeu nenhuma rodada;
    senão `{ round, response }`, com a resposta da última rodada respondida.
    Com uma rodada aberta, é a da rodada anterior.
- `next` que não seja verdadeiro ou falso é recusado (HTTP 400,
  `PHOTO_SURVEY_DRAW_INVALID`, motivo `next`).

`POST /api/photo-surveys/:surveyId/response`

- Corpo: os campos de hoje mais `round`, opcional.
- Sem `round`: a resposta é da rodada 1, com o comportamento de hoje, mesmo
  quando há uma rodada nova aberta. É o que manda um aplicativo de antes das
  rodadas.
- Com `round`: precisa ser a rodada aberta ou uma já respondida. Rodada que
  não existe é recusada (HTTP 400, `PHOTO_SURVEY_RESPONSE_INVALID`, motivo
  `round`).
- Resposta: os campos de hoje mais `round`, `progress` e `lastAnswered`. Na
  repetição idempotente de uma rodada antiga, `round` e `response` são os
  dela, e `lastAnswered` continua sendo a última rodada respondida.

O recibo (`answerId`) continua único entre todas as respostas, de todas as
rodadas.

## Banco

- `photo_survey_draws` e `photo_survey_responses` não são alteradas. Elas
  guardam a rodada 1, com a regra de identidade de hoje (o jogador mais os
  anônimos ligados a ele).
- Tabelas novas, criadas na subida da API, imutáveis como as atuais:
  `photo_survey_round_draws` e `photo_survey_round_responses`, com chave
  `(survey_id, player_id, round)` e `round >= 2`. A resposta referencia o
  sorteio da mesma rodada.
- Nenhuma linha existente é alterada ou apagada. Voltar ao commit anterior
  deixa as tabelas novas sem uso.
- As rodadas de 2 em diante seguem a regra de identidade da rodada 1: são
  procuradas no jogador da conta e nos ligados a ele. Havendo a mesma rodada
  em mais de um deles, vale a respondida mais antiga. A rodada nova é
  gravada no nome do jogador ativo, e a resposta, no nome de quem recebeu o
  sorteio dela.
- O recibo único entre as duas tabelas de resposta é garantido por uma trava
  tomada no código antes de gravar, não por restrição do banco.

## Tela

1. **Resposta registrada.** O texto passa a falar da rodada. Com
   `canContinue`, o botão principal é "Mais uma rodada"; "Compartilhar" e o
   caminho para as outras pesquisas continuam. Uma linha diz quantos
   confrontos a pessoa já viu e quantos existem. Vistos todos, a tela diz
   que ela viu todos os confrontos. Com a pesquisa fora da janela, a tela é
   a de antes das rodadas.
2. **Rodada nova.** O toque em "Mais uma rodada" pede o sorteio com `next` e
   leva às telas de voto, iguais às de hoje. O indicador mostra a rodada.
3. **Capa.** Ordem do destaque: a pesquisa pela metade; a primeira aberta
   ainda não respondida; a primeira com confrontos por ver; nenhuma. "Suas
   escolhas" mostra a escolhida da última rodada de cada pesquisa.
4. **Compartilhar.** A imagem é a da rodada mostrada, como hoje.
5. **"Como funciona".** O item 5 passa a dizer: "Um CPF, uma pessoa: você
   pode jogar várias rodadas da mesma pesquisa, e todas contam como a
   resposta de uma pessoa só."
6. **Entrada, cadastro e confirmação.** As telas de entrada e de cadastro
   passam de "Um CPF, um voto." para "Um CPF, uma pessoa.". A confirmação
   passa a dizer que não dá para trocar a escolha desta rodada. O texto do
   consentimento do cadastro (`shared/registration.js`) não muda.

## Entregas

| Parte | O que traz |
|---|---|
| 75a — Registro | Decisão 0007, este contexto, nota na decisão 0001, versão nova da política de integridade do voto, notas no `AGENTS.md` e no `CONTEXT.md` |
| 75b — Regras e servidor | Confrontos, montagem da rodada e progresso em `shared/`; tabelas novas, sorteio e resposta por rodada no servidor; testes |
| 75c — Tela | Resposta registrada, rodada nova, capa, "Como funciona"; testes e roteiros de navegador |
| 75d — Publicação | API e app, com o sim do Stefan. A API vai antes do app. Feita em 26/11/2026, no commit `e0914ae` |

## Critérios de aceite

- Uma pessoa que responde todas as rodadas vê todos os confrontos e a
  pesquisa fecha para ela. Em simulação com muitas sementes, isso leva um
  número limitado de rodadas; o teste fixa o limite medido para 20 cartas com
  sorteio de 16 e para 16 cartas com sorteio de 16.
- Toda rodada nova tem pelo menos uma dupla que a pessoa ainda não viu.
- Um aplicativo que não manda `next` nem `round` tem o comportamento de hoje,
  inclusive o erro ao tentar responder de novo.
- As respostas e os sorteios já gravados continuam valendo como rodada 1, sem
  alteração nas tabelas atuais.
- Uma resposta por rodada; repetição idempotente; recibo único entre todas as
  rodadas; sem rodada nova fora da janela; sem sorteio nem resposta sem
  cadastro.
- Nenhuma rota devolve soma de respostas.
- Os roteiros de navegador dos estágios 68 a 74 passam, ajustados onde a
  tela mudou de propósito.

## Fora de escopo

- A conta que transforma as rodadas de uma pessoa numa preferência só, e
  qualquer resultado somado (#177).
- Mudança nas cartas, nas perguntas ou na ordem das pesquisas.
- Mudança no cadastro.
- Publicação da pesquisa de famosos (estágio 74, parte 74d), que é anterior a
  este estágio.

## Gate humano

Merge e publicação pedem o sim do Stefan, um a um. A pergunta do merge leva
por extenso as escolhas de regra e de dado da decisão 0007 (1 a 11).
