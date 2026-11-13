# HANDOFF — [ICM 40] Abrir o app sem criar jogador e dar saída quando a cota por rede acabar

## Status

- Estado: `aprovado`
- Issue: #282
- Branch: `fix/first-visit` (a partir de `main` em 7c0bb27)
- PR: https://github.com/stefancabral-oss/polimatch/pull/313, aberta pelo Stefan
  em 31/10/2026
- Último commit: ver `git log fix/first-visit`; os commits de código são
  873da23, 1d85cff, f2d65c7, e38945d e 98b8967 (correção da revisão
  independente), e os registros do estágio vêm por último.

## Entregue

**Capa sem identidade e sem escrita**
- A capa, a navegação e os links de Duelos da corrida e Quem disse isso? são
  pintados antes de qualquer resposta da API. Os contadores começam em "—" e só
  os nós de progresso mudam quando catálogo, ranking e rodada chegam.
- O painel "Conexão necessária" que substituía a capa inteira saiu. Falha do
  catálogo vira um aviso dentro do hero, com "Tentar novamente", sem texto cru
  do navegador.
- `state.ready` passa a dizer só que o catálogo carregou. A identidade é
  resolvida por `ensureIdentity()`, com a mesma ideia do `ensureIdentity` da
  corrida: uma chave salva é apenas lida (GET) em paralelo ao catálogo; sem
  chave, o jogador anônimo nasce na primeira ação que precisa dele ("Jogar
  rodada do dia", "Duelo", "Voltar às escolhas", modo livre). Toques repetidos
  usam a mesma criação. Um login concluído enquanto o POST viaja vence, e a
  chave anônima é descartada.
- Ranking, Coleção e "Meu placar de apostas" abrem vazios para quem ainda não
  jogou, sem criar jogador.
- Um 401 na abertura descarta a chave inválida, mas o substituto só nasce na
  próxima jogada. Outras falhas (5xx, rede) preservam a chave, como antes.
- Sair da conta fora do duelo não cria jogador; dentro do duelo cria, porque a
  pessoa está jogando.
- Entrar com Google enquanto a chave salva ainda está sendo lida espera a
  leitura terminar e leva a chave anônima ao login, para as escolhas serem
  reunidas à conta. Sem isso, a sessão Google era gravada por cima da chave e o
  histórico anônimo se perdia (achado da revisão independente, commit 98b8967).

**Saída quando a cota da rede acaba**
- 429 `PLAYER_ISSUANCE_LIMIT` mostra na capa "Muitos jogos novos nesta rede
  hoje.", o motivo, o horário de liberação no fuso de São Paulo (arredondado ao
  minuto), o botão "Entrar com Google" (abre o mesmo diálogo do topo) e a
  lembrança de que Quem disse isso? segue aberto. Hero, navegação e quizzes
  continuam visíveis; não há "Tentar novamente" nem texto de servidor. Um novo
  toque antes da liberação não repete o POST.
- Outras falhas na criação mostram "Não conseguimos começar seu jogo agora."
  com "Tentar novamente".
- `handleGoogleCredential` chama `initialize()` quando `!state.ready`: com o
  catálogo fora do ar, o login termina a inicialização e a capa volta sem tocar
  em "Tentar novamente". Com o app pronto, o login segue o fluxo anterior.
- Duelos da corrida: sem chave salva, a abertura não pede nada; o jogador nasce
  ao entrar na arena ou escolher categoria. A cota tem mensagem própria que
  aponta o login em Início. O aviso "sua conta mudou em outra aba" só aparece
  quando esta aba já tinha identidade.

**Botão de conta e armazenamento**
- `styles.css`: no celular só `[data-account-label]` some; `.account-avatar`
  continua visível (símbolo deslogado, foto logado) e o botão tem 44 × 44.
- `src/safe-storage.js`: leitura e escrita nunca lançam; armazenamento
  bloqueado vira sessão em memória e a capa avisa que o progresso fica só nesta
  aba. `main.js` não acessa mais `localStorage` diretamente; a corrida usa o
  mesmo wrapper.

**Backend e política**
- `topic-store.js`: a cota `network-player-day` usa o dia editorial de São
  Paulo (`networkIssuanceWindow`), e o `Retry-After` conta até a próxima
  meia-noite. O contador legado por dia UTC que se sobrepõe à janela nova é
  herdado, limitado a 3, para o dia do deploy não abrir outra franquia. O limite
  continua 3.
- Recusas de criação de jogador são contadas em `quota_rejections_daily`
  (`day`, `scope`, `code`, `count`), fora da transação revertida, sem IP,
  pseudônimo ou jogador. Retenção de 400 dias; os contadores por rede seguem com
  8 dias. A tabela é criada com `CREATE TABLE IF NOT EXISTS` no `init()`.
- `docs/security/VOTE_ABUSE_POLICY.md` (versão 3): janela editorial, contagem
  das recusas, login Google fora da cota anônima por decisão de produto, e o
  contrato do app (nada é escrito na abertura; aviso próprio para a cota).

**Testes novos**
- `app/e2e/first-visit.mjs` (Chromium e WebKit), ligado ao workflow UI
  Interaction Smoke: capa pintada com a API pendente, visita passiva sem
  `POST /api/player` (página principal e corrida), aviso da cota com Google e
  horário, login que libera o jogo sem novo POST, login que inicializa o app
  sem catálogo, armazenamento bloqueado sem texto de rede, avatar ≥ 24 px e
  alvo ≥ 44 px em 375, 390 e 440, e login durante a leitura da chave salva
  levando a chave anônima (6 cenários).
- Unitários: `safe-storage.test.js`, `identity-notice.test.js`, janela
  editorial em `topic-store.test.js`, rota Google sem emissão anônima em
  `http-app.test.js`.
- `back/scripts/vote-abuse-smoke.mjs`: 5 `createPlayer` na mesma rede às
  23h30 de Brasília → 3 criados, 2 recusas com `retryAfterSeconds` 1800, bucket
  em 03:00Z e contagem 2 em `quota_rejections_daily`; herança do bucket UTC;
  login Google de subject novo sem token com a rede esgotada, sem mudar
  contadores nem recusas; após 9 dias simulados o contador some e o agregado
  fica.
- `app/scripts/measure-home-lcp.mjs`: medição manual do LCP da capa.

## Não entregue / pendente

- Lighthouse de verdade não rodou (não está instalado e não instalamos nada
  global). A medição usou Chromium com os mesmos parâmetros do throttling
  devtools móvel do Lighthouse; ver "Testes executados".
- O número do limite (3 por rede) não mudou: é a decisão Q4 da #277.
- Log estruturado de respostas 4xx e uma consulta ou painel das recusas em
  produção ficam para o estágio de observabilidade.
- "Restabelecer sessão" (401 no meio de um voto) ainda cria jogador direto; se
  a cota da rede estiver esgotada, o duelo mostra a espera genérica de 429, sem
  o botão do Google.
- Quizzes e `civic/uf-preference.js` já protegem o armazenamento e não foram
  migrados para `safe-storage`.
- O botão de som segue com 42 × 42 no celular, e no desktop o botão de conta
  com rótulo segue com altura mínima de 40 px.
- AAAA/IPv6 na origem continua fora deste estágio.
- Duelos da corrida: depois da recusa da cota, um novo toque em "Entrar na
  arena" repete o `POST /api/player` (a página principal não repete antes da
  liberação). Só gasta uma requisição; a mensagem continua a mesma.
- Se a leitura da chave salva falhar por erro passageiro (5xx, rede) e a pessoa
  entrar com Google, o login segue sem a chave anônima, como já acontecia em
  `main`; com a leitura em curso, o login agora espera.
- Com o catálogo fora do ar, os botões cívicos da navegação (quando ativos)
  esperam o catálogo carregar para abrir.

## Testes executados

- `npm test --prefix app`: 236 aprovados (226 antes + 10 novos).
- `npm test --prefix back`: 235 aprovados (232 antes + 3 novos), com e sem
  `DATABASE_URL`.
- `node --test shared/*.test.js`: 93 aprovados; `validate:taxonomy` ok.
- `npm run build --prefix app` com `VITE_GOOGLE_CLIENT_ID` de teste: ok, sem
  ativos do piloto #176.
- Smokes em PostgreSQL 16 descartável, na ordem do CI, em banco novo:
  topic-store, ordered-choices, presidential-duels, vote-abuse, game-progress
  e civic-schema, todos aprovados. O vote-abuse também foi repetido no mesmo
  banco para provar que mede só a própria diferença.
- E2E (prévia local): todos os scripts do workflow mais `first-visit.mjs`, no
  Chromium e no WebKit. Resultado detalhado em `verification.json`.
  No WebKit local (macOS), `interaction-smoke` (com e sem Google),
  `accessible-profile` e `civic-navigation` falham na mesma asserção de
  navegação por Tab em `main` antes desta mudança e depois dela; o CI em Linux
  decide.
- E2E atualizados porque supunham jogador criado na abertura:
  - `presidential-duels.mjs`: esperava as cartas ativas logo após abrir a
    página, o que dependia do POST na carga. Agora entra na arena antes, e
    confere 0 POST na abertura e 1 depois de "Entrar na arena".
  - `prediction-identity.mjs`: joga a rodada antes para criar a credencial
    anônima que o teste troca no meio do load. Depois do logout fora do duelo,
    confere que nenhum jogador foi criado e que o placar sem identidade não
    consulta o servidor; joga de novo e confere que a sessão seguinte abre o
    próprio placar (`Bearer pm2_identity_2`).
  - `vote-recovery.mjs`, cenário 3: o 401 na abertura descarta a chave e o
    substituto nasce ao abrir o duelo na mesma página (sem o initScript
    regravar a chave antiga). As asserções originais continuam.
- LCP da capa, Chromium, throttling devtools móvel (562,5 ms, 1,47 Mbps,
  CPU 4x), API simulada com 4 s por resposta, arquivos com gzip, mediana de 3:
  `main` 9,97 s (o h1 só aparece depois de dois ciclos da API); esta branch
  1,98 s, com o h1 pintado cerca de 3,9 s antes da primeira resposta da API.
- Capturas em `stages/40_first_visit/references/`: capa no WebKit com o avatar
  visível e o aviso da cota no Chromium e no WebKit, todas em 390 px.

**Revisão independente (31/10/2026)**, refeita do zero, sem aproveitar os
números acima:
- `npm test --prefix app`: 236 aprovados; `npm test --prefix back`: 235
  aprovados, sem e com `DATABASE_URL`; `node --test shared/*.test.js`: 93
  aprovados; `validate:taxonomy` ok; `test:card-art-pilot-contract`: 64
  aprovados; build com e sem `VITE_GOOGLE_CLIENT_ID` ok.
- PostgreSQL 16 descartável, banco novo, ordem do CI: os 6 smokes aprovados; o
  `vote-abuse` também passou repetido no mesmo banco.
- E2E do workflow mais `first-visit.mjs` (6 cenários): Chromium 27/27, antes e
  depois da correção 98b8967. WebKit 23/27: `interaction-smoke` (com e sem
  Google), `accessible-profile` e `civic-navigation` falham na asserção de
  navegação por Tab; os mesmos quatro scripts de `main` (7c0bb27) falham na
  mesma asserção contra o build de `main`, então é o WebKit local do macOS.
- O cenário 6 novo de `first-visit.mjs` falhou contra o build anterior à
  correção (login sem a chave) e passa depois, no Chromium e no WebKit. O
  `first-visit.mjs` inteiro falha contra o build de `main` no primeiro cenário.
- LCP com `measure-home-lcp.mjs` contra `vite preview`, mediana de 3: `main`
  9,98 s; esta branch 1,98 s, com o h1 pintado antes da primeira resposta da
  API (cerca de 5,85 s).

## Riscos conhecidos

- Quem ainda não jogou vê "0/10" e "0 escolhas no seu ranking" na capa. É
  verdadeiro, mas diferente de antes, quando havia um jogador criado.
- Menos linhas em `anonymous_players` (visitas que não jogam não criam
  ninguém). Métricas baseadas em criação de jogador vão cair; é o efeito
  esperado.
- A virada da cota de rede passa das 21h para a meia-noite de Brasília. No dia
  do deploy o contador UTC sobreposto é herdado, então nenhuma rede ganha
  franquia extra; algumas podem continuar bloqueadas até a meia-noite.
- `quota_rejections_daily` é tabela nova e aditiva; nenhum dado existente é
  alterado.
- A medição de LCP é local. O valor em produção depende de compressão e cache,
  tratados em outro estágio.

## Decisões tomadas

- "Primeira ação que precisa de identidade" é jogar (rodada do dia, duelo,
  modo livre), não o primeiro toque numa carta: a própria rodada do dia só é
  lida com o token do jogador.
- O aviso da cota fica na capa, para manter hero, navegação e quizzes à vista
  junto com o botão do Google.
- Só as recusas de criação de jogador são contadas agora; a tabela aceita
  outros escopos depois.
- Retenção de 400 dias para o agregado, conforme a recomendação da auditoria.

## Próximo passo exato

1. Stefan revisa a branch `fix/first-visit`, publica e abre a PR para #282.
2. Conferir o CI (UI Interaction Smoke em Chromium e WebKit, com o passo novo,
   e Backend and Shared com o smoke de abuso).
3. Gate visual com as capturas e, depois do deploy, medir o LCP em produção.

## Ação do Stefan

- Publicar a branch e abrir a PR (agentes não fazem push nem abrem PR nesta
  rodada), citando #282.
- Decidir a Q4 da #277 sobre o limite de 3 jogos novos por rede. Esta entrega
  não muda o número.
- Confirmar que o build de produção tem `VITE_GOOGLE_CLIENT_ID` configurado;
  sem ele o aviso da cota mostra texto em vez do botão do Google.
- Depois do deploy, rodar o Lighthouse móvel na capa de produção, ou
  `POLIMATCH_E2E_URL=<url> node app/scripts/measure-home-lcp.mjs` contra uma
  cópia servida com compressão.
- Para acompanhar as recusas no banco de produção, pelo acesso habitual de
  administração e só leitura:
  `SELECT day, scope, code, count FROM quota_rejections_daily ORDER BY day DESC LIMIT 30;`

## Atualização de 12/11/2026

- A branch recebeu a `main` atual (#311, #317, #319 e #320). A junção foi
  automática; só o `CONTEXT.md` da raiz foi tocado dos dois lados.
- Antes do envio, na junção local: `npm test --prefix app` com 255 testes e
  nenhuma falha, `npm run test:shared` com 93 e nenhuma falha, e
  `npm run build --prefix app` concluído. Os testes do back e os e2e rodam no
  CI do GitHub depois do envio.
- A Q4 da #277 foi respondida em 12/11/2026: o jogador nasce só no primeiro
  voto, que é o que este estágio entrega, e o limite por rede sobe. O número
  novo sai numa decisão versionada da política, com o dado de recusas que a
  tabela `quota_rejections_daily` passa a guardar. Este PR não muda o número.
- Continuam com o Stefan, depois do merge: o deploy, conferir que o build de
  produção tem `VITE_GOOGLE_CLIENT_ID`, medir o LCP da capa em produção e
  acompanhar as recusas pela consulta da seção "Ação do Stefan".

## Publicação em produção — 13/11/2026

Por instrução do Stefan em conversa ("Sim, publica"), com ele logado no painel, o app com este estágio foi publicado no commit `7a4c9db`, depois da API. Quem executou o deploy foi o agente, clicando em Deploy no painel, a pedido dele. É uma exceção pontual, autorizada por ele naquela conversa, à frase "nenhum agente publica em produção" do gate abaixo; a regra não muda.

- Por GET: as quatro páginas e os arquivos que elas referenciam respondem 200, e o build de produção traz o client id do Google.
- Em navegador limpo, autorizado por ele ("Sim, confere"): WebKit do Playwright, um contexto novo por página, sem clique, com toda requisição que não fosse GET para a API bloqueada. A capa fez três chamadas GET à API; as outras três páginas, nenhuma. Não houve tentativa de gravação, chave no `localStorage` nem erro. No log da API não apareceu `POST` nem `/api/player`.
- LCP móvel da capa, autorizado por ele ("Sim, mede"), mediana de 3: 2,10 s com `app/scripts/measure-home-lcp.mjs` (API simulada com 4 s) e 2,10 s no Lighthouse 12.8.2 com `--throttling-method=devtools` e a API real (nota 97; primeira resposta da API em 2,64 s). A auditoria de 30/10 registrava 5,4 s.
- No modo padrão o Lighthouse estima por simulação e deu 5,41 s, 5,42 s e 2,84 s (nota 80 na mediana). A mediana, 5,41 s, é igual à base da auditoria: quem rodar o Lighthouse padrão ou o PageSpeed pode continuar vendo perto de 5,4 s. A causa da variação não foi investigada.
- O script do repositório rodou a partir de uma cópia com `channel: "chrome"`, porque o Chromium do Playwright instalado na máquina é de outra versão.
- Não conferido em produção: o aviso de cota esgotada.
- Já registrado no handoff do estágio 38 e confirmado em produção: `GET /api/candidates` responde 86 KB sem compressão.
- A issue #282 foi fechada em 13/11/2026 por instrução do Stefan ("Sim, fecha"), transcrita na issue.

## Human gate

- Decisão: `aprovado`
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para este PR, em
  conversa de 12/11/2026 ("Pode mesclar o 313"), transcrita no PR. O merge fica
  a cargo do agente, a pedido dele, depois do CI verde. A regra 6 do
  `AGENTS.md` não muda. Nenhum agente publica em produção.
