# HANDOFF — ICM 74 — Pesquisa de famosos e influenciadores — #348

Estado: `aguardando gate do merge`. Nada deste estágio está em produção.

## O que foi feito

### 74a — Registro

- Decisão 0006 (`docs/decisions/0006-famosos-com-foto-de-licenca-livre.md`):
  as duas respostas do Stefan e as dez escolhas do agente.
- `stages/74_celebrity_survey/CONTEXT.md`.
- Notas datadas no `AGENTS.md`, no `CONTEXT.md` e no `README.md`, e a seção
  "Cartas de famosos" no `CREDITS.md`.

### 74b — Cartas

- Vinte cartas, todas com a mesma moldura: marca do PoliMatch, foto, nome e
  "Foto: autor · licença". Folha: `references/cartas-famosos.jpg`.
- `output/sources.json`: para cada carta, a página do arquivo na Wikimedia
  Commons, o endereço e o SHA-1 do original, o que foi baixado, o autor e a
  licença que a página declara, a data de nascimento na Wikidata e o
  enquadramento.
- `output/sources/`: as vinte fotos como foram baixadas, 11,9 MB. Dezesseis
  são o arquivo original, e o SHA-1 de cada uma bate com o que a Commons
  informa. Quatro são a miniatura de 1280 px gerada pela Wikimedia (Juliette,
  Marina Ruy Barbosa, Alok e Wagner Moura); delas fica o hash do arquivo
  baixado, ao lado do SHA-1 do original.
- `app/scripts/build-celebrity-cards.mjs` monta as cartas e grava: o desenho
  de origem de cada uma (`output/masters/`), os dois tamanhos publicados
  (`app/public/chromas/famosos/`, 40 arquivos, 2,6 MB), o catálogo
  (`app/src/celebrity-cards.json`), o manifesto (`output/manifest.json`) e a
  página de créditos (`app/creditos.html`).
- `app/src/celebrity-cards.test.js` prende uns aos outros a pesquisa, o
  catálogo, o manifesto, a lista de origem, as fotos, os desenhos, os
  arquivos publicados e a página de créditos.

### 74c — Pesquisa

- `shared/photo-survey.js`: a pesquisa `famosos-01` ("De quem você é mais
  fã?", assunto "Famosos", 20 cartas, sorteio de 16, telas de 4, nota "Fotos
  de licença livre, com o crédito em cada carta."), entre a segunda de
  Política e a de roupas. A definição ganha o campo `people`; as duas de
  Política e a de famosos dizem que sim. A resposta pública da API não leva o
  campo.
- `app/src/photo-survey-flow.js`: o título da final é "quem fica?" quando as
  cartas são pessoas. A lista fixa de cartas da entrada continua valendo só
  para Política.
- `app/src/photo-survey-page.js`: o catálogo de famosos entra ao lado dos
  outros dois. Sem item em "Em breve", o título não aparece.
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

A parte 74c foi escrita por um agente à parte, com as escolhas dadas pelo
agente principal, que leu o que mudou nos arquivos de regra, menu e build.

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
  e o endereço dela diz "Esta pesquisa não está disponível.". Por isso a API
  vai primeiro, como nos estágios 70 e 73.

## Testes

Em 24/11/2026, no macOS:

| O quê | Quem rodou | Resultado |
|---|---|---|
| `npm run test:shared` | os dois agentes | 121 de 121 |
| `npm test --prefix app` | os dois agentes | 226 de 226 |
| `npm test --prefix back` | os dois agentes | 306 de 306 |
| `npm run build --prefix app` | agente da 74c | sem erro, três páginas |
| `app/e2e/photo-survey.mjs`, WebKit e Chromium | agente da 74c | 34 de 34 em cada |
| `app/e2e/site-shell.mjs`, Chromium, execução inteira | agente da 74c | 53 de 53 |
| `app/e2e/site-shell.mjs`, WebKit, cenário por cenário | agente da 74c | 53 de 53 |
| `app/e2e/site-shell.mjs`, WebKit, execução inteira | agente da 74c | **parou no cenário 43**, em quatro tentativas |
| `app/e2e/client-error-report.mjs`, WebKit e Chromium | agente da 74c | três páginas |
| Roteiros do servidor com PostgreSQL 16 descartável | agente da 74c | aprovados |
| Caminho inteiro de `famosos-01` no aplicativo local, servidor simulado, roteiro fora do repositório | agente principal | entrada, quatro telas, final, confirmação, resposta registrada, imagem do compartilhar, capa e créditos, sem erro de página |

O cenário 43 ("a imagem demora, falha ou perde uma carta") já existia. Pelo
relato do agente da 74c, ele passa sozinho, e a execução inteira em WebKit
para no mesmo ponto com o código da `main`, nesta máquina. O agente principal
não repetiu essa conferência. Quem decide é o CI, que roda os dois
navegadores.

O Chromium local é a versão 1187, mais antiga que a que o Playwright do
projeto pede, por um roteiro auxiliar fora do repositório.

## Como as fotos chegaram

Em 24/11/2026 o agente leu, na Wikidata e na Wikimedia Commons, os dados da
imagem principal de 36 nomes e, com o "Sim, baixa" do Stefan, baixou as 36.
Depois da oitava, o servidor de arquivos da Wikimedia respondeu 429, com
espera de dez minutos e uma mensagem pedindo o uso das miniaturas. O agente
esperou e baixou as outras 28 com oito segundos entre uma e outra, pedindo a
miniatura de 1280 px para os arquivos mais largos que isso. As 16 fotos que
não viraram carta ficaram fora do repositório.

## O elenco e as duas trocas

O Stefan recebeu uma lista de vinte nomes e dezesseis reservas. Depois de ver
as fotos, o agente trocou dois:

- **Virginia Fonseca saiu, Bianca Andrade entrou.** A foto baixada é de uma
  sessão no Senado, e a roupa traz estampado o rosto de uma criança.
- **Fernanda Torres saiu, Marina Ruy Barbosa entrou.** O crédito que a
  licença exige na carta seria o da conta oficial de um político.

Nos dois casos o agente preferiu trocar a pessoa a procurar outra foto: o
download combinado era o da foto principal de cada nome. Com outra foto,
qualquer uma das duas pode voltar.

## O que não foi conferido

- **Que cada foto é da pessoa que o nome diz.** A identidade é a que a
  Wikidata e a página do arquivo informam. O agente viu as vinte fotos, mas
  não confere rosto.
- **Que a licença declarada é verdadeira.** Pelo que a página de cada
  arquivo indica, treze das vinte são quadros de vídeo publicados no YouTube
  (doze por canais de TV, um por um podcast). O agente não abriu os vídeos
  de origem nem conferiu a licença deles.
- **Candidaturas.** Nenhuma das vinte aparece nas listas de famosos
  candidatos em 2026 que o agente leu na imprensa, que são parciais. O
  registro do TSE não foi consultado.
- **Qualidade no tamanho maior.** Quinze fotos são ampliadas na carta de
  1060 px; a de Gil do Vigor, 2,4 vezes. Na carta de 530 px a ampliação cai
  pela metade. O agente viu a folha das vinte cartas em tamanho reduzido,
  não cada carta no tamanho maior.
- **Celular de verdade, o botão real do Google e o compartilhamento real do
  aparelho.**
- **Produção.** Nada foi publicado.

## Riscos

- **Direito da pessoa retratada.** A licença livre não trata dele. Vale o que
  está em "Pendências" na decisão 0006.
- **Licença contestada.** Se a licença de uma foto mudar ou for contestada, a
  carta sai e a pesquisa fica com menos cartas: com menos de 16 o sorteio
  deixa de funcionar como está.
- **Ordem na capa.** Quem respondeu as duas pesquisas de Política e ainda não
  a de roupas passa a ver a de famosos em destaque.

## Gate humano

Pendente em 24/11/2026.

O que o Stefan já respondeu: "Sim, começa" e "Sim, baixa" (decisão 0006).

A pergunta do merge leva por extenso as escolhas de regra e de dado:

1. quem aparece (os vinte nomes, com as duas trocas);
2. é uma pesquisa de verdade, com respostas gravadas sobre pessoas reais;
3. o sorteio de 16 entre 20;
4. a ordem na capa, com o que muda para quem já respondeu;
5. as fotos entram no repositório público, com o crédito.

Merge e publicação pedem o sim dele, um a um.
