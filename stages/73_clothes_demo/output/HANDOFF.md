# HANDOFF — [ICM 73] Pesquisa de roupas de demonstração

## Status

- Estado: `publicado`. As partes 73a, 73b e 73c foram mescladas (PR #346,
  commit `2cfa3e9`) e a 73d aconteceu em 23/11/2026, com API e app publicados
  nesse commit (ver "Publicação (73d)"). Em 24/11/2026, quando este registro
  foi escrito, a issue seguia aberta: fechar pede o sim do Stefan.
- Issue: #345
- Branch: `icm/73-clothes-demo`, feita sobre a `main` em `0b30d64`.
- PR: #346
- Em produção desde 23/11/2026.
- Origem: em 23/11/2026, à pergunta do agente "Passo a demonstração de roupas
  na frente da pesquisa de famosos?", o Stefan respondeu "Sim, roupas antes".
  A resposta cobre a ordem de construção. O resto é escolha do agente.

## Entregue (73a — registro)

- Decisão 0005, `docs/decisions/0005-roupas-antes-de-celebridades.md`: a
  ordem de construção passa a ser política, roupas, celebridades e
  influenciadores. O registro separa a decisão dele das nove escolhas do
  agente.
- Notas nas decisões 0001 e 0002, no `AGENTS.md`, no `README.md` e no
  `CONTEXT.md` da raiz.

## Entregue (73b — cartas)

- 16 peças: 12 camisetas e 4 moletons. Mesma moldura, mesmo fundo e mesmo
  tamanho na carta; muda a cor e a estampa. Cada carta traz o selo "DEMO", o
  tipo, o nome e a legenda "Peça de demonstração · Arte com IA".
- `app/scripts/build-clothes-cards.mjs` desenha tudo. Não há foto, pessoa,
  preço, marca de terceiros nem serviço de geração de imagem. As estampas são
  formas simples (onda, sol, raio, cacto, planeta, olho, chama, montanha,
  pipa, flor, xadrez, a frase "SEM PRESSA", estrela, arco, folha e lua).
- O roteiro foi escrito por um agente de IA. Por isso a carta, o catálogo e o
  manifesto dizem "arte com IA" (`CREDITS.md`, "Chromas e artes editadas").
- O texto das cartas é desenhado com a Helvetica Neue do macOS da máquina que
  gerou. A fonte não vai para o repositório nem para o site, só a imagem.
- Os arquivos gravados saíram do Chromium headless shell 1187 (o que estava
  na máquina) e do cwebp 1.6.0.
- O roteiro grava: o desenho de origem de cada carta em `output/masters/`
  (SVG); os dois tamanhos publicados em `app/public/chromas/roupas/` (WebP de
  530 e de 1060 de largura); o catálogo `app/src/clothes-cards.json`; o
  manifesto `output/manifest.json`, com o hash de cada arquivo; e a folha
  `references/cartas-roupas.jpg`.
- `app/src/clothes-cards.test.js` prende uns aos outros a pesquisa, o
  catálogo, o manifesto, os desenhos de origem e os arquivos publicados:
  código, nome, caminho, hash, edição, os dois tamanhos e o tamanho gravado
  em cada arquivo. Confere que o texto do selo "DEMO" e o da legenda estão no
  desenho de origem (presentes, não se estão visíveis), que o manifesto diz
  como a arte foi feita, que não sobra arquivo nas duas pastas e que nenhum
  código repete os de Política. Ele não prova que cada WebP é o desenho do
  seu SVG: isso pediria gerar de novo, e o texto depende da fonte da máquina.

## Entregue (73c — pesquisa)

- `shared/photo-survey.js`: a pesquisa `roupas-demo-01`, assunto "Roupas",
  pergunta "Qual você usaria?", 16 cartas, sorteio de 16 em telas de 4. Vem
  depois das duas de Política. A definição e a visão pública ganham o campo
  opcional `note`.
- `app/src/photo-survey-page.js` e `photo-survey-flow.js`: a página conhece os
  dois catálogos; a entrada de uma pesquisa cujo assunto não é "Política"
  ilustra com três cartas dela mesma (`entryCardIdsFor`); a entrada mostra a
  nota; o título da final é "Entre elas, qual fica?" fora da Política
  (`finalTitleFor`).
- `app/src/site-menu.js`: "Roupas" sai de "Em breve".
- Em `back/` só entram testes: um teste da rota de definição com as três
  pesquisas e um bloco no roteiro `back/scripts/photo-survey-smoke.mjs`. A
  lógica do servidor e as tabelas não mudam.
- `.github/workflows/ci.yml`: o filtro de caminhos inclui
  `stages/73_clothes_demo/output/**`.

Textos novos na tela: "Roupas", "Qual você usaria?", "Peças de demonstração,
desenhadas com IA pelo PoliMatch." e "Entre elas, qual fica?".

## O que muda para quem já usa o site

- Quem ainda não respondeu as duas pesquisas de Política e não começou a de
  roupas: a capa continua destacando uma de Política. A de roupas aparece em
  "Mais pesquisas" e no menu.
- Quem já respondeu as duas: a capa passa a destacar a pesquisa de roupas,
  onde antes dizia "Você respondeu todas as pesquisas abertas.". As telas de
  resposta registrada das duas pesquisas de Política passam a oferecer
  "Próxima pesquisa" no lugar de "Ver pesquisas".

## Merge — 23/11/2026

Com a instrução do Stefan ("Sim, mescla"), transcrita em "Human gate":

- PR #346 mesclado em `2cfa3e9`. A árvore do merge é a do commit `a4ba4e1`,
  o último do PR.
- No commit `a4ba4e1` todos os trabalhos do CI passaram, e o `ci-gate`
  também. O `browser-smoke` em WebKit levou 32 minutos, quase todos na
  instalação do navegador; no commit `09d6095` o trabalho inteiro tinha
  levado menos de 5. No log da execução anterior, cancelada, o download dos
  pacotes do Ubuntu estava lento.
- Enquanto o CI rodava, o agente principal executou localmente, em WebKit e
  no mesmo commit, `app/e2e/site-shell.mjs` (49 cenários) e
  `app/e2e/photo-survey.mjs` (34 cenários): passaram.
- O CI do push do merge na `main` (commit `2cfa3e9`, a mesma árvore) ainda
  rodava quando os dois deploys aconteceram: faltava o `browser-smoke` em
  WebKit, outra vez lento. Terminou depois, por volta de 03:17 UTC, com todos
  os trabalhos e o `ci-gate` verdes. Na 72d esse CI tinha terminado antes do
  deploy; aqui, não.

## Publicação (73d) — 23/11/2026

Com a instrução do Stefan ("Sim, publica"), transcrita em "Human gate".
Horários em UTC, já no dia 24. Em Brasília, a cópia do banco e os dois
deploys foram entre 23:53 e 23:58 de 23/11; o vigia foi até 00:03, e a
resposta dele ao pedido de teste veio por volta da meia-noite.

- **Antes (02:51), de fora:** capa, saúde da API e as duas pesquisas de
  Política respondiam 200; a pesquisa de roupas e as 32 imagens das cartas de
  roupa, 404.
- **Cópia do banco (02:53):** `pg_dump` no contêiner do banco, saída 0:
  `/tmp/pre-deploy-20261123.dump`, 614.010 bytes, 31 tabelas (uma entrada de
  dados por tabela, vazia ou não). A contagem de linhas das 31 tabelas foi
  gravada antes do deploy.
- **API (02:54 a 02:55):** publicada no commit `2cfa3e9`, em 21 s. No log,
  `database_ready` às 02:55:23 com `resetApplied: false`, depois `listening`.
  Uma busca por "error", "failed", "fatal" e "falha", sem diferenciar
  maiúsculas de minúsculas, nas 131 linhas que o painel mostrava não achou
  nenhuma. De fora, a cada
  5 s, a saúde respondeu 200 nas quatro leituras, e a rota da pesquisa de
  roupas passou de 404 a 200 às 02:55:32.
- **Banco depois da API:** as mesmas 31 tabelas. Trinta com a mesma contagem;
  `abuse_quota_counters` foi de 55 para 1. Pelo código, é a poda que a API
  faz ao subir, dos contadores com mais de oito dias. Nenhuma tabela nova.
  Respostas da pesquisa de roupas: 0.
- **App (02:57 a 02:58):** publicado no commit `2cfa3e9`, em 24 s, build de
  2026-11-24T02:57:49Z. De fora, a cada 5 s, a capa respondeu 200 nas seis
  leituras.
- **Vigia:** um roteiro leu a capa e a saúde da API a cada 3 s, de 02:52 a
  03:03. Estava previsto para 25 minutos e foi parado pelo agente depois de
  11. Nenhuma leitura falhou.
- As imagens do app e da API foram construídas pelo painel de deploy. O
  agente não as construiu nem inspecionou.
- O commit publicado é o que o painel de deploy registrou. `version.json`
  segue com `sha: "unknown"` (#287).

Conferido de fora depois dos dois deploys, só por GET:

- Capa, "Como funciona" e `/?p=roupas-demo-01`: 200.
- As três pesquisas respondem 200 na API. A de roupas vem com o assunto, a
  pergunta, a nota, 16 cartas, sorteio de 16 e `status: open`. As duas de
  Política vêm com a nota vazia.
- As 32 imagens das cartas de roupa respondem 200, e o hash de cada uma é o
  do manifesto.
- Os dois arquivos JS que a capa referencia (`main-vjn7p00_.js` e
  `site-menu-Dtz1zF8k.js`) trazem, juntos, `roupas-demo-01`, "Qual você
  usaria?", a nota, "Entre elas, qual fica?" e os endereços das cartas de
  roupa. Isso mostra o que está nos arquivos, não o comportamento na tela.

Entre a API nova e o app novo passaram cerca de dois minutos e meio. Pelo
código, nesse intervalo o app antigo só lista as duas pesquisas que conhece.
É o esperado, não algo que o agente tenha observado.

O que o agente não fez: não abriu o site em navegador nem tocou em carta em
produção; não fez pedido de escrita (nenhum sorteio, nenhuma resposta); não
abriu a aba de variáveis de nenhum serviço nem alterou configuração.

Depois da publicação, a mensagem do agente ao Stefan dava o endereço direto
da pesquisa de roupas e terminava assim: "A pesquisa de roupas funcionou no
seu celular? Abra o endereço, responda e toque em Compartilhar; depois me
diga "funcionou" ou "deu problema" e o que apareceu." Menos de três minutos
depois ele respondeu: "Funcionou". Era uma das duas respostas oferecidas. Ele
não disse o que testou, em que aparelho, nem o que apareceu. O registro não
afirma que houve teste em celular.

No contêiner do banco ficaram cinco cópias, todas com dado pessoal: as
quatro anteriores e a de 23/11. Apagar ou guardar fora é decisão do Stefan
(#279). Os dois arquivos de contagem que o agente criou foram apagados.

Visto de passagem, sem mexer: durante a publicação, no painel de deploy, a
chave "Autodeploy" aparecia ligada nos dois serviços. Às 02:51, nove minutos depois
do merge do PR #346, a produção ainda estava como antes; disso o agente
conclui que o merge não disparou deploy. O `docs/ops/RELEASE.md` descreve o
deploy manual "com o autodeploy desligado".

O registro feito na hora está na issue #345.

## Não entregue / pendente

- Em 24/11/2026 faltava fechar a issue #345, o que pede o sim do Stefan.
- O que recebe quem encomenda uma pesquisa (resultado, recortes): fora deste
  estágio.
- O título e a descrição da página (`app/index.html`) dizem "Quem você
  prefere?" em qualquer endereço, inclusive no da pesquisa de roupas. Já era
  assim para a segunda pesquisa de Política. Não foi mexido.
- O aviso por extenso só aparece na entrada da pesquisa. Nas outras telas e
  na imagem do compartilhar, o aviso é o selo "DEMO" de cada carta, que é
  pequeno: na grade de quatro cartas o texto dele fica com cerca de 5 a 6 px,
  e na imagem do compartilhar ele se lê na carta escolhida e não nas outras
  três. O texto da imagem não fala em demonstração. Quem usa leitor de tela
  só ouve o aviso na entrada.

## Testes executados

Todos em 23/11/2026. A parte 73c foi escrita por um agente à parte ("agente
da ligação"); o agente principal revisou o que ele mudou.

Rodados pelo agente principal, no macOS, depois dos ajustes das duas
leituras independentes:

- `npm run test:shared`: 119 de 119.
- `npm test --prefix app`: 218 de 218.
- `npm test --prefix back`: 306 de 306.
- `npm run build --prefix app`: sem erro.
- O caminho inteiro da pesquisa de roupas no aplicativo local, com servidor
  simulado, por um roteiro fora do repositório: entrada, quatro telas, final
  ("Entre elas, qual fica?"), confirmação, resposta registrada, imagem do
  compartilhar e capa, sem erro de página. As capturas de
  `references/telas-roupas.jpg` vêm dessa execução.
- A entrada da pesquisa de roupas em cinco tamanhos de tela: não rola em
  390×844, 375×667, 360×640 e 320×568; em 320×480 rola 23 px, com o botão
  "Começar" inteiro na tela. A nota ocupa duas linhas nesses tamanhos.

No CI do PR, visto pelo agente principal:

- No commit `09d6095`, anterior aos ajustes, todos os trabalhos passaram,
  entre eles `browser-smoke` em Chromium e em WebKit e a integração com
  PostgreSQL.
- No commit `3e4511c`, com os ajustes da primeira leitura, sete trabalhos
  passaram, entre eles `browser-smoke` em Chromium e a integração com
  PostgreSQL. O `browser-smoke` em WebKit ficou parado na instalação do
  navegador, antes de rodar código do projeto. O agente principal cancelou a
  execução à mão; por isso o `ci-gate` daquele commit aparece como falha.
- No commit `3c09121`, com os ajustes da segunda leitura, aconteceu o mesmo:
  sete trabalhos passaram, o WebKit parou na instalação do navegador e a
  execução foi cancelada à mão.
- No commit `a4ba4e1`, o último, todos os trabalhos passaram (ver "Merge").

Rodados só pelo agente da ligação, antes dos ajustes, segundo o relato dele:

- `app/e2e/site-shell.mjs`: 49 cenários, em Chromium e em WebKit (eram 46).
- `app/e2e/photo-survey.mjs`: 34 cenários, em Chromium e em WebKit.
- `npm run test:photo-survey --prefix back` e `npm run test:registration
  --prefix back`, num PostgreSQL 16 descartável.

Localmente, a máquina não tinha a versão do Chromium que o Playwright do
projeto pede: os roteiros de navegador rodaram em Chromium numa versão mais
antiga, por um roteiro auxiliar fora do repositório, e em WebKit, direto.

## Leitura independente

Duas passadas, somente leitura, por agentes que não escreveram o código.

### Primeira, no commit `09d6095`

Segurou o merge por um ponto do registro e apontou ajustes.

- **O que segurou:** o registro dizia que a capa "continua abrindo em
  Política". Não é o que o código faz para quem já respondeu as duas
  pesquisas de Política: essa pessoa passa a ver a de roupas em destaque.
  Corrigido no registro, no comentário do código e na issue; o comportamento
  não mudou.
- **Condicional:** o parágrafo da decisão 0005 sobre o que a pergunta dizia.
  Foi reescrito com a frase exata da mensagem e com o aviso de que o motivo
  está resumido.
- **Ajustes feitos:** "pedido" virou "resposta" onde ele só respondeu; as
  escolhas 3 e 4 da decisão 0005 saíram de "detalhe de desenho" e vão a ele
  no gate; entraram na lista a ilustração da entrada e a declaração de IA; o
  teste das cartas ficou mais apertado; a chama foi redesenhada, simétrica;
  o selo "DEMO" entrou em cada carta; a fonte deixou de ser a de interface
  do sistema e passou a ser a Helvetica Neue, que também vem com o macOS; a
  nota da entrada passou a dizer "desenhadas com IA".
- **O que ele conferiu:** os três conjuntos de teste de unidade, o CI no
  mesmo commit, os 16 desenhos refeitos a partir do roteiro (idênticos, byte
  a byte, aos gravados), os hashes e os tamanhos dos 32 arquivos, e que o
  servidor valida a resposta contra o sorteio gravado.
- **O que ele não conferiu:** que cada WebP é o desenho do seu SVG, busca de
  marca registrada, celular de verdade e produção.

### Segunda, no commit `3e4511c`

Sem bloqueio no conteúdo. Conferiu que o ponto que segurava o merge foi
corrigido em todos os lugares. Conferiu também que a frase citada na decisão
0005 bate, palavra por palavra, com o texto da mensagem que o agente
principal lhe passou; ele não viu a conversa.

- **O que ele conferiu:** os três conjuntos de teste de unidade (119, 218 e
  306); os roteiros de navegador em WebKit, num build local (49 e 34
  cenários); a entrada em cinco tamanhos de tela; e uma geração completa das
  cartas numa cópia, na mesma máquina, que saiu igual, byte a byte, aos 32
  arquivos, ao catálogo, ao manifesto e aos desenhos gravados. Fez 25
  alterações de teste numa cópia para ver o que o teste das cartas pega.
- **Ajustes feitos depois dela:** o teste das cartas passou a prender o selo
  "DEMO" e a legenda ao desenho de origem; a estrela do moletom mudou de cor
  (um azul-marinho sobre cinza lembrava, de longe, o emblema de um time
  americano); números e frases do registro que tinham ficado para trás; o
  que vai ao gate ficou igual em todos os documentos.
- **O que ficou como está:** o tamanho do selo "DEMO" (ver "Não entregue");
  o resumo do motivo na decisão 0005, sem a parte comercial.
- **O que ele não conferiu:** quem rodou o quê, os roteiros de navegador em
  Chromium, os testes com PostgreSQL, busca de marca registrada, os termos de
  uso da Helvetica Neue, celular de verdade e produção.

### Conferência do commit `3c09121`

O mesmo revisor leu só o que mudou depois da segunda passada. Sem bloqueio no
conteúdo. Rodou de novo os três conjuntos de teste de unidade e os roteiros
de navegador em WebKit, gerou as cartas de novo numa cópia (iguais, byte a
byte, com o Chromium headless shell 1187 e o cwebp 1.6.0) e fez dez
alterações de teste: o teste das cartas pega a falta do texto do selo, da
legenda e da edição, e não pega um selo presente mas invisível. Pediu que
este HANDOFF dissesse com exatidão o que ele conferiu sobre a frase citada, e
isso foi feito. O commit seguinte, `a4ba4e1`, só mexe em texto do registro e
num comentário de teste.

### Revisão automática no PR (Codex)

A revisão automática apontou, no commit `d1f25fa`, que faltavam o HANDOFF e
a verificação do estágio. Os dois entraram no commit `09d6095`. A conversa
foi respondida e resolvida no PR.

## Não verificado

- Os termos de uso da Helvetica Neue em imagem publicada.
- Busca de marca registrada para os nomes das peças e para "Sem Pressa".
- Pelo agente, em produção: nenhuma tela, nenhum sorteio e nenhuma resposta;
  o botão real do Google e o compartilhamento real do aparelho.
- Celular de verdade. Do teste pedido ao Stefan só se sabe a palavra
  "Funcionou".

## Riscos conhecidos

- **Respostas de verdade sobre peças que não existem.** A pesquisa grava
  respostas de pessoas cadastradas, ligadas à conta, sem data para fechar.
- **API e app precisam ir juntos, a API primeiro.** Com a API antiga, as
  listas da capa do app novo mostram só as duas pesquisas de Política, mas o
  menu ainda lista a de roupas, e o endereço dela diz que a pesquisa não está
  disponível (há cenário de navegador).
- **Gerar as cartas de novo em outra máquina pode mudar os arquivos.** O
  teste confere os arquivos gravados.
- **"De Política" é o assunto da pesquisa.** A lista fixa da entrada e o
  "quem fica?" dependem de `subject` ser "Política". Uma pesquisa de
  celebridades vai precisar rever isso.
- **Menores de 18.** O cadastro aceita a faixa "16 a 24" (pendência da
  decisão 0004).
- As pendências de privacidade (#283) e de backup (#279) continuam abertas.

## Decisões tomadas

Do Stefan: roupas antes de celebridades e influenciadores.

Do agente, listadas na decisão 0005: peças desenhadas por código; sem nome
de marca; pesquisa de verdade, que grava respostas; as 16 cartas para cada
pessoa; a pesquisa de roupas depois das duas de Política; moldura nova, mais
simples; "qual fica?" na final; a ilustração da entrada com cartas da própria
pesquisa; "arte com IA" na carta e na nota.

Do agente, fora da decisão 0005: a linha no filtro de caminhos do CI.

## Próximo passo exato

1. Em 24/11/2026 faltava fechar a issue #345, o que pede o sim do Stefan.

## Human gate

- Decisão: `aprovado` para o merge e para a publicação. Em 24/11/2026 o
  fechamento da issue seguia pendente.
- Responsável: Stefan
- Observação:
  - **Ordem de construção (23/11/2026).** À pergunta "Passo a demonstração de
    roupas na frente da pesquisa de famosos?", ele respondeu: "Sim, roupas
    antes".
  - **Merge (23/11/2026).** A mensagem do agente trazia, por extenso, três
    escolhas do agente: a pesquisa é de verdade e grava a resposta de quem
    tem cadastro com CPF, ligada à conta, sobre peças que não existem, sem
    data para fechar; as 16 peças aparecem para cada pessoa; e a capa muda
    para quem já respondeu as duas pesquisas de Política. A pergunta foi
    "Mesclo o PR 346 quando o CI do último commit ficar verde?". Ele
    respondeu: "Sim, mescla". O merge só foi feito depois de o CI passar. A
    transcrição está no PR #346.
  - **Publicação (23/11/2026).** À pergunta "Faço a cópia do banco e publico
    a API e o app?", que listava os três passos nessa ordem, ele respondeu:
    "Sim, publica". Foi um sim para o conjunto, não um por passo.
