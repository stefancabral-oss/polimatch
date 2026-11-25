# Decisão 0006 — Famosos e influenciadores com fotografia de licença livre

- Data da decisão: 24/11/2026
- Quem decidiu: Stefan
- Registrado por: agente (Claude)
- Issue: #348 ([ICM 74])
- Estado: em 24/11/2026, em construção no estágio 74, sem merge e sem
  publicação.
- Não altera decisão anterior. Segue a ordem da
  [decisão 0005](0005-roupas-antes-de-celebridades.md): política, roupas,
  celebridades e influenciadores.

## Contexto

O estágio 73 (pesquisa de roupas de demonstração) foi fechado em 24/11/2026.
A construção seguinte, pela decisão 0005, é a de celebridades e
influenciadores.

O repositório tem dez cartas da "Edição Inaugural" (estágio 23), feitas com
IA a partir de fotografias. Só três delas são de artistas ou influenciadores.
Uma pesquisa pede pelo menos 16 cartas com a mesma moldura (decisão 0002,
item 2). O agente desta sessão não gera retrato com IA.

Em 24/11/2026 o agente fez duas perguntas ao Stefan.

A primeira:

> "Começo a pesquisa de famosos e influenciadores?"

Ele respondeu:

> "Sim, começa"

A segunda veio numa mensagem que propunha, nestas palavras, "foto de licença
livre da Wikimedia dentro de uma moldura feita por código, igual para todas",
e dizia a favor ("cada foto fica com autor e licença registrados, sem rosto
gerado por IA"), contra ("as fotos são mais simples que as cartas de IA.
Muitas são quadros de programas de TV, em resolução baixa") e o limite ("a
licença livre resolve o direito do fotógrafo, não o da pessoa retratada"). A
mensagem listava vinte nomes como elenco proposto e dezesseis como reservas,
"para trocar quem tiver foto ruim", e descrevia o download: "a foto principal
de cada um desses 36 nomes, da Wikimedia Commons, cerca de 34 MB no total". A
pergunta era:

> "Baixo as fotos e monto as cartas dos famosos? Responda "sim, baixa" ou
> "prefiro com IA"."

Ele respondeu:

> "Sim, baixa"

## Decisão

1. **O estágio começa.** A pesquisa de famosos e influenciadores é a
   construção em curso.
2. **As cartas são feitas com fotografia de licença livre.** Cada carta usa
   uma fotografia da Wikimedia Commons, dentro de uma moldura desenhada por
   código, igual para todas. Nenhum retrato é gerado ou editado por IA.
3. **O download.** A fotografia principal de cada um dos 36 nomes da lista,
   da Wikimedia Commons.

A lista de nomes estava na mesma mensagem, e ele não a comentou. O agente a
trata como proposta sua, não como decisão dele: ela vai por extenso à
pergunta do gate do merge.

## Escolhas do agente

Tudo o que vem abaixo é escolha do agente, e o Stefan pode mudar qualquer
uma.

As escolhas de desenho (5, 6, 7, 8 e 10) se apoiam no pedido dele de não ser
parado por detalhes de desenho (decisão 0003, item 5). As escolhas 1, 2, 3, 4
e 9 não são de desenho: são de regra e de dado. Por isso a pergunta do gate
do merge as apresenta por extenso. A pergunta e a resposta dele ficam no
HANDOFF do estágio.

1. **Quem aparece.** Vinte pessoas, todas adultas e sem registro de
   falecimento na Wikidata na data das cartas: Anitta, Ivete Sangalo,
   Ludmilla, Luísa Sonza, Xuxa, Tatá Werneck, Bianca Andrade, Juliette, Bruna
   Marquezine, Marina Ruy Barbosa, Pabllo Vittar, Gusttavo Lima, Luan
   Santana, Alok, Luciano Huck, Whindersson Nunes, Felipe Neto, Casimiro,
   Wagner Moura e Gil do Vigor. Dezoito estavam na lista de vinte que o
   Stefan recebeu; Bianca Andrade e Marina Ruy Barbosa vieram das reservas,
   no lugar de Virginia Fonseca e Fernanda Torres, depois que o agente viu as
   fotos (os motivos estão no HANDOFF do estágio). A lista foi feita sem
   pessoas conhecidas por mandato ou candidatura: Política é outro assunto.
   Nenhuma das vinte aparece nas listas de famosos candidatos em 2026 que o
   agente leu na imprensa, e essas listas são parciais; o registro de
   candidaturas do TSE não foi consultado. A identidade de cada foto é a que
   a Wikidata e a Wikimedia Commons informam.
2. **É uma pesquisa de verdade, sobre pessoas reais.** O código é
   `famosos-01` e a pergunta é "De quem você é mais fã?". Valem o cadastro da
   decisão 0004 e uma resposta por pessoa. As respostas ficam gravadas como
   as de qualquer pesquisa, ligadas à conta de quem respondeu. A pesquisa não
   tem data para fechar. A pergunta é positiva; nenhuma pergunta negativa
   sobre pessoa real.
3. **Sorteio de 16 entre 20**, como nas pesquisas de Política: cada pessoa vê
   16 das 20 cartas, em quatro telas de quatro.
4. **A pesquisa de famosos vem depois das duas de Política e antes da de
   roupas.** A capa destaca a pesquisa que a pessoa deixou pela metade ou,
   sem isso, a primeira aberta que ela ainda não respondeu. Quem já respondeu
   as duas de Política e não respondeu a de roupas passa a ver a de famosos
   em destaque, e não mais a de roupas. A pesquisa de roupas continua aberta,
   com o mesmo endereço. A de famosos tem endereço próprio
   (`/?p=famosos-01`).
5. **Mesma moldura para as vinte**, como pede a decisão 0002. É uma moldura
   nova, da mesma família da das cartas de roupa: a marca do PoliMatch, a
   foto, o nome e o crédito da foto.
6. **O crédito vai na carta.** Cada carta traz "Foto: autor · licença", e
   por isso o crédito acompanha a imagem do compartilhar. A página nova
   "Créditos das fotos" (`/creditos.html`), no menu, lista autor, licença e
   endereço de origem de cada foto e diz o que foi mudado.
7. **"Quem fica?" nas pesquisas de pessoas.** A decisão 0005 (escolha 7)
   deixou anotado que uma pesquisa sobre pessoas com outro assunto pediria
   rever o título da final. A definição de cada pesquisa passa a dizer se as
   cartas são pessoas; Política e famosos dizem que sim, roupas diz que não.
8. **"Em breve" sai da capa e do menu.** "Famosos e influenciadores" era o
   único item. Sem item, o título "Em breve" não aparece.
9. **As fotos entram no repositório como foram baixadas.** Para cada uma
   ficam registrados o endereço da página na Wikimedia Commons, o autor e a
   licença que a página declara, e o hash do arquivo. O repositório é público
   e passa a redistribuir essas fotos, com o crédito. Para arquivo mais largo
   que 1280 px foi baixada a miniatura de 1280 px que a própria Wikimedia
   gera: o servidor dela limita o download de originais e pede, na mensagem
   de erro, o uso das miniaturas.
10. **O que se diz sobre IA.** A foto não é editada: só é posicionada,
    recortada pela janela da moldura e redimensionada. O roteiro que desenha
    a moldura e monta a carta foi escrito por um agente de IA. A página de
    créditos e o manifesto dizem as duas coisas (`CREDITS.md`).

## O que muda

| Onde estava | O que dizia | O que passa a valer |
|---|---|---|
| Capa e menu, "Em breve" | "Famosos e influenciadores". | Nenhum item; o título "Em breve" não aparece. |
| Capa, para quem respondeu as duas pesquisas de Política e não a de roupas | A pesquisa de roupas em destaque. | A pesquisa de famosos em destaque. |
| Menu | Início, Como funciona. | Entra "Créditos das fotos". |
| Título da final | "Quem fica?" só quando o assunto é "Política". | "Quem fica?" quando as cartas são pessoas. |

## O que não muda

- As decisões 0001 a 0005. Em particular: mesma moldura para todas as cartas
  de uma pesquisa, ninguém de fora antes de o aplicativo estar testado, e o
  cadastro obrigatório.
- As duas pesquisas de Política e a de roupas, nas regras e nas cartas.
- O gate de publicação agregada (#177): nenhuma soma de respostas aparece.
- O fluxo ICM e o gate humano do `AGENTS.md`. Merge e publicação pedem o sim
  do Stefan, um a um.

## Pendências

Nada abaixo fica liberado por esta decisão.

- **Direito da pessoa retratada.** A licença livre trata do direito de quem
  fez a foto. A situação das fotografias de pessoas públicas no produto segue
  a resposta do Stefan à Q3 da #277, de 12/11/2026: ficam enquanto o produto
  for gratuito e são regularizadas antes de vender. As cartas de famosos
  entram nessa mesma condição, e a revisão jurídica (#283) continua aberta.
- **A licença é a declarada.** Autor e licença são os que a página de cada
  arquivo na Wikimedia Commons informa. A origem de cada foto não foi
  conferida. Várias são quadros de vídeo publicados com licença livre por
  canais de TV; se a licença de origem mudar ou for contestada, a foto sai.
- **Chamar gente de fora.** Nenhuma pessoa retratada, agência ou marca foi
  contatada. Continua dependendo de um sim próprio do Stefan.
- **O que recebe quem encomenda uma pesquisa.** Fora deste estágio (decisão
  0001, item 4; #177).
- **As fotografias que já estão no site (#284).** Este estágio não mexe
  nelas.

## Referências

- `stages/74_celebrity_survey/`: contexto, handoff e verificação deste
  estágio.
- `stages/74_celebrity_survey/output/sources.json`: de onde veio cada foto.
- `app/scripts/build-celebrity-cards.mjs`: o roteiro que monta as cartas.
- `stages/74_celebrity_survey/references/cartas-famosos.jpg`: as vinte cartas
  lado a lado.
