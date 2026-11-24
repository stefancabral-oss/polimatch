# HANDOFF — [ICM 73] Pesquisa de roupas de demonstração

## Status

- Estado: `pronto para gate`. Em 23/11/2026 as partes 73a, 73b e 73c estavam
  construídas e testadas localmente, no PR #346, sem merge. Nada deste
  estágio estava em produção.
- Issue: #345
- Branch: `icm/73-clothes-demo`, feita sobre a `main` em `0b30d64`.
- PR: #346
- Pedido: em 23/11/2026, à pergunta do agente "Passo a demonstração de roupas
  na frente da pesquisa de famosos?", o Stefan respondeu "Sim, roupas antes".

## Entregue (73a — registro)

- Decisão 0005, `docs/decisions/0005-roupas-antes-de-celebridades.md`: a
  ordem de construção passa a ser política, roupas, celebridades e
  influenciadores. O que ele decidiu é a ordem; as outras escolhas do
  registro são do agente, por delegação, e estão marcadas assim.
- Notas nas decisões 0001 e 0002, no `AGENTS.md`, no `README.md` e no
  `CONTEXT.md` da raiz.

## Entregue (73b — cartas)

- 16 peças: 12 camisetas e 4 moletons. Mesma moldura, mesmo fundo e mesmo
  tamanho na carta; muda a cor e a estampa. Cada carta traz o tipo, o nome e
  "Peça de demonstração".
- `app/scripts/build-clothes-cards.mjs` desenha tudo. Não há foto, pessoa,
  preço, marca de terceiros nem serviço externo de imagem. As estampas são
  formas simples (onda, sol, raio, cacto, planeta, olho, chama, montanha,
  pipa, flor, xadrez, a frase "SEM PRESSA", estrela, arco, folha e lua).
- O roteiro grava: o desenho de origem de cada carta em `output/masters/`
  (SVG); os dois tamanhos publicados em `app/public/chromas/roupas/` (WebP de
  530 e de 1060 de largura); o catálogo `app/src/clothes-cards.json`; o
  manifesto `output/manifest.json`, com o hash de cada arquivo; e a folha
  `references/cartas-roupas.jpg`.
- `app/src/clothes-cards.test.js` prende catálogo, manifesto, desenhos de
  origem e arquivos publicados uns aos outros, confere que não sobra arquivo
  na pasta publicada e que nenhum código de carta repete os de Política.

## Entregue (73c — pesquisa)

- `shared/photo-survey.js`: a pesquisa `roupas-demo-01`, assunto "Roupas",
  pergunta "Qual você usaria?", 16 cartas, sorteio de 16 em telas de 4. Vem
  depois das duas de Política. A definição e a visão pública ganham o campo
  opcional `note`.
- `app/src/photo-survey-page.js` e `photo-survey-flow.js`: a página conhece os
  dois catálogos; a entrada de uma pesquisa que não é de Política ilustra com
  três cartas dela mesma (`entryCardIdsFor`); a entrada mostra a nota; o
  título da final é "Entre elas, qual fica?" fora da Política
  (`finalTitleFor`).
- `app/src/site-menu.js`: "Roupas" sai de "Em breve".
- Em `back/` só entram testes: um teste da rota de definição com as três
  pesquisas e um bloco no roteiro `back/scripts/photo-survey-smoke.mjs`. A
  lógica do servidor e as tabelas não mudam.
- `.github/workflows/ci.yml`: o filtro de caminhos inclui
  `stages/73_clothes_demo/output/**`.

Textos novos na tela: "Roupas", "Qual você usaria?", "Peças de demonstração,
criadas pelo PoliMatch." e "Entre elas, qual fica?".

## Não entregue / pendente

- **73d — publicação.** API e app, a API primeiro, cada passo com o sim do
  Stefan.
- O que recebe quem encomenda uma pesquisa (resultado, recortes): fora deste
  estágio.
- O título e a descrição da página (`app/index.html`) dizem "Quem você
  prefere?" em qualquer endereço, inclusive no da pesquisa de roupas. Já era
  assim para a segunda pesquisa de Política. Não foi mexido.

## Testes executados

Todos locais, em 23/11/2026, no macOS. A parte 73c foi escrita por um agente
à parte ("agente da ligação"); o agente principal revisou o que ele mudou.

Rodados pelo agente principal, depois da revisão:

- `npm run test:shared`: 119 de 119.
- `npm test --prefix app`: 218 de 218.
- `npm test --prefix back`: 306 de 306.
- `npm run build --prefix app`: sem erro.

Rodados só pelo agente da ligação, segundo o relato dele:

- `app/e2e/site-shell.mjs`: 49 cenários, em Chromium e em WebKit (eram 46).
- `app/e2e/photo-survey.mjs`: 34 cenários, em Chromium e em WebKit.
- `app/e2e/client-error-report.mjs`: aprovado em Chromium e em WebKit.
- `npm run test:card-art-pilot-contract --prefix app`: 64 de 64.
- `npm run test:photo-survey --prefix back` (duas vezes no mesmo banco) e
  `npm run test:registration --prefix back`, num PostgreSQL 16 descartável.

Como os roteiros de navegador rodaram: a máquina não tinha a versão do
Chromium que o Playwright do projeto pede. Em Chromium eles rodaram numa
versão mais antiga, por um roteiro auxiliar fora do repositório; em WebKit,
direto. O CI do PR roda os dois navegadores nas versões certas.

As capturas de `references/telas-roupas.jpg` vêm dessas execuções, com
servidor simulado. O agente principal olhou as capturas da entrada, de uma
tela de voto, da escolha registrada, da imagem do compartilhar e da capa.

Medidas do agente da ligação, não refeitas pelo agente principal: a nota
empurra a ilustração da entrada cerca de 21 px; a entrada da pesquisa de
roupas cabe sem rolar em 390×844, 375×667, 360×640 e 320×568; em 320×480 ela
rola 23 px e o botão "Começar" continua inteiro na tela.

## Não verificado

- Os roteiros de navegador na versão do Chromium e no WebKit de Linux que o
  CI usa, antes do CI deste PR.
- As imagens Docker do app e da API (não há Docker na máquina).
- Celular de verdade, botão real do Google e compartilhamento real do
  aparelho.
- Produção.

## Riscos conhecidos

- **Respostas de verdade sobre peças que não existem.** A pesquisa grava
  respostas de pessoas cadastradas. O aviso está na entrada e em cada carta;
  na carta, o texto fica pequeno no celular.
- **API e app precisam ir juntos, a API primeiro.** Com a API antiga, o app
  novo mostra só as duas pesquisas de Política, e o endereço da pesquisa de
  roupas diz que ela não está disponível (há cenário de navegador).
- **Gerar as cartas de novo em outra máquina pode mudar os arquivos**: o
  texto usa a fonte do sistema. O teste confere os arquivos gravados.
- **"De Política" é o assunto da pesquisa.** A lista fixa da entrada e o
  "quem fica?" dependem de `subject` ser "Política".
- **Menores de 18.** O cadastro aceita a faixa "16 a 24" (pendência da
  decisão 0004).
- As pendências de privacidade (#283) e de backup (#279) continuam abertas.

## Decisões tomadas

Do Stefan: roupas antes de celebridades e influenciadores.

Do agente, por delegação (decisão 0005): peças desenhadas por código; sem
nome de marca; pesquisa de verdade, com aviso de demonstração; as 16 cartas
para cada pessoa; a capa continua em Política; moldura nova, mais simples;
"qual fica?" na final; a linha no filtro do CI.

## Próximo passo exato

1. Gate humano do merge do PR #346.
2. Depois do merge, 73d: copiar o banco, publicar a API, publicar o app e
   conferir de fora por leitura, cada passo com o sim do Stefan.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan
- Observação: o pedido dele cobre a mudança de ordem. O merge e a publicação
  pedem um sim próprio, um a um.
