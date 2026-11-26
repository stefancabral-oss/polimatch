# Decisão 0007 — A pesquisa fica aberta enquanto houver confrontos por ver

- Data da decisão: 26/11/2026
- Quem decidiu: Stefan
- Registrado por: agente (Claude)
- Issue: #350 ([ICM 75])
- Estado: em 26/11/2026, construído no estágio 75, à espera do gate do
  merge; sem publicação.
- Altera a [decisão 0001](0001-pesquisa-de-preferencia-por-foto.md) no item 2
  ("não se repete para a mesma pessoa"). O resto dela continua valendo.

## Contexto

Desde o estágio 68, cada pessoa responde uma pesquisa uma vez: recebe um
sorteio de 16 cartas, escolhe uma em cada uma das quatro telas, escolhe uma
entre as quatro na final e confirma. Depois disso a pesquisa fica fechada
para ela. A página "Como funciona" diz: "Um CPF, um voto: cada pessoa
responde uma vez em cada pesquisa."

Em 26/11/2026, enquanto a publicação da pesquisa de famosos esperava o acesso
dele ao painel, o Stefan escreveu, por voz:

> "Depois builda e publica uma correção a onde a pessoa precisa ou fica
> aberto para votar enquanto houverem possibilidades de enfrentyamentos que a
> pessoa ainda não votou."

O agente respondeu que isso muda a regra de uma resposta por pessoa e o
banco, e que por isso seria um estágio novo, com revisão e gate. Disse
também, nestas palavras: "No resultado, cada pessoa continuaria valendo uma
só, com todas as rodadas dela somadas." E perguntou, dando duas leituras:

> "**"É isso":** a pessoa joga rodadas novas da mesma pesquisa, com grupos
> diferentes, até cada carta ter enfrentado todas as outras. Com 20 cartas
> são 190 duplas, perto de dez rodadas por pessoa."
>
> "**"Só as que faltaram":** uma rodada a mais, só para ela ver as 4 cartas
> que o sorteio deixou de fora."
>
> "A pessoa joga rodadas novas até ter visto todas as duplas de cartas, é
> isso? Responda "é isso" ou "só as que faltaram"."

Ele respondeu:

> "É isso."

## Decisão

1. **A pesquisa fica aberta para a pessoa enquanto houver confronto que ela
   ainda não viu.** Depois de responder, ela pode jogar rodadas novas da
   mesma pesquisa, com grupos diferentes, até cada carta ter enfrentado
   todas as outras.

## Escolhas do agente

A resposta do Stefan cobre o item acima. Tudo o que vem abaixo é escolha do
agente, e ele pode mudar qualquer uma.

As escolhas 1 a 8 não são de desenho: são de regra e de dado. Por isso a
pergunta do gate do merge as apresenta por extenso. As escolhas 9 a 11 são
de desenho e se apoiam no pedido dele de não ser parado por detalhes de
desenho (decisão 0003, item 5).

### De regra e de dado

1. **O que é um confronto.** Duas cartas que apareceram juntas na mesma tela
   de uma rodada que a pessoa respondeu: uma das quatro telas de voto ou a
   tela final. Não se exige que a pessoa tenha escolhido uma das duas: basta
   ter tido as duas na frente para escolher. Rodada começada e não
   confirmada não conta.
2. **Continuar é opcional.** A frase dele admite "precisa" e "fica aberto". O
   agente ficou com "fica aberto": depois de cada rodada a pessoa pode parar,
   e o que ela respondeu vale.
3. **Uma pessoa, um peso.** Na frase que ele leu antes de responder: no
   resultado, cada pessoa vale uma só, com todas as rodadas dela somadas.
   Este estágio não calcula soma nenhuma (#177); a regra fica registrada
   para quando a soma existir, e a política de integridade do voto passa a
   dizer isso.
4. **Toda rodada é uma rodada inteira.** Quatro telas, final e confirmação,
   como hoje, mesmo quando faltam poucos confrontos. Nas últimas rodadas
   algumas duplas se repetem.
5. **O servidor monta as rodadas novas dando prioridade às duplas que a
   pessoa ainda não viu.** Toda rodada nova traz pelo menos uma dupla nova.
   Entre montagens equivalentes, decide o sorteio. A primeira rodada
   continua sendo o sorteio simples de hoje.
6. **Uma resposta por rodada, imutável.** Cada rodada tem o seu sorteio e a
   sua resposta, gravados como hoje. A resposta que já existe é a primeira
   rodada. As rodadas seguintes ficam em tabelas novas; as tabelas atuais e
   as respostas já gravadas não são alteradas.
7. **Vale para todas as pesquisas,** as de Política, a de famosos e a de
   roupas, inclusive para quem já respondeu: essa pessoa passa a poder
   continuar.
8. **As rodadas novas são da conta com cadastro.** A primeira rodada
   continua valendo com a regra de identidade de hoje: a conta mais os
   jogadores anônimos ligados a ela. Da segunda em diante, a rodada pertence
   só ao jogador da conta com cadastro. Uma contagem futura precisa juntar
   as duas coisas por pessoa, e a política de integridade do voto diz isso.

### De desenho

9. **Depois de registrar, a tela oferece "Mais uma rodada",** enquanto houver
   confronto por ver, e mostra quantos confrontos a pessoa já viu.
   "Compartilhar" continua na tela, abaixo dele.
10. **Na capa,** a pesquisa que ainda tem confrontos por ver entra na fila do
    destaque depois das pesquisas que a pessoa ainda não respondeu.
11. **Os textos que diziam "um voto" ou "uma vez"** mudam: "Como funciona"
    deixa de dizer "responde uma vez em cada pesquisa", as telas de entrada
    e de cadastro passam a dizer "Um CPF, uma pessoa." e a confirmação passa
    a falar da escolha da rodada. O texto do consentimento do cadastro não
    muda.

## O que muda

| Onde estava | O que dizia | O que passa a valer |
|---|---|---|
| Decisão 0001, "Decisão", item 2 | "Tem começo e fim, não se repete para a mesma pessoa". | Cada rodada tem começo e fim. A pesquisa se repete para a mesma pessoa, em rodadas, até ela ter visto todos os confrontos. |
| "Como funciona", item 5 | "Um CPF, um voto: cada pessoa responde uma vez em cada pesquisa." | Um CPF, uma pessoa: ela pode jogar várias rodadas, e todas contam como a resposta de uma pessoa só. |
| Política de integridade do voto, "Resposta de pesquisa por foto" | Uma resposta por identidade e por pesquisa. | Uma resposta por identidade, por pesquisa e por rodada; qualquer contagem conta por pessoa. |
| Tela de resposta registrada | "Sua resposta está registrada e não pode ser trocada nesta pesquisa." | A escolha da rodada está registrada e não pode ser trocada; há "Mais uma rodada" enquanto houver confronto por ver. |

## O que não muda

- O cadastro obrigatório da decisão 0004: só joga rodada quem entrou e tem
  cadastro.
- A resposta de cada rodada não pode ser trocada depois de confirmada.
- O gate de publicação agregada (#177): nenhuma soma de respostas aparece.
- As cartas, as perguntas e a ordem das pesquisas.
- O fluxo ICM e o gate humano do `AGENTS.md`. Merge e publicação pedem o sim
  do Stefan, um a um.

## Pendências

Nada abaixo fica liberado por esta decisão.

- **Como as rodadas viram resultado.** "Uma pessoa, um peso" é a regra; a
  conta que transforma as rodadas de uma pessoa numa preferência só não foi
  desenhada. Depende do gate #177 e da revisão jurídica.
- **Jurídico e privacidade (#283).** Mais rodadas gravam mais escolhas de
  cada pessoa, inclusive sobre pessoas reais e sobre política.
- **O que recebe quem encomenda uma pesquisa.** Fora deste estágio.

## Referências

- `stages/75_more_rounds/`: contexto, handoff e verificação deste estágio.
- `docs/security/VOTE_ABUSE_POLICY.md`: a política de integridade do voto.
