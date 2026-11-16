# 69d — Limpeza do código do produto anterior

Entrega 69d da issue #331. Depois da troca da capa publicada, sai de `app/`
o código que nenhuma página, script ou teste em uso carrega mais.

## O que conta como "em uso"

Um arquivo de `app/src` fica se for alcançado, seguindo os imports, a partir
de:

- as páginas do build (`index.html` e `como-funciona.html`);
- os scripts de `app/scripts` (a maioria roda no build e no CI; os dois
  validadores de resultado do piloto são de uso manual);
- `back/`, `shared/` e `scripts/` da raiz, inclusive os testes deles.

Um teste de `app/src` fica se o que ele testa fica. Um roteiro de `app/e2e`
fica se o workflow de navegador o roda.

## O que sai

- 81 arquivos de `app/src`: a capa do jogo (`main.js` e o que ele carregava),
  os quizzes, os duelos, a parte cívica, som, coleção, os estilos e dados
  dessas páginas e os testes de unidade deles.
- 30 arquivos de `app/e2e`: os roteiros das páginas antigas, as fixtures e o
  executor local.
- `app/scripts/measure-home-lcp.mjs`, que media a capa antiga com as fixtures
  dela.

## O que fica, e por quê

- O site novo: a página da pesquisa, o menu, "Como funciona", o cliente da
  API, o relato de erros, a entrada com Google e o armazenamento.
- O piloto de arte das cartas (`card-art-pilot-*`), os testes dele e
  `styles.css`, que o formulário do piloto lê. O piloto é do estágio 12 e
  roda no build e no CI; o destino dele não é desta entrega.
- `photos.js`: um teste do servidor confere o módulo contra a API.
- Em `app/public`, tudo: as imagens do produto anterior continuam lá e os
  verificadores do build as validam.

## Como se garante

`app/src/repo-hygiene.test.js` refaz essa conta a cada execução dos testes.
Foi escrito antes da limpeza e falhou listando o que saiu.

O teste é uma rede larga, não uma prova: conta como uso qualquer import
vindo de `app/scripts`, de `back/` (testes inclusive) ou de um comentário, e
não olha funções exportadas sem uso, scripts que nada chama nem `app/public`.

O teste das 20 cartas (`political-chromas.test.js`) saiu junto com os
módulos antigos que ele também testava e voltou, só com a parte que confere o
catálogo e os arquivos publicados: era a única conferência de unidade do que
a capa mostra.

Nada em `back/` nem em `shared/` muda. O build publicado não muda de
comportamento: o que sai já não entrava nele.
