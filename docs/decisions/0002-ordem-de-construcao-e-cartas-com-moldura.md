# Decisão 0002 — Ordem de construção da pesquisa por foto e cartas com moldura no voto

- Data da decisão: 13/11/2026
- Quem decidiu: Stefan
- Registrado por: agente (Claude), a pedido dele
- Issue: #324 ([ICM 68])
- Estado: direção aprovada. **Nada desta decisão está em produção.**
- Altera a [decisão 0001](0001-pesquisa-de-preferencia-por-foto.md) nos pontos
  listados em "O que muda na decisão 0001". O resto dela continua valendo.

## Contexto

A decisão 0001 fixou a pesquisa de preferência por foto como direção do
produto e deixou a ordem do trabalho como "maturidade primeiro". Em 13/11/2026,
com quatro estágios de maturidade já publicados (37, 38, 39 e 40), o Stefan
decidiu começar a construção do formato novo e disse por onde começar.

Palavras dele, transcritas de conversa por voz:

> "Eu quero que você faça primeiro valer o PoliMatch que a gente já tinha
> funcionando dentro desse aplicativo novo que nós estamos montando. [...] Nós
> não vamos dar nenhum passo para trás."

> "Antes da gente seguir um plano de chamar pessoas, a gente precisa primeiro
> ter certeza que o aplicativo funciona 100%."

## Decisão

1. **Ordem de construção.** Primeiro a política que já funciona, dentro do
   formato novo. Depois celebridades e influenciadores. Depois roupas, com
   imagens criadas pelo próprio PoliMatch; nenhuma empresa envia foto nesta
   fase.
2. **Cartas com moldura no voto.** As cartas de moldura que já existem passam a
   ser o padrão das telas de voto. Condição: todas as cartas de uma mesma
   pesquisa usam o mesmo padrão de moldura, para ninguém sair em vantagem.
3. **Ninguém de fora antes de testar.** Nenhuma pessoa ou empresa é chamada
   antes de o aplicativo funcionar por inteiro, testado por agentes. O contato
   com marcas fica suspenso até lá.
4. **A construção começa agora.** A primeira etapa ([ICM 68] #324) corre em
   paralelo ao que resta do programa de maturidade (#309).

## O que muda na decisão 0001

| Ponto da 0001 | O que dizia | O que passa a valer |
|---|---|---|
| "Decisão", item 8; tabela, linhas "Chromas na rodada" e "Direção de arte" | Foto sem moldura na hora do voto. | Carta com moldura, no mesmo padrão para todas as cartas da pesquisa. O resto do visual da tela continua: fundo neutro, um único verde, sem enfeite além das cartas. |
| "Pendências", "Ordem do trabalho (#309)" | Maturidade primeiro: os bloqueios de [ICM 36] a [ICM 44] antes de qualquer etapa de produto. | A etapa 1 começa agora, em paralelo. Os bloqueios continuam abertos e nenhum é dispensado por esta decisão. |
| "Etapas seguintes propostas" | Medir o uso ([ICM 60]), depois o servidor da pesquisa e por fim as telas, com a [ICM 65] antes do servidor. | A etapa 1 traz regras, servidor e tela da primeira pesquisa, em módulos e tabelas novos, sem depender da divisão do `topic-store.js`. A [ICM 60] e a [ICM 65] seguem no programa de maturidade. |
| "Decisão", item 6 | Assuntos de abertura: Política, Famosos e influenciadores, Futebol. | Ordem de construção: Política, celebridades e influenciadores, roupas. Futebol não foi tratado nesta decisão. |

## O que não muda

- Os itens 1 a 5 e 7 da decisão 0001. Em particular o item 3: a escolha só
  entra na pesquisa com cadastro por CPF. A etapa 1 não tem cadastro por CPF;
  ela grava a escolha ligada à identidade que o jogo já usa, e se essas
  escolhas contam no resultado fica para a etapa do cadastro.
- Tudo o que a seção "O que continua valendo" da 0001 lista: app online-only,
  mesma exposição para todas as opções de uma tela, nenhum resultado
  manipulado, compartilhamento por iniciativa da pessoa, jogar sem cadastro, o
  gate de publicação agregada (#177), a política de integridade do voto e o
  fluxo ICM com gate humano.
- As pendências de fotos e jurídicas da 0001.

## Consequências a observar

- **Mesma moldura para todos.** Hoje 20 cartas de política têm o mesmo padrão
  ("Políticos 2026", em `app/public/chromas/politicos`). Lula e Flávio
  Bolsonaro têm uma moldura especial, diferente, e ficam fora da primeira
  pesquisa enquanto não houver carta deles no padrão comum.
- **A tela continua limpa.** O visual minimalista aprovado em 12/11/2026 vale
  para a tela. A moldura é da carta, não da interface.
- **O protótipo de 12/11/2026 continua como referência do fluxo**, não do
  visual das cartas: ele usa rostos fictícios e fotos sem moldura.

## Referências

- `stages/68_photo_survey_politics/`: contexto, handoff e verificação da
  etapa 1.
- `stages/68_photo_survey_politics/references/`: as três telas que o Stefan
  aprovou em 13/11/2026.
