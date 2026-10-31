# ICM 37 — Proteger o banco — #279
Base main 7c0bb27. Ler contexto raiz, AGENTS.md e o ROLLBACK.md do estágio 08.

## Objetivo e entradas
Ter cópia do PostgreSQL fora da VPS, restauração provada e nenhum caminho de
código que apague dados de produção por engano. Origem: auditoria de
maturidade de 30/10/2026 (bloqueio B2). O reset da edição dependia só de
uma linha em schema_migrations, então uma restauração parcial podia apagar
dados sem o health acusar. Os smokes não tinham guarda de banco descartável
e eram empacotados na imagem da API. Não havia backup lógico nem ensaio.

## Escopo
1. Reset da edição só em banco vazio; com dados, o boot aborta, salvo
   POLIMATCH_ALLOW_RESET=1. Smoke que reproduz a restauração parcial no CI.
2. Smokes e helpers destrutivos exigem POLIMATCH_DISPOSABLE_DB=1, host local
   e banco *_test, e recusam NODE_ENV=production antes de conectar.
3. Smokes e back/test-support fora da imagem da API, conferido no CI.
4. Script de backup (dump custom + manifesto com contagens e sha256) e
   ensaio de restauração em banco descartável, testados ponta a ponta.
5. docs/ops/BACKUP.md, docs/ops/DR.md e piso de rollback f99ac18.

## Fora de escopo
Migrações versionadas fora do boot, NOT VALID nas constraints, backfill
preguiçoso, staging, rollback de par por SHA e job de compatibilidade N-1:
achados API-04 e OPS-12 seguem para outros estágios. Painéis (hPanel,
Dokploy, bucket, DNS) e ensaio com dump real ficam com o Stefan.

## Critérios de aceite
- Bucket externo com dump de menos de 26 h e manifesto (Stefan).
- Ensaio registrado: restore exit 0, /api/health 200, resetApplied:false e
  contagens iguais ao manifesto (script local; dump real com o Stefan).
- Restore parcial sem schema_migrations e sem daily_answers: API aborta e
  nenhuma contagem muda.
- `docker run --rm --entrypoint ls polimatch-api scripts` sem *-smoke.mjs.
- `NODE_ENV=production node back/scripts/topic-store-smoke.mjs` aborta antes
  de abrir conexão.

## Dependências e gate
Nenhuma dependência. Revisão e merge pelo Stefan; nenhum agente aprova o
próprio gate, faz merge ou publica em produção.
