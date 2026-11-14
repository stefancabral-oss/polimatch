# 68d — Teste por agentes

Entrega 68d da issue #324. O contexto do estágio pede: agentes jogam ao menos
oito caminhos (direto, voltar e trocar, recarga no meio, segunda aba, troca de
identidade no meio, cota de rede esgotada, API fora do ar e pesquisa fechada),
cada caminho fica registrado com o resultado, e as correções que saírem
entram na entrega.

## O ambiente

Tudo local e descartável; nada fala com produção. O roteiro está em
`references/68d-ambiente/`:

- `ambiente.sh` compila a página com a API em outra origem, como em produção
  (CORS de verdade), cria seis bancos PostgreSQL novos e sobe seis APIs com
  `PHOTO_SURVEYS_ENABLED=true`, mais uma API com a mesma pesquisa fechada
  (uma cópia do servidor em que só a janela muda).
- `porta.mjs` serve a página em doze portas. Cada porta é uma "rede" para o
  servidor, duas por agente, cada agente com banco e API próprios. Tem uma
  chave por rede: API aberta, conexão derrubada, resposta 502 de proxy e
  pesquisa fechada.
- `roteiro-dos-agentes.md` é o texto comum que cada agente recebeu. Cada um
  recebeu também os caminhos dele.

Regras dos agentes: somente leitura no repositório, só `127.0.0.1`, só
`SELECT` no banco, toques de verdade no navegador (WebKit 26 e Chromium 140),
captura de tela conferida a olho, e o limite real de três jogos novos por
rede por dia.

## Rodada 1 (commit `0d9ce3f`, a tela como foi para o PR #327)

| Agente | Caminhos | Resultado |
| --- | --- | --- |
| 1 | direto; segunda aba; toques repetidos; voltar do navegador; 360×640 | passou; um ponto menor |
| 2 | voltar e trocar; recarga no meio; fonte larga | passou; um ponto menor |
| 3 | troca de identidade no meio; saída da conta | passou; um ponto a corrigir e um de texto |
| 4 | cota de rede esgotada | passou; só texto |
| 5 | API fora do ar (conexão derrubada e 502), inclusive resposta perdida | passou; só texto |
| 6 | pesquisa fechada: na abertura, no meio, depois de responder, reabertura | passou; dois pontos a corrigir e um menor |

Em nenhum caminho houve resposta gravada antes de confirmar, duas respostas do
mesmo jogador, escolha gravada diferente da que a tela mostrava, escolhas de
uma identidade gravadas em outra, linha nova em `votes` ou mudança em
`ranking_stats`. Pelos números finais de cada agente, os bancos fecharam com 34 jogadores, 32 sorteios e 27
respostas, somando os seis.

## O que saiu e o que mudou

Cada correção teve o cenário de e2e escrito antes do código, e cada cenário
falhou primeiro pelo motivo esperado.

| O que o agente viu | O que mudou |
| --- | --- |
| Fechou no meio: ao confirmar, a tela mostrava só "Esta pesquisa está fechada." | Quem confirma depois do fechamento, ou volta com escolhas guardadas, lê que a escolha não foi registrada |
| Entrada aberta antes de fechar: o toque em "Começar" criava jogador e gastava a cota da rede, para receber 409 em seguida | O toque confere a janela antes de criar o jogador |
| A conta muda no instante da confirmação: a resposta ia para a conta certa, mas a tela só dizia "Sua conta mudou" | A pessoa lê que a resposta foi registrada, e o aparelho guarda que aquela conta respondeu |
| Saída da conta no meio: o aviso falava em "conta atual" sem haver conta | "Você saiu da conta neste aparelho", com o botão "Começar" |
| Final em 360×640 com fonte larga: título em duas linhas, 17 px de rolagem | Título menor em tela estreita; a final cabe sem rolar |
| Quem respondeu e perdeu o registro local via "Fechada" em vez da própria resposta | Com a pesquisa fechada e uma identidade no aparelho, a página busca a resposta; fechada, a busca não grava nada |
| Duas abas no meio: a aba parada ficava numa tela antiga | A aba parada acompanha a outra |
| "Confira a conexão" com o servidor fora do ar | "Tente de novo em instantes"; "Confira a conexão" só com o aparelho sem rede |
| O aviso de cota falava em "jogos novos" | Fala em participações |
| Na final, as cartas não escolhidas pareciam desligadas | Ficam mais claras, sem parecer desligadas |

Mudou também o teste: o cenário de fonte larga usa uma fonte de largura fixa,
que mede quase igual no macOS e no Linux, e as telas de voto e a final
precisam caber sem rolar em pé. Antes, a diferença de fonte entre a máquina de
desenvolvimento e o CI só aparecia no CI.

## Rodada 2 (as correções, na página e na API de verdade)

Três agentes, com bancos novos, conferiram cada correção: pesquisa fechada,
troca de identidade, e duas abas, fonte larga, textos e a trava da confirmação
incerta. Todas se comportam como descrito, em WebKit e em Chromium. Conferido
direto nos três bancos: 18 jogadores, 18 sorteios, 13 respostas, nenhuma
duplicada, `votes` em zero e `ranking_stats` igual.

| O que o agente viu | O que mudou |
| --- | --- |
| A conta troca e volta dentro do tempo de uma confirmação: a resposta era gravada e a tela ficava no início do sorteio | A tela mostra a resposta registrada |
| Entrada com aviso em 360×640: a lista do formato ficava em parte atrás do botão | Em tela baixa, com aviso, a ilustração sai e a lista aparece inteira |

## Revisão do código

Um agente separado, somente leitura, revisou o código das correções. Sem
bloqueio. Pediu quatro acertos, feitos antes do PR:

| O que a revisão apontou | O que mudou |
| --- | --- |
| Fechada + falha ao conferir a resposta: a tela voltava para a entrada e dizia "Nenhuma escolha foi registrada" | Fica na tela de fechada, com aviso e nova tentativa |
| Saída da conta + confirmação registrada: o aviso convidava a responder sem conta | Tela de registrada, sem convite |
| Trechos novos sem teste | Cenários para fechada com sessão recusada, fechada com identidade que nunca abriu, falha tardia depois da troca de conta, guardas da aba que acompanha e aparelho sem rede |
| Roteiro do ambiente: erro 403 na pasta padrão, banco fora da máquina, pastas apagadas sem conferir, processo encerrado pelo número | Só banco local, só pasta criada pelo roteiro, só encerra o que abriu |

Os acertos da revisão não passaram por outra rodada de agentes; estão no e2e,
nos dois navegadores (33 cenários).

## Anotado, sem correção nesta entrega

- Recarregar com a API fora do ar depois de uma confirmação incerta solta a
  trava da troca. Quando a API volta, o sorteio diz se a resposta foi gravada
  antes de a tela oferecer a troca; o agente não conseguiu gravar duas
  escolhas.
- As escolhas parciais de uma identidade somem se outra identidade tocar em
  "Continuar" e jogar: o aparelho guarda um registro por pesquisa.
- Na entrada, em 360×640 com um aviso na tela, os três itens da lista ficam em
  parte atrás do botão fixo até rolar.
- O botão voltar do navegador sai da página; ao voltar, a pessoa retoma.
- A carta `samia-bonfim` mostra o nome "Sâmia Bomfim": o identificador interno
  tem outra grafia.
- Não foram exercitados no ambiente: resposta 5xx com CORS (coberta pelo e2e
  simulado), a virada da cota à meia-noite, gestos num celular de verdade e
  Firefox.
- Com a pesquisa fechada e uma identidade no aparelho, abrir a página pede o
  sorteio ao servidor, que fechado não grava nada. Uma rota só de leitura para
  a resposta da pessoa tiraria essa dependência.
- Em 390 px de largura com uma fonte muito larga o título de 28 px ainda pode
  quebrar; só pesa onde a altura aperta.
