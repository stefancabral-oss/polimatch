# ICM 68 — Pesquisa por foto, etapa 1: rodada de Política com as cartas de moldura — #324

Base main `77104a3` (merge da #322).
Ler o contexto raiz, o `AGENTS.md` e as decisões
[0001](../../docs/decisions/0001-pesquisa-de-preferencia-por-foto.md) e
[0002](../../docs/decisions/0002-ordem-de-construcao-e-cartas-com-moldura.md).

## Objetivo

Fazer o jogo de política que já está no ar funcionar no formato da pesquisa
por foto, reaproveitando as cartas de moldura que já existem. É a primeira
etapa de produto da direção nova. O jogo atual continua no ar, igual, até esta
etapa estar testada e o Stefan autorizar a publicação.

## Entradas

- Issue #324 e as decisões 0001 e 0002.
- As quatro telas em `references/`, aprovadas pelo Stefan em 13/11/2026:
  entrada, voto, final e confirmação.
- As 20 cartas "Políticos 2026" de `app/public/chromas/politicos`, em 530 e
  1060 pixels de largura. São imagens completas, com moldura e nome.
- O protótipo de 12/11/2026, em
  `stages/67_photo_survey_direction/references/prototipo-pesquisa.html`, como
  referência do fluxo.

## O que existe hoje e o que muda

| Tema | Jogo que está no ar | Etapa 1 |
|---|---|---|
| Telas | 10 telas de 4 cartas por dia, mais aquecimento | Entrada, 4 telas de 4, uma final e uma confirmação |
| Toque | Duas escolhas em ordem por tela | Um toque por tela |
| Voltar | Não volta | Volta e troca até confirmar |
| Gravação | A cada tela, com Elo | Uma vez, ao confirmar, sem Elo |
| Repetir | Uma rodada por dia | Uma resposta por jogador em cada pesquisa |
| Arte | Foto com moldura só para parte das pessoas | Carta de moldura no mesmo padrão para todas |

## O formato desta etapa

1. **Entrada.** Uma tela com a pergunta, o tamanho da pesquisa e o botão
   "Começar". As cartas que ilustram a entrada são sorteadas a cada visita,
   para nenhuma ficar em destaque fixo. Abrir a página não grava nada.
2. **Conjunto.** As 20 cartas "Políticos 2026". Cada jogador recebe 16 delas,
   sorteadas. Assim nenhuma das 20 precisa ser excluída por escolha editorial,
   e em conjunto todas aparecem com a mesma frequência.
3. **Telas de voto.** As 16 cartas se dividem em 4 telas de 4. Os grupos e a
   posição de cada carta na tela são sorteados por jogador. Um toque escolhe e
   avança.
4. **Final.** As quatro escolhidas, em uma tela. Um toque escolhe.
5. **Confirmação.** Mostra a escolhida e as outras três finalistas. "Confirmar
   minha escolha" grava. "Voltar e trocar" volta à final.
6. **Depois de confirmar.** A pessoa vê a escolha registrada e não responde de
   novo nesta pesquisa. Não há troca depois de confirmar nesta etapa.
7. **Pergunta.** "Quem você prefere?", a mesma em todas as telas de voto.
8. **Só carta.** Sem perfil, sem texto para ler e sem placar entre as telas.

## Regras

- **Sorteio emitido pelo servidor.** No toque em "Começar", o jogador é criado,
  se ainda não existe, e o servidor sorteia as 16 cartas e os grupos e guarda
  o sorteio ligado a ele. Recarregar ou abrir outra aba retoma o mesmo
  sorteio. Cada uma das 20 cartas tem a mesma chance de entrar e de ocupar
  cada posição.
- **Escolhas parciais ficam no aparelho.** Até a confirmação, só o aparelho
  sabe o que a pessoa tocou. Por isso voltar e trocar não exige apagar nada no
  banco.
- **Desfazer.** A decisão 0001 diz que a pesquisa "permite desfazer a
  escolha". Nesta etapa isso vale até a confirmação. Trocar depois de
  confirmar, como no protótipo de 12/11/2026, fica para uma etapa própria,
  com um desenho que respeite a gravação imutável.
- **Uma resposta por jogador e pesquisa.** Ao confirmar, o servidor grava de
  uma vez as cartas mostradas, a escolhida de cada tela e a escolhida final. A
  gravação é idempotente e imutável, como as do jogo atual.
- **O limite do "uma vez".** Quem apaga os dados do aparelho vira outro
  jogador e pode responder de novo, dentro da cota de jogos novos por rede. O
  que fecha essa porta é o cadastro por CPF, que não é desta etapa.
- **Troca de identidade no meio.** Se a pessoa entra ou sai do Google durante
  a pesquisa, ela recomeça com o sorteio da identidade atual. Vale a identidade
  do momento da confirmação, e nenhuma identidade responde duas vezes.
- **Validação no servidor.** Cada escolha tem de pertencer à tela sorteada, e a
  final tem de ser uma das quatro escolhidas. Resposta que não bate com o
  sorteio é recusada.
- **Janela.** A pesquisa tem abertura e fechamento. Fora da janela o servidor
  recusa respostas e a tela diz que a pesquisa está fechada.
- **Sem Elo.** A resposta não altera `ranking_stats` nem `player_stats`.
- **Sem resultado público.** O gate de publicação agregada (#177) continua em
  vigor; esta etapa não mostra soma nenhuma.
- **Abuso.** A política atual não tem cota para resposta de pesquisa. A
  entrega do servidor traz a mudança versionada de
  `docs/security/VOTE_ABUSE_POLICY.md` que a define.
- **CPF.** Não há cadastro por CPF nesta etapa. A escolha fica ligada à
  identidade que o jogo já usa. Se essas escolhas contam no resultado é
  assunto da etapa do cadastro (decisão 0001, item 3).

## Entregas

Cada entrega é um PR próprio, com gate do Stefan.

| Entrega | O que traz |
|---|---|
| 68a — Registro | Decisão 0002, este contexto, as telas e os ajustes no 0001, no `CONTEXT.md`, no `README.md` e no `AGENTS.md`. Sem código. |
| 68b — Regras e servidor | Sorteio e validação da chave em `shared/`; tabelas e rotas novas em módulos próprios do `back/`, sem mexer no `topic-store.js` além do registro das tabelas; política de abuso versionada. |
| 68c — Tela | Página nova em `app/`, com entrada, voto, final, confirmação e os estados "já respondeu" e "pesquisa fechada". Fica fora do menu e do sitemap, e com `noindex`. |
| 68d — Teste por agentes | Rodadas jogadas por agentes em caminhos diferentes, com o resultado no `verification.json` e as correções que saírem delas. |
| 68e — Publicação | API primeiro e app depois. Depois, em passo separado, a capa ganha a entrada para a pesquisa e a página entra no sitemap. Cada passo com o sim do Stefan. |

## Fora de escopo

- Cadastro por CPF, top 5 público, compartilhar, avisos, indicação e coleção.
- Trocar a escolha depois de confirmar.
- Som e háptica das telas novas.
- A segunda pesquisa (celebridades e influenciadores) e a de roupas.
- Mudanças no jogo atual: rodada diária, Elo, ranking e os jogos de leitura.
  A única mudança na capa é a entrada para a pesquisa, na 68e. O destino da
  rodada diária e da edição Eleições 2026 é da #285.
- Cartas novas, inclusive as de Lula e Flávio Bolsonaro no padrão comum, e a
  regeneração de cartas pedida pela #284.
- A divisão do `topic-store.js` (#307).

## Critérios de aceite

Regras e servidor (68b):

- O mesmo jogador recebe o mesmo sorteio ao recarregar ou em outra aba.
- O sorteio é uniforme: em muitas emissões, cada carta entra e ocupa cada
  posição com a mesma frequência, dentro da margem do teste.
- A resposta é gravada uma única vez por jogador e pesquisa; repetir a
  requisição devolve a mesma resposta sem gravar de novo.
- Resposta forjada é recusada: carta fora do sorteio, escolha que não pertence
  à tela, final que não é uma das quatro.
- As tabelas novas não aceitam alteração nem remoção de linhas gravadas.
- Nenhuma linha de `ranking_stats`, `player_stats` ou `votes` muda com a
  resposta.
- Fora da janela, a resposta é recusada.
- Nenhuma rota nova devolve soma de respostas.

Tela (68c):

- Abrir a página não cria jogador nem grava nada; o jogador nasce no toque em
  "Começar".
- Um toque por tela; voltar e trocar funciona até a confirmação.
- Quem já respondeu vê a própria escolha e não responde de novo: nem com
  recarga, nem com duas abas.
- Todas as cartas têm o mesmo padrão de moldura e o mesmo tamanho na tela.
- Funciona em celular, em Chromium e em WebKit. Com a API fora do ar, com a
  cota de rede esgotada ou com a pesquisa fechada, mostra uma saída clara.
- A página fica fora do menu e do sitemap, com `noindex`.
- Os testes e os e2e do jogo atual passam. Só mudam os que fixam a lista de
  páginas do build (`app/src/share-preview.test.js` e o sitemap), para
  conhecer a página nova.

Teste por agentes (68d):

- Agentes jogam ao menos estes caminhos: direto, voltar e trocar, recarga no
  meio, segunda aba, troca de identidade no meio, cota de rede esgotada, API
  fora do ar e pesquisa fechada. Cada caminho fica registrado com o resultado.

Publicação (68e):

- As condições de publicação abaixo estão atendidas ou foram decididas pelo
  Stefan.
- API e app publicados e conferidos de fora, com a contagem de linhas das
  tabelas antigas igual antes e depois.
- A entrada na capa só muda com o sim do Stefan, e a rodada diária continua
  acessível.

## Condições de publicação

Proposta do agente, a confirmar pelo Stefan. A decisão 0002 não dispensa
nenhum bloqueio de maturidade; estes são os que pesam nesta etapa:

- **Imagens (#284).** Das 20 cartas, 12 vêm do acervo do PoliMatch, sem origem
  registrada, e 8 vêm de fotos de veículos ou de sites (`kind: curated` em
  `shared/presidential-roster.json`). A decisão 0001 deixa as de veículo "a
  confirmar", e a #284 pede regenerar ou despublicar as cartas sem foto de
  origem licenciada. A construção e o teste por agentes usam as 20. Para
  publicar (68e), ou as 8 cartas são refeitas a partir de retrato oficial ou
  de licença livre, ou o Stefan confirma o uso delas. Com 12 cartas o formato
  de 16 não fecha.
- **Privacidade (#283).** A política publicada vem antes de divulgar a
  pesquisa para pessoas de fora.
- **Backup (#279).** O backup externo vem antes de divulgar a pesquisa para
  pessoas de fora, porque as respostas passam a ser o dado principal.
- **Edição Eleições 2026 (#285).** Define o que a capa diz e para onde a
  entrada aponta.

Os demais bloqueios abertos (#278, #280, #281 e #286) seguem no programa de
maturidade e não condicionam esta etapa.

## Dependências e riscos

- **Banco imutável.** Os gatilhos do jogo atual impedem apagar gravações. Por
  isso o desfazer desta etapa acontece antes de gravar.
- **`topic-store.js` grande.** A [ICM 65] #307 ainda não o dividiu. O servidor
  desta etapa fica em módulo próprio.
- **Testes que travam a tela atual.** `persistent-dom.test.js` e os e2e da
  rodada diária cobram os nós e os textos da tela atual. Esta etapa usa página
  própria e não os altera.
- **Dado gravado.** A etapa grava o mesmo tipo de dado que o jogo atual já
  grava: uma escolha ligada à identidade do jogo.
- **Programa de maturidade.** Continua aberto (#309) e corre em paralelo.
