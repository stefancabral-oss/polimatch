# HANDOFF — ICM 75 — Rodadas novas enquanto houver confrontos por ver — #350

Estado: `publicado`. Em 26/11/2026 o PR #352 foi mesclado e a API e o app
foram publicados no commit `e0914ae`. A issue #350 continua aberta.

PR: https://github.com/stefancabral-oss/polimatch/pull/352, branch
`icm/75-more-rounds`. Os commits são os do PR; este arquivo não lista os
hashes porque eles mudam a cada correção.

## O que foi pedido e o que é escolha do agente

Em 26/11/2026 o Stefan pediu que a pesquisa fique aberta para
votar enquanto houver confrontos que a pessoa ainda não votou, e respondeu
"É isso." à leitura do agente: rodadas novas da mesma pesquisa, com grupos
diferentes, até cada carta ter enfrentado todas as outras. As palavras dele e
a pergunta estão na decisão 0007
(`docs/decisions/0007-rodadas-enquanto-houver-confrontos.md`).

O resto é escolha do agente e está listado lá: onze escolhas de regra e de
dado (1 a 11), que a pergunta do merge leva por extenso, e três de desenho
(12 a 14).

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
  antes, inclusive a recusa ao tentar responder de novo. Uma resposta sem
  `round` é sempre da rodada 1, mesmo com uma rodada nova aberta.
- As rodadas de 2 em diante seguem a regra de identidade da rodada 1: são
  procuradas no jogador da conta e nos ligados a ele (escolha 8 da decisão
  0007). Se o jogador ativo da conta muda, a conta continua de onde parou.
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
- **O texto do consentimento do cadastro** continua dizendo "garantir um
  voto por pessoa". Não foi alterado, e ninguém é chamado a aceitar de novo.
  O agente leu a frase como a regra de uma pessoa, um peso; é leitura dele
  sobre um texto que as pessoas aceitaram, e cabe na revisão jurídica (#283).
  É a escolha 10 da decisão 0007.

## Quantas rodadas

Cada rodada mostra trinta duplas: seis em cada uma das quatro telas e seis na
final. Com 20 cartas são 190 duplas; com 16, são 120.

Em simulação com 500 sementes (`shared/photo-survey.test.js`), uma pessoa que
responde todas as rodadas viu todos os confrontos em 8 a 10 rodadas com 20
cartas e em 5 a 7 com 16. O teste fixa o máximo medido mais duas rodadas de
folga. Toda rodada nova traz pelo menos uma dupla que a pessoa ainda não viu.

## Verificação

Tudo abaixo foi rodado pelo agente que escreve este handoff, em 26/11/2026,
neste computador (macOS), duas vezes: antes da leitura independente e de
novo depois das correções que ela pediu. Os números são os da segunda vez. O
CI do GitHub (Linux) é a referência.

- `npm run test:shared`: 137 de 137.
- `npm test --prefix back`: 335 de 335.
- `npm test --prefix app`: 239 de 239.
- Build do app com o client id de teste do CI: passou, com as três
  conferências do fim.
- Roteiros de banco, na ordem do `back-shared.yml`, contra um PostgreSQL 16
  local descartável: os nove passaram (integração, escolhas ordenadas, duelos
  presidenciais, abuso, progresso do jogo, esquema cívico, resiliência,
  pesquisa por foto e cadastro). O do esquema cívico pede um banco sem uso
  e rodou num banco próprio. Não rodei o ensaio de backup e restauração nem
  a restauração parcial.
- Roteiros de navegador, com `vite preview` local e o servidor simulado dos
  próprios roteiros, depois do build:
  - WebKit: `photo-survey.mjs`, 42 cenários; `site-shell.mjs`, 56.
    `client-error-report.mjs` passou na primeira vez e não foi repetido.
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

- Antes do merge, nada foi visto em produção. O que foi lido depois da
  publicação está em "Publicação (75d) — 26/11/2026", abaixo.
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

## Leitura independente

Um agente à parte, somente leitura, leu o PR em 26/11/2026 e segurou o merge.
O que mudou por causa dela:

- **Rodadas e identidade.** As rodadas de 2 em diante eram só do jogador
  ativo da conta: quando ele mudava (um anônimo com voto no jogo antigo
  entrando na mesma conta), a conta podia jogar de novo as rodadas 2 em
  diante. Agora as rodadas são procuradas pela identidade, como a rodada 1.
- **Resposta sem `round`.** Valia para a rodada aberta: uma aba antiga, ainda
  na confirmação da rodada 1, podia ter a resposta gravada numa rodada nova
  cujas telas não mostrou. Agora é sempre da rodada 1.
- **Aba parada numa rodada antiga.** Quando outra aba já estava na rodada
  seguinte, a aba parada não percebia. Agora ela busca a rodada no servidor.
- **Registro.** Duas regras que estavam só no contexto do estágio viraram
  escolhas por extenso (9 e 10); saiu "por voz", que as fontes não trazem; as
  decisões 0004 e 0006 ganharam nota.

Uma segunda leitura, sobre as correções, não segurou o merge. Dela vieram a
escolha 11 por extenso, o primeiro e o último risco da lista abaixo e
acertos de texto. As correções de texto dessa segunda leitura não passaram
por nova leitura.

## Riscos conhecidos

- **Aba com o app antigo e rodada nova aberta.** A pessoa abre uma rodada
  nova no app novo, não confirma, e usa uma aba que ainda está com o app
  antigo. Essa aba mostra as telas da rodada aberta e, ao confirmar, recebe
  a recusa de quem já respondeu, com a escolha da primeira rodada. Nada
  errado é gravado. Recarregar a página traz o app novo. Só acontece com aba
  aberta desde antes da publicação do app.

- **Carta retirada com rodada aberta.** Se uma carta sair do catálogo do app
  enquanto alguém tem uma rodada emitida e não respondida, a tela pede para
  atualizar a página e a pessoa não consegue terminar a rodada nem abrir
  outra. Já valia para a rodada 1; agora vale para qualquer rodada aberta.
  Não mexer nas cartas de uma pesquisa aberta sem tratar isso.
- **Mudança nas cartas de uma pesquisa.** O total de confrontos acompanha as
  cartas atuais (escolha 9): acrescentar cartas reabre a pesquisa para quem
  já tinha visto tudo.
- **Duas abas.** A correção da aba parada foi coberta por teste de unidade,
  não reproduzida em navegador.
- **`:has()` no CSS.** A regra que esconde a barra de etapas em tela muito
  baixa não funciona em Safari anterior ao 15.4; nesses, a tela de 320×480
  com três botões pode precisar de rolagem.
- **Ligar um jogador antigo à conta pode mudar a contagem.** Vale a resposta
  mais antiga de cada rodada na identidade: se o jogador ligado tem uma
  primeira rodada mais antiga, é ela que passa a valer, e o número de
  confrontos vistos pode diminuir.
- **O desempate entre dois jogadores com a mesma rodada não tem teste
  automático.** Pelo código atual o caso não se alcança da segunda rodada em
  diante; a segunda leitura o reproduziu à mão no banco em memória.
- **O jogo antigo continua ligado na API.** O caso da troca de jogador ativo
  só se alcança chamando a API direto; pela tela atual não há caminho.

## Merge — 26/11/2026

À pergunta "Mesclo o PR 352 quando o CI do último commit ficar verde?", que
levava por extenso as onze escolhas de regra e de dado, o Stefan respondeu
"Sim, mescla". A resposta está transcrita no PR (comentário de 22:17 UTC).
O merge foi por squash às 22:17:45 UTC, no commit
`e0914ae4a91eeb7b2e12f5d77080f2defad73fe1`. A árvore desse commit é igual à
do último commit do PR (`af03864`), que teve o CI aprovado. O CI do push na
`main` terminou aprovado às 22:22:47 UTC.

## Publicação (75d) — 26/11/2026

À pergunta "Faço a cópia do banco e publico a API e o app das rodadas?", o
Stefan respondeu "Sim, publica". Quem publicou foi o agente, pelo painel de
deploy, com uma sessão que já estava aberta; o agente não digitou senha.
Começou depois de o CI da `main` terminar.

1. **Cópia do banco**, no terminal do contêiner do banco: `pg_dump` em
   formato próprio do PostgreSQL, 612.693 bytes, e a contagem de linhas das
   31 tabelas, num arquivo à parte, também no contêiner. Com ela são sete
   cópias guardadas no contêiner.
2. **API**, no commit do merge: o painel mostrou o deploy concluído em
   27 s, com o título do commit `e0914ae` ("[ICM 75] Rodadas novas enquanto
   houver confrontos por ver (#352)"); o hash não apareceu na tela. A
   migração nova no banco confirma que a API publicada é a deste commit. Depois dele, uma nova contagem no mesmo terminal: 33 tabelas.
   Entraram `photo_survey_round_draws` e `photo_survey_round_responses`,
   vazias; `schema_migrations` passou de 5 para 6 linhas, com
   `2026-11-26-photo-survey-rounds-v1`. Nenhuma outra contagem mudou.
3. **App** no mesmo commit. O painel mostrou o deploy concluído em 29 s,
   com o hash `e0914ae4a91eeb7b2e12f5d77080f2defad73fe1`.

Lido de fora, só por GET, depois dos dois deploys:

- `version.json` com `builtAt` `2026-11-26T22:26:52.914Z`. Ele traz `sha`
  `unknown`: não identifica o commit (#287); o commit publicado se lê no
  painel.
- O script principal publicado (`main-C1UIVA4d.js`) traz "Mais uma rodada"
  e não traz "Um CPF, um voto". "Como funciona" traz a frase nova do item 5.
- `/api/health`, as quatro pesquisas, a capa e `/creditos.html` respondem
  200.
- Um roteiro do agente leu `/api/health`, a capa e uma pesquisa a cada
  poucos segundos, de 22:23:41 UTC (depois da cópia do banco e da consulta
  ao CI, antes do deploy da API) até 22:48:55 UTC: 1.626 leituras e nenhuma
  falha. Pelo roteiro, falha é qualquer leitura cujo código não seja 200,
  inclusive tempo esgotado ou erro de rede.

O que o agente não fez nem viu em produção:

- Não abriu navegador contra o site e não fez nenhum pedido de escrita.
- Não jogou rodada nova nem viu a tela de resposta registrada com a
  contagem de confrontos.
- Não leu o log de início da API. Que ela subiu e migrou se vê pelo banco e
  pelas leituras de fora.

Ao sair, o painel voltou para a organização em que abre e a aba foi
fechada. O registro na issue #350 é o comentário da publicação.

### Voltar atrás

Publicar de novo o commit anterior (`835614a`, que tem o mesmo código de
`6e38d32`, o último publicado antes deste) nos dois serviços, app primeiro. As tabelas novas ficam no banco,
sem uso; nenhuma linha antiga é alterada. Rodadas já respondidas ficam
gravadas e deixam de ser mostradas.

## Gate humano

- [x] Merge: "Sim, mescla", 26/11/2026, com as onze escolhas de regra e de
      dado por extenso na pergunta.
- [x] Publicação (75d): "Sim, publica", 26/11/2026.
- [ ] Teste em celular de verdade, com conta Google: do Stefan.
- [ ] Fechamento da issue #350: outro sim.
