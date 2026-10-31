# HANDOFF — [ICM 37] Proteger o banco

## Status

- Estado: `pronto para gate`
- Issue: #279
- Branch: `fix/database-safety` (base main `7c0bb27`)
- PR: não aberta; a branch só tem commits locais
- Último commit de código: `59ecc0c` (este HANDOFF entra no commit seguinte)

Commits:

- `7e8961b` Bloqueia o reset da edição quando o banco já tem dados
- `1099376` Exige banco descartável nos smokes e prova a restauração parcial no CI
- `f324830` Tira os smokes e o test-support da imagem da API
- `4ea2490` Adiciona backup com manifesto e ensaio de restauração do PostgreSQL
- `59ecc0c` Documenta backup externo, ensaio de restauração, DR e piso de rollback

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

1. **hPanel:** abrir a VPS em Backups e anotar se o backup semanal automático
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
   Depois do deploy, conferir no log da API a linha
   `PostgreSQL Eleições 2026 inicializado` com `resetApplied: false`.

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
  126→0 rodadas, 400→0 votos e health 200; nesta branch, saída 1 e 0 de 26
  contagens alteradas (`references/partial-restore-reproduction.md`).
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
- O teste `topic-store-smoke.mjs` mudou de propósito: o legado com linhas
  agora precisa ser recusado sem autorização e só é resetado com ela. Nenhum
  teste foi removido ou afrouxado.

## Próximo passo exato

1. Stefan revisa a branch `fix/database-safety`, faz push e abre a PR para #279.
2. CI verde nos jobs `back-unit` (inclui a asserção da imagem) e
   `back-integration-postgres` (inclui backup, ensaio e restauração parcial).
3. Merge, deploy e itens da "Ação do Stefan".

## Human gate

- Decisão: `pendente`
- Responsável: Stefan
- Observação: nenhum agente aprovou este gate, fez push, merge ou publicou.
