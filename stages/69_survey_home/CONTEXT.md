# ICM 69 — A pesquisa por foto vira a capa — #331

Base main `2080596` (merge da #330).
Ler o contexto raiz, o `AGENTS.md`, as decisões
[0001](../../docs/decisions/0001-pesquisa-de-preferencia-por-foto.md),
[0002](../../docs/decisions/0002-ordem-de-construcao-e-cartas-com-moldura.md) e
[0003](../../docs/decisions/0003-a-pesquisa-vira-a-capa.md), e o contexto do
estágio 68.

## Objetivo

`polimatch.com.br` abre direto na pesquisa aberta, com um menu no padrão novo.
As páginas do produto anterior saem do site. O que o estágio 68 construiu
(entrada, voto, final, confirmação, uma resposta por jogador) não muda.

## Entradas

- Issue #331 e a decisão 0003.
- A folha com as telas desenhadas, em `references/`, que o Stefan recebeu em
  14/11/2026 e mandou construir.
- A página da pesquisa do estágio 68: `app/pesquisa.html`,
  `app/src/photo-survey-page.js`, `app/src/photo-survey-flow.js` e
  `app/src/photo-survey.css`.
- A entrada com Google da capa atual: `app/src/google-login.js` e as rotas
  `/api/auth/google` e `/api/auth/logout`, que já existem.

## O que existe hoje e o que muda

| Tema | Hoje | Depois deste estágio |
|---|---|---|
| `/` | Capa do jogo: rodada diária, ranking, coleção | Entrada da pesquisa aberta |
| `/pesquisa.html` | A pesquisa, escondida, com `noindex` | Leva ao início |
| `/quem-disse-isso.html`, `/fato-ou-fake.html`, `/duelos-da-corrida.html`, `/integridade.html` | Páginas do produto anterior | Levam ao início |
| Menu | Barra de baixo da capa do jogo | Botão no canto, que abre o menu novo |
| Entrada com Google | Só na capa do jogo | No menu |
| Sitemap | As quatro páginas antigas | O início e "Como funciona" |
| Visual | Malaquita na capa, neutro na pesquisa | Neutro, com um único verde, em tudo |

## O formato deste estágio

1. **Início.** A entrada da pesquisa aberta, como no estágio 68. No lugar do
   rótulo "Pesquisa", no canto, fica o botão do menu. Abrir a página continua
   sem gravar nada.
2. **Menu.** Abre por cima da tela. Traz as pesquisas (a aberta, que leva ao
   início, e as próximas, marcadas "em breve" e sem link), "Como funciona" e a
   conta: "Entrar com Google" ou, para quem já entrou, "Sair da conta". O
   botão do menu aparece na entrada, na resposta registrada e nas telas de
   pesquisa fechada. Não aparece durante o voto, a final e a confirmação: ali
   continua o indicador de etapa.
3. **Próximas pesquisas.** "Famosos e influenciadores" e "Roupas", na ordem da
   decisão 0002. São só anúncio: não têm página, data nem cartas.
4. **Depois de responder.** A tela de resposta registrada mostra a escolha, as
   finalistas e as próximas pesquisas. O botão "Ir para o início" sai, porque
   a pessoa já está no início.
5. **Como funciona.** Página curta, no mesmo padrão, com o formato em quatro
   linhas e o botão para responder.
6. **Privacidade.** A folha traz a página. Ela não entra neste estágio: só
   entra no menu quando houver texto aprovado (#283).
7. **Endereços antigos.** Respondem 302 para o início. A resposta é
   temporária de propósito.

## Regras

- **Nada em `back/` nem em `shared/`.** As rotas e os dados do jogo anterior
  ficam como estão.
- **Abrir não grava.** Abrir o início, abrir o menu e abrir "Como funciona"
  não criam jogador nem gravam nada. O jogador continua nascendo no toque em
  "Começar".
- **Identidade.** Entrar ou sair pelo menu usa a mesma chave do aparelho que a
  pesquisa já lê. A pesquisa reage como já reagia a uma troca de conta feita
  em outra aba: recomeça com a identidade atual, e nenhuma identidade responde
  duas vezes.
- **Sair com a sessão vencida.** Se o servidor responde que a sessão já não
  vale, o aparelho esquece a sessão mesmo assim. Com falha de rede, não:
  primeiro se revoga, depois se esquece.
- **Sem resultado público.** O gate de publicação agregada (#177) continua em
  vigor.
- **Uma só página serve a pesquisa.** `/pesquisa.html` deixa de existir como
  página e passa a redirecionar.

## Entregas

| Entrega | O que traz | PR |
|---|---|---|
| 69a — Registro | Decisão 0003, este contexto, o plano, a folha e os ajustes no 0001, no `CONTEXT.md`, no `README.md`, no `AGENTS.md` e no contexto do estágio 68. | o mesmo da 69b e da 69c |
| 69b — Casca nova | Menu, entrada com Google no menu e a página "Como funciona". | o mesmo |
| 69c — Troca da capa | `/` serve a pesquisa; redirecionamentos; sitemap e manifesto; as páginas antigas saem do build; os testes de navegador delas saem do CI. | o mesmo |
| 69d — Limpeza | O código, os testes e os roteiros das páginas antigas saem da `main`. | próprio, depois da 69c publicada |
| 69e — Publicação | App publicado e conferido de fora. | registro próprio |

## Fora de escopo

- Qualquer mudança no servidor, no banco ou nas rotas.
- A página de Privacidade e o texto dela (#283).
- Cadastro por CPF, top 5 público, compartilhar, avisos e indicação.
- A segunda pesquisa e a de roupas: neste estágio elas são só o anúncio "em
  breve".
- Som e háptica.
- A pesquisa de lançamento com código próprio: é proposta para o passo de
  publicação e mexe em `shared/`.
- Apagar imagens públicas que só o produto anterior usava: fica para a 69d ou
  depois, junto com a #284.

## Critérios de aceite

Casca nova (69b):

- O menu abre pelo botão, fecha pelo botão de fechar e pela tecla Esc, prende
  o foco enquanto está aberto e devolve o foco ao botão ao fechar.
- O menu lista a pesquisa aberta com link para o início e as próximas sem
  link.
- Abrir o menu não faz nenhuma requisição que grave.
- Entrar com Google pelo menu troca a identidade do aparelho. Quem estava na
  entrada segue na entrada; quem já tinha começado recomeça com a conta, com
  o aviso de conta trocada.
- Sair pelo menu revoga a sessão e esquece a chave. Com a sessão já inválida
  no servidor, o aparelho esquece mesmo assim.
- O aviso de cota de rede esgotada aponta para o menu, não para outra página.
- "Como funciona" cabe na tela em 390×844 e em 360×640, com o botão que leva
  ao início.

Troca da capa (69c):

- `/` mostra a entrada da pesquisa; abrir não cria jogador nem sorteio.
- Os 34 cenários do e2e da pesquisa passam com a página em `/`.
- O build tem só `index.html` e `como-funciona.html`; o sitemap lista só as
  duas; nenhuma tem `noindex`.
- No nginx, `/pesquisa.html` e os quatro endereços antigos respondem 302 com
  `Location: /`; um arquivo ausente continua respondendo 404.
- Os testes de unidade passam; os e2e que sobram no CI passam em Chromium e
  em WebKit.

Limpeza (69d):

- Nenhum módulo de `app/src` fica sem uso pelo build, pelos testes do
  servidor ou pelo CI.
- Os testes de `back/` e de `shared/` passam sem alteração de comportamento.

Publicação (69e):

- As condições de publicação abaixo foram decididas pelo Stefan.
- App publicado e conferido de fora: `/` com a pesquisa, redirecionamentos
  respondendo, API intocada.

## Condições de publicação

A decidir pelo Stefan no passo de publicação. Nenhuma é dispensada por este
estágio:

- **Privacidade (#283).** Com a troca, qualquer visitante vê a pesquisa. O
  estágio 68 punha a política publicada antes de divulgar a pessoas de fora.
- **Backup (#279).** As respostas passam a ser o dado principal.
- **Imagens (#284).** As 8 cartas vindas de fotos de veículos ou de sites
  continuam no conjunto, com o uso confirmado por ele para o teste escondido.
- **Pesquisa de lançamento.** Proposta do agente: código novo, zerado, para
  separar as respostas de ensaio.
- **Cota por rede.** Três participações novas por rede por dia; a quarta
  pessoa da mesma rede precisa entrar com Google.

## Dependências e riscos

- **A entrada com Google muda de lugar.** É o ponto mais delicado: a troca de
  identidade no meio da pesquisa já é coberta pelo estágio 68, e o menu usa o
  mesmo caminho.
- **Muitos testes fixam as páginas atuais.** Cerca de 28 roteiros de e2e e
  cinco testes de unidade conhecem a capa do jogo. Na 69c eles saem do CI ou
  são reescritos para a capa nova; o relato de erros do navegador
  (`client-error-report`) é reescrito, não removido.
- **O servidor depende de arquivos do app.** `app/src/photos.js` e
  `app/public/portraits` entram nos testes de `back/`. A limpeza (69d) só
  apaga o que nenhum deles usa.
- **Redirecionamento só existe no nginx.** O `vite preview` dos e2e não o
  reproduz; quem confere é o smoke da imagem, no CI.
- **Programa de maturidade.** Continua aberto (#309) e corre em paralelo.
