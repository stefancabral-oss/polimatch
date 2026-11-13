# HANDOFF — [ICM 39] API que não cai, erros visíveis e alarme

## Status

- Estado: `pronto para gate`
- Issue: #281
- Branch: `fix/api-resilience` (a partir de main `7c0bb27`; atualizada com a
  `main` em 13/11/2026, ver "Atualização de 13/11/2026")
- PR: https://github.com/stefancabral-oss/polimatch/pull/312, aberta pelo Stefan
  em 31/10/2026
- Último commit: o commit deste HANDOFF

## Entregue

- **Banco** (`back/src/database-resilience.js`, `topic-store.js`):
  - ouvinte de erro no pool para clientes ociosos e também para clientes
    emprestados no meio de uma transação. O pg-pool só escuta os ociosos; um
    cliente emprestado cuja conexão caía, inclusive por
    `idle_in_transaction_session_timeout`, também derrubava o processo;
  - prazos: conexão 5 s, consulta 10 s, espera por trava 5 s, transação
    parada 15 s, keep-alive TCP e `application_name=polimatch-api`. Os valores
    podem ser ajustados por `PG_*_TIMEOUT_MS`; um valor inválido impede o boot;
  - a migração de boot roda com `SET LOCAL` de 2 min, 30 s e 1 min, que valem
    só dentro da transação dela. A validação da constraint em
    `installGameSchema` percorre a tabela inteira a cada boot e não pode cair no
    limite de 10 s;
  - falha passageira do banco (prazo, trava, sessão encerrada, sem conexão)
    responde `503 DATABASE_UNAVAILABLE` com `Retry-After: 5`. O app já trata
    qualquer 5xx como repetível.
- **Processo** (`back/src/process-guards.js`, `server.js`):
  - `unhandledRejection` é registrada e a API segue;
  - `uncaughtException` é registrada; a API fecha o servidor e o pool em ordem
    e sai com código 1;
  - SIGTERM/SIGINT fecham em ordem com código 0, esperando as requisições em
    andamento;
  - o encerramento tem um timer de 8 s que força a saída;
  - falha de boot é registrada e sai com código 1.
- **Corpo da requisição** (`back/src/http-app.js`):
  - `Content-Encoding` diferente de `identity` recebe 415 antes de o corpo ser
    lido;
  - `express.json` usa `inflate: false`;
  - JSON malformado recebe 400 `INVALID_JSON`, corpo acima de 32 KB recebe
    413 `PAYLOAD_TOO_LARGE` e charset desconhecido recebe 415
    `UNSUPPORTED_CHARSET`, todos com mensagem fixa;
  - `app.disable('x-powered-by')`.
- **Dependências**:
  - `npm audit fix` atualizou body-parser para 2.4.0, proxy-addr para 2.0.8 e
    qs para 6.17.1;
  - o piso do override de qs subiu para `^6.17.1`;
  - `npm audit --omit=dev` e `npm audit` completo em back/: 0 avisos.
- **Logs** (`back/src/logger.js`):
  - uma linha JSON por requisição com `t`, `level`, `service`, `rev`,
    `requestId`, `method`, `route`, `status`, `ms` e `code`. `path` aparece só
    quando nenhuma rota casou;
  - nunca entram IP, cabeçalhos, query string ou corpo, e tokens e credenciais
    em texto livre são mascarados;
  - 5xx geram `request_failed` com stack e requestId;
  - 429 levam o código, então `grep -c '"status":429'` conta as recusas;
  - tudo sai no stdout.
- **Erros do navegador** (`app/src/error-reporter.js`,
  `app/src/install-error-reporter.js`, `back/src/client-error-report.js`):
  - as quatro páginas (`index.html`, `quem-disse-isso.html`,
    `fato-ou-fake.html`, `duelos-da-corrida.html`) importam primeiro o relato
    de erros, que escuta `error`, `unhandledrejection` e `vite:preloadError`;
  - o navegador envia por `sendBeacon`, como `text/plain` (sem preflight), um
    objeto de até 2 KB com build, página, tipo, mensagem, arquivo, posição e
    stack curta. Nada do jogador entra: objetos rejeitados viram só o tipo,
    query string e fragmento saem das URLs e tokens são mascarados. No máximo
    5 relatos por página, sem repetir o mesmo erro;
  - `POST /api/client-errors` revalida os campos, descarta o resto e grava uma
    linha `client_error` (nível `warn`) com o `requestId` e o `build` da
    página. Limite de 10 relatos por minuto por rede (pseudônimo HMAC, nunca o
    IP) e 120 por minuto no total; acima disso, 429
    `CLIENT_ERROR_RATE_LIMITED`;
  - o `build` é o `SOURCE_COMMIT` do build do app; enquanto o deploy não passa
    esse valor (ICM 45), vem o carimbo de horário do build, como já acontece
    com o `?v=` dos retratos.
- **Smoke** `back/scripts/api-resilience-smoke.mjs`
  (`npm run test:resilience --prefix back`), novo passo no job
  `back-integration-postgres`. Ele se recusa a rodar contra banco que não
  seja local e também confere a linha `client_error` no log do processo real.
- **E2E** `app/e2e/client-error-report.mjs`, novo passo no workflow de
  interface (Chromium e WebKit): força erro, rejeição e falha de import
  dinâmico no jogo, no quiz e na checagem e confere os relatos.
- **Documentação**: `docs/ops/MONITORING.md` (campos, erros do navegador,
  consultas, variáveis, monitor externo, avisos do Dokploy) e um link no
  README.

## Revisão independente

A primeira entrega adiava toda a captura de erros do navegador para o ICM 45.
O ICM 45 só cuida do SHA no build e do CI em main, então a captura ficaria
sem dono. A revisão implementou a captura neste estágio (relato no app,
endpoint, testes, e2e e documentação) e refez a verificação inteira.

## Não entregue / pendente

- O `build` dos relatos e o `rev` da API só trazem o SHA do commit em produção
  depois que o ICM 45 passar `SOURCE_COMMIT` no build do app e da API.
- Rastreador de erros (Sentry/GlitchTip) não adotado; 5xx e erros do navegador
  ficam no log. Não existe staging para o critério "5xx em staging gera
  evento".
- Rota inexistente continua com 404 HTML do Express (ICM 38). Compressão da
  API (ICM 38). npm audit no CI e Dependabot (ICM 52). Rotação dos logs do
  Docker (ICM 41).
- Os avisos de dev do app (vite) não entram neste estágio.

## Ação do Stefan

1. Monitor externo conforme `docs/ops/MONITORING.md`: Better Stack gratuito,
   checagem a cada 3 min, monitores em `https://polimatch.com.br/` (palavra
   `PoliMatch`) e `https://api.polimatch.com.br/api/health` (palavra
   `"ok":true`), alerta por e-mail.
2. Aviso de validade dos certificados com 14 dias nos dois monitores. Se o
   plano gratuito não liberar, usar o monitor de expiração do UptimeRobot.
   Adicionar `www` só depois do ICM 38.
3. Testar o alarme pelo monitor temporário de rota inexistente ou parando a
   API numa janela de pouco uso, e anotar na #281 o tempo até o alerta (meta:
   até 5 min).
4. No Dokploy: Settings → Notifications → Add Notification, marcar
   **App Build Error** e **App Deploy**, testar e salvar.
5. Depois do merge, fazer o deploy da API e depois o do app. A ordem só evita
   relatos perdidos: um app novo com a API antiga recebe 404 no relato e segue
   normal. Não há mudança de schema; o rollback é voltar a imagem anterior de
   cada serviço. Conferir:
   - `curl -sI https://api.polimatch.com.br/api/health` sem `x-powered-by`;
   - `docker logs --since 1h <api> 2>&1 | grep -c '"event":"http_request"'`
     maior que zero;
   - `grep -c '"status":429'` funcionando;
   - no console do navegador em `https://polimatch.com.br/`, rodar
     `setTimeout(() => { throw new Error("teste de alerta") })` e achar a
     linha com
     `docker logs --since 10m <api> 2>&1 | grep '"event":"client_error"' | grep 'teste de alerta'`.
6. Decidir se mantém o logger próprio ou prefere pino (ver Decisões). A troca
   fica restrita a `logger.js`.

## Testes executados

Base de todas as execuções: esta branch, num PostgreSQL 16.14 local e
descartável, Node 22.13.

- `npm test --prefix back`: 268 aprovados, 0 falhas (232 de main e 36 novos
  em logger, database-resilience, process-guards, http-hardening e
  client-error-report). Nenhum teste existente foi alterado.
- `npm test --prefix app`: 235 aprovados, 0 falhas (226 de main e 9 novos em
  error-reporter). Build do app aprovado, sem ativos do piloto #176.
- `npm run test:shared`: 93 aprovados, mais validação da taxonomia.
  `npm run editorial:verify --prefix back`: aprovado.
- Smokes de integração na ordem do CI, num banco novo: topic-store,
  ordered-choices, presidential-duels, vote-abuse, game-progress, civic-schema
  e api-resilience, todos aprovados.
- O smoke de resiliência mediu:
  - 1 conexão da API encerrada, `/api/health` seguinte com 200 e o mesmo pid;
  - corpo comprimido 415, JSON malformado 400, corpo grande 413;
  - tabela travada: 503 em cerca de 1,0 s (o smoke usa
    `PG_LOCK_TIMEOUT_MS=1000`);
  - linhas de requisição todas em JSON, exatamente 1 linha `"status":429` com
    `PLAYER_ISSUANCE_LIMIT`, sem token nem IP, e 1 linha `client_error` com o
    build enviado;
  - SIGTERM com saída 0;
  - no pool: prazo de consulta (57014), prazos da migração restritos à
    transação, transação parada e conexão ociosa encerrada, todas registradas
    sem derrubar o processo.
- Cenários manuais contra `src/server.js` em modo produção:
  - PostgreSQL parado: `/api/health` responde 503 `DATABASE_UNAVAILABLE` com
    `Retry-After: 5`; depois de religado, 200 no mesmo processo;
  - conexões da API encerradas durante uma requisição presa em trava: a
    requisição recebe 503, o processo segue e o health seguinte dá 200;
  - corpo comprimido enviado em partes: 415 com `Connection: close`,
    processo vivo;
  - SIGTERM com uma requisição em andamento: a requisição termina com 201 e o
    processo sai com `shutdown_completed`;
  - sem `DATABASE_URL`, banco inacessível, `PG_LOCK_TIMEOUT_MS=5s` ou segredo
    curto: `boot_failed` em JSON e saída 1.
- E2E contra `vite preview`, com a lista do workflow de interface mais o
  `client-error-report` (26 execuções por navegador; o smoke do formulário do
  piloto #176 ficou de fora porque não carrega as páginas do app). Localmente
  o Chromium usou o headless 1187 que está em cache, porque o Playwright
  1.55.1 pede a revisão 1193; o ajuste ficou só no diretório temporário.
  - Chromium: 26 de 26 aprovados.
  - WebKit: 21 de 26 na rodada completa. `interaction-smoke` (com e sem
    Google), `accessible-profile` e `civic-navigation` falham nos passos de
    Tab e de foco exatamente como em main `7c0bb27`, construído num diretório
    temporário: é o WebKit do macOS, e o CI roda WebKit no Linux.
    `fact-check` estourou o tempo uma vez; repetido, também falha às vezes em
    main com o `vite preview` sob carga, e com um servidor estático, alternando
    main e branch, passou 6 de 6 em cada um.
  - Depois do último ajuste, com build igual ao do Dokploy (sem
    `SOURCE_COMMIT`): `client-error-report`, `quote-quiz-checked`,
    `quote-quiz`, `main-navigation` e `presidential-navigation` aprovados nos
    dois navegadores.
- Prova ponta a ponta do relato: `src/server.js` em modo produção com
  `APP_ORIGINS` local e as páginas do build servidas na mesma origem. Um throw
  forçado em `quem-disse-isso.html` e na home, em Chromium e WebKit, virou
  linha `client_error` com o `build` igual ao `SOURCE_COMMIT` do build em
  cerca de 110 ms. Nenhum outro relato apareceu, mesmo com a home recebendo
  503 em todas as outras rotas da API.

## Riscos conhecidos

- Trava de 5 s: os votos de um tópico serializam em `ranking_pools FOR
  UPDATE`. A auditoria mediu 40 votos simultâneos em 405 ms. Um pico muito
  maior passaria a receber 503 repetível em vez de esperar sem limite. O valor
  pode ser ajustado por `PG_LOCK_TIMEOUT_MS`.
- Consulta de 10 s: leituras pesadas (recorte diário, apostas cumulativas)
  passam nos smokes. Com muito mais dados, ajustar por
  `PG_STATEMENT_TIMEOUT_MS`.
- A classificação de falha passageira usa três mensagens do driver pg 8.23,
  além dos códigos SQLSTATE e de rede. Se o driver mudar o texto, esses casos
  voltam a 500, sem derrubar o processo.
- Manter a API viva depois de uma `unhandledRejection` depende do healthcheck
  para reiniciar se algo ficar realmente quebrado.
- Volume de log: a linha por requisição inclui o healthcheck do Docker a cada
  30 s e o monitor externo. Os relatos do navegador somam no máximo 120
  linhas de até 2 KB por minuto. A rotação fica no ICM 41.
- O limite dos relatos fica em memória, por processo; com mais de uma réplica
  da API, o teto global multiplica.
- O passo novo do workflow de interface compara o `build` dos relatos com
  `github.sha`, que é o valor que o Vite usa hoje no CI. Se o ICM 45 mudar a
  fonte do SHA no build do CI, este passo precisa usar a mesma fonte.
- Com `CMD ["npm", "start"]`, o npm imprime linhas próprias (fora do JSON)
  quando o processo sai com 1. O ICM 52 troca o CMD.
- Ajustes de prazo exigem novo deploy da API.
- `back-shared.yml` e `ui-interaction-smoke.yml` também podem mudar em outras
  branches da mesma rodada (ICM 38, 45 e 52), com risco de conflito simples
  no merge.

## Decisões tomadas

- **Logger próprio em vez de pino + pino-http.** São 73 linhas, sem
  dependência nova; pino 9 e pino-http trariam 2 pacotes diretos e cerca de 13
  transitivos. Os campos formam uma lista de permissão: IP e `Authorization`
  não entram por construção, em vez de dependerem de configuração de redact e
  serializers. Há ainda uma máscara para tokens, chaves de jogador e
  credenciais em texto livre. A escrita é síncrona no stdout, adequada ao
  volume atual. Se o tráfego crescer ou o Stefan preferir pino, a troca fica
  restrita a `logger.js`.
- **Relato de erros próprio em vez de Sentry/GlitchTip**, como a issue permite:
  sem conta nova, sem SDK e sem enviar nada a terceiros. O relato não leva
  user agent nem nenhum dado do jogador.
- **Política de processo**: rejeição não tratada registra e segue; exceção
  não capturada registra, fecha em ordem e sai com 1. O timer de saída forçada
  não é `unref`, para que um fechamento pendurado não termine com código 0.
- Sem logger injetado, `createHttpApp` registra só avisos e falhas, como
  antes com `console.error`. O servidor injeta o logger completo. Os testes
  antigos continuam valendo sem alteração.
- A linha de requisição usa o nível `info` para qualquer status. A falha 5xx
  tem linha própria com nível `error`; o relato do navegador, `warn`.
- O filtro de `Content-Encoding` vale para qualquer método e roda depois do
  CORS, para o navegador conseguir ler o 415. A rota de relatos fica antes do
  parser JSON geral, para que o teto de 2 KB valha para qualquer tipo de corpo.
- O relato só escuta erros que sobem até a janela, sem captura: falhas de
  imagem continuam com o fallback próprio do app e não viram relato.
- O smoke encerra apenas conexões com `application_name=polimatch-api` e se
  recusa a rodar contra banco remoto.
- O CONTEXT.md da raiz não foi alterado: não há mudança de direção do produto,
  e outras branches da mesma rodada mexem no mesmo trecho.

## Próximo passo exato

1. Stefan revisa a branch `fix/api-resilience`, faz push e abre a PR citando
   a #281.
2. Conferir no CI os jobs `back-shared` (com o passo do smoke de resiliência)
   e `UI Interaction Smoke` em Chromium e WebKit (com o passo do relato de
   erros).
3. Merge e deploy da API, depois do app; rollback é voltar a imagem anterior
   de cada serviço, sem mudança de schema.
4. Executar a lista "Ação do Stefan" e registrar na #281 o tempo do alarme.

## Atualização de 13/11/2026

A branch recebeu a `main` atual, que traz #311, #317, a direção nova (#319 e
#320), o conserto do CI (#321), o estágio 40 (#313) e o estágio 37 (#310).

Três conflitos, todos com o estágio 37:

- `back/src/server.js`: os dois estágios reescreveram o início da API. Ficou a
  estrutura deste estágio, com logger e guardas de processo. A garantia do
  estágio 37 continua: se a inicialização do banco falha, a API não escuta e
  sai com código 1. O reset bloqueado chega ao mesmo `catch`, e o log
  `boot_failed` leva o código `SCHEMA_RESET_BLOCKED`.
- `back/src/topic-store.js`: `createTopicStore` aceita `env`, `logger` e
  `allowSchemaReset`, e o `init()` aplica os prazos da migração e depois chama
  `createCleanSchema` com `allowReset`.
- `.github/workflows/back-shared.yml`: o passo de resiliência vem antes do
  backup com ensaio e da restauração parcial, que precisa ser o último.

Dois encaixes que o git não acusa:

- `back/scripts/api-resilience-smoke.mjs` passou a usar a guarda de banco
  descartável do estágio 37. O teste `disposable-db.test.js` roda todo
  `*-smoke.mjs` e exige essa recusa; sem isso o `back-unit` reprovaria.
- O log de início deixou de ser a linha `PostgreSQL Eleições 2026
  inicializado` e passou a ser JSON, com `"event":"database_ready"`. O ensaio e
  o smoke de restauração parcial já aceitam os dois formatos. O handoff do
  estágio 37 citava a linha antiga na lista do Stefan e foi corrigido.

Conferido na máquina desta atualização: sintaxe dos arquivos juntados, YAML do
workflow e ausência de marcadores de conflito. Os testes do back não rodam
aqui, por falta das dependências instaladas; a prova é o CI do GitHub.

CI do GitHub no commit `a7e5a85`: `back-unit`, `back-integration-postgres`
(com resiliência, backup, ensaio e restauração parcial juntos), `shared-data`,
`validate` e `browser-smoke (chromium)` verdes. `browser-smoke (webkit)`
falhou, por uma falha intermitente que já existia na `main`:

- O que falhou: `app/e2e/fact-check.mjs` esperou 30 s por `[data-verdict]`
  depois de voltar do quiz pelo link do rodapé.
- Reprodução em WebKit nesta máquina: 4 falhas em 34 rodadas, uma delas em 8
  rodadas na `main` sem este PR. Na falha, a página continuava em
  `quem-disse-isso.html`: o clique não tinha navegado.
- Causa: no WebKit, `quem-disse-isso.html` e `fato-ou-fake.html` montam o
  conteúdo antes de as folhas de estilo estarem aplicadas
  (`document.styleSheets` vazio no primeiro render). O link do rodapé aparece
  em 4498 px, vai para 1029 px quando o CSS chega e para 1018 px quando a
  fonte troca. O clique do teste nesse intervalo erra o link.
- Por que varia: `app/src/quote-quiz.css` começa com um `@import` de
  `fonts.googleapis.com`. A folha de estilo só fica pronta quando esse pedido
  externo responde, então o tempo sem estilo depende da rede de terceiros.
- Correção, só no teste: esperar `load` e as fontes, com prazo, antes de
  clicar no link do rodapé da página recém-aberta. Depois dela, 54 rodadas em
  WebKit sem falha: 30 com a primeira versão da espera e 24 com a versão com
  prazo, que foi sugestão da conferência independente.
- Fora do escopo deste estágio, para a [ICM 56] #298, que trata de fontes
  locais: nessas duas páginas o conteúdo sem estilo aparece por um instante no
  Safari. `index.html` e `duelos-da-corrida.html` não têm o problema.
- Mesmo padrão, não alterado aqui: `app/e2e/quote-quiz.mjs` (linhas 56, 58 e
  62) e `app/e2e/quote-quiz-checked.mjs` (linha 81) clicam logo depois de uma
  navegação para essas páginas. Não falharam, mas estão expostos à mesma
  corrida.

Um agente independente conferiu a junção, somente leitura: nenhum defeito de
código na junção, nenhuma linha perdida dos dois lados, e a guarda nova do
smoke de resiliência atende ao teste que a exige.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan
- Observação: nenhum agente aprova o próprio gate, faz merge ou publica em
  produção.
