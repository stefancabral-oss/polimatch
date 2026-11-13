# HANDOFF — [ICM 68] Pesquisa por foto, etapa 1: rodada de Política com as cartas de moldura

## Status

- Estado: `em andamento`. A entrega 68a (registro) foi aprovada; faltam as entregas 68b a 68e.
- Issue: #324
- Branch desta entrega: `icm/68-photo-survey-politics` (base main `77104a3`)
- PR: #325

## Entregue (68a — registro)

- `docs/decisions/0002-ordem-de-construcao-e-cartas-com-moldura.md`: a decisão do Stefan de 13/11/2026 sobre a ordem de construção e as cartas com moldura no voto, com o que ela altera na decisão 0001.
- `stages/68_photo_survey_politics/CONTEXT.md`: formato, regras, entregas, fora de escopo e critérios de aceite da etapa 1.
- `stages/68_photo_survey_politics/references/`: as quatro telas aprovadas. A de entrada foi desenhada depois das outras três e aprovada com este PR.
- `docs/decisions/0001-pesquisa-de-preferencia-por-foto.md`: marca nos quatro pontos alterados. Nada foi apagado.
- `CONTEXT.md`, `README.md` e `AGENTS.md` da raiz: apontam para a decisão 0002 e para esta etapa.

## Não entregue / pendente

- As entregas 68b (regras e servidor), 68c (tela), 68d (teste por agentes) e 68e (publicação). Nenhum código foi escrito.
- O plano de implementação de cada entrega, que sai antes do primeiro PR de código.

## Testes executados

- `npm test --prefix app` e `npm run test:shared` na branch, para confirmar que a mudança de documentação não quebra nenhum teste que leia esses arquivos. Os números estão no `verification.json`.
- O PR não altera `app/`, `back/` nem `shared/`.

## Revisão independente

Um agente separado, somente leitura, revisou este PR em 13/11/2026 e não achou bloqueio. Correções aplicadas depois dela: a tela de entrada, que faltava no formato; a regra do desfazer, que vale até a confirmação; critérios de aceite por entrega, com os que faltavam (resposta forjada, sorteio uniforme, tabelas imutáveis, janela, troca de identidade); a página nova fora do sitemap e os testes que fixam a lista de páginas; a troca da entrada do site só na 68e; e as condições de publicação, com os bloqueios de maturidade que pesam nesta etapa.

## Riscos conhecidos

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

1. Plano de implementação da 68b e o primeiro PR de código, que pede o gate dele antes do merge.

## Ação do Stefan

- Decidir sobre as 8 cartas vindas de fotos de veículos: refazer a partir de retrato oficial ou de licença livre, ou confirmar o uso.
- Confirmar as condições de publicação propostas no contexto do estágio.
- Dizer se quer cartas de Lula e Flávio Bolsonaro no padrão comum, para entrarem numa próxima pesquisa.

## Human gate

- Decisão da entrega 68a: `aprovado`
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para este PR, em conversa de 13/11/2026. À pergunta "Mesclo o PR 325, com a tela de entrada incluída, ou quer mudar alguma coisa?", ele respondeu: "Toca". O merge fica a cargo do agente, a pedido dele, com o check verde no commit final. As entregas 68b a 68e têm gate próprio. A regra 6 do `AGENTS.md` não muda.
