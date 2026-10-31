# Restauração parcial reproduzida — 31/10/2026

Dados sintéticos dos smokes num PostgreSQL 16 local e descartável. Dump com
`pg_dump -Fc`, restauração com `pg_restore -L` sem o TABLE DATA de
`schema_migrations` e de `daily_answers`, depois boot de `back/src/server.js`.
A restauração termina com código 1 (a FK de `daily_predictions` espera
`daily_answers`), como no ensaio da auditoria.

| Tabela | Antes do boot | Depois, main 7c0bb27 | Depois, esta branch |
| --- | --- | --- | --- |
| anonymous_players | 30 | 0 | 30 |
| choice_rounds | 126 | 0 | 126 |
| votes | 400 | 0 | 400 |
| ranking_pools | 8 | 7 | 8 |
| ranking_stats | 231 | 160 | 231 |
| schema_migrations | 0 | 3 | 0 |
| demais 20 tabelas | iguais | iguais | iguais |

- main: log `resetApplied: true`, `/api/health` 200.
- esta branch: log `SCHEMA_RESET_BLOCKED`, processo sai com código 1,
  `/api/health` sem resposta, 0 de 26 contagens alteradas.

O `back/scripts/partial-restore-smoke.mjs` repete o cenário no CI sem
depender do cliente do PostgreSQL. Executado contra o `topic-store.js` e o
`server.js` da main, ele falha na asserção do boot bloqueado (a API sobe com
código 0); nesta branch passa.
