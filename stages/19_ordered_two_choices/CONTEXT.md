# ICM 19 — Duas escolhas ordenadas

## Objetivo e entradas
Issue #239; CONTEXT.md raiz; fluxo de voto em app/src/main.js, back/src/topic-store.js e shared/elo.js.
Stefan substituiu a proposta inicial de empate por duas cartas ordenadas: primeira ganha mais que segunda e as duas restantes têm a mesma penalização.

## Escopo e direção visual
Preservar as quatro cartas e a marca atual. Instrução Escolha duas cartas, estado 0/2 e 1/2, primeira marcada como 1ª escolha. Segundo toque em carta distinta confirma; tocar na primeira desmarca antes do envio. Remover descarte da nova rodada. Modos de duas cartas permanecem com uma escolha.

## Contrato e aceite
Uma operação atômica guarda os dois IDs em ordem. Pontos +24/+8/-16/-16; cinco confrontos de 8 pontos representam primeira > segunda > restantes empatadas. Histórico antigo permanece intacto. Replay divergente rejeitado; timeout e troca de identidade preservam as proteções atuais. Capacidade explícita permite backend antes do frontend. Testes PostgreSQL, unidade e navegador e build.

## Fora de escopo
Redesign, catálogo, agregados, login, monetização e reescrita de ranking.

## Autorização e gate
Pedido expresso do usuário: criar, buildar e colocar na main, seguido de Dê continuidade. Integrar após PR e checks. Não alegar revisão visual humana que não ocorreu. Publicação deve ser verificada separadamente.
