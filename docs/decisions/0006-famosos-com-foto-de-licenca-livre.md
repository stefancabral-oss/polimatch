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

A issue do estágio 73 (#345, pesquisa de roupas de demonstração) foi fechada
em 24/11/2026. A construção seguinte, pela decisão 0005, é a de celebridades
e influenciadores.

O repositório tem dez cartas da "Edição Inaugural" (estágio 23), feitas com
IA a partir de fotografias. Só três delas são de artistas ou influenciadores.
O formato mostra 16 cartas a cada pessoa (estágio 68), e a decisão 0002, item
2, pede a mesma moldura para todas as cartas de uma pesquisa. O agente desta
sessão não gera retrato com IA.

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

A mesma mensagem dizia que não havia decisão nova sobre fotografia de pessoa
pública a tomar para começar, porque ele já tinha respondido à Q3 da #277 em
12/11/2026. Ele não comentou esse ponto. O que o agente tira disso está na
escolha 6, abaixo, como escolha do agente.

## Decisão

1. **O estágio começa.** A pesquisa de famosos e influenciadores é a
   construção em curso.
2. **As cartas são feitas com fotografia de licença livre.** Cada carta usa
   uma fotografia da Wikimedia Commons, dentro de uma moldura desenhada por
   código, igual para todas. Nenhum retrato é gerado ou editado por IA.
3. **O download.** A fotografia de cada um dos 36 nomes da lista, da
   Wikimedia Commons.

A lista de nomes estava na mesma mensagem, e ele não a comentou. O agente a
trata como proposta sua, não como decisão dele: ela vai por extenso à
pergunta do gate do merge.

## Escolhas do agente

Tudo o que vem abaixo é escolha do agente, e o Stefan pode mudar qualquer
uma.

As escolhas 1 a 9 não são de desenho: são de regra e de dado. Por isso a
pergunta do gate do merge as apresenta por extenso. As escolhas 10 a 15 são
de desenho e se apoiam no pedido dele de não ser parado por detalhes de
desenho (decisão 0003, item 5). A pergunta e a resposta dele ficam no HANDOFF
do estágio.

### De regra e de dado

1. **Quem aparece.** Vinte pessoas: Anitta, Ivete Sangalo, Ludmilla, Luísa
   Sonza, Xuxa, Tatá Werneck, Ana Maria Braga, Juliette, Bruna Marquezine,
   Iza, Pabllo Vittar, Gusttavo Lima, Rodrigo Santoro, Alok, Selton Mello,
   Whindersson Nunes, Felipe Neto, Casimiro, Wagner Moura e Gil do Vigor.
   Dezesseis estavam na lista de vinte que o Stefan recebeu. Ana Maria Braga,
   Iza, Rodrigo Santoro e Selton Mello vieram das reservas, no lugar de
   Virginia Fonseca, Fernanda Torres, Luan Santana e Luciano Huck, depois que
   o agente viu as fotos e conferiu a origem delas (os motivos estão no
   HANDOFF do estágio). Pela Wikidata, em 24/11/2026, todas nasceram até
   1998 e nenhuma tem registro de falecimento. A identidade de cada foto é a
   que a Wikidata e a Wikimedia Commons informam.
2. **Oito das vinte estão no catálogo do jogo eleitoral anterior.** O
   arquivo `shared/elections-2026.json`, do produto que saiu do site em
   14/11/2026, lista Anitta, Ludmilla, Pabllo Vittar, Gusttavo Lima,
   Whindersson Nunes, Casimiro e Wagner Moura no grupo `influencia_debate`, e
   Felipe Neto no grupo `politica`. O mesmo arquivo registra que Gusttavo
   Lima ensaiou uma candidatura à Presidência em 2025 e desistiu, e que
   Felipe Neto não é candidato. Nenhuma das vinte está registrada ali como
   candidata em 2026, e a Wikidata não registrava, em 24/11/2026, cargo,
   partido nem candidatura para nenhuma. O registro de candidaturas do TSE
   não foi consultado. O agente manteve as oito porque estavam na lista que o
   Stefan recebeu; a escolha de manter ou trocar é dele.
3. **É uma pesquisa de verdade, sobre pessoas reais.** O código é
   `famosos-01` e a pergunta é "De quem você é mais fã?". Valem o cadastro da
   decisão 0004 e uma resposta por pessoa. As respostas ficam gravadas como
   as de qualquer pesquisa, ligadas à conta de quem respondeu. A pesquisa não
   tem data para fechar. A pergunta é positiva; nenhuma pergunta negativa
   sobre pessoa real.
4. **Sorteio de 16 entre 20**, como nas pesquisas de Política: cada pessoa vê
   16 das 20 cartas, em quatro telas de quatro.
5. **A pesquisa de famosos vem depois das duas de Política e antes da de
   roupas.** A capa destaca a pesquisa que a pessoa deixou pela metade ou,
   sem isso, a primeira aberta que ela ainda não respondeu. Quem já respondeu
   as duas de Política e não respondeu a de roupas passa a ver a de famosos
   em destaque, e não mais a de roupas. Quem já respondeu as três passa a ver
   a de famosos, no lugar do aviso de que respondeu todas. A pesquisa de
   roupas continua aberta, com o mesmo endereço. A de famosos tem endereço
   próprio (`/?p=famosos-01`).
6. **A condição da Q3 vale para estas fotos.** A resposta do Stefan à Q3 da
   #277, como está na decisão 0001: "as fotos de pessoas públicas ficam
   enquanto o produto for gratuito. A regularização, com retrato oficial ou
   de licença livre ou com autorização, passa a ser condição para vender ou
   monetizar. O registro de autor, licença e origem por foto continua, para
   deixar essa regularização pronta. [...] Fotos de agência ou de veículo
   ficam a confirmar antes de decidir. O compartilhamento da escolha leva a
   foto para a rede social com a marca do PoliMatch, o que pesa nessa
   regularização." O agente lê essa resposta como cobrindo as cartas de
   famosos, e lê a ressalva sobre agência e veículo como dirigida a foto sem
   licença. É leitura do agente: quinze das vinte fotos são quadros de vídeo
   publicados por canais de TV ou de podcast, e uma é de uma agência de
   notícias de governo, todas com licença livre dada por quem publicou. Ele
   não disse que a ressalva não se aplica a elas.
7. **As fotos entram no repositório como foram baixadas.** Para cada uma
   ficam registrados a página na Wikimedia Commons, o autor e a licença que a
   página declara, e o hash do arquivo. O repositório é público e passa a
   redistribuir essas fotos, com o crédito. Uma foto tirada depois sai do
   aplicativo, mas continua no histórico do repositório e nas cópias dele.
8. **Três cartas ficam sob a mesma licença da foto.** As fotos de Juliette,
   Selton Mello e Wagner Moura têm licença CC BY-SA 4.0, que pede que a obra
   derivada seja oferecida nos mesmos termos. A página de créditos e o
   `CREDITS.md` dizem que essas três cartas podem ser reutilizadas assim: a
   moldura e a placa do nome dessas três cartas ficam abertas a reuso por
   qualquer pessoa, nesses termos. O agente não avaliou se a imagem do
   compartilhar que contém uma dessas cartas cai na mesma obrigação. O
   repositório não tem arquivo de licença para o código.
9. **A página de créditos é pública e entra no mapa do site.** Ela lista os
   vinte nomes, o autor de cada foto e a licença, e pode ser achada por
   buscador.

### De desenho

10. **Mesma moldura para as vinte**, como pede a decisão 0002. É uma moldura
    nova, da mesma família da das cartas de roupa: a marca do PoliMatch, a
    foto, o nome e o crédito da foto.
11. **Onde o crédito aparece.** Cada carta traz "Foto: autor · licença", mas
    nos tamanhos em que o aplicativo mostra a carta essa linha não se lê. O
    crédito que se lê está em três lugares: na página "Créditos das fotos"
    (`/creditos.html`), que tem autor, licença, título e endereço de origem
    de cada foto e diz o que foi mudado; no menu e na entrada da pesquisa,
    que levam a essa página; e em duas linhas no pé da imagem do
    compartilhar, com o autor e a licença das fotos que estão nela e o
    endereço da página.
12. **"Quem fica?" nas pesquisas de pessoas.** A decisão 0005 (escolha 7)
    deixou anotado que uma pesquisa sobre pessoas com outro assunto pediria
    rever o título da final. A definição de cada pesquisa passa a dizer se as
    cartas são pessoas; Política e famosos dizem que sim, roupas diz que não.
13. **"Em breve" sai da capa e do menu.** "Famosos e influenciadores" era o
    único item. Sem item, o título "Em breve" não aparece.
14. **A entrada da pesquisa ilustra com três das vinte cartas dela,**
    sorteadas a cada visita. A lista fixa de cartas da entrada, pedida pelo
    Stefan em 14/11/2026, continua valendo só para as pesquisas de Política.
15. **O que se diz sobre IA.** A foto não é editada: só é posicionada,
    recortada pela janela da moldura e redimensionada. O roteiro que desenha
    a moldura e monta a carta foi escrito por um agente de IA. A página de
    créditos e o manifesto dizem as duas coisas (`CREDITS.md`).

Uma nota sobre o download: para arquivo mais largo que 1280 px foi baixada a
miniatura de 1280 px que a própria Wikimedia gera. O servidor dela limita o
download de originais e pede, na mensagem de erro, o uso das miniaturas.

## O que muda

| Onde estava | O que dizia | O que passa a valer |
|---|---|---|
| Capa e menu, "Em breve" | "Famosos e influenciadores". | Nenhum item; o título "Em breve" não aparece. |
| Capa, para quem respondeu as duas pesquisas de Política e não a de roupas | A pesquisa de roupas em destaque. | A pesquisa de famosos em destaque. |
| Capa, para quem respondeu as três pesquisas | "Você respondeu todas as pesquisas abertas." | A pesquisa de famosos em destaque. |
| Menu | Início, Como funciona. | Entra "Créditos das fotos". |
| Título da final | "Quem fica?" só quando o assunto é "Política". | "Quem fica?" quando as cartas são pessoas. |
| Imagem do compartilhar | Sem crédito de foto. | Duas linhas de crédito no pé, só quando as cartas levam foto de outra pessoa. |

## O que não muda

- As decisões 0001 a 0005. Em particular: mesma moldura para todas as cartas
  de uma pesquisa, ninguém de fora antes de o aplicativo estar testado, e o
  cadastro obrigatório.
- As duas pesquisas de Política e a de roupas, nas regras e nas cartas, e a
  imagem do compartilhar delas.
- O gate de publicação agregada (#177): nenhuma soma de respostas aparece.
- O fluxo ICM e o gate humano do `AGENTS.md`. Merge e publicação pedem o sim
  do Stefan, um a um.

## Pendências

Nada abaixo fica liberado por esta decisão.

- **Direito da pessoa retratada.** A licença livre trata do direito de quem
  fez a foto, não do direito da pessoa que aparece nela. A revisão jurídica
  (#283) continua aberta, e a regularização antes de vender ou monetizar
  continua sendo condição (decisão 0001, "Fotos").
- **A licença é a declarada.** Autor e licença são os que a página de cada
  arquivo na Wikimedia Commons informa. O que o agente conferiu fora dela, e
  o que a própria Commons ainda marca como pendente, está no HANDOFF do
  estágio. Se a licença de uma foto mudar ou for contestada, a carta sai do
  aplicativo.
- **Idade de quem responde.** O cadastro aceita a faixa "16 a 24". Se uma
  pesquisa sobre pessoas reais pode ter resposta de menores de 18 é pergunta
  para a revisão jurídica (decisão 0004, "Menores de 18").
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
