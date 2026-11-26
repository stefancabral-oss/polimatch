# HANDOFF — ICM 75 — Rodadas novas enquanto houver confrontos por ver — #350

Estado: `aguardando gate do merge`. Nada deste estágio está em produção.

## O que foi pedido e o que é escolha do agente

Em 26/11/2026 o Stefan pediu, por voz, que a pesquisa fique aberta para
votar enquanto houver confrontos que a pessoa ainda não votou, e respondeu
"É isso." à leitura do agente: rodadas novas da mesma pesquisa, com grupos
diferentes, até cada carta ter enfrentado todas as outras. As palavras dele e
a pergunta estão na decisão 0007
(`docs/decisions/0007-rodadas-enquanto-houver-confrontos.md`).

O resto é escolha do agente e está listado lá: oito escolhas de regra e de
dado (1 a 8), que a pergunta do merge leva por extenso, e três de desenho
(9 a 11).

## O que foi feito

### 75a — Registro

- Decisão 0007 e `stages/75_more_rounds/CONTEXT.md`, com as regras, o
  contrato da API, o banco e as telas.
- Nota na decisão 0001 (o item 2, "não se repete para a mesma pessoa", foi
  alterado), seção nova no `CONTEXT.md` da raiz, e o `AGENTS.md` e o
  `README.md` passam a citar as decisões 0002 a 0007.
- `docs/security/VOTE_ABUSE_POLICY.md`, versão 6: seção "Rodadas da pesquisa
  por foto". Nenhum número das versões anteriores muda.

### 75b — Regras e servidor

- `shared/photo-survey.js`: `pairKey`, `roundPairKeys` (as duplas de uma
  rodada respondida: as de cada tela de voto e as da final), `seenPairKeys`,
  `totalPairCount`, `surveyProgress` e `drawRound`, que monta uma rodada nova
  com prioridade para as duplas que a pessoa ainda não viu. A primeira rodada
  continua sendo `drawCards`.
- `back/src/photo-survey-store.js`: duas tabelas novas, criadas na subida da
  API, `photo_survey_round_draws` e `photo_survey_round_responses`, com chave
  `(survey_id, player_id, round)`, `round >= 2` e gatilho que recusa
  alteração e exclusão; migração `2026-11-26-photo-survey-rounds-v1`. As
  tabelas `photo_survey_draws` e `photo_survey_responses` não são alteradas
  e guardam a rodada 1.
- O recibo (`answerId`) é único entre as duas tabelas de resposta. Quem
  garante é uma trava tomada no código antes de gravar
  (`pg_advisory_xact_lock`), não uma restrição do banco.
- `back/src/http-app.js`: as rotas são as mesmas. `POST …/draw` aceita
  `next: true` no corpo; `POST …/response` aceita `round`. As duas devolvem,
  além do que já devolviam, `round`, `progress` (`answeredRounds`,
  `seenPairs`, `totalPairs`, `canContinue`) e `lastAnswered`. Erro novo:
  HTTP 400 `PHOTO_SURVEY_DRAW_INVALID`, motivo `next`; e o motivo `round` em
  `PHOTO_SURVEY_RESPONSE_INVALID`.
- Um aplicativo que não manda `next` nem `round` tem o comportamento de
  antes, inclusive a recusa ao tentar responder de novo.
- As rodadas de 2 em diante pertencem só ao jogador da conta com cadastro. A
  regra de identidade da rodada 1 (a conta mais os anônimos ligados a ela)
  não se estende a elas (escolha 8 da decisão 0007).
- Testes: `shared/photo-survey.test.js`, `back/src/photo-survey-store.test.js`
  (novo, com um banco em memória em `back/test-support/`),
  `back/src/photo-survey-http.test.js` e os roteiros
  `back/scripts/photo-survey-smoke.mjs` e `cpf-registration-smoke.mjs`.

### 75c — Tela

- `app/src/photo-survey-flow.js`: as regras das rodadas na página
  (`roundState`, `nextRoundNumber`, `registeredCopy`, `coverFeature`,
  `answeredElsewhere`) e a rodada no que o aparelho guarda. O que se guarda
  da rodada 1 é igual ao de antes.
- `app/src/api.js`: o pedido de sorteio manda `next: true` só no toque em
  "Mais uma rodada"; a resposta manda `round` só quando o servidor disse o
  número.
- `app/src/photo-survey-page.js`:
  - **Resposta registrada.** Com rodada por jogar: "A escolha desta rodada
    está registrada e não pode ser trocada. Você já viu 30 de 190
    confrontos." (os números vêm do servidor), o botão "Mais uma rodada" em
    cima e, abaixo, lado a lado, "Compartilhar" e o caminho para as outras
    pesquisas. Vistos todos: "Você viu todos os confrontos desta pesquisa.",
    sem o botão. Com a pesquisa fora da janela, ou com um servidor de antes
    das rodadas, a tela é a de antes.
  - **Rodada nova.** As telas de voto são as mesmas. Da segunda rodada em
    diante a etapa diz "Rodada N · Tela X de 4" e o rótulo de cima,
    "Política · Rodada N".
  - **Confirmação.** Com um servidor que conhece rodadas, o aviso passa a
    ser "Depois não dá para trocar a escolha desta rodada.", também na
    primeira rodada: o texto antigo ("não dá para votar de novo nesta
    pesquisa") deixaria de ser verdade.
  - **Capa.** Ordem do destaque: a pesquisa pela metade; a primeira aberta
    sem resposta; a primeira com rodada por jogar, com o botão "Mais uma
    rodada" e o texto "Ainda há confrontos que você não viu."; nenhuma.
    "Suas escolhas" mostra a escolhida da última rodada respondida.
  - **Entrada e cadastro.** "Um CPF, um voto." passa a "Um CPF, uma pessoa.".
- `app/como-funciona.html`, item 5: "Um CPF, uma pessoa: você pode jogar
  várias rodadas da mesma pesquisa, e todas contam como a resposta de uma
  pessoa só."
- `app/src/photo-survey.css` e `app/src/site-menu.css`: os três botões da
  resposta registrada e espaços menores em tela baixa.
- `app/e2e/photo-survey.mjs` e `app/e2e/site-shell.mjs`: o servidor simulado
  segue o contrato novo e pode imitar o servidor antigo; cenários novos das
  rodadas.

## O que muda para quem já usa

- **Quem já respondeu uma pesquisa** passa a ver, ao abri-la, a contagem de
  confrontos e o botão "Mais uma rodada". "Compartilhar" continua na tela,
  agora abaixo dele.
- **Quem já respondeu todas** deixa de ver "Você respondeu todas as pesquisas
  abertas." na capa e passa a ver a primeira pesquisa em destaque, com "Mais
  uma rodada". Para saber qual destacar, a capa espera a resposta do servidor
  sobre as pesquisas respondidas.
- **A capa não emite rodada.** Só o toque em "Mais uma rodada" pede a rodada
  seguinte, como só o toque em "Começar" emite a primeira.
- **Rodada emitida e não respondida.** Abrir a pesquisa leva direto ao voto
  dela. Se a pesquisa fechar antes da confirmação, a tela volta para a última
  rodada respondida, que continua valendo, e avisa que a rodada nova não foi
  registrada.
- **Dois aparelhos na mesma rodada.** Vale a primeira resposta; o segundo
  aparelho vê a resposta que valeu, com aviso.
- **O texto do consentimento do cadastro** continua dizendo "um voto por
  pessoa". Não foi alterado: é o texto que as pessoas aceitaram, e a regra
  que ele descreve (uma pessoa, um peso) é a mesma.

## Quantas rodadas

Cada rodada mostra trinta duplas: seis em cada uma das quatro telas e seis na
final. Com 20 cartas são 190 duplas; com 16, são 120.

Em simulação com 500 sementes (`shared/photo-survey.test.js`), uma pessoa que
responde todas as rodadas viu todos os confrontos em 8 a 10 rodadas com 20
cartas e em 5 a 7 com 16. O teste fixa o máximo medido mais duas rodadas de
folga. Toda rodada nova traz pelo menos uma dupla que a pessoa ainda não viu.

## Verificação

Tudo abaixo foi rodado pelo agente que escreve este handoff, em 26/11/2026,
neste computador (macOS), no código deste PR antes de trazer a `main` mais
nova, que só difere em documentação. O CI do GitHub (Linux) é a referência.

- `npm run test:shared`: 137 de 137.
- `npm test --prefix back`: 335 de 335.
- `npm test --prefix app`: 239 de 239.
- Build do app com o client id de teste do CI: passou, com as três
  conferências do fim.
- Roteiros de banco, na ordem do `back-shared.yml`, contra um PostgreSQL 16
  local descartável: os nove passaram (integração, escolhas ordenadas, duelos
  presidenciais, abuso, progresso do jogo, esquema cívico, resiliência,
  pesquisa por foto e cadastro). Não rodei o ensaio de backup e restauração
  nem a restauração parcial.
- Roteiros de navegador, com `vite preview` local e o servidor simulado dos
  próprios roteiros, depois do build:
  - WebKit: `photo-survey.mjs`, 42 cenários; `site-shell.mjs`, 56;
    `client-error-report.mjs` passou.
  - Chromium: `photo-survey.mjs`, 42; `site-shell.mjs`, 56. O Chromium usado
    é o que já estava nesta máquina (revisão 1187), aberto por um roteiro
    auxiliar fora do repositório; o Playwright do projeto pede a revisão
    1193, que não está instalada. Não rodei `client-error-report.mjs` em
    Chromium.

As telas foram construídas por um agente à parte, que rodou os mesmos testes
antes; o que está acima é a execução repetida depois da revisão. As capturas
de tela que olhei (resposta registrada em 390×844 e em 320×480, tela de voto
da rodada 2 e capa com "Mais uma rodada") foram tiradas por esse agente, em
WebKit, com servidor simulado; não estão no repositório.

## O que não foi conferido

- Nada foi visto em produção: o estágio não está publicado.
- Celular de verdade e conta Google de verdade. As telas foram vistas em
  WebKit e em Chromium neste computador, com servidor simulado.
- O servidor de verdade com PostgreSQL foi exercitado só pelos roteiros de
  banco, não pelo aplicativo no navegador.
- As fontes do Linux do CI são mais largas que as do macOS. "Como funciona"
  ganhou uma frase mais longa e espaços menores em tela baixa; a medida com
  uma fonte larga foi feita pelo agente das telas, não por mim.
- A conta que transforma as rodadas de uma pessoa numa preferência só não
  existe (#177). Este estágio não calcula nem devolve soma nenhuma.
- Quanto tempo leva uma rodada nova para montar no servidor com muitas
  pessoas ao mesmo tempo não foi medido.

## Publicação (75d)

Pede o sim do Stefan, depois do merge.

1. Cópia do banco, como nas publicações anteriores.
2. **API primeiro.** Ao subir, ela cria as duas tabelas novas e grava a
   migração. Com a API nova e o app antigo, nada muda para ninguém: o app
   antigo não pede rodada.
3. **App depois.**
4. Voltar atrás: publicar de novo o commit anterior dos dois serviços. As
   tabelas novas ficam no banco, sem uso; nenhuma linha antiga é alterada.
   Rodadas já respondidas ficam gravadas e deixam de ser mostradas.

## Gate humano

- [ ] Merge: sim do Stefan, com as oito escolhas de regra e de dado por
      extenso na pergunta.
- [ ] Publicação (75d): outro sim, depois do merge.
- [ ] Fechamento da issue #350: outro sim.
