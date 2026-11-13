# Reconstrução do ambiente (DR)

Como recolocar o PoliMatch no ar se a VPS for perdida, usando só este
documento, o cofre de senhas, o último dump externo e o repositório. Backup,
retenção e ensaio de restauração estão em [BACKUP.md](BACKUP.md).

Metas: RPO 24 h e RTO 2 h. O RTO ainda não foi medido; a estimativa é de 1 a
3 h com o dump externo em mãos.

## Inventário

Tudo roda numa única VPS com Dokploy, que publica os containers atrás do
Traefik com HTTPS.

| Serviço | Origem | Configuração |
| --- | --- | --- |
| API | `back/Dockerfile`, contexto na raiz do repositório | porta interna 3001, healthcheck `GET /api/health`, volume `/repo/back/data` |
| PWA | `app/Dockerfile`, contexto na raiz | nginx, porta interna 80 |
| PostgreSQL | serviço de banco do Dokploy | versão major a confirmar no painel; o CI usa `postgres:16-alpine` |
| DNS | Cloudflare | `polimatch.com.br` para o PWA, `api.polimatch.com.br` para a API |
| Login Google | Google Cloud, cliente OAuth Web | origem JavaScript `https://polimatch.com.br` |

Pelo código atual, a API não lê nem grava em `/repo/back/data`; todo o estado
do jogo está no PostgreSQL. Confirme no painel se o volume tem arquivos antes
de descartá-lo.

## Variáveis e segredos

Os valores ficam no cofre de senhas do Stefan, nunca no repositório. Os nomes
e o papel de cada um estão no [README](../../README.md#deploy-no-dokploy).

API:

- `DATABASE_URL`
- `VOTER_NETWORK_SECRET` (só existe no painel hoje; copiar para o cofre). Se
  for perdido, um valor novo só reinicia os pseudônimos de rede das cotas de
  abuso; chaves de recuperação e sessões usam sha256 sem esse segredo e
  continuam valendo.
- `TRUST_PROXY_HOPS`
- `GOOGLE_CLIENT_ID`
- `APP_ORIGINS` (só se houver origem além de `https://polimatch.com.br`)
- `EDITORIAL_AUTHORITY_PUBLIC_JWK`, `EDITORIAL_AUTHORITY_ISSUER`,
  `EDITORIAL_AUTHORITY_KEY_ID`, `EDITORIAL_AUTHORITY_RECEIPTS`
- `AGGREGATE_AUTHORITY_RECEIPTS`
- opcionais: `COLLECTION_ENABLED`, `PG_POOL_MAX`
- build arg `SOURCE_COMMIT` (SHA completo do commit publicado)
- nunca em produção: `POLIMATCH_ALLOW_RESET`, `POLIMATCH_DISPOSABLE_DB`

PWA (build args): `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`.

PostgreSQL: usuário, senha e nome do banco.

Backup: credencial de escrita do bucket, credencial de leitura do bucket, chave
privada `age` (fora da VPS) e URL do monitor de batimento.

## Passo a passo

1. **Acessos.** Confirmar acesso ao cofre, ao bucket externo, ao DNS, ao
   GitHub e ao Google Cloud antes de começar. Anotar a hora de início.
2. **Servidor.** Provisionar uma VPS Linux LTS, atualizar pacotes, criar
   usuário administrativo com chave SSH e aplicar o endurecimento de acesso
   documentado para o servidor. Expor publicamente só o necessário para HTTP e
   HTTPS.
3. **Dokploy.** Instalar pelo procedimento oficial e restringir o acesso ao
   painel conforme o endurecimento. Conectar o repositório do GitHub.
4. **Banco.** Criar o serviço PostgreSQL na mesma versão major do dump
   (`serverVersion` no manifesto). Gerar senha nova e guardar no cofre.
5. **Dados.** Baixar o último dump de `polimatch/daily/`, decifrar se preciso
   e ensaiar com `scripts/ops/drill-local.mjs` numa máquina local. Com
   resultado `pass`, restaurar no banco novo pelo runbook de incidente do
   [BACKUP.md](BACKUP.md#restauração-em-produção-incidente), sempre antes de
   subir a API.
6. **API.** Criar o app com `back/Dockerfile`, contexto na raiz, porta 3001,
   variáveis da lista acima e `SOURCE_COMMIT` do commit escolhido. Usar o
   release do manifesto (`releaseRevision`) ou um posterior, nunca anterior ao
   piso `f99ac18`. Domínio `api.polimatch.com.br` com HTTPS.
7. **Conferência da API.** `/api/health` responde 200, o log mostra
   `resetApplied: false` e as contagens principais batem com o manifesto. Se
   aparecer `SCHEMA_RESET_BLOCKED`, a restauração veio incompleta: refazer o
   passo 5, sem `POLIMATCH_ALLOW_RESET`.
8. **PWA.** Criar o app com `app/Dockerfile`, `VITE_API_URL` e
   `VITE_GOOGLE_CLIENT_ID`, domínio `polimatch.com.br` com HTTPS.
9. **DNS.** Apontar os dois nomes para a nova VPS (TTL baixo durante a troca)
   e esperar os certificados.
10. **Backups.** Recriar o destino S3 e os agendamentos diário e mensal no
    Dokploy (ou o cron) e o monitor. Rodar um backup manual e conferir o
    arquivo no bucket.
11. **Smoke.** Só leitura: `/api/health`, `/api/candidates`, abrir o PWA no
    celular e no desktop. Não votar como usuário real.
12. **Registro.** Anotar a hora de fim (RTO medido), o dump usado e o commit
    publicado no HANDOFF do estágio em curso.

## Rollback de código

O procedimento de rollback continua em
[ROLLBACK.md](../../stages/08_release_deploy_observabilidade/output/ROLLBACK.md),
que registra o piso `f99ac18`. Rollback de código não restaura banco.

## Ensaios

- Restauração do dump: mensal, pelo [BACKUP.md](BACKUP.md#ensaio-mensal-de-restauração).
- Reconstrução completa seguindo este documento num ambiente descartável:
  trimestral, registrando o RTO medido.

## Lacunas conhecidas

- O `/api/health` de produção responde `revision: null` porque o deploy não
  passa `SOURCE_COMMIT`. Sem isso, o backup não fica ligado ao release que o
  gerou; informar `BACKUP_RELEASE_REVISION` no cron enquanto isso não muda.
- Não há ambiente de staging para ensaiar a reconstrução fora da produção.
- O esquema ainda é aplicado no boot da API; migrações versionadas fora do boot
  são outro estágio.
