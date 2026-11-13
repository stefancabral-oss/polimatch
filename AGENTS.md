# PoliMatch — Regras de execução ICM

Este repositório usa ICM para mudanças estruturais do produto.

## Regra principal

O fluxo é sempre:

`Issue -> branch -> Pull Request -> CI/testes -> HANDOFF -> Human gate -> Issue fechada -> próxima Issue`

Não pular etapas. Não abrir uma etapa dependente como concluída antes da anterior passar pelo human gate.

## Contrato de cada estágio

Cada estágio ICM vive em `stages/NN_nome/` e precisa conter:

- `CONTEXT.md`: objetivo, entradas, escopo, fora de escopo, critérios de aceite e dependências.
- `output/HANDOFF.md`: o que foi feito, o que falta, riscos, links de PR/commit e próximo passo.
- `output/verification.json`: evidência verificável dos testes executados.
- `references/`: materiais visuais, decisões e referências usadas quando necessário.

## Regras para agentes

1. Ler `CONTEXT.md` da raiz e o `CONTEXT.md` do estágio ativo antes de alterar código.
2. Trabalhar apenas no escopo do estágio atual.
3. Não misturar redesign, backend, autenticação, áudio e deploy em uma mesma Issue se forem estágios distintos.
4. Preservar as decisões aprovadas já documentadas; mudanças de direção exigem atualização explícita do contexto.
5. Código novo deve ter teste proporcional ao risco.
6. Nenhum agente aprova o próprio human gate.
7. CI pode validar estrutura e testes; não pode substituir decisão humana de produto.
8. Antes de encerrar um estágio, atualizar `HANDOFF.md` e `verification.json`.

## Convenção das Issues

Título estável: `[ICM 01] ...` até `[ICM 09] ...`.

O número ICM não depende do número da Issue do GitHub.

Cada Issue deve ter:

- objetivo;
- dependências;
- entregáveis;
- critérios de aceite;
- testes/evidências;
- gate humano.

## Estado atual

Desde 12/11/2026 a direção do produto é a pesquisa de preferência por foto, registrada na issue #318 e em `docs/decisions/0001-pesquisa-de-preferencia-por-foto.md`. Antes de propor ou alterar tela, regra de voto ou cadastro, leia esse registro e a decisão 0002 (`docs/decisions/0002-ordem-de-construcao-e-cartas-com-moldura.md`), de 13/11/2026, que alterou quatro pontos dele. A primeira etapa de produto da direção nova está aberta: [ICM 68] #324, em `stages/68_photo_survey_politics/`. Cada etapa precisa de Issue própria e de gate humano.

Nada da direção nova está em produção. O programa de maturidade (#309) continua ativo e corre em paralelo à etapa 1 da pesquisa por foto; nenhum bloqueio dele foi dispensado. Ninguém de fora é chamado antes de o aplicativo estar testado.

A lista abaixo descreve o programa anterior, a reconstrução do frontend, e vale para o que está no ar. Para as telas novas da pesquisa por foto não valem o tema malaquita na interface nem a descrição curta na carta. As cartas com moldura valem na tela de voto, desde que todas as cartas de uma pesquisa usem o mesmo padrão (decisão 0002).

O programa ICM anterior é a reconstrução do frontend PoliMatch, com foco em:

- UX/UI mobile-first;
- tema claro/porcelana com malaquita estrutural;
- cards com proporção de TCG semelhante às referências aprovadas;
- clique direto na carta para votar;
- descrição curta de quem a pessoa é e o que faz;
- Chromas como foco visual;
- sistema próprio de botões;
- sound design e haptics para reforçar interação, progresso e recompensa sem favorecer candidato específico;
- coleção, ranking e torneio coerentes com o novo design;
- SSO real fica fora desta rodada e será tratado depois.
