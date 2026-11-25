# HANDOFF — ICM 74 — Pesquisa de famosos e influenciadores — #348

Estado: `aguardando gate do merge`. Nada deste estágio está em produção.

## O que foi feito

### 74a — Registro

- Decisão 0006 (`docs/decisions/0006-famosos-com-foto-de-licenca-livre.md`):
  as duas respostas do Stefan e as dezesseis escolhas do agente, onze de
  regra e de dado e cinco de desenho.
- `stages/74_celebrity_survey/CONTEXT.md`.
- Notas datadas no `AGENTS.md`, no `CONTEXT.md` e no `README.md`, e a seção
  "Cartas de famosos" no `CREDITS.md`.

### 74b — Cartas

- Vinte cartas, todas com a mesma moldura: marca do PoliMatch, foto, nome e
  "Foto: autor · licença". Folha: `references/cartas-famosos.jpg`.
- `output/sources.json`: para cada carta, a página do arquivo na Wikimedia
  Commons, o endereço e o SHA-1 do original, o que foi baixado, o autor e a
  licença que a página declara, o que a Commons marca sobre a revisão da
  licença, a origem fora da Commons com a licença vista nela, a data de
  nascimento na Wikidata e o enquadramento.
- `output/sources/`: as vinte fotos como foram baixadas, 11,4 MB. Quinze são
  o arquivo original, e o SHA-1 de cada uma bate com o que a Commons informa.
  Cinco são a miniatura de 1280 px gerada pela Wikimedia (Juliette, Rodrigo
  Santoro, Alok, Selton Mello e Wagner Moura); delas fica o hash do arquivo
  baixado, ao lado do SHA-1 do original.
- `app/scripts/build-celebrity-cards.mjs` monta as cartas e grava: o desenho
  de origem de cada uma (`output/masters/`), os dois tamanhos publicados
  (`app/public/chromas/famosos/`, 40 arquivos, 2,3 MB), o catálogo
  (`app/src/celebrity-cards.json`), o manifesto (`output/manifest.json`) e a
  página de créditos (`app/creditos.html`). As contas do enquadramento e o
  texto dos créditos ficam em `app/scripts/celebrity-cards-lib.mjs`, que o
  teste também usa.
- `app/src/celebrity-cards.test.js` prende uns aos outros a pesquisa, o
  catálogo, o manifesto, a lista de origem, as fotos, os desenhos, os
  arquivos publicados e a página de créditos. O desenho de origem de cada
  carta é comparado inteiro com o que o roteiro gera: a moldura é a mesma
  nas vinte, sem nada a mais.

### 74c — Pesquisa

- `shared/photo-survey.js`: a pesquisa `famosos-01` ("De quem você é mais
  fã?", assunto "Famosos", 20 cartas, sorteio de 16, telas de 4, nota "Fotos
  de licença livre."), entre a segunda de Política e a de roupas. A definição
  ganha o campo `people`; as duas de Política e a de famosos dizem que sim. A
  resposta pública da API não leva o campo.
- `app/src/photo-survey-flow.js`: o título da final é "quem fica?" quando as
  cartas são pessoas. A lista fixa de cartas da entrada continua valendo só
  para Política.
- `app/src/photo-survey-page.js`: o catálogo de famosos entra ao lado dos
  outros dois. Sem item em "Em breve", o título não aparece. A entrada de uma
  pesquisa com foto creditada mostra "Ver os créditos" ao lado da nota.
- `app/src/share-choice.js`: a imagem do compartilhar ganha duas linhas no
  pé, com o autor e a licença das fotos que estão nela e o endereço da página
  de créditos. Só quando as cartas levam foto de outra pessoa: nas pesquisas
  de Política e de roupas a imagem não muda.
- `app/src/site-menu.js`: "Em breve" vazio; "Créditos das fotos" depois de
  "Como funciona".
- `app/creditos.html` entra no build (`app/vite.config.js`,
  `app/src/credits-page.js`), no mapa do site e nos estilos.
- `.github/workflows/ci.yml`: o filtro de caminhos ganha
  `stages/74_celebrity_survey/output/**`.
- Testes de `shared/`, do app e do servidor ajustados e ampliados; roteiros
  de navegador com quatro cenários novos (entrada de famosos, o caminho
  inteiro com "quem fica?", a página de créditos, a capa sem "Em breve").
- `back/scripts/photo-survey-smoke.mjs`: a pesquisa de roupas passa a ser
  achada pelo código, e não pela posição na lista.

A maior parte da 74c foi escrita por um agente à parte, com as escolhas dadas
pelo agente principal. O agente principal leu o que mudou em
`shared/photo-survey.js`, `photo-survey-flow.js`, `site-menu.js`,
`vite.config.js`, no mapa do site e no `ci.yml`, e escreveu o crédito na
imagem do compartilhar e o caminho para os créditos na entrada. Não leu, linha
a linha, o que o outro agente mudou em `photo-survey-page.js`, nos estilos,
nos testes e nos roteiros de navegador.

## Como as fotos chegaram

Em 24/11/2026 o agente leu, na Wikidata e na Wikimedia Commons, os dados da
primeira imagem listada no item de 36 nomes e, com o "Sim, baixa" do Stefan,
baixou as 36. Depois da oitava, o servidor de arquivos da Wikimedia respondeu
429, com espera de dez minutos e uma mensagem pedindo o uso das miniaturas. O
agente esperou e baixou as outras 28 com oito segundos entre uma e outra,
pedindo a miniatura de 1280 px para os arquivos mais largos que isso. As 16
fotos que não viraram carta ficaram fora do repositório.

Para as vinte que viraram carta, o arquivo é o primeiro que o item da pessoa
lista na Wikidata. Para Anitta, Ludmilla e Rodrigo Santoro, a Wikidata
marcava nesse dia outra imagem como preferida.

## O elenco e as trocas

O Stefan recebeu uma lista de vinte nomes e dezesseis reservas, "para trocar
quem tiver foto ruim". Dezesseis dos vinte ficaram. Quatro saíram, e quatro
reservas entraram: Ana Maria Braga, Iza, Rodrigo Santoro e Selton Mello.

| Saiu | Por quê |
|---|---|
| Virginia Fonseca | A foto é de uma sessão no Senado, e a roupa traz estampado o rosto de uma criança. |
| Fernanda Torres | O crédito que a licença exige seria o da conta oficial de um político. |
| Luan Santana | A página da foto no Flickr mostra a marca de domínio público, e a Commons registra CC0: são coisas diferentes. Um microfone cobre parte do rosto. |
| Luciano Huck | A Commons diz que a imagem é um recorte de outra foto. Aparecem a mão de outra pessoa no ombro dele e um crachá com texto legível. |

Três reservas foram tentadas e não ficaram: Bianca Andrade (o arquivo tem
título genérico e a descrição cita quatro pessoas, então quem aparece no
recorte só a Wikidata diz), Marina Ruy Barbosa (a leitura independente
apontou a procedência mais fraca do conjunto: obra própria declarada por uma
conta sem página de usuário) e Carlinhos Maia (o rosto de outra pessoa
aparece atrás dele).

Nos casos em que o problema era a foto, o agente trocou a pessoa em vez de
procurar outra foto: o download combinado era o de uma foto por nome. Com
outra foto, qualquer uma delas pode voltar.

Os recortes de Rodrigo Santoro e de Selton Mello foram fechados depois da
segunda leitura independente: no tamanho maior, o primeiro recorte deixava
ver parte do rosto de outra pessoa ao fundo (num cartaz e numa pessoa
desfocada).

As fotos e as cartas que saíram continuam nos dois primeiros commits do PR,
que são públicos: as de Luan Santana, Luciano Huck, Bianca Andrade e Marina
Ruy Barbosa no primeiro (`bc37f7c`), e os recortes anteriores de Rodrigo
Santoro e de Selton Mello no segundo (`a448cba`). Um merge que junta os
commits as deixa fora da `main`; os commits do PR continuam alcançáveis no
GitHub. Reescrever o histórico do branch antes do merge pede o sim do
Stefan e, sozinho, não torna os commits antigos inalcançáveis no GitHub.

## O que foi conferido na origem

Em 24/11/2026, por leitura das páginas, sem baixar imagem:

- **Wikimedia Commons, as vinte.** A página de cada arquivo existe, e autor,
  licença e SHA-1 do original são os registrados em `sources.json`.
- **YouTube, as quinze que são quadro de vídeo.** O agente abriu a página do
  vídeo que cada arquivo da Commons dá como origem. As quinze mostravam
  "License: Creative Commons Attribution license (reuse allowed)". Um vídeo
  de controle, sem essa licença, não mostrava a linha. Doze são do canal
  Multishow, uma do Record Goiás, uma do TNT Sports Brasil e uma do
  Attractive Mindset Network. A página do YouTube não diz a versão da
  licença.
- **Flickr, uma.** A página da foto de Alok mostra CC BY 2.0.
- **Obra própria, quatro.** Juliette, Rodrigo Santoro, Selton Mello e Wagner
  Moura são fotos que o autor publicou direto na Commons. Não há origem fora
  dela para conferir.

O que a própria Commons marcava nesse dia:

- **Revisão de licença:** nove arquivos revisados; quatro esperando revisão
  (Ludmilla, Luísa Sonza, Tatá Werneck e Pabllo Vittar); sete sem categoria
  de revisão (Gusttavo Lima, Casimiro, Alok e as quatro obras próprias). O
  arquivo de Anitta está entre os revisados e, ao mesmo tempo, numa categoria
  de envios de um usuário que pedem revisão.
- **Bruna Marquezine:** a Commons avisa que a licença do modelo da página (CC
  BY 4.0) difere da que está nos dados estruturados do arquivo. A carta usa a
  do modelo da página.
- **Aviso de direitos de personalidade:** onze dos vinte arquivos trazem o
  aviso padrão da Commons de que a pessoa retratada pode ter direitos sobre o
  uso da imagem.

## O que aparece nas fotos além da pessoa

O agente olhou dezoito cartas no tamanho publicado de 530 px e, no de 1060
px, as de Rodrigo Santoro e de Selton Mello. Não viu rosto de outra pessoa
em nenhuma. A leitura independente olhou as vinte no tamanho de 1060 px e
também não viu. O que se vê:

- microfone em Anitta (com parte de uma etiqueta), Xuxa, Iza e Alok;
- parte de um letreiro atrás de Gusttavo Lima, e uma tatuagem com texto;
- uma forma escura e desfocada no canto de baixo da carta de Wagner Moura;
- atrás de Rodrigo Santoro, o cabelo de uma mulher num cartaz desfocado, sem
  o rosto dela;
- fundo desfocado atrás de Selton Mello, sem rosto;
- uma escultura atrás de Ana Maria Braga;
- dois logotipos legíveis no moletom de Casimiro, na borda de baixo, um
  deles de um canal de TV;
- cenário de estúdio ou de evento nas demais.

A foto de Casimiro é de 2017, pela descrição na Commons, e a de Rodrigo
Santoro, de 2012.

## O que muda para quem já usa

- **Capa.** A pesquisa de famosos aparece em "Mais pesquisas", entre a
  segunda de Política e a de roupas.
- **Quem respondeu as duas de Política e não a de roupas** passa a ver a de
  famosos em destaque; respondida essa, a de roupas.
- **Quem respondeu as três que existem** via "Você respondeu todas as
  pesquisas abertas." e passa a ver a de famosos em destaque. As telas de
  resposta registrada dessas três oferecem "Próxima pesquisa".
- **"Em breve"** some da capa e do menu.
- **Menu:** quatro pesquisas, Início, Como funciona e Créditos das fotos.
- **Se o app for publicado antes da API,** o menu lista a pesquisa de famosos
  e o endereço dela diz "Esta pesquisa não está disponível."; nessa janela,
  "Próxima pesquisa" leva a uma capa sem nada para responder. Por isso a API
  vai primeiro, como nos estágios 70 e 73.

## Testes

Em 24/11/2026, no macOS, no estado dos arquivos do terceiro commit
(`dfc142c`), rodados pelo agente principal:

| O quê | Resultado |
|---|---|
| `npm run test:shared` | 121 de 121 |
| `npm test --prefix app` | 229 de 229 |
| `npm test --prefix back` | 306 de 306 |
| `npm run build --prefix app` | sem erro, três páginas |
| `app/e2e/site-shell.mjs`, Chromium, execução inteira | 53 de 53 |
| `app/e2e/photo-survey.mjs`, Chromium | 34 de 34 |
| `app/e2e/client-error-report.mjs`, Chromium | três páginas |
| `app/e2e/photo-survey.mjs`, WebKit | 34 de 34 |
| `app/e2e/client-error-report.mjs`, WebKit | três páginas |
| `app/e2e/site-shell.mjs`, WebKit, execução inteira | **42 cenários e parou no 43º** |
| `app/e2e/site-shell.mjs`, WebKit, do 43º ao 53º, um a um | 11 de 11 |
| Caminho inteiro de `famosos-01` no aplicativo local, servidor simulado, roteiro fora do repositório | entrada, quatro telas, final, confirmação, resposta registrada, imagem do compartilhar com o crédito, capa e créditos, sem erro de página |

O 43º cenário ("a imagem demora, falha ou perde uma carta") já existia. Nesta
máquina, a execução inteira em WebKit para nele por estouro de tempo ao abrir
a página, e ele passa quando roda sozinho. A leitura independente viu o mesmo
num build da `main`. Em 23/11/2026 a mesma execução inteira passou nesta
máquina (HANDOFF do estágio 73): o comportamento é instável aqui, não um
defeito fixo. No CI dos três primeiros commits deste PR (`bc37f7c`,
`a448cba` e `dfc142c`) os nove trabalhos passaram, entre eles os roteiros de
navegador em Chromium e em WebKit.

O Chromium local é o 1187, mais antigo que o 1193 que o Playwright do projeto
pede. Os roteiros rodaram nele por um roteiro auxiliar fora do repositório.
O build dos roteiros usou `VITE_GOOGLE_CLIENT_ID` de teste, como o CI.

Não rodados pelo agente principal: os roteiros do servidor com PostgreSQL. O
agente da 74c os rodou, num PostgreSQL 16 descartável, antes das mudanças
feitas depois da leitura independente; o CI os roda a cada commit.

## O que não foi conferido

- **Que cada foto é da pessoa que o nome diz.** A identidade é a que a
  Wikidata e a página do arquivo informam. O agente viu as vinte fotos, mas
  não confere rosto.
- **Que o quadro vem do vídeo indicado, e que o canal tinha o direito de
  licenciar tudo o que aparece nele.** O agente leu a licença na página do
  vídeo; não assistiu aos vídeos.
- **A licença das quatro obras próprias,** além do que a Commons declara.
- **Candidaturas.** Nenhuma das vinte está registrada como candidata no
  catálogo eleitoral do repositório, e a Wikidata não registrava cargo,
  partido nem candidatura para nenhuma. O registro do TSE não foi consultado.
- **Qualidade no tamanho maior.** Quinze fotos são ampliadas na carta de
  1060 px; a de Ana Maria Braga, 2,64 vezes. Na carta de 530 px a ampliação
  cai pela metade. O agente viu dezoito cartas no tamanho de 530 px e duas
  no de 1060 px; a leitura independente viu as vinte no de 1060 px.
- **Se o crédito na imagem do compartilhar basta para cada licença.** Ele traz
  autor e licença das fotos da imagem e o endereço da página de créditos; o
  título e o endereço de cada foto ficam só na página.
- **Tamanho dos toques na página de créditos com outra fonte.** A altura dos
  links foi medida só com as fontes do macOS. O estilo que impede a quebra no
  nome da licença depende de `rel="noopener license"` na página gerada.
- **Celular de verdade, o botão real do Google e o compartilhamento real do
  aparelho.**
- **Produção.** Nada foi publicado.

## Riscos

- **Direito da pessoa retratada.** A licença livre não trata dele. Vale o que
  está em "Pendências" na decisão 0006.
- **Licença contestada.** Se a licença de uma foto mudar ou for contestada, a
  carta sai do aplicativo, mas o arquivo continua no histórico do repositório
  público. Com menos de 16 cartas o sorteio deixa de funcionar como está.
- **Ordem na capa.** Quem respondeu as duas pesquisas de Política e ainda não
  a de roupas passa a ver a de famosos em destaque.
- **Tamanho.** O estágio acrescenta cerca de 14 MB ao repositório: 11,4 MB de
  fotos de origem, 2,3 MB de cartas publicadas e as duas folhas de
  referência.

## Leitura independente

Feita por um agente que não escreveu o código, somente leitura, sobre o
primeiro commit do PR (`bc37f7c`). **Segurou a pergunta do merge.** O código,
os testes e o CI se sustentaram; os achados eram do registro e da procedência
das fotos:

- a frase que dizia que a lista não tinha pessoas conhecidas por mandato ou
  candidatura era contrariada pelo catálogo eleitoral do próprio repositório;
- a resposta à Q3 da #277 estava estendida às cartas de famosos como se o
  Stefan tivesse decidido isso;
- "imagem principal na Wikidata" não valia para duas fotos;
- a Commons marcava pendências de revisão de licença que o registro não
  citava;
- a oferta das cartas de licença CC BY-SA nos mesmos termos não estava entre
  as escolhas que vão ao gate;
- o crédito na carta não se lê nos tamanhos em que o aplicativo a mostra, e
  alguns créditos não eram os que a Commons pede;
- o que aparece nas fotos além da pessoa só estava descrito para as duas que
  tinham sido trocadas;
- frases do registro além da evidência, datadas errado ou faltando;
- brechas no teste das cartas: das 33 alterações que ele fez numa cópia,
  várias passavam sem o teste notar.

O que o revisor conferiu e se sustentou: as contagens; página, autor, licença
e SHA-1 dos vinte arquivos de então na API da Commons; datas de nascimento na
Wikidata; a geração das cartas numa cópia, igual byte a byte; os testes de
unidade; o build; os roteiros em WebKit.

O que mudou em resposta, tudo neste PR: o registro; quatro cartas trocadas e
os recortes mais fechados; a conferência da licença no YouTube e no Flickr; o
crédito pelo campo de atribuição da Commons; o título da obra na página de
créditos; o crédito na imagem do compartilhar e o caminho para os créditos na
entrada; e o teste das cartas, que passou a conferir o enquadramento, o
endereço da licença, a página de créditos inteira e a diferença entre
original e miniatura.

**Segunda passada,** sobre o segundo commit (`a448cba`), pelo mesmo revisor.
Dos nove achados da primeira, seis estavam resolvidos e três em parte. Ela
**segurou de novo**, por um ponto: um critério de aceite escrito naquele
commit ("nenhuma carta mostra o rosto de outra pessoa") não valia, no tamanho
maior, para duas das quatro cartas novas. Apontou também:

- as fotos trocadas continuam nos commits públicos do PR;
- o teste ainda não via mudanças no desenho de origem fora de três trechos;
- pontos menores do registro (a miniatura de Iza, o que o catálogo diz de
  Felipe Neto, a marca nas cartas de licença CC BY-SA, a legenda da folha de
  telas, o CI);
- duas escolhas a tratar como de regra e de dado: onde o crédito aparece e a
  permanência das quatro fotos com revisão de licença pendente;
- o crédito na imagem do compartilhar encolhia demais com quatro créditos
  diferentes.

O que ela conferiu e se sustentou: os campos das vinte na API da Commons; as
quinze páginas do YouTube, que ela abriu por conta própria e mostravam a
mesma licença; a geração das cartas numa cópia, igual byte a byte; a imagem
do compartilhar das pesquisas de Política e de roupas, igual byte a byte
antes e depois; a entrada com o caminho para os créditos em telas de 320 a
390 px; os testes de unidade, o build e os roteiros em WebKit.

O que mudou em resposta, no terceiro commit: os dois recortes; o teste
compara o desenho de origem inteiro; o crédito na imagem do compartilhar
passa a usar duas linhas equilibradas, com um teste sobre o catálogo; e o
registro.

**Terceira passada,** sobre o terceiro commit (`dfc142c`), pelo mesmo
revisor: **não segurou.** O ponto das duas cartas estava resolvido: ele olhou
as vinte no tamanho de 1060 px e não viu rosto de outra pessoa. Os outros
pontos da segunda passada estavam resolvidos, salvo acertos pequenos de
texto, feitos no quarto commit: uma contagem que mudou com o recorte novo
(quinze fotos ampliadas, não catorze), o número de alterações do teste na
segunda passada (50, não 47, erro do próprio revisor), o que cada um viu em
que tamanho e a frase sobre reescrever o histórico. Ele refez as alterações
no teste das cartas: de 52, dez passam sem o teste notar, e nove delas
estão na lista do que o teste não prova; a décima (o tamanho da letra
mudado no desenho e no manifesto juntos, dentro da faixa aceita) entrou na
lista no quarto commit.

O quarto commit só tem esses acertos de texto e não passou por nova
leitura.

Uma observação do revisor sobre o registro: a tabela de testes do terceiro
commit foi escrita antes de as últimas execuções terminarem. Os números
escritos foram conferidos depois com o resultado das execuções e não
mudaram.

## Gate humano

Pendente em 24/11/2026.

O que o Stefan já respondeu: "Sim, começa" e "Sim, baixa" (decisão 0006).

A pergunta do merge leva por extenso as escolhas de regra e de dado, as onze
primeiras da decisão 0006:

1. quem aparece (os vinte nomes, com as quatro trocas);
2. oito das vinte estão no catálogo do jogo eleitoral anterior;
3. é uma pesquisa de verdade, com respostas gravadas sobre pessoas reais;
4. o sorteio de 16 entre 20;
5. a ordem na capa, com o que muda para quem já respondeu;
6. a leitura do agente de que a resposta à Q3 da #277 cobre estas fotos;
7. as fotos entram no repositório público, com o crédito, e as que foram
   trocadas continuam nos commits do PR;
8. três cartas ficam sob a mesma licença da foto;
9. a página de créditos é pública e pode ser achada por buscador;
10. onde o crédito aparece;
11. ficam quatro fotos cuja licença a Commons ainda não revisou.

Merge e publicação pedem o sim dele, um a um.
