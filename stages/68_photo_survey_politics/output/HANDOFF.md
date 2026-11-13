# HANDOFF — [ICM 68] Pesquisa por foto, etapa 1: rodada de Política com as cartas de moldura

## Status

- Estado: `em andamento`. A entrega 68a (registro) está pronta para gate.
- Issue: #324
- Branch desta entrega: `icm/68-photo-survey-politics` (base main `77104a3`)
- PR: ver a issue #324

## Entregue (68a — registro)

- `docs/decisions/0002-ordem-de-construcao-e-cartas-com-moldura.md`: a decisão do Stefan de 13/11/2026 sobre a ordem de construção e as cartas com moldura no voto, com o que ela altera na decisão 0001.
- `stages/68_photo_survey_politics/CONTEXT.md`: formato, regras, entregas, fora de escopo e critérios de aceite da etapa 1.
- `stages/68_photo_survey_politics/references/`: as três telas aprovadas.
- `docs/decisions/0001-pesquisa-de-preferencia-por-foto.md`: marca nos quatro pontos alterados. Nada foi apagado.
- `CONTEXT.md`, `README.md` e `AGENTS.md` da raiz: apontam para a decisão 0002 e para esta etapa.

## Não entregue / pendente

- As entregas 68b (regras e servidor), 68c (tela), 68d (teste por agentes) e 68e (publicação). Nenhum código foi escrito.
- O plano de implementação de cada entrega, que sai antes do primeiro PR de código.

## Testes executados

- `npm test --prefix app` e `npm run test:shared` na branch, para confirmar que a mudança de documentação não quebra nenhum teste que leia esses arquivos. Os números estão no `verification.json`.
- O PR não altera `app/`, `back/` nem `shared/`.

## Riscos conhecidos

- A decisão 0002 muda a ordem "maturidade primeiro" da 0001. Os bloqueios de maturidade continuam abertos (#278, #279, #280, #281, #283, #284, #285 e #286) e correm em paralelo.
- A primeira pesquisa fica sem Lula e Flávio Bolsonaro, porque as cartas deles têm moldura diferente das outras 20.
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

1. Gate do Stefan nesta entrega (68a).
2. Plano de implementação da 68b e, com o sim dele, o primeiro PR de código.

## Ação do Stefan

- Revisar e decidir o merge do PR da 68a.
- Dizer se quer cartas de Lula e Flávio Bolsonaro no padrão comum, para entrarem numa próxima pesquisa.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan
- Observação: o desenho da etapa foi aprovado por ele em conversa de 13/11/2026 ("Aprovado"). O merge deste PR depende de instrução dele para este PR, transcrita no PR. A regra 6 do `AGENTS.md` não muda.
