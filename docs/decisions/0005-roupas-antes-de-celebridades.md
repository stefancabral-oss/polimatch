# Decisão 0005 — Roupas antes de celebridades e influenciadores

- Data da decisão: 23/11/2026
- Quem decidiu: Stefan
- Registrado por: agente (Claude)
- Issue: #345 ([ICM 73])
- Estado: direção aprovada. Em 23/11/2026 a pesquisa de roupas de
  demonstração estava construída no estágio 73 e fora de produção. O estado
  atual está no HANDOFF do estágio.
- Altera a [decisão 0002](0002-ordem-de-construcao-e-cartas-com-moldura.md) no
  item 1 (ordem de construção). O resto dela continua valendo.

## Contexto

A decisão 0002 fixou a ordem de construção: política, depois celebridades e
influenciadores, depois roupas, com imagens criadas pelo próprio PoliMatch. A
primeira construção, a pesquisa de Política, está em produção desde
14/11/2026 (estágio 68).

Em 23/11/2026 o agente perguntou ao Stefan:

> "Passo a demonstração de roupas na frente da pesquisa de famosos?"

A mensagem em que a pergunta veio dizia, antes dela, nestas palavras: "Ela
muda a ordem que você definiu e pede imagens de roupas criadas por nós." A
mensagem trazia também o motivo do agente, que não é transcrito aqui. Em
resumo: a demonstração de roupas precisa existir antes de mostrar o formato a
qualquer marca.

Ele respondeu:

> "Sim, roupas antes"

## Decisão

1. **Ordem de construção.** Política, depois roupas, depois celebridades e
   influenciadores.

## Escolhas do agente

A resposta do Stefan cobre a ordem. Tudo o que vem abaixo é escolha do
agente, e ele pode mudar qualquer uma.

As escolhas de desenho (1, 2, 5, 6, 7, 8 e 9) se apoiam no pedido dele de não
ser parado por detalhes de desenho (decisão 0003, item 5). As escolhas 3 e 4
não são de desenho: são de regra e de dado. Elas vão a ele, com estas
palavras, no gate do merge.

1. **As peças são desenhadas por código.** As 16 peças (12 camisetas e 4
   moletons) saem de um roteiro que está no repositório. Não há foto, pessoa,
   marca de terceiros nem serviço de geração de imagem. Cada carta tem o
   desenho de origem, o roteiro que o gera e o hash de cada arquivo publicado.
2. **Sem nome de marca.** As peças têm nome descritivo ("Camiseta Onda").
   Nenhuma marca, real ou inventada, aparece.
3. **É uma pesquisa de verdade.** O código é `roupas-demo-01` e a pergunta é
   "Qual você usaria?". Valem o cadastro da decisão 0004 e uma resposta por
   pessoa. As respostas ficam gravadas como as de qualquer pesquisa, ligadas à
   conta de quem respondeu, embora as peças não existam. A pesquisa não tem
   data para fechar. A entrada dela diz "Peças de demonstração, desenhadas com
   IA pelo PoliMatch.", e cada carta traz o selo "DEMO".
4. **As 16 peças aparecem para cada pessoa.** Na Política o sorteio tira 16
   de 20 cartas. Aqui as 16 entram sempre: o sorteio decide só em que tela e
   em que posição cada uma aparece.
5. **A pesquisa de roupas vem depois das duas de Política.** A capa destaca a
   primeira pesquisa aberta que a pessoa ainda não respondeu. Para quem não
   respondeu as duas de Política, nada muda. Quem já respondeu as duas passa
   a ver a de roupas em destaque, no lugar do aviso de que respondeu todas. A
   pesquisa tem endereço próprio (`/?p=roupas-demo-01`).
6. **Mesma moldura para as 16**, como pede a decisão 0002. É uma moldura
   nova, mais simples que a das cartas de Política.
7. **"Qual fica?" no lugar de "quem fica?".** O título da tela final muda nas
   pesquisas cujo assunto não é "Política". Uma pesquisa futura sobre pessoas
   com outro assunto vai precisar rever isso.
8. **A entrada da pesquisa de roupas ilustra com três das 16 cartas dela.** A
   lista fixa de cartas da entrada, pedida por ele em 14/11/2026, continua
   valendo só para as pesquisas de Política, sem mudança.
9. **"Arte com IA".** O roteiro que desenha as cartas foi escrito por um
   agente de IA. Por isso cada carta, o catálogo e o manifesto dizem "arte
   com IA", como pede o `CREDITS.md`.

## O que muda

| Onde estava | O que dizia | O que passa a valer |
|---|---|---|
| Decisão 0002, "Decisão", item 1 | Política, depois celebridades e influenciadores, depois roupas. | Política, depois roupas, depois celebridades e influenciadores. |
| Decisão 0001, "Decisão", item 6, na nota da decisão 0002 | A mesma ordem. | A ordem nova. |
| Capa e menu, "Em breve" | "Famosos e influenciadores" e "Roupas". | Só "Famosos e influenciadores". |
| Capa, para quem respondeu as duas pesquisas de Política | "Você respondeu todas as pesquisas abertas." | A pesquisa de roupas em destaque. |

## O que não muda

- Os itens 2, 3 e 4 da decisão 0002: mesma moldura para todas as cartas de
  uma pesquisa, ninguém de fora antes de o aplicativo estar testado, e a
  construção em paralelo ao programa de maturidade (#309).
- No item 1 da decisão 0002, o que vale para roupas: imagens criadas pelo
  próprio PoliMatch, e nenhuma empresa envia foto nesta fase.
- O cadastro obrigatório da decisão 0004.
- O gate de publicação agregada (#177): nenhuma soma de respostas aparece.
- O fluxo ICM e o gate humano do `AGENTS.md`. Merge e publicação pedem o sim
  do Stefan, um a um.

## Pendências

Nada abaixo fica liberado por esta decisão.

- **O que recebe quem encomenda uma pesquisa.** Resultado completo e recortes
  (decisão 0001, item 4) não fazem parte do estágio 73. Dependem do gate #177
  e da revisão jurídica.
- **Jurídico e privacidade (#283).** Seguem abertos. A pesquisa de roupas
  grava respostas de pessoas cadastradas com CPF, como as outras.
- **Idade.** O cadastro aceita a faixa "16 a 24". Se uma pesquisa de roupas
  pode ter resposta de menores de 18 é pergunta para a mesma revisão
  (decisão 0004, "Menores de 18").
- **Chamar gente de fora.** Continua dependendo de o aplicativo estar testado
  (decisão 0002, item 3) e de um sim próprio do Stefan.
- **Fotos de peças reais.** Quando uma empresa mandar foto, entram regras
  próprias: o direito sobre a foto e sobre a imagem de quem aparecer nela.
  Fica fora deste estágio.
- **Nomes e estampas.** Não foi feita busca de marca registrada para os nomes
  das peças nem para a frase "Sem Pressa" de uma das estampas.

## Referências

- `stages/73_clothes_demo/`: contexto, handoff e verificação deste estágio.
- `app/scripts/build-clothes-cards.mjs`: o roteiro que desenha as 16 cartas.
- `stages/73_clothes_demo/references/cartas-roupas.jpg`: as 16 cartas lado a
  lado.
