# Decisão 0003 — A pesquisa por foto vira a capa do PoliMatch

- Data da decisão: 14/11/2026
- Quem decidiu: Stefan
- Registrado por: agente (Claude), a pedido dele
- Issue: #331 ([ICM 69])
- Estado: em produção desde 14/11/2026 (estágio 69, #331): a pesquisa é a capa
  do site e as páginas do produto anterior saíram.
- Altera a [decisão 0001](0001-pesquisa-de-preferencia-por-foto.md) no item 7 e
  o contexto do estágio 68 nos pontos listados em "O que muda". A
  [decisão 0002](0002-ordem-de-construcao-e-cartas-com-moldura.md) continua
  valendo inteira.

## Contexto

Em 14/11/2026 a pesquisa de Política foi publicada em endereço próprio, fora do
menu e do sitemap (estágio 68, #324). O Stefan testou no celular e, no mesmo
dia, pediu a troca da capa.

Palavras dele, transcritas de conversa por voz:

> "Preciso que você deixe esse /pesquisa.html no lugar daquilo que tem hoje.
> Preciso que reconstrua as páginas que existem substituindo pela nossa ideia.
> Arrumando os menus. Deixando no nosso padrão."

Depois de receber a folha com as telas desenhadas
(`stages/69_survey_home/references/capa-nova-proposta.jpg`):

> "Pode seguir, vai pra frente. Pode ir construindo. [...] Termina de construir
> o aplicativo, tira o que é velho, deixa novo, pra gente poder deixar isso
> pronto, pra já colocar as outras opções e começar a rodar já com mais
> maturidade."

## Decisão

1. **A capa é a pesquisa aberta.** `polimatch.com.br` abre direto na entrada
   da pesquisa aberta.
2. **O produto anterior sai do site.** A capa do jogo (rodada diária, ranking,
   coleção e o menu de baixo), "Duelos da corrida", "Quem disse isso?", "Fato
   ou fake?" e a página "Como seu jogo é confirmado". Quem abre um endereço
   antigo é levado ao início.
3. **Menu no padrão novo.** As pesquisas (a aberta e as próximas, marcadas
   "em breve"), a página "Como funciona" e a entrada com Google.
4. **Um padrão só.** O visual das telas novas (decisão 0001, item 8, com a
   decisão 0002) passa a valer para o site inteiro.
5. **Detalhes de desenho por delegação.** O Stefan pediu para não ser parado
   por eles: o agente escolhe, mostra pronto, e ele pode mudar qualquer um
   depois. Merge e publicação continuam pedindo o sim dele, um a um.

## O que muda

| Onde estava | O que dizia | O que passa a valer |
|---|---|---|
| Decisão 0001, "Decisão", item 7 | Os jogos de leitura e a parte cívica e de notícias ficam no ar sem trabalho novo. | Saem do site. O código sai da `main` em PR próprio e continua no histórico do Git. |
| Decisão 0001, tabela, linha "Capa presidencial" | A entrada passa a ser a próxima pesquisa aberta. | Confirmado: é o que o estágio 69 constrói. |
| `stages/68_photo_survey_politics/CONTEXT.md`, entrega 68e e critério de publicação | A capa ganha uma entrada para a pesquisa, e a rodada diária continua acessível. | A capa passa a ser a pesquisa. A segunda parte da 68e (entrada na capa e sitemap) é absorvida pelo estágio 69. |
| `CONTEXT.md`, "Decisões atuais aprovadas" | Descrevem o que está no ar. | Viram histórico no dia em que a troca for publicada. |
| [ICM 43] #285, destino da edição Eleições 2026 | Em aberto. | Na interface, a edição sai do site. O que fazer com os dados dela continua na #285. |
| [ICM 44] #286, edição padrão do quiz | Edição 1 como padrão e as demais como arquivo. | Perde o objeto na interface: o quiz sai do site. |

## O que não muda

- Os itens 1 a 6 e 8 da decisão 0001 e a decisão 0002 inteira.
- O servidor e o banco. Nada é apagado, as rotas do jogo anterior continuam
  respondendo e as gravações seguem imutáveis. Este estágio não toca em
  `back/` nem em `shared/`.
- O gate de publicação agregada (#177), a política de integridade do voto e a
  regra de que nenhum resultado somado aparece para o público.
- O fluxo ICM e o gate humano do `AGENTS.md`.
- As pendências de fotos e jurídicas da decisão 0001. O repositório continua
  sem afirmar enquadramento jurídico para a pesquisa por foto.

## Consequências a observar

- **A pesquisa fica à vista de qualquer visitante.** Até aqui ela estava
  escondida. As condições de publicação que o estágio 68 listou para "antes
  de divulgar a pessoas de fora" pesam na publicação da troca: política de
  privacidade (#283) e backup externo (#279). Decidir publicar com elas
  abertas é do Stefan.
- **A frase "Não é pesquisa eleitoral" sai junto com a capa antiga.** Ela era
  exibida no produto anterior. O texto que a substitui depende da revisão
  jurídica (Q5 da #277); o site novo não exibe enquadramento nenhum.
- **Página de Privacidade.** Só entra no menu com texto aprovado (#283).
- **Entrada com Google.** Só existia na capa antiga. Passa a ficar no menu;
  sem ela, quem esbarra na cota de participações por rede não teria saída.
- **Respostas de ensaio.** A pesquisa `politica-2026-01` recebeu respostas de
  teste. Abrir a pesquisa de lançamento com código próprio, zerada, é proposta
  do agente para o passo de publicação.
- **Endereços antigos.** Redirecionam para o início com resposta temporária
  (302), para a volta ser possível se algum dia for decidida.
- **Aplicativo instalado.** Quem instalou o PoliMatch na tela de início passa
  a abrir a pesquisa.

## Referências

- `stages/69_survey_home/`: contexto, plano, handoff e verificação.
- `stages/69_survey_home/references/capa-nova-proposta.jpg`: a folha com as
  telas desenhadas que o Stefan recebeu em 14/11/2026.
