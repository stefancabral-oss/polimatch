# 69b e 69c — Casca nova e troca da capa

Plano das entregas 69b e 69c da issue #331. O que se constrói está em
`../CONTEXT.md`; aqui ficam as decisões de implementação. Cada tarefa começa
pelo teste, que precisa falhar pelo motivo esperado antes do código.

## Restrições

- Nada em `back/` nem em `shared/`.
- Sem dependência nova: JavaScript puro, como o resto do app.
- O menu usa `<dialog>` nativo com `showModal()`: foco preso, Esc e fundo
  inerte vêm do navegador.
- A chave do aparelho continua em `polimatch:v3:recovery-key`. Sessão Google
  começa com `pms_`; chave anônima, com `pm2_`. O menu distingue as duas pelo
  prefixo, sem consultar o servidor.
- Textos em português, curtos, sem promessa que o produto não cumpre.

## Arquivos

| Arquivo | Papel |
|---|---|
| `app/src/site-menu.js` (novo) | Lista das próximas pesquisas, tipo de conta, marcação do menu e montagem no DOM |
| `app/src/site-menu.css` (novo) | Botão do menu, painel, itens e lista de próximas pesquisas |
| `app/src/site-menu.test.js` (novo) | Regras puras do menu |
| `app/src/photo-survey-page.js` | Botão do menu no cabeçalho, telas sem "Ir para o início", avisos apontando o menu, reação à troca de conta na mesma aba, registro do service worker |
| `app/como-funciona.html` e `app/src/how-it-works-page.js` (novos) | Página "Como funciona" |
| `app/index.html` | Passa a carregar a pesquisa |
| `app/pesquisa.html` e as três páginas antigas | Saem do build e do repositório; os módulos delas em `app/src` ficam até a 69d |
| `app/vite.config.js` | Entradas: `index.html` e `como-funciona.html` |
| `app/nginx.conf` | `absolute_redirect off` e 302 dos cinco endereços aposentados |
| `app/public/sitemap.xml`, `app/public/manifest.webmanifest` | Páginas novas; nome e cores do padrão novo |
| `app/public/integridade.html` | Sai |
| `app/e2e/photo-survey.mjs` | A página passa a ser `/`; o cenário 1 confere a capa nova |
| `app/e2e/site-shell.mjs` (novo) | Menu, conta e "Como funciona" |
| `app/e2e/client-error-report.mjs` | Passa a forçar o erro nas duas páginas novas |
| `app/scripts/smoke-nginx.mjs` | Confere os redirecionamentos e as páginas novas |
| `.github/workflows/ui-interaction-smoke.yml` | Saem os roteiros das páginas antigas |

## Tarefas

### 1. Regras do menu

`app/src/site-menu.js` exporta, sem tocar no DOM ao ser importado:

- `UPCOMING_SURVEYS`: lista congelada, `["Famosos e influenciadores", "Roupas"]`.
- `accountKind(key)`: `"google"` para `pms_…`, `"anonymous"` para qualquer
  outra chave não vazia, `"none"` sem chave.
- `menuMarkup({ account, googleReady, busy, error })`: a marcação do painel.
  `account` é o resultado de `accountKind`. Com `"google"` mostra "Sair da
  conta"; nos outros casos, o lugar do botão do Google quando `googleReady`.
- `upcomingMarkup()`: as linhas "em breve", usadas no menu e na tela de
  resposta registrada.

Testes (`site-menu.test.js`): os três tipos de conta; a pesquisa aberta com
link para `./` e as próximas sem link; "Sair da conta" só com conta Google;
sem identificador do Google configurado não há área de entrada; o erro
aparece com `role="alert"`; nenhum texto recebido entra sem escape.

### 2. Menu no DOM

`mountSiteMenu({ host, current, onIdentityChange })` cria o
`<dialog class="pm-menu">` dentro de `host` e devolve `{ open(), close() }`. O
botão que abre vem de `menuButtonMarkup()` e tem `data-action="menu"`. Entrar: `mountGoogleButton` →
`exchangeGoogleCredential(credential, chave atual)` → grava `sessionToken` na
chave do aparelho → `onIdentityChange()`. Sair: `endSession(chave)`; com
resposta 401 a chave é esquecida mesmo assim; com falha de rede ou erro do
servidor ela fica e o erro aparece → `onIdentityChange()`. Se a entrada é
recusada com 401 e havia uma chave no aparelho, ela é refeita sem a chave,
menos quando a recusa é da credencial do Google (`INVALID_GOOGLE_CREDENTIAL`).
Sem `showModal`, o painel abre pelo atributo `open`.

### 3. A página da pesquisa

- `shell()`: nas telas `entry`, `done` e nas de pesquisa parada, o canto traz
  o botão do menu e o rótulo de etapa fica só para leitor de tela; no voto, na
  final e na confirmação, só o rótulo.
- `renderDone`: sai "Ir para o início", entram as próximas pesquisas.
- `renderStopped`: sai "Ir para o início".
- Aviso de cota: "Entre com Google no menu para responder agora", com um
  botão que abre o menu. Aviso de sessão: aponta o menu.
- `identityUpdated()`: chamada pelo menu. Com identidade em uso e diferente da
  salva, vale `identityChanged()`. Sem identidade em uso (entrada, resposta
  registrada sem conta, pesquisa parada), a página reabre (`init()`), para o
  aviso de cota sumir e a conta ser lida.
- `identityChanged()` ganha dois desvios: com a pesquisa parada a página
  reabre em vez de oferecer a entrada; e quem estava na resposta registrada e
  saiu da conta continua nela, com aviso. Uma recusa 409 de pesquisa fechada
  passa a ser guardada como estado da pesquisa.
- O registro do `sw.js` vem da capa antiga para cá.

### 4. Como funciona

HTML estático com o mesmo cabeçalho; o módulo só liga o menu. Título, quatro
linhas numeradas, a nota "Do PoliMatch só sai o resultado somado, nunca a
escolha de uma pessoa." (decisão 0001, item 5) e o botão
"Responder a pesquisa", que leva a `./`.

### 5. Troca da capa

- `index.html` com o conteúdo da `pesquisa.html`, sem `noindex`, com o
  manifesto e o ícone de toque; `og:url` na raiz.
- Entradas do Vite: `main: "index.html"` (o nome do arquivo gerado continua
  `main-*.js`, que o smoke do nginx procura) e `howItWorks: "como-funciona.html"`.
- nginx: um bloco por endereço aposentado, `return 302 /;`, antes do bloco
  geral de `.html`; `absolute_redirect off` para o `Location` sair relativo
  atrás do proxy.
- Testes de unidade que fixam páginas: `share-preview.test.js`,
  `edge-delivery.test.js`, `error-reporter.test.js`; `integrity-page.test.js`
  sai com a página.

### 6. Testes de navegador e CI

- `photo-survey.mjs`: `SURVEY_URL` vira a raiz; o cenário 1 passa a conferir
  que a capa é a pesquisa, que o sitemap lista as duas páginas e que as
  antigas não estão no build.
- `site-shell.mjs`: abrir e fechar (botão, Esc, foco), itens, nenhuma
  gravação ao abrir, entrar com Google simulado, sair, sair com sessão
  vencida, cota → menu → entrar → começar, "Como funciona" em dois tamanhos.
- Workflow: ficam `photo-survey`, `site-shell` e `client-error-report`.

## O que os testes não cobrem e precisa de olho

- O botão real do Google: nos e2e o script do Google é simulado. Em produção
  o identificador do cliente precisa aceitar a origem; ele já é usado na capa
  atual, na mesma origem.
- O redirecionamento: só o smoke da imagem, no CI, exercita o nginx.
- `<dialog>` em navegador antigo (antes do Safari 15.4): o menu abre pelo
  atributo, sem prender o foco. O e2e simula a falta de `showModal`; um
  aparelho de verdade com esse navegador não foi usado.
- Abrir o menu carrega o script do Google (`accounts.google.com`), como a
  capa antiga fazia ao abrir a tela de entrada.
