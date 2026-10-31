# ICM 40 — Primeira visita sem jogador e saída da cota por rede — #282

Base: `main` em 7c0bb27. Ler o `CONTEXT.md` da raiz, a política
`docs/security/VOTE_ABUSE_POLICY.md` e o estágio 11 (login Google).
Origem: auditoria de maturidade de 30/10/2026, bloqueio B4.

## Objetivo

A capa, a navegação e os quizzes abrem sem nenhuma escrita no servidor. O
jogador anônimo nasce só na primeira ação que precisa de identidade. Quando a
cota de jogos novos da rede acaba, a pessoa vê o motivo, a saída pelo Google e
o horário de liberação, em vez de "Não conseguimos falar com o servidor".

## Entradas

- `initialize()` fazia `POST /api/player` num `Promise.all` na carga, e a
  capa inteira dependia dele e de `/api/candidates`.
- A API aceita 3 jogadores anônimos novos por rede por dia; atrás de CGNAT,
  escola ou escritório isso acaba cedo. A janela era o dia UTC.
- O login Google não usa essa cota, mas o botão de conta virava um círculo
  vazio no celular (regra CSS que escondia o avatar) e a tela continuava
  travada depois do login.
- Acessos ao `localStorage` sem proteção faziam navegador com dados bloqueados
  parecer falha de rede, com texto em inglês.
- As recusas da cota não ficavam registradas em lugar nenhum.

## Escopo

- `app/src/main.js`: capa e navegação pintadas antes da API, com marcadores
  nos contadores; identidade sob demanda (`ensureIdentity`); aviso próprio para
  `PLAYER_ISSUANCE_LIMIT` com "Entrar com Google" e horário de liberação;
  login inicializa o app quando o catálogo ainda não carregou; logout fora do
  duelo não cria jogador.
- `app/src/presidential-page.js`: Duelos da corrida só criam jogador ao entrar
  na arena ou escolher categoria; mensagem própria para a cota.
- `app/src/safe-storage.js` e `app/src/identity-notice.js`, com testes.
- `app/src/styles.css`: só o rótulo do botão de conta some no celular; avatar
  visível e alvo de 44 × 44.
- `back/src/topic-store.js`: janela da cota de rede no dia editorial de São
  Paulo, `Retry-After` até a meia-noite, herança do contador legado UTC no dia
  da troca e contagem agregada das recusas em `quota_rejections_daily`.
- `docs/security/VOTE_ABUSE_POLICY.md`: janela, contagem e login Google como
  saída intencional da cota anônima.
- Testes: e2e `app/e2e/first-visit.mjs` (Chromium e WebKit) ligado ao CI,
  ajustes nos e2e que supunham criação antecipada, smoke `vote-abuse` e testes
  unitários.

## Fora de escopo

- Mudar o limite de 3 jogos novos por rede (decisão Q4 da #277).
- Compressão, cache e demais ajustes de infraestrutura que afetam o LCP.
- Log estruturado de respostas 4xx (outro achado da auditoria).
- `safe-storage` nos quizzes e em `civic/uf-preference.js`, que já se protegem.
- AAAA/IPv6 na origem, painel ou consulta de recusas em produção.

## Critérios de aceite

- E2E com `POST /api/player` = 429 `PLAYER_ISSUANCE_LIMIT`: hero, navegação,
  links dos quizzes e botão "Entrar com Google" visíveis; o texto "Não
  conseguimos falar com o servidor" não aparece. Depois do callback (stub), a
  capa com navegação aparece sem tocar em "Tentar novamente".
- Visita sem interação não gera `POST /api/player`.
- `.account-avatar` ≥ 24 px em 375, 390 e 440, no Chromium e no WebKit.
- Smoke `vote-abuse`: 5 `createPlayer` na mesma rede geram contagem 2 em
  `quota_rejections_daily`.
- LCP móvel com throttling e API simulada ≤ 2,5 s, pintado antes de qualquer
  resposta de `/api/`.

## Dependências

- Decisão Q4 da #277 só para o número do limite. O resto não depende dela.
- Gate humano: revisão e merge pelo Stefan.
