# HANDOFF — [ICM 68] Pesquisa por foto, etapa 1: rodada de Política com as cartas de moldura

## Status

- Estado: `em andamento`. A entrega 68a (registro) foi aprovada. A 68b (regras e servidor) está pronta para gate. Faltam a 68c, a 68d e a 68e.
- Issue: #324
- 68a: PR #325, mesclado em `3a59344`.
- 68b: branch `icm/68b-photo-survey-server` (base main `3a59344`); o PR está na issue #324.

## Entregue (68a — registro)

- `docs/decisions/0002-ordem-de-construcao-e-cartas-com-moldura.md`: a decisão do Stefan de 13/11/2026 sobre a ordem de construção e as cartas com moldura no voto, com o que ela altera na decisão 0001.
- `stages/68_photo_survey_politics/CONTEXT.md`: formato, regras, entregas, fora de escopo e critérios de aceite da etapa 1.
- `stages/68_photo_survey_politics/references/`: as quatro telas aprovadas. A de entrada foi desenhada depois das outras três e aprovada com este PR.
- `docs/decisions/0001-pesquisa-de-preferencia-por-foto.md`: marca nos quatro pontos alterados. Nada foi apagado.
- `CONTEXT.md`, `README.md` e `AGENTS.md` da raiz: apontam para a decisão 0002 e para esta etapa.

## Entregue (68b — regras e servidor)

- `shared/photo-survey.js`: a pesquisa `politica-2026-01` (20 cartas, sorteio de 16, telas de 4), o sorteio, as telas, a validação da chave e o estado pela janela. Funções puras, com 10 testes.
- `back/src/photo-survey-store.js`: as tabelas `photo_survey_draws` e `photo_survey_responses`, aditivas e imutáveis, o sorteio por jogador e a resposta única por identidade.
- `back/src/http-app.js`: `GET /api/photo-surveys/:surveyId`, `POST …/draw` e `POST …/response`.
- `back/scripts/photo-survey-smoke.mjs` e o passo dele em `.github/workflows/back-shared.yml`.
- `docs/security/VOTE_ABUSE_POLICY.md`, versão 4, com a seção da pesquisa por foto.
- `README.md`: as três rotas na tabela da API.
- `stages/68_photo_survey_politics/plans/68b-regras-e-servidor.md`: o plano seguido.

O que muda no jogo atual: nada no que a pessoa vê. No servidor, o login Google passa a ligar à conta o jogador anônimo que respondeu a uma pesquisa sem ter jogado; antes ele era descartado. A resposta do login traz `merge.status: "linked"` nesse caso, e o app, que só reage a `combined` e `alreadyCombined`, não mostra aviso.

Nada desta entrega é visível no site: não há tela, e as rotas novas nascem desligadas. Só `PHOTO_SURVEYS_ENABLED=true` no ambiente da API as liga; sem isso respondem 404 `PHOTO_SURVEYS_DISABLED`.

## Não entregue / pendente

- As entregas 68c (tela), 68d (teste por agentes) e 68e (publicação).
- A pesquisa `politica-2026-01` está sem janela (`opensAt` e `closesAt` nulos), ou seja, aberta assim que as rotas forem ligadas. Definir a janela e ligar `PHOTO_SURVEYS_ENABLED` em produção são assunto da 68e.
- Fechar uma pesquisa exige mudar a definição no código e publicar. Não há painel para isso.

## Testes executados

68a: `npm test --prefix app` e `npm run test:shared`; o PR não alterava código.

68b, em 13/11/2026, numa máquina com PostgreSQL 16.14 local e banco descartável:

- `npm run test:shared`: 103/103 (10 novos).
- `npm test --prefix back`: 293/293 (8 novos: 7 das rotas e a guarda de banco descartável do smoke novo).
- `npm test --prefix app`: 286/286.
- Smokes na ordem do CI, todos aprovados: integração, duas escolhas, duelos, abuso, progresso, cívico, resiliência e o novo, da pesquisa.
- Backup com manifesto e ensaio de restauração: 47 tabelas, com as duas novas no manifesto e sem diferença depois do boot. Restauração parcial: aprovada.
- A API real, local: definição, sorteio, resposta, repetição (`alreadyProcessed`), outra escolha (409) e chamada sem sessão (401).
- O smoke novo foi escrito antes do código e falhou primeiro por método ausente; depois apontou o caso do login Google descrito acima.

## Revisão independente

Um agente separado, somente leitura, revisou este PR em 13/11/2026 e não achou bloqueio. Correções aplicadas depois dela: a tela de entrada, que faltava no formato; a regra do desfazer, que vale até a confirmação; critérios de aceite por entrega, com os que faltavam (resposta forjada, sorteio uniforme, tabelas imutáveis, janela, troca de identidade); a página nova fora do sitemap e os testes que fixam a lista de páginas; a troca da entrada do site só na 68e; e as condições de publicação, com os bloqueios de maturidade que pesam nesta etapa.

## Riscos conhecidos

- A 68b mexe em `combineGoogleHistory`, a função que junta o histórico no login Google. A mudança é uma condição e um status; os smokes de integração e de identidade continuam aprovados.
- Um deploy da API com a 68b não abre a pesquisa: as rotas ficam desligadas até `PHOTO_SURVEYS_ENABLED=true`. As tabelas novas são criadas vazias no boot.
- A decisão 0002 muda a ordem "maturidade primeiro" da 0001. Os bloqueios de maturidade continuam abertos (#278, #279, #280, #281, #283, #284, #285 e #286) e correm em paralelo.
- A primeira pesquisa fica sem Lula e Flávio Bolsonaro, porque as cartas deles têm moldura diferente das outras 20.
- Das 20 cartas, 8 vêm de fotos de veículos ou de sites. Sem refazer essas 8 ou sem a confirmação do Stefan, a publicação (68e) não acontece com elas, e com 12 cartas o formato de 16 não fecha.
- "Uma resposta por jogador" não é "uma por pessoa": quem apaga os dados do aparelho pode responder de novo, dentro da cota de rede. O cadastro por CPF é o que resolve.
- A etapa grava escolha política ligada à identidade do jogo, como o jogo atual já faz. A [ICM 41] #283, de privacidade, continua aberta.

## Decisões tomadas

Decididas pelo Stefan em 13/11/2026:

- A ordem de construção: política, depois celebridades e influenciadores, depois roupas com imagens próprias.
- As cartas com moldura valem na tela de voto.
- Ninguém de fora é chamado antes de o aplicativo estar testado por agentes.
- O desenho da etapa 1: 16 cartas em 4 telas de 4, final, confirmação; página nova ao lado do jogo atual; sem CPF, sem top 5 público, sem compartilhar, avisos e indicação nesta etapa.

Escolhas de desenho do agente, dentro do que ele aprovou, a confirmar neste gate:

- Cada pessoa recebe 16 das 20 cartas por sorteio, em vez de uma lista fixa de 16. Evita excluir quatro nomes por escolha editorial.
- O sorteio é emitido pelo servidor quando a pessoa começa, e as escolhas parciais ficam só no aparelho até a confirmação.
- A coleção fica fora desta etapa.
- A resposta da pesquisa não altera o Elo do jogo atual.

## Próximo passo exato

1. Gate do Stefan no PR da 68b.
2. Plano e implementação da 68c, a tela.

## Ação do Stefan

- Decidir o merge do PR da 68b. Ele não publica nada.
- Decidir sobre as 8 cartas vindas de fotos de veículos: refazer a partir de retrato oficial ou de licença livre, ou confirmar o uso.
- Confirmar as condições de publicação propostas no contexto do estágio.
- Dizer se quer cartas de Lula e Flávio Bolsonaro no padrão comum, para entrarem numa próxima pesquisa.

## Human gate

- Decisão da entrega 68a: `aprovado`
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para este PR, em conversa de 13/11/2026. À pergunta "Mesclo o PR 325, com a tela de entrada incluída, ou quer mudar alguma coisa?", ele respondeu: "Toca". O merge fica a cargo do agente, a pedido dele, com o check verde no commit final. As entregas 68b a 68e têm gate próprio. A regra 6 do `AGENTS.md` não muda.
