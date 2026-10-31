# HANDOFF — [ICM 39] API que não cai, erros visíveis e alarme

## Status

- Estado: `pronto para gate`
- Issue: #281
- Branch: `fix/api-resilience` (a partir de main `7c0bb27`)
- PR: não aberta; o agente não faz push nem abre PR
- Último commit: o commit deste HANDOFF; código e documentação até `0a1b944`

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
  - SIGTERM/SIGINT fecham em ordem com código 0;
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
- **Smoke** `back/scripts/api-resilience-smoke.mjs`
  (`npm run test:resilience --prefix back`), novo passo no job
  `back-integration-postgres`. Ele se recusa a rodar contra banco que não
  seja local.
- **Documentação**: `docs/ops/MONITORING.md` (campos, consultas, variáveis,
  monitor externo, avisos do Dokploy) e um link no README.

## Não entregue / pendente

- Captura de erros no navegador (`error`, `unhandledrejection`,
  `vite:preloadError` via sendBeacon): adiada até o ICM 45 colocar o SHA do
  build no cliente. Por isso o critério "throw forçado aparece no log com o
  SHA" continua aberto.
- `rev` sai `null` até o ICM 45 passar `SOURCE_COMMIT` no deploy.
- Rastreador de erros (Sentry/GlitchTip) não adotado; os 5xx ficam no log.
  Não existe staging para o critério "5xx em staging gera evento".
- Rota inexistente continua com 404 HTML do Express (ICM 38). Compressão da
  API (ICM 38). npm audit no CI e Dependabot (ICM 52). Rotação dos logs do
  Docker (ICM 41).
- Os avisos de dev do app (vite) não entram neste estágio, que cobre só back/.

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
5. Depois do merge e do deploy da API (não precisa de deploy coordenado com o
   app):
   - `curl -sI https://api.polimatch.com.br/api/health` sem `x-powered-by`;
   - `docker logs --since 1h <api> 2>&1 | grep -c '"event":"http_request"'`
     maior que zero;
   - `grep -c '"status":429'` funcionando.
6. Decidir se mantém o logger próprio ou prefere pino (ver Decisões). A troca
   fica restrita a `logger.js`.

## Testes executados

- `npm test --prefix back`: 261 aprovados, 0 falhas (232 de antes e 29
  novos em logger, database-resilience, process-guards e http-hardening).
- `npm run test:shared`: 93 aprovados, mais validação da taxonomia.
  `npm run editorial:verify --prefix back`: aprovado.
- `npm test --prefix app`: 226 aprovados. Build do app aprovado.
- PostgreSQL 16.14 local descartável, banco novo, na ordem do CI:
  topic-store, ordered-choices, presidential-duels, vote-abuse,
  game-progress, civic-schema e api-resilience, todos aprovados. O
  api-resilience passou nas 10 execuções, as 3 últimas já com a versão final,
  em cerca de 4 s cada.
- O smoke de resiliência mediu:
  - 1 conexão da API encerrada, `/api/health` seguinte com 200 e o mesmo pid;
  - corpo comprimido 415, JSON malformado 400, corpo grande 413;
  - tabela travada: 503 em cerca de 1,0 s (o smoke usa
    `PG_LOCK_TIMEOUT_MS=1000`);
  - 15 linhas de requisição, todas JSON válidas, e exatamente 1 linha
    `"status":429` com `PLAYER_ISSUANCE_LIMIT`, sem token nem IP;
  - SIGTERM com saída 0;
  - no pool: prazo de consulta (57014), prazos da migração restritos à
    transação, transação parada e conexão ociosa encerrada, todas registradas
    sem derrubar o processo.
- Reprodução do problema em main `7c0bb27`, extraído por `git archive`:
  depois de `pg_terminate_backend`, o `/api/health` deu `000` e o processo
  morreu com `Unhandled 'error' event`. Nesta branch dá 200, e main ainda
  mostrava `X-Powered-By: Express`.
- E2E de interface: não se aplica. `app/` e `shared/` estão idênticos a main
  (`git diff 7c0bb27 -- app shared` vazio) e o workflow de UI não roda para
  esta branch. Tentativa local: o Chromium exige a revisão 1193, que não está
  no cache (há 1187), e o WebKit do macOS falha nos passos de Tab do teclado,
  ambiente que o CI não usa (lá o WebKit roda em Linux). Como o app não mudou,
  isso não vem desta entrega.

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
  30 s e o monitor externo. A rotação fica no ICM 41.
- Com `CMD ["npm", "start"]`, o npm imprime linhas próprias (fora do JSON)
  quando o processo sai com 1. O ICM 52 troca o CMD.
- Ajustes de prazo exigem novo deploy da API.

## Decisões tomadas

- **Logger próprio em vez de pino + pino-http.** São 73 linhas, sem
  dependência nova; pino 9 e pino-http trariam 2 pacotes diretos e cerca de 13
  transitivos. Os campos
  formam uma lista de permissão: IP e `Authorization` não entram por
  construção, em vez de dependerem de configuração de redact e serializers. Há
  ainda uma máscara para tokens, chaves de jogador e credenciais em texto
  livre. A escrita é síncrona no stdout, adequada ao volume atual. Se o tráfego
  crescer ou o Stefan preferir pino, a troca fica restrita a `logger.js`.
- **Política de processo**: rejeição não tratada registra e segue; exceção
  não capturada registra, fecha em ordem e sai com 1. O timer de saída forçada
  não é `unref`, para que um fechamento pendurado não termine com código 0.
- Sem logger injetado, `createHttpApp` registra só avisos e falhas, como
  antes com `console.error`. O servidor injeta o logger completo. Os testes
  antigos (uma entrada de erro por 5xx, detalhe completo no log e resposta
  sanitizada) continuam valendo sem alteração.
- A linha de requisição usa o nível `info` para qualquer status. A falha 5xx
  tem linha própria com nível `error`.
- O filtro de `Content-Encoding` vale para qualquer método e roda depois do
  CORS, para o navegador conseguir ler o 415.
- O smoke encerra apenas conexões com `application_name=polimatch-api` e se
  recusa a rodar contra banco remoto.
- O CONTEXT.md da raiz não foi alterado: não há mudança de direção do produto,
  e outras branches da mesma rodada mexem no mesmo trecho.

## Próximo passo exato

1. Stefan revisa a branch `fix/api-resilience`, faz push e abre a PR citando
   a #281.
2. Conferir no CI o job `back-shared`, incluindo o passo novo do smoke de
   resiliência.
3. Merge e deploy só da API; rollback é voltar a imagem anterior da API, sem
   mudança de schema.
4. Executar a lista "Ação do Stefan" e registrar na #281 o tempo do alarme.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan
- Observação: nenhum agente aprova o próprio gate, faz merge ou publica em
  produção.
