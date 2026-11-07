# Rollback da release

1. No Dokploy, selecione primeiro o deployment anterior da API e use o rollback/redeploy configurado.
2. Confirme `GET /api/health` e `GET /api/candidates` antes de trocar o PWA.
3. Faça rollback do PWA para o deployment imediatamente anterior.
4. Valide Home, Duelo, Ranking e uma criação de jogador sem registrar voto de usuário real.
5. Não reverta ou restaure o PostgreSQL para rollback apenas de código; votos são auditáveis e idempotentes. Restauração de banco segue `docs/ops/BACKUP.md`.

## Piso de rollback

Não volte a API para um commit anterior a `f99ac18` (merge da PR #205, 17/09/2026 13:36 -03).
As imagens anteriores recriam `choice_rounds_mode_check` aceitando só `free` e `daily`. As rodadas
`warmup` e `tiebreak` já gravadas violam essa regra, o boot desfaz a transação e a API não sobe.
Não há perda de dados, mas o jogo fica fora do ar até um novo deploy de commit igual ou posterior ao piso.

Atualize este piso sempre que uma mudança de esquema deixar de ser compatível com o release anterior.
Registro: piso definido no estágio 37 (#279), conferido em `git show f99ac18^1` (só `free`/`daily`)
e `git show f99ac18` (`warmup`/`tiebreak` aceitos).
