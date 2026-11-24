# HANDOFF — [ICM 73] Pesquisa de roupas de demonstração

## Status

- Estado: `pronto para gate`. Em 23/11/2026 as partes 73a, 73b e 73c estavam
  construídas e testadas, no PR #346, sem merge. Nada deste estágio estava em
  produção.
- Issue: #345
- Branch: `icm/73-clothes-demo`, feita sobre a `main` em `0b30d64`.
- PR: #346
- Origem: em 23/11/2026, à pergunta do agente "Passo a demonstração de roupas
  na frente da pesquisa de famosos?", o Stefan respondeu "Sim, roupas antes".
  A resposta cobre a ordem de construção. O resto é escolha do agente.

## Entregue (73a — registro)

- Decisão 0005, `docs/decisions/0005-roupas-antes-de-celebridades.md`: a
  ordem de construção passa a ser política, roupas, celebridades e
  influenciadores. O registro separa a decisão dele das nove escolhas do
  agente.
- Notas nas decisões 0001 e 0002, no `AGENTS.md`, no `README.md` e no
  `CONTEXT.md` da raiz.

## Entregue (73b — cartas)

- 16 peças: 12 camisetas e 4 moletons. Mesma moldura, mesmo fundo e mesmo
  tamanho na carta; muda a cor e a estampa. Cada carta traz o selo "DEMO", o
  tipo, o nome e a legenda "Peça de demonstração · Arte com IA".
- `app/scripts/build-clothes-cards.mjs` desenha tudo. Não há foto, pessoa,
  preço, marca de terceiros nem serviço de geração de imagem. As estampas são
  formas simples (onda, sol, raio, cacto, planeta, olho, chama, montanha,
  pipa, flor, xadrez, a frase "SEM PRESSA", estrela, arco, folha e lua).
- O roteiro foi escrito por um agente de IA. Por isso a carta, o catálogo e o
  manifesto dizem "arte com IA" (`CREDITS.md`, "Chromas e artes editadas").
- O texto das cartas é desenhado com a Helvetica Neue do macOS da máquina que
  gerou. A fonte não vai para o repositório nem para o site, só a imagem.
- Os arquivos gravados saíram do Chromium headless shell 1187 (o que estava
  na máquina) e do cwebp 1.6.0.
- O roteiro grava: o desenho de origem de cada carta em `output/masters/`
  (SVG); os dois tamanhos publicados em `app/public/chromas/roupas/` (WebP de
  530 e de 1060 de largura); o catálogo `app/src/clothes-cards.json`; o
  manifesto `output/manifest.json`, com o hash de cada arquivo; e a folha
  `references/cartas-roupas.jpg`.
- `app/src/clothes-cards.test.js` prende uns aos outros a pesquisa, o
  catálogo, o manifesto, os desenhos de origem e os arquivos publicados:
  código, nome, caminho, hash, os dois tamanhos e o tamanho gravado em cada
  arquivo. Confere também que não sobra arquivo nas duas pastas e que nenhum
  código repete os de Política. Ele não prova que cada WebP é o desenho do
  seu SVG: isso pediria gerar de novo, e o texto depende da fonte da máquina.

## Entregue (73c — pesquisa)

- `shared/photo-survey.js`: a pesquisa `roupas-demo-01`, assunto "Roupas",
  pergunta "Qual você usaria?", 16 cartas, sorteio de 16 em telas de 4. Vem
  depois das duas de Política. A definição e a visão pública ganham o campo
  opcional `note`.
- `app/src/photo-survey-page.js` e `photo-survey-flow.js`: a página conhece os
  dois catálogos; a entrada de uma pesquisa cujo assunto não é "Política"
  ilustra com três cartas dela mesma (`entryCardIdsFor`); a entrada mostra a
  nota; o título da final é "Entre elas, qual fica?" fora da Política
  (`finalTitleFor`).
- `app/src/site-menu.js`: "Roupas" sai de "Em breve".
- Em `back/` só entram testes: um teste da rota de definição com as três
  pesquisas e um bloco no roteiro `back/scripts/photo-survey-smoke.mjs`. A
  lógica do servidor e as tabelas não mudam.
- `.github/workflows/ci.yml`: o filtro de caminhos inclui
  `stages/73_clothes_demo/output/**`.

Textos novos na tela: "Roupas", "Qual você usaria?", "Peças de demonstração,
desenhadas com IA pelo PoliMatch." e "Entre elas, qual fica?".

## O que muda para quem já usa o site

- Quem ainda não respondeu as duas pesquisas de Política e não começou a de
  roupas: a capa continua destacando uma de Política. A de roupas aparece em
  "Mais pesquisas" e no menu.
- Quem já respondeu as duas: a capa passa a destacar a pesquisa de roupas,
  onde antes dizia "Você respondeu todas as pesquisas abertas.". As telas de
  resposta registrada das duas pesquisas de Política passam a oferecer
  "Próxima pesquisa" no lugar de "Ver pesquisas".

## Não entregue / pendente

- **73d — publicação.** API e app, a API primeiro, cada passo com o sim do
  Stefan. O registro da 73d precisa atualizar duas frases no presente que
  ficam falsas com a publicação: na decisão 0002, "As construções seguintes
  da ordem não estão em produção"; na decisão 0001, "os outros assuntos"
  entre o que não está em produção. Precisa também atualizar o estado, o
  gate e o CI neste HANDOFF e o "Estado" da decisão 0005.
- O que recebe quem encomenda uma pesquisa (resultado, recortes): fora deste
  estágio.
- O título e a descrição da página (`app/index.html`) dizem "Quem você
  prefere?" em qualquer endereço, inclusive no da pesquisa de roupas. Já era
  assim para a segunda pesquisa de Política. Não foi mexido.
- O aviso por extenso só aparece na entrada da pesquisa. Nas outras telas e
  na imagem do compartilhar, o aviso é o selo "DEMO" de cada carta, que é
  pequeno: na grade de quatro cartas o texto dele fica com cerca de 5 a 6 px,
  e na imagem do compartilhar ele se lê na carta escolhida e não nas outras
  três. O texto da imagem não fala em demonstração. Quem usa leitor de tela
  só ouve o aviso na entrada.

## Testes executados

Todos em 23/11/2026. A parte 73c foi escrita por um agente à parte ("agente
da ligação"); o agente principal revisou o que ele mudou.

Rodados pelo agente principal, no macOS, depois dos ajustes das duas
leituras independentes:

- `npm run test:shared`: 119 de 119.
- `npm test --prefix app`: 218 de 218.
- `npm test --prefix back`: 306 de 306.
- `npm run build --prefix app`: sem erro.
- O caminho inteiro da pesquisa de roupas no aplicativo local, com servidor
  simulado, por um roteiro fora do repositório: entrada, quatro telas, final
  ("Entre elas, qual fica?"), confirmação, resposta registrada, imagem do
  compartilhar e capa, sem erro de página. As capturas de
  `references/telas-roupas.jpg` vêm dessa execução.
- A entrada da pesquisa de roupas em cinco tamanhos de tela: não rola em
  390×844, 375×667, 360×640 e 320×568; em 320×480 rola 23 px, com o botão
  "Começar" inteiro na tela. A nota ocupa duas linhas nesses tamanhos.

No CI do PR, visto pelo agente principal:

- No commit `09d6095`, anterior aos ajustes, todos os trabalhos passaram,
  entre eles `browser-smoke` em Chromium e em WebKit e a integração com
  PostgreSQL.
- No commit `3e4511c`, com os ajustes da primeira leitura, sete trabalhos
  passaram, entre eles `browser-smoke` em Chromium e a integração com
  PostgreSQL. O `browser-smoke` em WebKit ficou parado na instalação do
  navegador, antes de rodar código do projeto, e o commit foi substituído
  pelo seguinte.
- O CI do último commit é conferido no gate e fica registrado no PR.

Rodados só pelo agente da ligação, antes dos ajustes, segundo o relato dele:

- `app/e2e/site-shell.mjs`: 49 cenários, em Chromium e em WebKit (eram 46).
- `app/e2e/photo-survey.mjs`: 34 cenários, em Chromium e em WebKit.
- `npm run test:photo-survey --prefix back` e `npm run test:registration
  --prefix back`, num PostgreSQL 16 descartável.

Localmente, a máquina não tinha a versão do Chromium que o Playwright do
projeto pede: os roteiros de navegador rodaram em Chromium numa versão mais
antiga, por um roteiro auxiliar fora do repositório, e em WebKit, direto.

## Leitura independente

Duas passadas, somente leitura, por agentes que não escreveram o código.

### Primeira, no commit `09d6095`

Segurou o merge por um ponto do registro e apontou ajustes.

- **O que segurou:** o registro dizia que a capa "continua abrindo em
  Política". Não é o que o código faz para quem já respondeu as duas
  pesquisas de Política: essa pessoa passa a ver a de roupas em destaque.
  Corrigido no registro, no comentário do código e na issue; o comportamento
  não mudou.
- **Condicional:** o parágrafo da decisão 0005 sobre o que a pergunta dizia.
  Foi reescrito com a frase exata da mensagem e com o aviso de que o motivo
  está resumido.
- **Ajustes feitos:** "pedido" virou "resposta" onde ele só respondeu; as
  escolhas 3 e 4 da decisão 0005 saíram de "detalhe de desenho" e vão a ele
  no gate; entraram na lista a ilustração da entrada e a declaração de IA; o
  teste das cartas ficou mais apertado; a chama foi redesenhada, simétrica;
  o selo "DEMO" entrou em cada carta; a fonte deixou de ser a de interface
  do sistema e passou a ser a Helvetica Neue, que também vem com o macOS; a
  nota da entrada passou a dizer "desenhadas com IA".
- **O que ele conferiu:** os três conjuntos de teste de unidade, o CI no
  mesmo commit, os 16 desenhos refeitos a partir do roteiro (idênticos, byte
  a byte, aos gravados), os hashes e os tamanhos dos 32 arquivos, e que o
  servidor valida a resposta contra o sorteio gravado.
- **O que ele não conferiu:** que cada WebP é o desenho do seu SVG, busca de
  marca registrada, celular de verdade e produção.

### Segunda, no commit `3e4511c`

Sem bloqueio no conteúdo. Conferiu que o ponto que segurava o merge foi
corrigido em todos os lugares e que a frase citada da mensagem bate, palavra
por palavra, com a mensagem que o Stefan recebeu.

- **O que ele conferiu:** os três conjuntos de teste de unidade (119, 218 e
  306); os roteiros de navegador em WebKit, num build local (49 e 34
  cenários); a entrada em cinco tamanhos de tela; e uma geração completa das
  cartas numa cópia, na mesma máquina, que saiu igual, byte a byte, aos 32
  arquivos, ao catálogo, ao manifesto e aos desenhos gravados. Fez 25
  alterações de teste numa cópia para ver o que o teste das cartas pega.
- **Ajustes feitos depois dela:** o teste das cartas passou a prender o selo
  "DEMO" e a legenda ao desenho de origem; a estrela do moletom mudou de cor
  (um azul-marinho sobre cinza lembrava, de longe, o emblema de um time
  americano); números e frases do registro que tinham ficado para trás; o
  que vai ao gate ficou igual em todos os documentos.
- **O que ficou como está:** o tamanho do selo "DEMO" (ver "Não entregue");
  o resumo do motivo na decisão 0005, sem a parte comercial.
- **O que ele não conferiu:** quem rodou o quê, busca de marca registrada,
  os termos de uso da Helvetica Neue, celular de verdade e produção.

O último commit, com esses ajustes, não passou por uma terceira leitura
inteira: ver o comentário do gate no PR.

### Revisão automática do GitHub

A revisão automática apontou, no commit `d1f25fa`, que faltavam o HANDOFF e
a verificação do estágio. Os dois entraram no commit `09d6095`. A conversa
foi respondida e resolvida no PR.

## Não verificado

- O CI do último commit, no momento em que este texto foi escrito.
- Os termos de uso da Helvetica Neue em imagem publicada.
- As imagens Docker do app e da API fora do CI (não há Docker na máquina).
- Celular de verdade, botão real do Google e compartilhamento real do
  aparelho.
- Busca de marca registrada para os nomes das peças e para "Sem Pressa".
- Produção.

## Riscos conhecidos

- **Respostas de verdade sobre peças que não existem.** A pesquisa grava
  respostas de pessoas cadastradas, ligadas à conta, sem data para fechar.
- **API e app precisam ir juntos, a API primeiro.** Com a API antiga, as
  listas da capa do app novo mostram só as duas pesquisas de Política, mas o
  menu ainda lista a de roupas, e o endereço dela diz que a pesquisa não está
  disponível (há cenário de navegador).
- **Gerar as cartas de novo em outra máquina pode mudar os arquivos.** O
  teste confere os arquivos gravados.
- **"De Política" é o assunto da pesquisa.** A lista fixa da entrada e o
  "quem fica?" dependem de `subject` ser "Política". Uma pesquisa de
  celebridades vai precisar rever isso.
- **Menores de 18.** O cadastro aceita a faixa "16 a 24" (pendência da
  decisão 0004).
- As pendências de privacidade (#283) e de backup (#279) continuam abertas.

## Decisões tomadas

Do Stefan: roupas antes de celebridades e influenciadores.

Do agente, listadas na decisão 0005: peças desenhadas por código; sem nome
de marca; pesquisa de verdade, que grava respostas; as 16 cartas para cada
pessoa; a pesquisa de roupas depois das duas de Política; moldura nova, mais
simples; "qual fica?" na final; a ilustração da entrada com cartas da própria
pesquisa; "arte com IA" na carta e na nota.

Do agente, fora da decisão 0005: a linha no filtro de caminhos do CI.

## Próximo passo exato

1. Gate humano do merge do PR #346. A pergunta do gate leva a ele, por
   extenso, as escolhas 3 e 4 da decisão 0005 (a pesquisa grava respostas de
   pessoas cadastradas sobre peças que não existem; as 16 peças aparecem para
   cada pessoa) e o que muda na capa para quem já respondeu as duas pesquisas
   de Política.
2. Depois do merge, 73d: copiar o banco, publicar a API, publicar o app e
   conferir de fora por leitura, cada passo com o sim do Stefan.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan
- Observação: a resposta dele cobre a mudança de ordem. O merge e a
  publicação pedem um sim próprio, um a um.
