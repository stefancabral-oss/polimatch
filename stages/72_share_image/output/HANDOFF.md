# HANDOFF — [ICM 72] Compartilhar entrega sempre a imagem com as escolhas

## Status

- Estado: `concluído`. As partes 72a e 72b foram mescladas (PR #339, commit `28fd962`) e a 72c aconteceu em 16/11/2026: o app está publicado nesse commit.
- Issue: #338
- Branch: `icm/72-share-image`. Foi feita sobre a `main` em `59ca9a1`; com o estágio 71 (PR #337) aprovado para entrar antes, foi refeita em cima dele. Os dois mexiam em quatro arquivos; os conflitos estão descritos em "Testes executados".
- PR: #339
- Em produção desde 16/11/2026.

## Entregue (72a — imagem)

- `app/src/share-choice.js`: a imagem (1080×1350, JPEG) passa a trazer a escolhida em destaque e até três finalistas numa linha, com "Minha escolha", o nome, a pergunta, "Minhas finalistas" e "Responda em polimatch.com.br".
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

## Próximo passo exato

Nenhum neste estágio.

## Ação do Stefan

- Confirmar se o que ele testou no celular incluiu tocar em "Compartilhar", se a imagem chegou e em que aparelho.

## Human gate

- Decisão das partes 72a e 72b e da publicação (72c): `aprovado`
- Responsável: Stefan
- Observação: a construção responde à avaliação dele de 16/11/2026 e à delegação registrada na decisão 0003. O merge e a publicação tiveram instrução direta dele no mesmo dia. A mensagem do agente que antecedeu a pergunta dizia que os dois pedidos (este e o cadastro com CPF, PR #337) estavam prontos e nenhum estava no ar; que a imagem traz a escolhida, as três finalistas, a pergunta e o endereço; que a causa provável do "só o link" é o iPhone descartar a imagem quando ela vai com texto e link, e que agora vai só a imagem; que onde não dá para compartilhar arquivo a imagem aparece na tela com "Baixar imagem"; que nada disso foi testado num celular de verdade e que a correção do iPhone vem de um defeito conhecido do navegador; e que os dois PRs passaram por revisão independente e estavam com os testes automáticos verdes. A pergunta foi: "Mesclo e publico o cadastro com CPF e o compartilhar com imagem? Pode responder 'sim, os dois', 'só o compartilhar' ou 'só o cadastro'." Ele respondeu: "Sim, os dois". O merge e o deploy ficaram a cargo do agente, a pedido dele, com o check verde no commit final, e foram feitos em 16/11/2026 (ver "Publicação"). A regra 6 do `AGENTS.md` não muda.
