# HANDOFF — [ICM 72] Compartilhar entrega sempre a imagem com as escolhas

## Status

- Estado: `concluído` nas partes 72a a 72c: a 72a e a 72b foram mescladas (PR #339, commit `28fd962`) e a 72c aconteceu em 16/11/2026, com o app publicado nesse commit. A 72d (ajuste de texto) foi aprovada pelo Stefan em 23/11/2026 (ver "Human gate"); o merge e a publicação dela são registrados na issue #342.
- Issue: #338
- Branch: `icm/72-share-image`. Foi feita sobre a `main` em `59ca9a1`; com o estágio 71 (PR #337) aprovado para entrar antes, foi refeita em cima dele. Os dois mexiam em quatro arquivos; os conflitos estão descritos em "Testes executados".
- PR: #339
- Em produção desde 16/11/2026.
- 72d (ajuste de texto pedido depois da publicação): issue #342, branch `icm/72-share-wording`, PR #343. Até o app ser publicado de novo, o que está no ar segue com "Minhas finalistas" e "Suas finalistas".

## Entregue (72a — imagem)

- `app/src/share-choice.js`: a imagem (1080×1350, JPEG) passa a trazer a escolhida em destaque e até três finalistas numa linha, com "Minha escolha", o nome, a pergunta, "Minhas finalistas" e "Responda em polimatch.com.br". (O rótulo "Minhas finalistas" muda para "Também na final" na 72d.)
- `shareImageLayout({ ratio, others })`: a conta de onde cada coisa fica, separada do desenho, com teste. Uma carta mais alta que o normal encolhe para caber.
- Uma finalista cuja carta não carrega fica de fora, e a imagem sai assim mesmo.

## Entregue (72b — entrega)

- `sharePlan(nav, file)`: com a imagem pronta, o plano é sempre entregar a imagem. Onde o aparelho compartilha arquivo, abre o compartilhamento dele. Onde não compartilha, abre a prévia.
- A prévia: a imagem na tela, "Baixar imagem", o link como segundo botão ("Compartilhar link" ou "Copiar link") e "Fechar". Fechar devolve o foco ao botão e solta o endereço local da imagem.
- Com compartilhamento de arquivo, vai só a imagem, sem texto nem endereço na mesma chamada.
- O botão "Compartilhar" fica desabilitado até a imagem ficar pronta. A imagem usa a carta que a tela já carregou, então fica pronta quase na hora. Se ela não sair em 8 segundos, o botão libera e o toque abre a prévia, que espera pela imagem ou oferece "Tentar de novo"; o toque nunca manda só o link.
- Se o aparelho diz que compartilha arquivo e recusa na hora, a prévia abre, em vez do aviso de falha.
- Uma tela nova fecha a prévia. O endereço local da imagem é solto em todo fechamento.

## Publicação (72c) — 16/11/2026

Com a instrução do Stefan ("Sim, os dois"), transcrita em "Human gate":

- PR #339 mesclado em `28fd962`, depois de refeito sobre o estágio 71. A árvore do merge é a do commit `fc53b1f`, que tinha o `ci-gate` verde.
- App publicado no commit `28fd962` (31 s), build de 2026-11-16T23:26:07Z, junto com o estágio 71. De fora, nenhuma leitura falhou. O commit é o que o painel de deploy registrou; `version.json` segue com `sha: "unknown"` (#287).
- Conferido de fora, só por leitura do pacote publicado: o código do app traz a imagem com as finalistas, a prévia com "Baixar imagem" e a espera pela imagem. Isso mostra o que está no pacote, não o comportamento na tela: o agente não exercitou o compartilhar em produção.
- Depois da publicação, o Stefan escreveu: "No celular funcionou". Ele não disse o que testou nem em que aparelho. O agente tinha pedido quatro passos (entrar com Google, fazer o cadastro, responder uma pesquisa e tocar em "Compartilhar"); não se sabe quais deles o relato cobre, nem se cobre o compartilhar.

O registro do banco e da API desta publicação está no HANDOFF do estágio 71 e na issue #336; o deste estágio, na #338.

## Entregue (72d — ajuste de texto)

Depois da publicação, em 16/11/2026, o Stefan escreveu: "única frase que não gostei: Minhas finalistas. Ficou meio fora do portugues."

- Na imagem, o rótulo acima das outras três cartas passa de "Minhas finalistas" para "Também na final". A descrição da imagem na prévia muda junto: "Imagem com a minha escolha: (nome). Também na final: (nomes)."
- Nas telas de confirmação e de resposta registrada, o mesmo rótulo passa de "Suas finalistas" para "Também na final". Ele apontou só a frase da imagem; a das telas usa a mesma palavra e foi trocada junto, por escolha do agente.
- Só texto, em `app/src/share-choice.js` e `app/src/photo-survey-page.js`. O desenho da imagem, as cartas, as regras e o servidor não mudam. Nos documentos e no código, "finalistas" continua sendo o nome interno dessas três cartas.
- A primeira versão desta parte usava "Também escolhi" na imagem e "Você também escolheu" nas telas, e foi mostrada a ele numa folha. A revisão independente apontou que esse texto afirma preferência: como o sorteio monta as telas ao acaso, a pessoa pode ter escolhido numa tela alguém de quem não gosta, e a imagem diria que ela "também escolheu" essa pessoa. O agente trocou para "Também na final", que descreve o que aconteceu, e mandou a ele uma folha com as duas opções lado a lado, com a recomendação. A folha está em `references/texto-duas-opcoes.jpg`. A escolha entre as duas era dele. Antes do ciclo de crítica a pergunta oferecia as duas; depois dele, a pergunta do gate propunha só "Também na final", e em 23/11/2026 ele respondeu "Sim, na final".
- Chega à produção com um deploy do app, depois do merge. Ele deu o sim em 23/11/2026; o registro da publicação fica na issue #342.

### A frase passou por um ciclo de crítica (17/11/2026)

Em 17/11/2026, com o PR pronto, o Stefan pediu um ciclo de refinamento da frase ("Roda para descobrir a melhor frase."). O ciclo tem três papéis: um crítico aponta falhas com severidade, o autor reescreve só para as altas e as médias, e um juiz diz se a versão nova é materialmente melhor. O crítico e o juiz foram agentes à parte, um novo a cada vez. Cada um recebeu do autor o contexto do produto, o histórico da frase e a versão a julgar; o segundo crítico recebeu também o motivo da primeira reescrita, e os juízes não receberam a lista de falhas dos críticos. O autor foi o agente do estágio.

| Ciclo | O crítico leu | Alta | Média | Marginal | Reescrita | Juiz |
|---|---|---|---|---|---|---|
| 1 | "Também na final" | 1 | 1 | 6 | "Também na minha final" na imagem e na descrição dela; telas iguais | Não |
| 2 | "Também na minha final" | 1 | 1 | 6 | "Em vez de" nos três lugares | Não |

- Ciclo 1. Falha alta: na imagem, "a final" não tem dono, e quem recebe pode ler como a final da pesquisa toda ou uma seleção do site. Média: em futebol e em reality, "na final" tem sentido literal. O juiz não considerou "Também na minha final" melhor: resolve o dono, mas volta ao possessivo com uma palavra da mesma família de "Minhas finalistas" e reforça a leitura de que as outras cartas também são preferência da pessoa.
- Ciclo 2. O crítico leu a reescrita do ciclo 1, não a frase que estava de pé; o juiz comparou, nos dois ciclos, com "Também na final". Falha alta (por risco, não por certeza, segundo o crítico): possessivo mais "final" repete o esqueleto da frase que o Stefan apontou. Média: "também" e "minha" incluem as três cartas na preferência da pessoa. O juiz não considerou "Em vez de" melhor: dispensa saber o que é a final, mas soa como rejeição das outras três e fica uma frase presa numa preposição.
- O ciclo parou pela regra dele: dois ciclos seguidos com o juiz respondendo não. Ficou "Também na final". Isso mostra que as duas reescritas testadas não foram julgadas melhores; não mostra que não existe frase melhor.
- Fica conhecido, sem conserto de uma linha que o ciclo tenha achado: quem recebe a imagem pode entender "a final" como a final da pesquisa. O primeiro crítico anotou que a causa da queixa do Stefan não foi apurada e que a metáfora de torneio continua; o segundo, que "final" é da mesma família de "finalistas" e que só o Stefan pode dizer se o incômodo continua.
- Os dois críticos disseram ter aberto a imagem gerada e a tela de resposta registrada com "Também na final". Aos juízes as mesmas imagens foram indicadas (ao primeiro, só a imagem gerada); eles responderam só sim ou não com uma frase e não disseram o que abriram. As duas reescritas foram julgadas pelo texto: nenhuma imagem foi gerada com elas.

## Não entregue / pendente

- Imagem com as escolhas de várias pesquisas numa folha só; formato para stories.
- Som e háptica.

## Testes executados

No CI do PR #339, antes de a branch ser refeita, o commit `cf680b8` passou (`ci-gate` verde): os testes de unidade do app, a imagem do app e, no Linux, os dois roteiros em Chromium e em WebKit. A revisão automática (Codex) deixou um apontamento, sobre a preparação antiga apagar o prazo da tela nova; estava corrigido nesse commit, foi respondido e a conversa encerrada.

Depois de refeita sobre o estágio 71, em 16/11/2026, local (macOS): `npm test --prefix app` 213/213, `npm run test:shared` 118/118, `npm test --prefix back` 305/305; `site-shell.mjs` com 46 cenários e `photo-survey.mjs` com 34, em WebKit e em Chromium 140. Houve conflito em quatro arquivos, todos de emenda: os imports da página, o fim da folha de estilos (a emenda deixou um bloco sem fechar, que o build acusou e foi corrigido), o trecho do roteiro que prepara a tela de resposta (que passou a usar a conta cadastrada do estágio 71) e o contexto raiz. O commit refeito, `fc53b1f`, passou no `ci-gate` antes do merge (o PR só mexe no app, e os testes do servidor não rodam nele).

Em 16/11/2026, local (macOS), no código do PR antes de ser refeito:

- `npm test --prefix app`: 205/205. Nada muda em `shared/` nem em `back/`.
- `app/e2e/site-shell.mjs`: 36 cenários aprovados em WebKit e em Chromium 140. Quatro são do compartilhar: o compartilhamento do aparelho só com a imagem; a prévia com "Baixar imagem" (em 390×844 e 360×640); fechar a folha e a recusa do arquivo; a imagem que demora, falha ou perde uma carta, e o navegador sem `showModal`.
- `app/e2e/photo-survey.mjs`: 34 cenários aprovados em WebKit e em Chromium 140.
- Conferidas a olho: a imagem gerada (1080×1350, cerca de 400 KB), a tela de resposta registrada e a prévia em 390×844 e 360×640. A folha está em `references/`.

O que veio antes do código, e falhou primeiro pelo motivo esperado: os testes de `share-choice.test.js` (o plano de entrega, a conta do desenho, a marcação da prévia e, depois da revisão, a chamada só com o arquivo, a linha que encolhe e os estados da prévia).

O que não seguiu essa ordem: os cenários de navegador vieram depois da mudança da página, nas duas rodadas. Na primeira, o Chromium mostrou um defeito de verdade (a imagem da prévia só era solta quando o navegador avisava do fechamento); corrigido. Depois dos consertos da revisão, o código foi desfeito de catorze formas e as catorze foram pegas, uma delas só depois de um cenário ganhar a conferência que faltava (o foco na prévia sem `showModal`).

Na 72d, em 16/11/2026:

- Os testes vieram antes do código e falharam pelo motivo esperado, nas duas rodadas de texto: o de unidade da descrição da imagem; o cenário de navegador da imagem, que passou a ler o que a imagem escreve (falhou com "MINHAS FINALISTAS" e, na segunda rodada, com "TAMBÉM ESCOLHI" na lista); e o das telas de resumo (leu "Suas finalistas" e, na segunda rodada, "Você também escolheu").
- Local (macOS), no checkout do agente, com o Playwright instalado nele (WebKit, e Chromium 140 pelo executável do cache), com o texto final: `npm test --prefix app` 213/213; em Chromium, `site-shell.mjs` com 46 cenários e `photo-survey.mjs` com 34; em WebKit, `photo-survey.mjs` com 34 e `site-shell.mjs` com 42 num processo, que parou no cenário 43 por tempo esgotado ao abrir a página, mais os cenários 43 a 46 rodados um por processo, aprovados. A parada não parece vir da mudança: o revisor viu a mesma num clone novo, com e sem a gravação do que a imagem escreve, e num script sem relação com o app (o WebKit desta máquina deixa de navegar depois de muitos contextos no mesmo processo). Ele não rodou a base sem o PR. Na rodada do primeiro texto os 46 tinham passado num processo só.
- No CI do PR #343 (Linux), o commit `9530311` (a versão com "Também escolhi") teve o `ci-gate` verde, com `site-shell` 46 e `photo-survey` 34 em Chromium e em WebKit. O commit `f86a500`, com "Também na final", teve o `ci-gate` verde e os checks `browser-smoke (chromium)` e `browser-smoke (webkit)` aprovados, que são os que rodam os dois roteiros; a contagem de cenários dessa rodada não foi lida. Os commits do gate, de 23/11/2026, vêm depois dele e só mexem neste registro; o resultado do último está no PR. Nada muda em `shared/` nem em `back/`, e os testes do servidor não rodam.
- Conferidas a olho: a imagem gerada com cada um dos dois textos, e a tela de resposta registrada em 390×844 com o primeiro. As telas de confirmação e de resposta registrada com o texto final foram olhadas pelo revisor, não pelo agente.

## Revisão independente

Um agente à parte, somente leitura, revisou o commit `fb3bf7a` num clone próprio em 16/11/2026. Rodou os testes de unidade, os dois roteiros em WebKit, seis roteiros dele com servidor simulado (tempo, prévia, telas, imagem, promessa antiga e trava) e 21 mutações, das quais os testes de então pegavam cinco. Não achou regressão, mas recomendou segurar o merge por um ponto que a branch não tocava:

| O que a revisão apontou | O que mudou |
|---|---|
| No aparelho que compartilha arquivo, a chamada mandava a imagem com o texto e o endereço juntos, como no estágio 70. No iPhone isso é conhecido por entregar só o texto ao WhatsApp e a outros aplicativos. É o caminho mais provável da queixa do Stefan | Com arquivo, vai só o arquivo |
| A imagem dependia de baixar a carta de 1060 px (cerca de 500 KB), que a tela não usa. Numa rede lenta passava do prazo de 8 s e o toque mandava só o link | A imagem usa a carta de 530 px, já carregada. Fica pronta quase na hora |
| Uma imagem que falhava uma vez nunca era tentada de novo: todo toque seguinte mandava só o link. Uma finalista que nem carregava nem falhava segurava a imagem para sempre | Sem imagem, o toque abre a prévia, que tenta de novo. Cada carta tem prazo de 6 s |
| O botão podia ficar preso desabilitado: a preparação da tela anterior apagava o prazo da tela nova | Cada preparação tem o próprio prazo e um número; o resultado de uma antiga é ignorado |
| Um compartilhamento do aparelho que nunca respondia matava o botão | A trava do toque repetido se solta sozinha em 10 segundos |
| Com o celular deitado a imagem da prévia virava um selo | A imagem tem altura mínima e a prévia rola |
| Texto longo saía da folha | A linha encolhe até um mínimo e depois é cortada com reticências |
| Sem `showModal` o Esc não fechava a prévia; o botão desabilitado não dizia nada ao leitor de tela; a descrição da imagem não citava as finalistas | Corrigidos os três |

Os documentos diziam "só libera com a imagem pronta" e que o caminho do link tinha sido "fechado", o que o código não garantia. O contexto e este HANDOFF foram reescritos com a regra como ela é. Entraram o plano em `plans/` e a seção no contexto raiz.

Ficaram anotados, sem mudança: com o celular deitado, na tela de resposta registrada, a linha das finalistas fica atrás dos botões (já era assim na `main`); "Baixar imagem" com endereço local provavelmente não funciona em navegadores dentro de aplicativos, onde a saída é segurar o dedo na imagem.

Ele não conferiu aparelho de verdade (o ponto do iPhone é leitura de um defeito conhecido do navegador, não teste), Chromium, navegadores dentro de aplicativos, leitor de tela, nem produção.

**72d.** Um agente à parte, somente leitura, revisou o commit `9530311` (a versão com "Também escolhi") num clone próprio em 16/11/2026. Sem bloqueio. Rodou os testes de unidade e os dois roteiros nos dois navegadores, desfez cada uma das quatro trocas de texto (as quatro foram pegas: a descrição da imagem pela unidade e pelo roteiro, as outras três só pelos roteiros), mediu o rótulo em 30 casos por navegador (cinco tamanhos de tela, três condições de fonte, as duas telas; uma linha em todos) e olhou a imagem gerada (o acento do É não corta). Não achou "finalista" visível em nenhum lugar do app. Apontou a leitura de "Também escolhi" como apoio, descrita acima, e ajustes neste registro, aplicados. Anotou, fora do diff e sem mudança: com uma carta que não carrega, a imagem desenha duas e a descrição cita três nomes; com o texto ampliado por CSS (simulação) em 320 de largura, a linha das três cartas vai para trás dos botões, igual ao que era. A gravação do que a imagem escreve prova que o texto foi passado ao desenho, não que saiu legível. Ele não conferiu aparelho de verdade, leitor de tela, fontes de Android nem produção. A troca para "Também na final" veio depois dessa leitura; ele não tinha alternativa que considerasse claramente melhor, e a que pôs na mesa foi "Também chegaram à final".

Numa segunda passada, sobre o commit `e2e1260`, o mesmo agente releu a troca: sem bloqueio. Considerou "Também na final" correto e fiel nas duas telas, inclusive na confirmação; mediu o rótulo de novo (uma linha nos 30 casos); olhou a confirmação e a resposta registrada em 390×844 e em 320×480 com fonte larga, e a imagem gerada nos dois navegadores. Anotou que, na imagem, "Também na final" não diz de quem é a final e pode ser lido como a final da pesquisa; achou o risco baixo, porque "Minha escolha" no topo enquadra tudo como pessoal, e deixou "Também na minha final" como opção se o Stefan quiser. Pediu três precisões neste registro e uma conferência menos frágil no cenário da imagem (comparar só os rótulos), aplicadas.

## Riscos conhecidos

- **A imagem leva a foto de quatro pessoas reais com a marca do PoliMatch,** em vez de uma. Está na consulta jurídica sobre direito de imagem (decisão 0001, pendência de fotos).
- **O compartilhamento real não foi exercitado pelo agente.** Nos testes `navigator.share` é simulado. Depois da publicação o Stefan escreveu "No celular funcionou", sem dizer o que testou nem em que aparelho: não se sabe se o relato cobre o compartilhar. Também não se sabe em que aparelho ele viu ir só o link. Três caminhos davam nisso e foram tratados: o toque antes de a imagem ficar pronta, o aparelho sem compartilhamento de arquivo e, no iPhone, a imagem enviada junto com texto e endereço. Este último vem de um defeito conhecido do navegador, não de teste em aparelho.
- **Sem texto junto da imagem,** quem recebe não ganha um link para tocar: o endereço está escrito na imagem.
- **Navegadores dentro de aplicativos** (Instagram, WhatsApp) costumam não compartilhar nem baixar arquivo. Neles a saída é segurar o dedo na imagem da prévia, que o texto da prévia indica. Não foi testado.
- **O botão espera a imagem.** Em condição normal ela fica pronta quase na hora; no pior caso o botão fica até 8 segundos desabilitado.
- **Conflito com o estágio 71 (#336, PR #337):** resolvido antes do merge. Os dois mexiam na página da pesquisa e no roteiro `site-shell.mjs`; esta branch foi refeita sobre o estágio 71 (ver "Testes executados").
- As condições de publicação dos estágios 69 e 70 seguem abertas: privacidade (#283) e backup externo (#279).

## Decisões tomadas

Avaliação do Stefan em 16/11/2026, com o estágio 70 no ar: "Compartilhar: Deve gerar uma imagem com minhas escolhas, não apenas o link."

Escolhas do agente, por delegação dele (decisão 0003, item 5), que pode mudar qualquer uma:

- "Minhas escolhas" são a escolhida e as finalistas daquela pesquisa, como na tela de resposta registrada.
- Onde não dá para compartilhar arquivo, a imagem aparece na tela para baixar, em vez de ir só o link.
- Com arquivo, vai só a imagem, sem texto nem endereço junto (por causa do iPhone).
- O botão espera a imagem ficar pronta.
- O formato continua 1080×1350.

Na 72d, a partir da avaliação dele ("única frase que não gostei: Minhas finalistas"), escolhas do agente, que ele pode mudar:

- "Também na final", na imagem e nas telas: descreve a final, sem afirmar que a pessoa prefere as outras três. A alternativa, "Também escolhi" (com "Você também escolheu" nas telas), é mais pessoal e ficou como segunda opção. Em 23/11/2026 o Stefan aprovou a publicação com "Também na final" ("Sim, na final").
- Trocar também o rótulo das telas, que ele não citou.

## Próximo passo exato

1. Merge do PR #343 e deploy do app (a API não muda), com o sim do Stefan de 23/11/2026. Este arquivo não é atualizado depois: se já foram feitos, e quando, está na issue #342.
2. Depois do deploy: conferência de fora, só por leitura, de que o pacote publicado traz o texto novo, e registro na issue #342.

## Ação do Stefan

- Dizer se a issue #342 pode ser fechada depois da publicação.
- Confirmar se o que ele testou no celular incluiu tocar em "Compartilhar", se a imagem chegou e em que aparelho. A frase que ele citou em 16/11/2026 ("Minhas finalistas") só aparece na imagem e na descrição dela, mas ele não disse onde a viu.

## Human gate

- Decisão da 72d (ajuste de texto): `aprovado`
- Responsável: Stefan
- Observação: em 17/11/2026, depois do ciclo de crítica, a mensagem do agente dizia que o ciclo tinha parado no segundo ciclo e que a melhor frase continuava sendo "Também na final"; trazia a versão final, a tabela com os dois ciclos (cada reescrita e a recusa do juiz) e as marginais rejeitadas; dizia que um terceiro pode entender "a final" como a final da pesquisa toda, que "final" é da mesma família de "finalistas" e que, se o incômodo dele fosse a palavra, o caminho seria outro; e que nada tinha sido mesclado nem publicado. A pergunta foi: "Mesclo o PR 343 e publico o app com 'Também na final'? Pode responder 'sim, na final' ou 'não agora'." Ele respondeu em 23/11/2026: "Sim, na final". O merge e o deploy do app ficam a cargo do agente, a pedido dele, com o check verde no commit final. A regra 6 do `AGENTS.md` não muda.
- Decisão das partes 72a e 72b e da publicação (72c): `aprovado`
- Responsável: Stefan
- Observação: a construção responde à avaliação dele de 16/11/2026 e à delegação registrada na decisão 0003. O merge e a publicação tiveram instrução direta dele no mesmo dia. A mensagem do agente que antecedeu a pergunta dizia que os dois pedidos (este e o cadastro com CPF, PR #337) estavam prontos e nenhum estava no ar; que a imagem traz a escolhida, as três finalistas, a pergunta e o endereço; que a causa provável do "só o link" é o iPhone descartar a imagem quando ela vai com texto e link, e que agora vai só a imagem; que onde não dá para compartilhar arquivo a imagem aparece na tela com "Baixar imagem"; que nada disso foi testado num celular de verdade e que a correção do iPhone vem de um defeito conhecido do navegador; e que os dois PRs passaram por revisão independente e estavam com os testes automáticos verdes. A pergunta foi: "Mesclo e publico o cadastro com CPF e o compartilhar com imagem? Pode responder 'sim, os dois', 'só o compartilhar' ou 'só o cadastro'." Ele respondeu: "Sim, os dois". O merge e o deploy ficaram a cargo do agente, a pedido dele, com o check verde no commit final, e foram feitos em 16/11/2026 (ver "Publicação"). A regra 6 do `AGENTS.md` não muda.
