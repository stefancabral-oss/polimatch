# Decisão 0008 — Rodadas contínuas, resultado da pessoa, feed e perfil

- Data da decisão: 26/11/2026
- Quem decidiu: Stefan
- Registrado por: agente (Claude)
- Issue: #354 ([ICM 76])
- Estado: em 26/11/2026, em construção no estágio 76, sem merge e sem
  publicação.
- Altera a [decisão 0007](0007-rodadas-enquanto-houver-confrontos.md) nas
  escolhas 2 ("continuar é opcional"), 12 ("Mais uma rodada") e 13 ("Suas
  escolhas" na capa); a [decisão 0001](0001-pesquisa-de-preferencia-por-foto.md)
  no item 5 ("Nunca o dado de uma pessoa"); a
  [decisão 0004](0004-cadastro-obrigatorio-com-cpf.md) em "O que não muda"; e o
  que "Como funciona" e a tela do cadastro prometem sobre a escolha de uma
  pessoa.

## Contexto

Com as rodadas no ar (decisão 0007), a pessoa que confirma uma rodada vê a
escolha registrada e o botão "Mais uma rodada". Nenhuma escolha de uma
pessoa aparece para outra: a página "Como funciona" diz "Do PoliMatch só sai
o resultado somado, nunca a escolha de uma pessoa."

Em 26/11/2026 o Stefan escreveu:

> "única coisa é que fica perguntando se quero mais uma rodada. Basta ficar
> em aberto e dar o resultado prévio se solicitado."

> "Também coloca na página inicial de cada pessoa que fez login um Feed das
> pesquisas. E no perfil dela, assim como no instagram, aparece a foto de
> quem está em primeiro lugar na escolha dela daquela pesquisa."

O agente perguntou se o resultado prévio era o da própria pessoa ou o de
todos. Ele respondeu:

> "De todos? não faz sentido, porque a pesquisa será prévia para todos que
> começarem enquanto não for fechada por quem a contratou."

O agente explicou que um perfil visível a outros mostra a terceiros as
escolhas de uma pessoa, inclusive sobre política, o que é dado sensível pela
LGPD, e perguntou: "O perfil de cada pessoa é visível só para ela ou também
para os outros?". Ele respondeu:

> "Igual o instagram"

O agente perguntou então se o perfil nasce público ou só depois de a pessoa
ligar, recomendando a segunda opção. Ele respondeu:

> "Pessoa liga"

Depois de o agente começar a construir, ele perguntou:

> "pra que seria tudo isso?"

O agente explicou o que cada um dos quatro pedidos faz e por que o perfil
público pede aceite próprio e revisão jurídica, e perguntou: "Sigo com os
quatro itens ou deixo o perfil público para depois?". Ele respondeu:

> "Sigo com tudo"

## Decisão

1. **As rodadas seguem sem perguntar.** Confirmada uma rodada, a seguinte
   começa enquanto houver confronto por ver.
2. **O resultado prévio aparece quando a pessoa pede, e não é "o de
   todos"**, que o Stefan rejeitou. Que seja o da própria pessoa é leitura
   do agente sobre a resposta dele. A soma de todos continua sem aparecer,
   pelo gate #177; a resposta dele não promete que ela apareça quando a
   pesquisa fechar.
3. **Quem entrou vê na página inicial um feed das pesquisas.**
4. **Cada pessoa tem um perfil, visível a outras pessoas como no Instagram,**
   com a foto de quem está em primeiro lugar nas escolhas dela em cada
   pesquisa.
5. **O perfil nasce fechado e só aparece para os outros depois de a pessoa
   ligar.**

## Escolhas do agente

As respostas do Stefan cobrem os itens acima. O resto é escolha do agente, e
ele pode mudar qualquer uma.

As escolhas 1 a 13 não são de desenho: são de regra e de dado, e a pergunta
do gate do merge as apresenta por extenso. As escolhas 14 a 16 são de desenho
(decisão 0003, item 5).

### De regra e de dado

1. **Como se chega ao primeiro lugar.** Em cada pesquisa, a carta ganha 3
   pontos por rodada em que venceu a final e 1 ponto por rodada em que venceu
   uma tela de voto (a campeã ganha os dois: 4). Empate: mais vitórias na
   final, depois mais vitórias em tela, depois a ordem das cartas na
   pesquisa. Contam todas as rodadas respondidas pela pessoa, pela regra de
   identidade da decisão 0007. Só entram cartas com ao menos 1 ponto, e
   cartas que saíram da pesquisa não entram. O resultado prévio mostra essa
   ordem.
2. **Ligar o perfil pede um aceite próprio,** separado do cadastro, com
   versão e data do aceite gravadas no banco (o texto de cada versão fica no
   código, e um teste impede mudar o texto sem mudar a versão). Desligar é a
   qualquer momento, sem aceite e sem exigir cadastro, e vale na hora. Sem
   cadastro, a conta só pode desligar: não grava marcações nem cria perfil.
3. **A pessoa escolhe pesquisa por pesquisa o que mostra.** Ao ligar, nenhuma
   pesquisa vem marcada; ela marca as que quer mostrar. Pesquisa que ela não
   marcou não aparece, nem como "oculta".
4. **O perfil mostra só um nome de perfil escolhido pela pessoa** (3 a 20
   letras, números ou sublinhado, único, sem diferença entre maiúsculas e
   minúsculas) e, para cada pesquisa marcada em que a pessoa já respondeu
   uma rodada, o assunto, a pergunta e a carta em primeiro lugar. Não mostra
   nome da conta Google, foto da pessoa, CPF, faixa de idade, gênero nem
   estado. Alguns nomes são reservados: admin, polimatch, perfil, suporte,
   ajuda, api e www.
5. **O perfil só se acha pelo link,** `polimatch.com.br/perfil.html?u=<nome>`.
   Não há busca, lista de perfis nem perfil no mapa do site, e a página pede
   para não ser indexada.
6. **Perfil desligado ou inexistente responde igual,** para não dizer a quem
   procura se um nome de perfil existe.
7. **O primeiro lugar no perfil muda conforme a pessoa joga.** É o resultado
   prévio dela naquele momento.
8. **Textos de privacidade mudam.** "Como funciona" e a tela do cadastro
   passam a dizer que a escolha da pessoa só aparece no perfil que ela
   ligar, e só nas pesquisas que marcar; o título do cadastro deixa de dizer
   "nunca o seu nome", porque o nome de perfil é escolhido pela pessoa e
   pode ser o nome dela. O texto do aceite do cadastro (o que a pessoa
   aceitou) não muda.
9. **Só quem tem cadastro com CPF liga perfil**, como só quem tem cadastro
   responde (decisão 0004). Salvar marcações com o perfil ligado manda de
   novo a versão atual do aceite; se o texto do aceite mudar um dia, a
   pessoa aceita de novo antes de mudar o perfil.
10. **O nome de perfil não muda depois de escolhido, e não volta a ficar
    livre enquanto a conta existir.** Assim um link antigo nunca passa a mostrar as escolhas de outra
    pessoa. Consequência: o nome continua da conta com o perfil desligado, e
    quem tenta ligar com um nome usado descobre que ele existe.
11. **As marcações ficam guardadas com o perfil desligado,** e voltam ao
    religar. Religar grava data de aceite nova.
12. **O resultado da pessoa continua legível com a pesquisa fechada.** Só
    ela vê.
13. **As rotas do perfil e do resultado seguem a chave que liga as
    pesquisas por foto** (`PHOTO_SURVEYS_ENABLED`): com as pesquisas
    desligadas no servidor, o perfil também some.

### De desenho

14. **Rodada contínua.** Ao confirmar, a tela diz "Rodada registrada" por um
    instante e abre a próxima. "Ver meu resultado" fica à mão durante o voto
    e na confirmação, depois da primeira rodada. Vistos todos os confrontos,
    a tela mostra o resultado. Abrir uma pesquisa já respondida mostra o
    resultado com "Continuar votando": abrir a página nunca começa rodada
    sem um toque da pessoa.
15. **Feed.** Na página inicial de quem entrou, as pesquisas aparecem em
    cartões, uma embaixo da outra: as que a pessoa não começou, as que estão
    em andamento e as respondidas, com a primeira colocada dela.
16. **Perfil.** Grade de fotos como no Instagram: uma por pesquisa marcada,
    com o assunto embaixo. "Meu perfil" no menu mostra a versão da própria
    pessoa, com o botão de ligar e desligar e as marcações.

## O que não muda

- O gate de publicação agregada (#177): nenhuma soma de respostas aparece.
- Uma resposta por rodada, sem troca depois de confirmar.
- O cadastro obrigatório da decisão 0004.
- O fluxo ICM e o gate humano do `AGENTS.md`.

## Pendências

Nada abaixo fica liberado por esta decisão.

- **Revisão jurídica antes de publicar o perfil (#283).** Mostrar a
  terceiros a escolha de uma pessoa sobre política é dado pessoal sensível
  (LGPD, art. 11). O aceite próprio é a base pensada; a redação e o
  tratamento precisam de revisão.
- **Nome de perfil que imita outra pessoa.** Nada impede alguém de escolher
  o nome de uma pessoa conhecida. Falta definir como tratar.

## Referências

- `stages/76_feed_profile/`: contexto, handoff e verificação deste estágio.
