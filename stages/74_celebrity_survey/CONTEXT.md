# ICM 74 — Pesquisa de famosos e influenciadores — #348

Base: `main` em `b9be219`.
Ler o contexto raiz, o `AGENTS.md`, as decisões 0001, 0002, 0004, 0005 e 0006
e os contextos dos estágios 68, 70, 71 e 73.

## Objetivo

Abrir no PoliMatch a pesquisa de famosos e influenciadores, a terceira
construção pela ordem da decisão 0005, com cartas feitas de fotografia de
licença livre.

## Entradas

- Issue #348. Em 24/11/2026 o Stefan respondeu "Sim, começa" à pergunta
  "Começo a pesquisa de famosos e influenciadores?" e "Sim, baixa" à pergunta
  "Baixo as fotos e monto as cartas dos famosos?". Registro na decisão 0006.
  As respostas cobrem começar o estágio, fazer as cartas com fotografia de
  licença livre e o download. As outras escolhas são do agente e estão
  listadas lá.
- Decisão 0002, item 2: todas as cartas de uma pesquisa usam o mesmo padrão
  de moldura. Item 3: ninguém de fora antes de o aplicativo estar testado.
- O que os estágios 68 a 73 construíram: regras em `shared/photo-survey.js`,
  servidor em `back/src/photo-survey-store.js`, página em
  `app/src/photo-survey-page.js`, menu em `app/src/site-menu.js`, imagem do
  compartilhar em `app/src/share-choice.js`, e o modelo de catálogo próprio
  por pesquisa (`app/src/clothes-cards.json`).

## O que existe hoje e o que muda

| Tema | Hoje | Depois deste estágio |
|---|---|---|
| Pesquisas | Três: duas de Política e a de roupas | Quatro: entra `famosos-01`, "De quem você é mais fã?", com 20 cartas próprias |
| Ordem | Política, Política, roupas | Política, Política, famosos, roupas |
| Cartas | Dois catálogos: as 20 de Política e as 16 de roupa | Três catálogos: entram as 20 de famosos |
| Sorteio | Política: 16 de 20. Roupas: as 16 | Famosos: 16 de 20, como Política |
| Título da final | "Quem fica?" quando o assunto é "Política"; "qual fica?" nos outros | "Quem fica?" quando as cartas são pessoas (Política e famosos); "qual fica?" em roupas |
| "Em breve" | "Famosos e influenciadores" | Nenhum item, e o título "Em breve" não aparece |
| Menu | Início, Como funciona | Entra "Créditos das fotos" |
| Capa | Quem respondeu as duas de Política vê a de roupas em destaque | Vê a de famosos; respondida essa, a de roupas |

## O formato deste estágio

1. **Cartas.** Vinte, todas com a mesma moldura: a marca do PoliMatch, a
   janela da foto, o nome e a linha "Foto: autor · licença". O que muda de
   uma para a outra é a foto, o nome e o crédito.
2. **Fotos.** Cada foto é a imagem principal da pessoa na Wikidata, baixada
   da Wikimedia Commons em 24/11/2026, com licença livre declarada na página
   do arquivo (CC BY, CC BY-SA ou CC0). O arquivo entra no repositório como
   foi baixado, em `output/sources/`. Para arquivo mais largo que 1280 px foi
   baixada a miniatura de 1280 px gerada pela Wikimedia. A foto não é
   editada: é posicionada, recortada pela janela da moldura e redimensionada.
3. **Origem.** `output/sources.json` diz, para cada carta, a página do
   arquivo na Commons, o endereço e o SHA-1 do original, o que foi baixado, o
   autor, a licença, a data de nascimento da pessoa na Wikidata e o
   enquadramento. As cartas são montadas por
   `app/scripts/build-celebrity-cards.mjs`, que grava o desenho de origem de
   cada carta (SVG, em `output/masters/`), os dois tamanhos publicados (WebP
   de 530 e 1060 de largura, em `app/public/chromas/famosos/`), o catálogo do
   app (`app/src/celebrity-cards.json`), o manifesto com o hash de cada
   arquivo (`output/manifest.json`) e a página de créditos
   (`app/creditos.html`). O nome de cada arquivo publicado leva um carimbo
   feito do desenho e da foto: mudar um dos dois muda o endereço.
4. **Pesquisa.** `famosos-01`, assunto "Famosos", pergunta "De quem você é
   mais fã?", 20 cartas, sorteio de 16, telas de 4. A entrada mostra a nota
   "Fotos de licença livre, com o crédito em cada carta.". A definição de
   pesquisa ganha um campo, `people`, que diz se as cartas são pessoas.
5. **Créditos.** Página estática `/creditos.html`, ligada no menu.

## Entregas

| Parte | O que traz |
|---|---|
| 74a — Registro | Decisão 0006, este contexto, notas no `AGENTS.md`, no `CONTEXT.md` e no `CREDITS.md` |
| 74b — Cartas | As 20 cartas, as fotos de origem, a lista de origem, o manifesto, a página de créditos e o teste que prende uns aos outros |
| 74c — Pesquisa | `famosos-01` nas regras, no servidor e na tela; o campo `people`; "Em breve" vazio; "Créditos das fotos" no menu; filtro do CI |
| 74d — Publicação | API e app, com o sim do Stefan |

## Critérios de aceite

- A pesquisa `famosos-01` tem 20 cartas e mostra 16 a cada pessoa, em 4
  telas de 4.
- Todas as cartas da pesquisa têm a mesma moldura e a mesma apresentação.
- Cada foto tem, no repositório, a página de origem, o autor, a licença e o
  hash, e o crédito aparece na carta e na página de créditos.
- Nenhuma pessoa com menos de 18 anos e nenhuma pessoa falecida entre as
  cartas, pela data de nascimento e pelo registro da Wikidata em 24/11/2026.
- A pergunta é positiva.
- As regras do estágio 68 e o cadastro do estágio 71 valem sem mudança: uma
  resposta por pessoa, só com conta e cadastro.
- As duas pesquisas de Política e a de roupas continuam como estão, salvo a
  ordem na capa descrita acima.
- Os roteiros de navegador dos estágios 68 a 73 passam, ajustados onde a
  tela mudou de propósito.

## Fora de escopo

- Resultado para quem encomenda, soma de respostas e os cinco primeiros
  (#177).
- Contato com qualquer pessoa retratada, agência ou marca.
- Futebol e os outros assuntos.
- Regularização das fotografias que já estão no site (#284).
- Retrato gerado ou editado por IA.

## Gate humano

Merge e publicação pedem o sim do Stefan, um a um. A pergunta do merge leva
por extenso as escolhas de regra e de dado da decisão 0006.
