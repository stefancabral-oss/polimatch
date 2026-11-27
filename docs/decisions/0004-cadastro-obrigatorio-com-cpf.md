# Decisão 0004 — Cadastro obrigatório com CPF para responder

- Data da decisão: 16/11/2026
- Quem decidiu: Stefan
- Registrado por: agente (Claude), a pedido dele
- Issue: #336 ([ICM 71])
- Estado: em produção desde 16/11/2026, quando API e app foram publicados no
  commit `28fd962` (publicação registrada na issue #336).
- Altera a [decisão 0001](0001-pesquisa-de-preferencia-por-foto.md) no item 3 e
  em "O que continua valendo", e a
  [decisão 0002](0002-ordem-de-construcao-e-cartas-com-moldura.md) no ponto
  listado em "O que muda". A
  [decisão 0003](0003-a-pesquisa-vira-a-capa.md) continua valendo inteira.

## Contexto

Desde 14/11/2026 a pesquisa por foto é a capa do site. Qualquer visitante
respondia: o toque em "Começar" criava um jogador sem conta. A decisão 0001
previa o cadastro por CPF como etapa posterior, opcional para jogar ("a pessoa
joga primeiro e se cadastra depois").

Em 16/11/2026 o Stefan pediu, por escrito:

> "cria o login obrigatório para cpf para poder entrar e jogar. sem esse
> cadastro a pessoa não pode entrar e dar voto."

## Decisão

1. **Só responde quem entrou e se cadastrou.** Sem o cadastro com CPF a pessoa
   não começa uma pesquisa e não registra resposta. O servidor recusa; não é
   só a tela que esconde.
2. **A capa continua aberta.** Qualquer visitante vê a capa, a pergunta e as
   cartas da entrada. O que pede cadastro é começar a responder.

## Escolhas do agente, por delegação

O Stefan pediu para não ser parado por detalhes de desenho (decisão 0003,
item 5). Estas escolhas respondem à pendência "Login Google e CPF" da decisão
0001. Ele pode mudar qualquer uma.

1. **A entrada é a conta Google.** É a entrada que o site já tem. Ela dá à
   pessoa um jeito de voltar em outro aparelho sem senha nova e sem custo de
   SMS. Entrada só com CPF não prova quem está digitando.
2. **O cadastro é o do protótipo aprovado em 12/11/2026:** CPF, faixa de
   idade, gênero e estado, numa tela só, feito uma vez por conta.
3. **Um CPF por conta e uma conta por CPF.**
4. **O CPF é conferido pelos dígitos, não na Receita Federal.** A conferência
   pelos dígitos barra erro de digitação e número inventado ao acaso. Ela não
   prova que o CPF é de quem digitou. Conferir na Receita é serviço pago por
   consulta e pede contrato: decisão do Stefan.
5. **O número do CPF não é guardado.** O servidor guarda um código gerado a
   partir dele com um segredo do servidor, que basta para reconhecer um CPF
   repetido. Isso protege o número num vazamento só do banco. Não é
   anonimização: quem tem o banco e o segredo juntos, como o operador do
   servidor, consegue testar os CPFs possíveis contra os códigos e descobrir
   quais estão cadastrados. Para a revisão jurídica, o dado continua sendo
   pessoal. O PoliMatch não guarda lista de CPFs, e não dá para conferir
   depois na Receita os cadastros já feitos sem pedir o número de novo.
6. **Consentimento na tela do cadastro.** O servidor guarda a versão do texto
   aceito e a data. O texto de cada versão fica no repositório
   (`shared/registration.js`), e um teste impede mudar o texto sem mudar a
   versão. O texto diz o que o sistema faz. Ele não substitui a política de
   privacidade nem a revisão jurídica (#283).
7. **Limite de tentativas de cadastro por conta,** para que uma conta não sirva
   para descobrir quais CPFs já estão cadastrados.

## O que muda

| Onde estava | O que dizia | O que passa a valer |
|---|---|---|
| Decisão 0001, "Decisão", item 3 | Qualquer pessoa joga. A pessoa joga primeiro e se cadastra depois. | Só responde quem entrou e se cadastrou. O cadastro vem antes. |
| Decisão 0001, "O que continua valendo" | Jogar sem cadastro continua permitido. | Deixa de valer para a pesquisa por foto. |
| Decisão 0001, pendência "Login Google e CPF" | Sem resposta. | Respondida por delegação: a conta Google é a entrada e o CPF é o cadastro, um por conta. |
| Decisão 0002, "O que não muda" | A etapa 1 não tem cadastro por CPF; se as escolhas contam no resultado fica para a etapa do cadastro. | Conta a resposta de quem tem cadastro. As respostas dadas antes, sem conta, só passam a contar se a pessoa entrar e se cadastrar, o que liga a resposta antiga à conta. |
| `docs/security/VOTE_ABUSE_POLICY.md` | Quem apaga os dados do aparelho vira outro jogador e pode responder de novo. | Na pesquisa por foto essa porta fecha: responder exige a conta com cadastro, e a resposta é uma por conta. |
| `stages/68_photo_survey_politics/CONTEXT.md` e seguintes | O toque em "Começar" cria o jogador. | A página da pesquisa não cria mais jogador sem conta. |

## O que não muda

- Do PoliMatch só sai a resposta somada, nunca o dado de uma pessoa.
  (Alterado pela decisão 0008, de 26/11/2026: a escolha de uma pessoa aparece
  no perfil que ela mesma ligar, e só nas pesquisas que marcar.)
- O gate de publicação agregada (#177): nenhuma soma de respostas aparece.
- App online-only, mesma exposição para todas as opções de uma tela, nenhum
  resultado manipulado, compartilhamento por iniciativa da pessoa.
- Uma resposta por pessoa em cada pesquisa, sem troca depois de confirmar.
  (Alterado pela decisão 0007, de 26/11/2026: uma resposta por rodada, em
  rodadas novas enquanto houver confronto por ver.)
- O fluxo ICM e o gate humano do `AGENTS.md`. Merge e publicação pedem o sim
  do Stefan, um a um. (Em 16/11/2026 a pergunta listou os dois merges e os
  deploys de uma vez e teve um sim para o conjunto; está no HANDOFF do
  estágio 71.)

## Pendências

Nada abaixo fica liberado por esta decisão. A publicação de 16/11/2026 foi
feita com estas pendências abertas, por decisão do Stefan (o gate está no
HANDOFF do estágio 71).

- **Jurídico (#283).** Tratar CPF junto com preferência política é a primeira
  pergunta da lista para o advogado na decisão 0001, e segue sem resposta
  registrada no repositório. Com o cadastro obrigatório, toda resposta nova
  nasce ligada a uma pessoa identificável. Publicar este estágio com a
  pendência aberta é decisão do Stefan.
- **Política de privacidade (#283).** O site não tem a página. O texto de
  consentimento do cadastro descreve o tratamento, mas não é a política.
- **Menores de 18.** A faixa de idade mais baixa do protótipo é "16 a 24". Se
  o cadastro aceita 16 e 17 anos é pergunta para a mesma revisão.
- **Pedido de exclusão.** Não há tela para a pessoa apagar o cadastro. Até
  existir, o pedido é atendido à mão.
- **Conferência do CPF na Receita.** Não contratada.
- **Backup externo (#279).** Segue aberto. Com este estágio, o backup do banco
  só é completo junto com `VOTER_NETWORK_SECRET`: sem o segredo, os códigos
  dos CPFs cadastrados não servem mais para reconhecer um CPF repetido
  (`docs/ops/DR.md`).

## Referências

- `stages/71_cpf_registration/`: contexto, handoff e verificação deste estágio.
- `stages/67_photo_survey_direction/references/prototipo-pesquisa.html`: o
  protótipo aprovado em 12/11/2026, com a tela de cadastro.
