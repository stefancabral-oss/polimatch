# Backup e restauração do PostgreSQL

O PostgreSQL guarda os únicos dados que não dá para refazer a partir do Git:
jogadores anônimos, vínculos com Google, sessões, rodadas, votos, sessões
diárias e coleção. Imagens, catálogo e código se reconstroem do repositório
(ver [DR.md](DR.md)). Este documento define onde fica a cópia, por quanto
tempo, quem acessa, como ensaiar a restauração e como restaurar num incidente.

## Metas

| Meta | Valor | Situação |
| --- | --- | --- |
| RPO (perda máxima aceitável) | 24 h | depende do backup diário externo (Ação do Stefan no estágio 37) |
| RTO (tempo para voltar a jogar) | 2 h | ainda não medido; registrar no primeiro ensaio de reconstrução |
| Idade máxima do último dump no bucket | 26 h | conferir semanalmente e por monitor |

O backup semanal do provedor da VPS (hPanel) restaura a máquina inteira e não
substitui o backup lógico: perde até 7 dias e volta também código, painel e
certificados.

## Destino, retenção e acesso

- **Destino:** bucket S3 fora do provedor da VPS, em conta separada:
  Cloudflare R2 ou Backblaze B2. Nunca em disco da própria VPS como única cópia.
- **Retenção:** 30 diários e 12 mensais.
  - prefixo `polimatch/daily/`: um dump por dia, mantendo os 30 mais recentes;
  - prefixo `polimatch/monthly/`: o dump do dia 01, mantendo os 12 mais recentes;
  - regra de ciclo de vida no bucket como segunda trava: apagar `daily/` após
    35 dias e `monthly/` após 400 dias.
- **Acesso restrito:** o dump contém o `sub` do Google, o nome de exibição e o
  avatar de quem vinculou a conta, além dos hashes de chaves de recuperação e
  de sessões. São dados pessoais.
  - a credencial que grava (Dokploy ou cron) só escreve naquele bucket; se o
    provedor permitir, sem listar nem apagar;
  - leitura só para o Stefan, com credencial guardada no cofre de senhas;
  - cifra em repouso do provedor ligada; no cron, cifra adicional com `age`,
    com a chave privada fora da VPS;
  - dumps baixados para ensaio são apagados ao fim do ensaio.

## Opção A (preferida): backup agendado do Dokploy

No serviço PostgreSQL do PoliMatch, em Backups:

1. Criar o destino S3 (R2 ou B2) com a credencial de escrita restrita.
2. Agendar o diário: cron `17 6 * * *` (UTC), prefixo `polimatch/daily/`,
   retenção de 30 arquivos.
3. Agendar o mensal: cron `47 6 1 * *` (UTC), prefixo `polimatch/monthly/`,
   retenção de 12 arquivos.
4. Ligar a notificação de falha de backup do Dokploy.
5. Rodar o backup manualmente uma vez e confirmar o arquivo no bucket.

O Dokploy grava `.sql.gz`. O ensaio aceita esse formato direto; como ele não
gera manifesto, o ensaio compara o banco restaurado com as contagens lidas do
próprio dump.

## Opção B: cron com `scripts/ops/pg-backup-vps.sh`

O script gera, em `BACKUP_DIR`:

- `polimatch-AAAAMMDDTHHMMSSZ.dump`: `pg_dump` no formato custom;
- `polimatch-AAAAMMDDTHHMMSSZ.manifest.json`: data, banco, versões do servidor
  e do `pg_dump`, `releaseRevision` (quando informado), sha256 e tamanho do
  dump, migrações de `schema_migrations` e a contagem de linhas de cada tabela,
  lida do próprio dump.

Ele recusa dump sem os dados de `schema_migrations` (esse dump faria a API
recusar o boot) e mantém só `BACKUP_LOCAL_KEEP` cópias no disco local (padrão
7). Com `BACKUP_AGE_RECIPIENTS_FILE`, cifra o dump e apaga a cópia em claro.
Com `BACKUP_RCLONE_REMOTE`, envia dump e manifesto para `daily/` e, no dia 01,
também para `monthly/`, com `rclone copy --immutable` (o script nunca apaga no
bucket; a retenção fica nas regras do bucket). Com `BACKUP_SUCCESS_URL`, chama
um monitor de batimento (por exemplo healthchecks.io) para alertar quando o
backup não roda em 26 h. `scripts/ops/pg-backup-vps.sh --help` lista todas as
variáveis.

Na VPS, o `pg_dump` pode ser o do próprio container do banco, sem instalar
cliente no host. Exemplo de `/usr/local/bin/polimatch-backup` (permissão 700):

```sh
#!/usr/bin/env bash
set -euo pipefail
set -a; . /etc/polimatch-backup.env; set +a   # arquivo 600, fora do repositório
container=$(docker ps -q --filter "name=$POLIMATCH_DB_CONTAINER" | head -n 1)
export PG_DUMP="docker exec -i $container pg_dump"
export PG_RESTORE="docker exec -i $container pg_restore"
exec /opt/polimatch/scripts/ops/pg-backup-vps.sh
```

`/etc/polimatch-backup.env` define `POLIMATCH_DB_CONTAINER`,
`BACKUP_DATABASE_URL` (com socket do container, sem senha na URL, por exemplo
`postgresql://usuario@/banco`), `BACKUP_DIR`, `BACKUP_RCLONE_REMOTE`,
`BACKUP_AGE_RECIPIENTS_FILE` e `BACKUP_SUCCESS_URL`. As credenciais do bucket
ficam na configuração do rclone, também com permissão 600. Crontab do root:

```cron
17 6 * * * /usr/local/bin/polimatch-backup >> /var/log/polimatch-backup.log 2>&1
```

## Ensaio mensal de restauração

Usa `scripts/ops/drill-local.mjs` numa máquina com Node 22, o repositório e um
PostgreSQL descartável (local, banco terminado em `_test`). O script recusa
qualquer outro alvo.

1. Baixar o dump mais recente de `polimatch/daily/` e, se houver, o manifesto.
   Se o dump estiver cifrado: `age -d -i chave.txt -o arquivo.dump arquivo.dump.age`.
2. Subir um PostgreSQL da mesma versão major de produção só em 127.0.0.1.
3. Fazer checkout do commit em produção (o `releaseRevision` do manifesto ou o
   deployment do Dokploy) e rodar `npm ci --prefix back`.
4. Rodar:

   ```sh
   POLIMATCH_DISPOSABLE_DB=1 \
   DRILL_DATABASE_URL=postgresql://postgres@127.0.0.1:5432/polimatch_drill_test \
   node scripts/ops/drill-local.mjs caminho/do/dump --report drill-AAAA-MM.json
   ```

5. O ensaio passa quando: a restauração termina com código 0; sha256 e
   contagens batem com o manifesto; o banco restaurado tem as mesmas contagens
   do dump; a API desta cópia sobe com `NODE_ENV=production`, responde
   `/api/health` 200 e registra `resetApplied: false`; e o boot não muda
   nenhuma tabela além de completar catálogo e estatísticas
   (`ranking_pools`, `ranking_stats`, `player_pools`, `player_stats`,
   `schema_migrations`) e podar cotas vencidas (`abuse_quota_counters`).
6. Registrar na tabela abaixo: data, arquivo, resultado, tabelas, linhas e
   duração da restauração. Não copiar dados pessoais para o registro.
7. Apagar o dump baixado. O banco do ensaio é apagado pelo script, exceto com
   `--keep-db`.

O CI roda o mesmo par de scripts sobre os dados dos smokes a cada PR do
backend, usando o `pg_dump` do container, e confirma que um manifesto
adulterado reprova o ensaio.

### Registro de ensaios

| Data | Origem do dump | Resultado | Tabelas | Linhas | Restauração | Observação |
| --- | --- | --- | --- | --- | --- | --- |
| 31/10/2026 | sintético (smokes, PostgreSQL 16 local) | pass | 44 | 7400 | 0,16 s | estágio 37; não é dado de produção |

O primeiro ensaio com dump real de produção é Ação do Stefan.

## Restauração em produção (incidente)

1. Parar a API no Dokploy antes de mexer no banco. Isso evita escrita e evita
   que ela reinicie no meio da carga.
2. Fazer um dump do estado atual, mesmo que danificado, e guardar à parte.
3. Ensaiar o dump escolhido com o `drill-local.mjs` (seção anterior). Só seguir
   com resultado `pass`.
4. Restaurar sempre o dump inteiro, numa transação, parando no primeiro erro:

   ```sh
   docker exec -i <container-do-banco> pg_restore --exit-on-error --single-transaction \
     --clean --if-exists --no-owner --dbname=postgresql://usuario@/banco < arquivo.dump
   ```

   Para `.sql.gz` do Dokploy: `gunzip -c arquivo.sql.gz > arquivo.dump` antes.
   Se o ensaio apontar `dumpFormat` `plain+gzip`, o arquivo é SQL puro e o
   `pg_restore` não o lê: recriar o banco vazio e carregar com
   `gunzip -c arquivo.sql.gz | docker exec -i <container-do-banco> psql -X -v ON_ERROR_STOP=1 --single-transaction --dbname=postgresql://usuario@/banco`.
   Nunca restaurar tabelas avulsas (`pg_restore -t` ou `-L` parcial) num banco
   que a API vai usar.
5. Subir a API de um release igual ou posterior ao piso de rollback
   (`f99ac18`, ver [ROLLBACK.md](../../stages/08_release_deploy_observabilidade/output/ROLLBACK.md)).
   Conferir `/api/health` 200 e o log `resetApplied: false`.
6. Se o log mostrar `SCHEMA_RESET_BLOCKED`, a restauração veio incompleta
   (faltou `schema_migrations`). A API recusou o boot de propósito e nada foi
   apagado. Refazer a restauração completa. **Não** definir
   `POLIMATCH_ALLOW_RESET=1`: essa variável existe só para apagar a edição de
   propósito e faria exatamente a perda que a guarda evita.
7. Conferir as contagens principais contra o manifesto do dump restaurado.

## Proteções no código

- A API só recria as tabelas da edição num banco vazio. Se a linha
  `20260913_eleicoes_2026_clean_start` faltar em `schema_migrations` e houver
  qualquer linha nas tabelas, o boot para com `SCHEMA_RESET_BLOCKED` e sai com
  código 1, sem escutar.
- Os smokes de integração e o ensaio só rodam com `POLIMATCH_DISPOSABLE_DB=1`,
  host `localhost`, `127.0.0.1` ou `::1`, banco terminado em `_test` e
  `NODE_ENV` diferente de `production`. A recusa acontece antes de abrir
  conexão.
- Os smokes e `back/test-support` não entram na imagem da API; o CI confere.
