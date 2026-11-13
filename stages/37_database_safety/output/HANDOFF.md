# HANDOFF — [ICM 37] Proteger o banco

## Status

- Estado: `aprovado`
- Issue: #279
- Branch: `fix/database-safety` (base main `7c0bb27`; atualizada com a `main`
  em 13/11/2026, ver "Atualização de 13/11/2026")
- PR: https://github.com/stefancabral-oss/polimatch/pull/310, aberta pelo Stefan
  em 31/10/2026
- Último commit de código da entrega original: `7fa8b69`. Em 13/11/2026 o
  commit `b641000` ajustou o ensaio de restauração

Commits:

- `7e8961b` Bloqueia o reset da edição quando o banco já tem dados
- `1099376` Exige banco descartável nos smokes e prova a restauração parcial no CI
- `f324830` Tira os smokes e o test-support da imagem da API
- `4ea2490` Adiciona backup com manifesto e ensaio de restauração do PostgreSQL
- `59ecc0c` Documenta backup externo, ensaio de restauração, DR e piso de rollback
- `4df3d9c` Registra o estágio 37 com handoff, verificação e evidências
- `7fa8b69` Restringe o ensaio ao banco conferido pela guarda (revisão)

## Entregue

- **Reset seguro.** `createCleanSchema` (back/src/topic-store.js) só recria as
  tabelas da edição num banco vazio. Se falta
  `20260913_eleicoes_2026_clean_start` em `schema_migrations` e alguma tabela
  do search_path tem linhas, a transação é desfeita com `SCHEMA_RESET_BLOCKED`,
  a menos que `POLIMATCH_ALLOW_RESET=1` (opção `allowSchemaReset` no
  `createTopicStore`). O `server.js` registra o motivo e sai com código 1 sem
  escutar. Banco vazio continua inicializando.
- **Smoke da restauração parcial.** `back/scripts/partial-restore-smoke.mjs`
  sobe o `server.js` real com `NODE_ENV=production` e prova: banco vazio
  inicializa; restore sem as linhas de `schema_migrations` e sem
  `daily_answers` faz a API sair com código 1, sem escutar, sem mudar
  contagens nem constraints; com o dump completo sobe sem reset e sem perder
  linhas; com `POLIMATCH_ALLOW_RESET=1` o reset é aplicado. Último passo do job
  `back-integration-postgres`.
- **Guarda dos smokes.** `back/test-support/disposable-db.js` recusa, com
  código 2 e antes de conectar: `NODE_ENV=production`, ausência de
  `POLIMATCH_DISPOSABLE_DB=1`, host diferente de `localhost`/`127.0.0.1`/`::1`
  (o CI usa `127.0.0.1`), parâmetros `host=`/`dbname=` na URL e banco que não
  termina em `_test`. Ligada nos 7 `*-smoke.mjs`. Um teste unitário roda cada
  smoke contra alvos inalcançáveis e exige a recusa, então smoke novo sem
  guarda quebra o CI. O job do CI define `POLIMATCH_DISPOSABLE_DB: '1'`.
- **Imagem da API.** `.dockerignore` exclui `back/scripts/*-smoke.mjs` e
  `back/test-support`. Novo passo no job `back-unit` lista `scripts` dentro da
  imagem e falha se houver `*-smoke.mjs` ou `test-support`.
- **Backup.** `scripts/ops/pg-backup-vps.sh`: dump custom + manifesto (sha256,
  versões, migrações, contagem por tabela lida do próprio dump,
  `releaseRevision` opcional). Recusa dump sem dados de `schema_migrations`.
  Funciona com `pg_dump` via `docker exec`. Opcionais: cifra com `age`, envio
  com `rclone` para `daily/` e `monthly/`, monitor de batimento, retenção local.
- **Ensaio.** `scripts/ops/drill-local.mjs`: restaura dump custom, `.gz` do
  Dokploy ou SQL puro num banco local `_test`, confere sha256 e contagens com
  manifesto e dump, sobe a API desta cópia e exige `/api/health` 200,
  `resetApplied:false` e nenhuma perda de linhas no boot. Também no CI, com o
  `pg_dump` do container e um caso de manifesto adulterado que precisa reprovar.
  O `pg_restore`/`psql` do ensaio roda sem `PGHOST`, `PGHOSTADDR`, `PGPORT`,
  `PGDATABASE`, `PGSERVICE` e `PGSERVICEFILE` do shell, para que o libpq não
  troque o destino conferido pela guarda.
- **Docs.** `docs/ops/BACKUP.md` (destino R2/B2, 30 diários + 12 mensais,
  acesso restrito pelo `sub`/nome/avatar do Google, Dokploy ou cron, ensaio
  mensal, runbook de incidente, registro de ensaios), `docs/ops/DR.md`
  (inventário, variáveis por serviço, reconstrução passo a passo) e piso de
  rollback `f99ac18` no `ROLLBACK.md` do estágio 08. README aponta para eles.

## Não entregue / pendente

- Bucket externo, agendamento e ensaio com dump real: dependem do Stefan
  (lista abaixo). Sem isso o RPO real continua indefinido.
- A asserção da imagem Docker só roda no CI: Docker não está instalado nesta
  máquina. Localmente, o `git check-ignore` com os mesmos padrões confirmou que
  saem exatamente os 7 smokes e os 6 arquivos de `back/test-support`.
- Fora do escopo (achados API-04 e OPS-12 da auditoria): migrações versionadas
  fora do boot, `NOT VALID` nas constraints, backfill de `player_stats` a cada
  boot, staging, rollback do par por SHA e job de compatibilidade N-1.
- `back/src/*.test.js` continuam na imagem; importam `test-support` e não
  rodam lá. Inofensivo, mas pode sair do contexto num estágio futuro.

## Ação do Stefan

1. **Painel do provedor da VPS:** abrir a VPS em Backups e anotar se o backup semanal automático
   está ativo, a data do último e a retenção. Guardar captura. Isso não
   substitui o backup lógico.
2. **Bucket externo:** criar bucket privado em Cloudflare R2 ou Backblaze B2,
   em conta fora do provedor da VPS, com cifra em repouso. Criar uma
   credencial só de escrita naquele bucket (para o Dokploy ou cron) e uma de
   leitura guardada no cofre. Regras de ciclo de vida: `polimatch/daily/`
   apaga após 35 dias, `polimatch/monthly/` após 400 dias.
3. **Dokploy:** no serviço PostgreSQL, em Backups, cadastrar o destino S3 e
   dois agendamentos: diário `17 6 * * *` (UTC), prefixo `polimatch/daily/`,
   manter 30; mensal `47 6 1 * *`, prefixo `polimatch/monthly/`, manter 12.
   Ligar notificação de falha, rodar um backup manual e conferir o arquivo
   no bucket. Alternativa: o cron de `docs/ops/BACKUP.md` (opção B).
4. **Monitor:** confirmar semanalmente que o último dump tem menos de 26 h
   (ou ligar o monitor de batimento do cron).
5. **Ensaio mensal com dump real:** seguir `docs/ops/BACKUP.md`, seção "Ensaio
   mensal de restauração", e anotar o resultado na tabela "Registro de
   ensaios". O primeiro ensaio fecha o critério do drill registrado.
6. **Cofre:** copiar `VOTER_NETWORK_SECRET` e as demais variáveis listadas em
   `docs/ops/DR.md` para o cofre de senhas.
7. **Revisão:** se a branch estiver ok, push, PR, CI verde e merge.
   Depois do deploy, conferir no log da API a linha de início com
   `resetApplied: false`. Desde o estágio 39 ela é JSON, com
   `"event":"database_ready"`; antes era `PostgreSQL Eleições 2026
   inicializado`.

## Testes executados

Todos em 31/10/2026, macOS, Node 22.13, PostgreSQL 16.14 local e descartável
(porta própria, banco `polimatch_test`, apagado ao fim).

- `npm test --prefix back`: 245/245 (232 da main + 13 novos: 11 da guarda,
  incluindo um por smoke, e 2 da decisão de reset).
- `npm test --prefix app`: 226/226. `node --test shared/*.test.js`: 93/93.
  `npm run test:shared` com taxonomia: ok. `npm run editorial:verify`: ok.
- Espelho local do job `back-integration-postgres` na ordem do CI: 7 smokes,
  backup + ensaio (com `pg_dump`/`pg_restore` por pipe no lugar do
  `docker exec`), manifesto adulterado reprovado e restauração parcial: ok.
- Restauração parcial real (`pg_restore -L`): na main, 30→0 jogadores,
  126→0 rodadas, 400→0 votos e health 200; nesta branch, saída 1 e nenhuma
  contagem alterada (`references/partial-restore-reproduction.md`).
- `partial-restore-smoke.mjs` contra o código da main: falha como esperado.
- Guarda: `NODE_ENV=production node back/scripts/topic-store-smoke.mjs` sai
  com 2 e o log do PostgreSQL não registra nenhuma conexão nova; host remoto
  e banco sem `_test` também saem com 2.
- Backup + ensaio: 44 tabelas, 7400 linhas, sha256 conferido, restauração
  em 0,16 s, health 200, `resetApplied:false`
  (`references/drill-local-2026-10-31.json`). Bateria de 14 casos: pipe,
  manifesto e sha256 adulterados, dump sem `schema_migrations` (backup recusa
  e ensaio reprova), `.sql.gz` do Dokploy, SQL puro, recusas da guarda e fluxo
  `age`/`rclone`/monitor com stubs.
- E2E (não exercitam o backend; app e shared idênticos à main): build ok;
  `ordered-choices` passou em Chromium e WebKit; `interaction-smoke` passou em
  Chromium e falhou em WebKit no passo de navegação por Tab, comportamento do
  WebKit no macOS sem relação com esta branch. Os navegadores em cache são
  builds anteriores aos da Playwright 1.55.1 e foram apontados por
  `PLAYWRIGHT_BROWSERS_PATH`, sem baixar nada.

### Revisão independente (31/10/2026)

Refeito por outro agente, em PostgreSQL 16.14 descartável próprio, depois do
commit `7fa8b69`:

- `npm test --prefix back`: 245/245; a main `7c0bb27` (export completo) dá
  232/232, então são 13 testes novos. `npm test --prefix app`: 226/226.
  `node --test shared/*.test.js`: 93/93; taxonomia e `editorial:verify` ok.
- Espelho do job `back-integration-postgres` com banco recriado: 6 smokes,
  backup (44 tabelas, 7400 linhas), ensaio `pass` (restauração 0, health 200,
  `resetApplied:false`), manifesto adulterado reprovado e
  `partial-restore-smoke` ok.
- Restauração parcial com `pg_restore -L` (sem os dados de
  `schema_migrations` e `daily_answers`) sobre o dump do espelho: nesta
  branch a API sai com `SCHEMA_RESET_BLOCKED`, sem health, e as 30 tabelas do
  schema public ficam iguais; com o `server.js` da main, health 200,
  `resetApplied: true` e 6 tabelas mudam (jogadores 30→0, rodadas 126→0,
  votos 400→0, `ranking_stats` 231→160, `ranking_pools` 8→7,
  `schema_migrations` 0→3).
- Guarda: `NODE_ENV=production` com banco local (`topic-store-smoke`), host
  remoto (`npm run test:integration`), banco sem `_test` (`vote-abuse-smoke`
  e ensaio) e falta da opção (`partial-restore-smoke`) saem com 2; o log do
  PostgreSQL (`log_connections`) ficou com o mesmo número de conexões.
- Ensaio também com `.sql.gz` custom e SQL puro gzip (estilo Dokploy): `pass`.
  Backup de banco sem a linha da migração: recusado.
- Achado e corrigido: com `PGHOSTADDR` no shell, o `pg_restore` do ensaio
  restaurava no endereço da variável e não no banco conferido (o libpq usa a
  variável quando a URL não define `hostaddr`). Depois de `7fa8b69`, o mesmo
  ensaio com `PGHOSTADDR` e `PGSERVICE` definidos passa contra o banco local.
- E2E com build de `app/` e `vite preview` local: `ordered-choices`,
  `vote-recovery`, `interaction-smoke` e `accessible-profile` passam em
  Chromium; em WebKit passam `ordered-choices` e `vote-recovery`, e
  `interaction-smoke`/`accessible-profile` falham na navegação por Tab, como
  na execução original (WebKit do macOS; `app/` e `shared/` iguais à main, e
  o workflow de UI não roda nesta PR).

## Riscos conhecidos

- Até o deploy desta branch, a produção mantém o comportamento antigo.
- Com a guarda, um banco com a linha de migração removida e só catálogo
  semeado também é recusado. É intencional: a saída é restaurar completo ou
  definir `POLIMATCH_ALLOW_RESET=1` de propósito.
- O passo de backup no CI depende de `docker exec` no container de serviço do
  GitHub Actions; validado localmente só por pipe equivalente.
- Outros estágios da mesma onda também mexem em `back-shared.yml`,
  `back/Dockerfile`/`.dockerignore` e no `CONTEXT.md` raiz: conflitos simples
  de merge são prováveis.
- Os formatos do Dokploy (`.sql.gz` com dump custom ou SQL puro) foram
  testados com dumps gerados localmente, não com um arquivo do painel.
- Com `DRILL_API_PORT` ou `SMOKE_API_PORT` fixos e outra API já escutando na
  porta, o ensaio e o smoke reprovam (não há falso positivo, porque exigem o
  log do próprio processo). O padrão é porta livre escolhida na hora.

## Decisões tomadas

- Autorização de reset por `POLIMATCH_ALLOW_RESET=1` literal, conforme a
  issue; qualquer outro valor é recusa.
- "Banco com dados" = qualquer linha em qualquer tabela do search_path, exceto
  `schema_migrations`. Mais conservador que olhar só `votes`: também protege
  vínculos Google e sessões quando só parte do dump volta.
- Contagens do manifesto lidas do próprio dump: batem por construção com o
  snapshot do `pg_dump`, sem corrida com escritas em produção.
- Retenção longa no bucket (regras de ciclo de vida); o script só copia com
  `--immutable` e nunca apaga remotamente.
- O ensaio aceita como mudança do boot apenas crescimento de catálogo e
  estatísticas e poda de cotas vencidas; qualquer outra diferença reprova.
- O ensaio é `scripts/ops/drill-local.mjs`, e não o `drill-local.sh` citado
  na issue: em Node ele roda igual no CI e na máquina do ensaio e usa a mesma
  guarda de banco descartável dos smokes.
- O teste `topic-store-smoke.mjs` mudou de propósito: o legado com linhas
  agora precisa ser recusado sem autorização e só é resetado com ela. Nenhum
  teste foi removido ou afrouxado.

## Próximo passo exato

1. Feito: a PR #310 está aberta e atualizada com a `main`.
2. Feito: CI verde nos jobs `back-unit` (inclui a asserção da imagem) e
   `back-integration-postgres` (inclui backup, ensaio e restauração parcial).
3. Merge, deploy e itens da "Ação do Stefan".

## Atualização de 13/11/2026

- A branch recebeu a `main` atual, que traz #311, #317, o estágio 40 (#313), o
  conserto do CI (#321) e a direção nova (#319 e #320).
- Dois conflitos, os dois de acréscimo dos dois lados, resolvidos mantendo
  tudo: no `CONTEXT.md` da raiz ficaram as seções deste estágio e do estágio
  40; em `back/src/topic-store.test.js` ficaram os imports e os testes dos
  dois estágios. Nenhum teste foi removido ou alterado.
- O estágio 40 criou a tabela `quota_rejections_daily`, que é podada no boot
  depois de mais de 400 dias. O ensaio deste estágio só aceitava poda em
  `abuse_quota_counters` e acusaria perda num dump com recusas mais antigas
  que a retenção. `scripts/ops/drill-local.mjs` e `docs/ops/BACKUP.md`
  passaram a aceitar essa segunda poda. É a única mudança de código além dos
  conflitos. Hoje nenhum teste a exercita, porque o dump do CI só tem recusas
  recentes. Ele traz recusas datadas de 25/10/2026, que o boot passa a podar
  no fim de 11/2027: sem este ajuste, o próprio ensaio do CI começaria a
  falhar nessa data.
- Os testes do back não rodam na máquina desta atualização, por falta das
  dependências instaladas. Conferidos aqui: sintaxe dos arquivos juntados e os
  cinco nomes importados no teste.
- CI do GitHub no commit `b641000`, em 13/11/2026: `back-unit`,
  `back-integration-postgres`, `shared-data` e `validate` verdes.
- Um agente independente conferiu a junção e o ajuste do ensaio, somente
  leitura: nenhum teste ou import perdido (26 testes no arquivo, 24 de cada
  lado), nenhum choque escondido nos arquivos juntados automaticamente e
  nenhum bloqueio.

## Publicação em produção — 13/11/2026

Por instrução do Stefan em conversa ("Sim, cópia e API"), com ele logado no painel, a API com este estágio foi publicada no commit `7a4c9db`. Quem executou o deploy foi o agente, clicando em Deploy no painel, a pedido dele. É uma exceção pontual, autorizada por ele naquela conversa, à frase "nenhum agente publica em produção" do gate abaixo; a regra não muda.

- Antes do deploy foi feita uma cópia manual do banco com `pg_dump` (formato custom, 26 tabelas, comando sem erro). Ela fica dentro do contêiner do banco e é provisória: não substitui o backup externo. Como todo dump, contém dados pessoais (`docs/ops/BACKUP.md`). Fica sob responsabilidade do Stefan e deve ser apagada quando o primeiro backup externo for conferido, ou antes, se ele decidir; não há prazo definido.
- O banco tinha a linha `20260913_eleicoes_2026_clean_start` em `schema_migrations`. O log de início trouxe `"event":"database_ready"` com `"resetApplied":false`.
- Contagem de linhas por tabela antes e depois: 25 tabelas iguais. O boot podou `abuse_quota_counters` e criou `quota_rejections_daily` vazia, como previsto.
- No painel não havia destino de backup configurado. Continuam com o Stefan: bucket externo, destino e agendamentos no Dokploy, cofre de senhas, ensaio com dump real e a conferência do backup da VPS. A issue #279 segue aberta.

## Human gate

- Decisão: `aprovado`
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para este PR, em
  conversa de 13/11/2026 ("Pode mesclar o 310"), transcrita no PR. O merge fica
  a cargo do agente, a pedido dele, com o CI verde. A regra 6 do `AGENTS.md`
  não muda. Nenhum agente publica em produção: deploy, bucket, agendamento do
  backup, cofre e ensaio com dump real continuam com o Stefan.
