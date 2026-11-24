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

Desde 12/11/2026 a direção do produto é a pesquisa de preferência por foto, registrada na issue #318 e em `docs/decisions/0001-pesquisa-de-preferencia-por-foto.md`. Antes de propor ou alterar tela, regra de voto ou cadastro, leia esse registro e a decisão 0002 (`docs/decisions/0002-ordem-de-construcao-e-cartas-com-moldura.md`), de 13/11/2026, que alterou quatro pontos dele. A primeira etapa de produto da direção nova é a [ICM 68] #324, em `stages/68_photo_survey_politics/`. A decisão 0003 (`docs/decisions/0003-a-pesquisa-vira-a-capa.md`), de 14/11/2026, faz da pesquisa a capa do site e tira as páginas do produto anterior: [ICM 69] #331, em `stages/69_survey_home/`. A decisão 0004 (`docs/decisions/0004-cadastro-obrigatorio-com-cpf.md`), de 16/11/2026, torna obrigatórios a entrada com Google e o cadastro com CPF para responder: [ICM 71] #336, em `stages/71_cpf_registration/`; ela altera o item 3 da 0001. A decisão 0005 (`docs/decisions/0005-roupas-antes-de-celebridades.md`), de 23/11/2026, põe roupas à frente de celebridades e influenciadores na ordem de construção: [ICM 73] #345, em `stages/73_clothes_demo/`; ela altera o item 1 da 0002. Cada etapa precisa de Issue própria e de gate humano.

Desde 16/11/2026 estão em produção os estágios 70, 71 e 72: duas pesquisas de Política com a capa em lista, o cadastro obrigatório com CPF para responder (decisão 0004) e o compartilhar com imagem. No pacote publicado, a página da pesquisa não pede mais jogador sem conta. O que foi e o que não foi conferido em produção está nos HANDOFF desses estágios. Em 23/11/2026 o estágio 73 (pesquisa de roupas de demonstração, com 16 cartas desenhadas por código) estava construído e fora de produção; o HANDOFF dele diz o estado atual. Desde 14/11/2026 a pesquisa de Política é a capa do site, em produção, com menu novo e a página "Como funciona"; as páginas do produto anterior saíram do site e o código das páginas saiu de `app/` (o que ficou de resto está no HANDOFF do estágio 69). As rotas do jogo anterior continuam na API. O programa de maturidade (#309) continua ativo e corre em paralelo à etapa 1 da pesquisa por foto; nenhum bloqueio dele foi dispensado. Ninguém de fora é chamado antes de o aplicativo estar testado.

A lista abaixo descreve o programa anterior, a reconstrução do frontend. Desde a troca da capa ela é histórico: não descreve mais o que está no ar. Para as telas novas da pesquisa por foto não valem o tema malaquita na interface nem a descrição curta na carta. As cartas com moldura valem na tela de voto, desde que todas as cartas de uma pesquisa usem o mesmo padrão (decisão 0002).

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
