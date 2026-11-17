# ICM 72 — Compartilhar entrega sempre a imagem com as escolhas — #338

Base: `main` depois do estágio 70 (#334), publicado em 16/11/2026.
Ler o contexto raiz, o `AGENTS.md`, as decisões 0001 a 0003 e o contexto do
estágio 70. Este estágio não depende do estágio 71 (#336), que corria em
paralelo em outra branch. Depois: o estágio 71 foi aprovado para entrar
antes, a branch deste foi refeita em cima dele e os dois foram publicados
juntos em 16/11/2026.

## Objetivo

"Compartilhar" entrega sempre uma imagem com as escolhas da pessoa, e não só
o link.

## Entradas

- Issue #338. Avaliação do Stefan em 16/11/2026, com o estágio 70 no ar:
  "Compartilhar: Deve gerar uma imagem com minhas escolhas, não apenas o
  link."
- O que o estágio 70 construiu: `app/src/share-choice.js` e a tela de
  resposta registrada em `app/src/photo-survey-page.js`.

## O que existe hoje e o que muda

| Tema | Hoje | Depois deste estágio |
|---|---|---|
| O que a imagem mostra | A carta escolhida, o nome, a pergunta e o endereço | A escolhida em destaque, as finalistas, a pergunta e o endereço |
| Toque antes de a imagem ficar pronta | Vai só o texto com o endereço | O botão espera a imagem. Se ela não sair em 8 s, ele libera e o toque abre a prévia, que espera por ela ou oferece tentar de novo |
| O que vai para o aparelho que compartilha arquivo | A imagem com o texto e o endereço na mesma chamada | Só a imagem. No iPhone, texto junto faz vários aplicativos descartarem a imagem |
| Carta usada na imagem | A de 1060 px (cerca de 500 KB), baixada só para isso | A de 530 px, que a tela já carregou |
| Aparelho que compartilha texto e não arquivo | Vai só o texto com o endereço | A imagem aparece na tela, com "Baixar imagem"; o link é o segundo botão |
| Aparelho sem compartilhamento | O endereço é copiado | A imagem aparece na tela, com "Baixar imagem"; "Copiar link" é o segundo botão |
| Aparelho que recusa o arquivo na hora | Aviso de falha | A imagem aparece na tela |

## Regras

- **A imagem é a entrega.** O toque só tem dois destinos: o compartilhamento
  do aparelho com a imagem, ou a prévia na tela. Nenhum caminho do toque
  manda só o link sem a pessoa pedir, com a imagem pronta ou não.
- **Com arquivo, vai só o arquivo.** Sem texto nem endereço na mesma
  chamada: o endereço já está escrito na imagem.
- **Só no toque.** Nada é compartilhado, baixado nem copiado sem o toque.
  Compartilhar não fala com a API.
- **Só as escolhas da pessoa.** A imagem leva a escolhida e as finalistas
  dela. Nunca resultado somado (#177).
- **A imagem não sai do aparelho por conta própria.** Ela é montada no
  navegador e fica na memória da página; a prévia usa um endereço local, que
  é solto quando a prévia fecha.
- **O botão não fica preso.** Se a imagem não ficar pronta em 8 segundos, ou
  o navegador não conseguir montá-la, o botão libera e o toque abre a prévia.
  Se a imagem ainda está a caminho, a prévia espera e mostra quando chegar;
  se não saiu, o toque tenta de novo, e a prévia oferece "Tentar de novo".
  Uma imagem que chega depois do prazo passa a valer.
- **Uma finalista cuja carta não carrega, ou não chega em 6 segundos, fica
  de fora** e a imagem sai assim mesmo.
- **Texto que não cabe numa linha da imagem** diminui até um mínimo e depois
  é cortado com reticências.
- **Fechar a folha de compartilhar não é erro.**

## Entregas

Um PR:

| Parte | O que traz |
|---|---|
| 72a — Imagem | `shareImageLayout` e `shareImage` com as finalistas; testes |
| 72b — Entrega | `sharePlan`, a prévia com "Baixar imagem", o botão que espera a imagem; testes e roteiros de navegador |
| 72c — Publicação | Só o app, com o sim do Stefan. Feita em 16/11/2026, junto com o estágio 71 |

## Fora de escopo

- Imagem com as escolhas de várias pesquisas numa folha só.
- Formatos para stories (1080×1920) e escolha de formato.
- Texto com resultado somado ou comparação com a maioria.
- Mudança no servidor.

## Critérios de aceite

- A imagem tem 1080×1350 (JPEG) e desenha a escolhida no meio, em destaque,
  e até três finalistas numa linha abaixo dela, tudo dentro da folha.
- O botão "Compartilhar" fica desabilitado até a imagem ficar pronta, a
  montagem falhar ou o prazo de 8 segundos passar.
- A imagem não baixa a carta de 1060 px.
- Com compartilhamento de arquivo: um toque abre o compartilhamento do
  aparelho só com a imagem (um JPEG de verdade), sem texto nem endereço na
  chamada; dois toques seguidos abrem uma vez.
- Sem a imagem pronta, o toque abre a prévia, nunca o link: ela espera a
  imagem, ou oferece tentar de novo.
- Sem compartilhamento de arquivo (só texto, ou nenhum): o toque abre a
  prévia com a imagem; nada é compartilhado nem copiado até a pessoa pedir;
  "Baixar imagem" baixa `polimatch-minha-escolha.jpg`; o segundo botão
  compartilha ou copia o link; fechar devolve o foco ao botão.
- O aparelho recusa o arquivo: a prévia abre, sem aviso de falha.
- A pessoa fecha a folha de compartilhar: nenhum aviso e nenhuma prévia.
- Uma tela nova (sair da conta, por exemplo) fecha a prévia.
- A prévia cabe sem rolar em 390×844 e 360×640. O endereço local da imagem
  é solto ao fechar pelo botão, por Esc e por uma tela nova. Sem `showModal`
  a prévia abre e o Esc fecha.
- Os cenários dos estágios 68 a 70 continuam passando.

## Condições de publicação

- Só o app. Não há mudança na API nem no banco.
- As dos estágios 69 e 70 seguem abertas (privacidade, #283; backup, #279).

## Dependências e riscos

- **A imagem leva a foto de quatro pessoas reais com a marca do PoliMatch,**
  em vez de uma. Está na consulta jurídica sobre direito de imagem (decisão
  0001, pendência de fotos).
- **O compartilhamento real não é exercitado nos testes:** `navigator.share`
  é simulado. O teste num celular de verdade é do Stefan. A troca para "só o
  arquivo" vem de um defeito conhecido do iPhone, não de um teste em
  aparelho.
- **Sem texto junto da imagem,** quem recebe não ganha um link para tocar: o
  endereço está escrito na imagem.
- **Conflito com o estágio 71:** os dois mexem em
  `app/src/photo-survey-page.js` e em `app/e2e/site-shell.mjs`, em trechos
  diferentes. O que for mesclado depois é refeito sobre a `main`. (Foi este:
  refeito sobre o estágio 71, com conflito de emenda em quatro arquivos; ver
  o HANDOFF.)
