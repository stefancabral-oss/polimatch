# ICM 73 — Pesquisa de roupas de demonstração — #345

Base: `main` em `0b30d64`.
Ler o contexto raiz, o `AGENTS.md`, as decisões 0001, 0002, 0004 e 0005 e os
contextos dos estágios 68, 70 e 71.

## Objetivo

Abrir no PoliMatch uma pesquisa de roupas, com peças criadas pelo próprio
PoliMatch, para existir algo que se possa abrir e usar antes de chamar
qualquer pessoa ou empresa de fora (decisão 0002, item 3).

## Entradas

- Issue #345. Em 23/11/2026, à pergunta do agente "Passo a demonstração de
  roupas na frente da pesquisa de famosos?", o Stefan respondeu: "Sim, roupas
  antes". Registro na decisão 0005.
- Decisão 0002, item 1: roupas "com imagens criadas pelo próprio PoliMatch;
  nenhuma empresa envia foto nesta fase". Item 2: todas as cartas de uma
  pesquisa usam o mesmo padrão de moldura.
- O que os estágios 68 a 72 construíram: regras em `shared/photo-survey.js`,
  servidor em `back/src/photo-survey-store.js`, página em
  `app/src/photo-survey-page.js`, menu em `app/src/site-menu.js`, imagem do
  compartilhar em `app/src/share-choice.js`.

## O que existe hoje e o que muda

| Tema | Hoje | Depois deste estágio |
|---|---|---|
| Pesquisas | Duas, de Política, com as mesmas 20 cartas | Três: entra `roupas-demo-01`, "Qual você usaria?", com 16 cartas próprias |
| Cartas | Um catálogo: as 20 de Política | Dois catálogos: as 20 de Política e as 16 de roupa |
| Sorteio | 16 de 20 cartas por pessoa | Em roupas, as 16 entram sempre; o sorteio decide a tela e a posição |
| Ilustração da entrada | Três cartas de uma lista fixa, para as duas pesquisas | Em Política, a mesma lista. Em roupas, três das cartas da própria pesquisa |
| Aviso | Nenhum | A entrada da pesquisa de roupas diz: "Peças de demonstração, criadas pelo PoliMatch." |
| "Em breve" | "Famosos e influenciadores" e "Roupas" | Só "Famosos e influenciadores" |
| Capa | Abre na primeira pesquisa de Política sem resposta | Igual. A de roupas vem depois das duas de Política |

## O formato deste estágio

1. **Cartas.** 16 peças: 12 camisetas e 4 moletons. Todas com a mesma
   moldura, a mesma silhueta por tipo, o mesmo fundo e o mesmo tamanho na
   carta. O que muda de uma para a outra é a cor e a estampa. Cada carta traz
   o tipo, o nome da peça e "Peça de demonstração". Não há foto, pessoa,
   preço nem marca de terceiros.
2. **Origem.** As cartas são desenhadas por `app/scripts/build-clothes-cards.mjs`.
   O roteiro grava o desenho de origem de cada carta (SVG, em
   `output/masters/`), os dois tamanhos publicados (WebP de 530 e 1060 de
   largura, em `app/public/chromas/roupas/`), o catálogo do app
   (`app/src/clothes-cards.json`) e o manifesto com o hash de cada arquivo
   (`output/manifest.json`). O nome de cada arquivo publicado leva o começo do
   hash do desenho de origem: mudar o desenho muda o endereço.
3. **Pesquisa.** `roupas-demo-01`, assunto "Roupas", pergunta "Qual você
   usaria?", 16 cartas, sorteio de 16, telas de 4. A definição ganha um campo
   opcional, `note`, que a entrada mostra abaixo da pergunta. As pesquisas de
   Política não têm nota.
4. **Entrada.** A ilustração da entrada de uma pesquisa de Política continua
   saindo da lista fixa do estágio 68. Para qualquer outro assunto, sai das
   cartas da própria pesquisa.
5. **Capa e menu.** A pesquisa nova aparece em "Mais pesquisas" e no menu,
   pelas mesmas regras do estágio 70. "Roupas" sai de "Em breve".

## Regras

- **As regras do estágio 68 valem sem mudança:** um toque por tela, final,
  confirmação, uma resposta por pessoa, sem troca depois de confirmar.
- **O cadastro do estágio 71 vale sem mudança:** só responde quem entrou com
  Google e tem cadastro com CPF.
- **Mesma exposição.** As 16 peças aparecem para toda pessoa, uma vez cada, em
  telas de quatro montadas por sorteio.
- **Sem resultado público.** Nenhuma soma de respostas aparece (#177).
  Compartilhar leva só a escolha da pessoa.
- **As pesquisas de Política não mudam:** mesmas cartas, mesma ilustração de
  entrada, mesmo lugar na capa.

## Entregas

Um PR, com commits por parte:

| Parte | O que traz |
|---|---|
| 73a — Registro | Decisão 0005, este contexto, notas nas decisões 0001 e 0002, no `AGENTS.md` e no `CONTEXT.md` |
| 73b — Cartas | O roteiro, os 16 desenhos de origem, os 32 arquivos publicados, o catálogo, o manifesto e o teste que prende uns aos outros |
| 73c — Pesquisa | A pesquisa nas regras, no servidor e na tela; a nota; a ilustração da entrada por pesquisa; "Em breve" |
| 73d — Publicação | API e app, com o sim do Stefan |

## Fora de escopo

- Resultado para quem encomenda, soma de respostas e os cinco primeiros.
- Foto enviada por empresa, nome de marca e qualquer contato com marca.
- Celebridades e influenciadores.
- Mudança no cadastro, nas faixas de idade ou no texto de consentimento.
- Rota nova no servidor e tabela nova no banco.

## Critérios de aceite

- `shared/`: três pesquisas com ids únicos; a de roupas tem 16 cartas,
  sorteio de 16 em telas de 4, assunto, pergunta e nota.
- Catálogo, manifesto e arquivos batem: 16 cartas, dois tamanhos cada, hash
  conferido, proporção 5:7, nenhum arquivo sobrando na pasta publicada.
- `/?p=roupas-demo-01` abre a entrada com o assunto, a pergunta, a nota e
  três cartas de roupa.
- O caminho inteiro da pesquisa de roupas funciona: quatro telas, final,
  confirmação, resposta registrada e compartilhar.
- A entrada das pesquisas de Política não mostra nota e só usa as cartas da
  lista do estágio 68.
- Na capa sem identidade: destaque na primeira pesquisa de Política; as
  outras duas em "Mais pesquisas"; uma só "em breve".
- Os roteiros de navegador dos estágios 68 a 72 passam, ajustados onde a tela
  mudou de propósito.

## Condições de publicação

As dos estágios 69 e 71 continuam abertas (privacidade, #283; backup, #279).
A publicação é de API e app, a API primeiro: a pesquisa é definida em
`shared/`, e com a API antiga o app novo recebe 404 para a pesquisa de roupas
e mostra só as duas de Política.

## Dependências e riscos

- **Respostas de verdade sobre peças que não existem.** A pesquisa grava
  respostas de pessoas cadastradas. O aviso de demonstração está na entrada e
  em cada carta, mas o texto da carta fica pequeno no celular.
- **O texto das cartas usa a fonte do sistema.** Gerar de novo em outra
  máquina pode mudar os arquivos. O teste confere os arquivos gravados; não
  gera de novo.
- **A marca na carta é texto simples**, não o emblema das cartas de Política.
- **Menores de 18.** O cadastro aceita a faixa "16 a 24" (pendência da
  decisão 0004).
