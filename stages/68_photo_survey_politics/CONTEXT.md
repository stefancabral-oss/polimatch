# ICM 68 — Pesquisa por foto, etapa 1: rodada de Política com as cartas de moldura — #324

Base main `77104a3` (merge da #322).
Ler o contexto raiz, o `AGENTS.md` e as decisões
[0001](../../docs/decisions/0001-pesquisa-de-preferencia-por-foto.md) e
[0002](../../docs/decisions/0002-ordem-de-construcao-e-cartas-com-moldura.md).

## Objetivo

Fazer o jogo de política que já está no ar funcionar no formato da pesquisa
por foto, reaproveitando as cartas de moldura que já existem. É a primeira
etapa de produto da direção nova. O jogo atual continua no ar, igual, até esta
etapa estar testada e o Stefan autorizar a troca da entrada.

## Entradas

- Issue #324 e as decisões 0001 e 0002.
- As três telas aprovadas pelo Stefan em 13/11/2026, em `references/`.
- As 20 cartas "Políticos 2026" de `app/public/chromas/politicos`, em 530 e
  1060 pixels de largura. São imagens completas, com moldura e nome.
- O protótipo de 12/11/2026, em
  `stages/67_photo_survey_direction/references/prototipo-pesquisa.html`, como
  referência do fluxo.

## O que existe hoje e o que muda

| Tema | Jogo que está no ar | Etapa 1 |
|---|---|---|
| Telas | 10 telas de 4 cartas por dia, mais aquecimento | 4 telas de 4, uma final e uma confirmação |
| Toque | Duas escolhas em ordem por tela | Um toque por tela |
| Voltar | Não volta | Volta e troca até confirmar |
| Gravação | A cada tela, com Elo | Uma vez, ao confirmar, sem Elo |
| Repetir | Uma rodada por dia | Uma resposta por pessoa em cada pesquisa |
| Arte | Foto com moldura só para parte das pessoas | Carta de moldura no mesmo padrão para todas |

## O formato desta etapa

1. **Conjunto.** As 20 cartas "Políticos 2026". Cada pessoa recebe 16 delas,
   sorteadas. Assim nenhuma das 20 precisa ser excluída por escolha editorial,
   e em conjunto todas aparecem com a mesma frequência.
2. **Telas de voto.** As 16 cartas se dividem em 4 telas de 4. Os grupos e a
   posição de cada carta na tela são sorteados por pessoa. Um toque escolhe e
   avança.
3. **Final.** As quatro escolhidas, em uma tela. Um toque escolhe.
4. **Confirmação.** Mostra a escolhida e as outras três finalistas. "Confirmar
   minha escolha" grava. "Voltar e trocar" volta à final.
5. **Depois de confirmar.** A pessoa vê a escolha registrada e não responde de
   novo nesta pesquisa.
6. **Pergunta.** "Quem você prefere?", a mesma em todas as telas de voto.
7. **Só carta.** Sem perfil, sem texto para ler e sem placar entre as telas.

## Regras

- **Sorteio emitido pelo servidor.** Quando a pessoa começa, o servidor sorteia
  as 16 cartas e os grupos e guarda o sorteio ligado ao jogador. Recarregar ou
  abrir outra aba retoma o mesmo sorteio. Abrir a página não grava nada: como
  no jogo atual, o jogador nasce quando a pessoa toca em começar.
- **Escolhas parciais ficam no aparelho.** Até a confirmação, só o aparelho
  sabe o que a pessoa tocou. Por isso voltar e trocar não exige apagar nada no
  banco, que continua imutável.
- **Uma resposta por pessoa e pesquisa.** Ao confirmar, o servidor grava de uma
  vez as cartas mostradas, a escolhida de cada tela e a escolhida final. A
  gravação é idempotente e não pode ser alterada depois.
- **Validação no servidor.** Cada escolha tem de pertencer à tela sorteada, e a
  final tem de ser uma das quatro escolhidas.
- **Sem Elo.** A resposta não altera `ranking_stats` nem `player_stats`.
- **Sem resultado público.** O gate de publicação agregada (#177) continua em
  vigor; esta etapa não mostra soma nenhuma.
- **Abuso.** Valem as cotas da política atual. Incluir a resposta de pesquisa
  na `docs/security/VOTE_ABUSE_POLICY.md` é uma mudança versionada, feita na
  entrega do servidor.
- **CPF.** Não há cadastro por CPF nesta etapa. A escolha fica ligada à
  identidade que o jogo já usa. Se essas escolhas contam no resultado é
  assunto da etapa do cadastro (decisão 0001, item 3).

## Entregas

Cada entrega é um PR próprio, com gate do Stefan.

| Entrega | O que traz |
|---|---|
| 68a — Registro | Decisão 0002, este contexto, as telas aprovadas e os ajustes no 0001, no `CONTEXT.md`, no `README.md` e no `AGENTS.md`. Sem código. |
| 68b — Regras e servidor | Sorteio e validação da chave em `shared/`; tabelas e rotas novas em módulos próprios do `back/`, sem mexer no `topic-store.js` além do registro das tabelas; política de abuso versionada. |
| 68c — Tela | Página nova em `app/`, com voto, final, confirmação e o estado "já respondeu". Não entra no menu do site. |
| 68d — Teste por agentes | Rodadas jogadas por agentes em caminhos diferentes, com o resultado no `verification.json` e as correções que saírem delas. |
| 68e — Publicação | API primeiro e app depois, e a troca da entrada do site. Cada passo com o sim do Stefan. |

## Fora de escopo

- Cadastro por CPF, top 5 público, compartilhar, avisos, indicação e coleção.
- Som e háptica das telas novas.
- A segunda pesquisa (celebridades e influenciadores) e a de roupas.
- Qualquer mudança no jogo atual: capa, rodada diária, Elo, ranking e os
  jogos de leitura.
- Cartas novas, inclusive as de Lula e Flávio Bolsonaro no padrão comum.
- Encerrar a edição Eleições 2026 (#285) e a divisão do `topic-store.js`
  (#307).

## Critérios de aceite

- Um toque por tela; voltar e trocar funciona até a confirmação; a escolha é
  gravada uma única vez, ao confirmar.
- Todas as cartas da pesquisa têm o mesmo padrão de moldura, e grupos e
  posições são sorteados por pessoa.
- Quem já respondeu não responde de novo: nem com recarga, nem com duas abas,
  nem repetindo a requisição.
- Abrir a página não cria jogador nem grava nada.
- O jogo atual continua igual: os testes e os e2e que já existem passam sem
  alteração.
- Nenhuma soma de respostas aparece para o público.
- A página funciona em celular, em Chromium e em WebKit, e com a API fora do
  ar mostra uma saída clara.
- Antes de publicar, agentes jogam ao menos estes caminhos: caminho direto,
  voltar e trocar, recarga no meio, segunda aba, cota de rede esgotada e API
  fora do ar.

## Dependências e riscos

- **Banco imutável.** Os gatilhos do jogo atual impedem apagar gravações. Por
  isso o desfazer desta etapa acontece antes de gravar.
- **`topic-store.js` grande.** A [ICM 65] #307 ainda não o dividiu. O servidor
  desta etapa fica em módulo próprio.
- **Testes que travam a tela atual.** `persistent-dom.test.js` e os e2e da
  rodada diária cobram os nós e os textos da tela atual. Esta etapa usa página
  própria e não os altera.
- **Privacidade.** A etapa grava o mesmo tipo de dado que o jogo atual já
  grava: uma escolha ligada à identidade do jogo. A [ICM 41] #283 continua
  aberta.
- **Imagens.** As cartas são "Arte com IA" de pessoas públicas. A pendência de
  fotos da decisão 0001 continua valendo.
- **Programa de maturidade.** Continua aberto (#309) e corre em paralelo.
