# HANDOFF — [ICM 70] Capa com várias pesquisas, suas escolhas e compartilhar

## Status

- Estado: `concluído`. As partes 70a a 70d foram mescladas (PR #335, commit `59ca9a1`) e a 70e aconteceu em 16/11/2026: API e app foram publicados nesse commit. O registro também está na issue #334.
- Issue: #334
- Branch: `icm/70-more-surveys`. Foi feita sobre a da limpeza (PR #333); com a #333 mesclada em `e220a96`, em 16/11/2026, foi refeita sobre a `main`, sem conflito e sem mudança de conteúdo.
- PR: #335
- Em produção desde 16/11/2026. O compartilhar deste estágio foi trocado no mesmo dia pelo do estágio 72 (#338).

## Entregue (70a — regras)

- `shared/photo-survey.js`: cada pesquisa tem `subject`, que entra na visão pública. Entra a segunda pesquisa, `politica-2026-02`, "Em quem você confia mais?", com as mesmas 20 cartas, sorteio de 16 em telas de 4.
- Nenhuma mudança em `back/src`: o servidor já guardava sorteio e resposta por pesquisa. O smoke do servidor passou a conferir que o mesmo jogador responde as duas e que uma não mexe na outra.

## Entregue (70b — página por pesquisa)

- A página vale para qualquer pesquisa. `/?p=<código>` abre a entrada dela; um código desconhecido cai na capa.
- Tocar em "Começar" na capa põe a pesquisa no endereço, para a recarga voltar a ela.
- As escolhas guardadas no aparelho já eram por pesquisa; os pedidos à API passaram a usar a pesquisa da tela.

## Entregue (70c — capa e menu)

- A capa lê a definição de cada pesquisa (uma leitura por pesquisa, sem identidade) e põe em destaque a primeira aberta que a pessoa ainda não respondeu neste aparelho. Abaixo: "Suas escolhas", "Mais pesquisas" e "Em breve".
- "Suas escolhas": para o que este aparelho sabe respondido pela identidade atual, a capa busca a resposta no servidor e mostra a carta e o nome. Tocar leva à tela da resposta.
- Respondidas todas as abertas, a capa diz isso. Sem nenhuma aberta, também. Uma pesquisa fechada sai do destaque e aparece como "Fechada".
- Uma pesquisa que a pessoa deixou pela metade, se ainda estiver aberta, vira o destaque, com "Continuar". A capa não redireciona; se a pesquisa fecha, a capa destaca outra.
- Se a definição de alguma pesquisa não chega, a capa avisa e oferece tentar de novo, em vez de mostrar uma lista pela metade.
- Outra aba entra ou sai da conta, ou a capa volta do histórico do navegador: ela se refaz, sem gravar nada.
- Uma pesquisa que o servidor não conhece some da capa: é o que protege a publicação se o app for ao ar antes da API.
- As três linhas do formato saíram da entrada (estão em "Como funciona"); ficou a frase "Sua escolha só é registrada quando você confirmar.".
- O menu lista cada pesquisa pela pergunta, com o endereço dela, e ganhou "Início".

## Entregue (70d — compartilhar)

- Na tela de resposta registrada: "Compartilhar" (para o leitor de tela, "Compartilhar minha escolha") e "Próxima pesquisa" (ou "Ver pesquisas", quando não há outra sem resposta). Os dois últimos levam à capa, que decide o destaque. Os textos são curtos porque em tela baixa os dois botões ficam lado a lado.
- `app/src/share-choice.js`: a imagem (1080×1350, JPEG) com "Minha escolha", o nome, a carta, a pergunta e "Responda em polimatch.com.br"; o texto; e o endereço da pesquisa.
- A imagem é montada quando a tela aparece, para o toque abrir o compartilhamento do aparelho na hora. Sem suporte a arquivo vai o texto com o endereço; sem compartilhamento, o endereço é copiado e a tela avisa. Fechar a folha de compartilhar não é erro.
- Nada é compartilhado sem o toque, e compartilhar não fala com a API.

## Publicação (70e) — 16/11/2026

Com a instrução do Stefan ("Sim, mescla e publica"), transcrita em "Human gate":

- PR #333 (limpeza, 69d) mesclado em `e220a96`, com a mesma árvore do commit `94b9bfb`; PR #335 (este estágio) mesclado em `59ca9a1`, com a mesma árvore do commit `2cb8b0f`. Os dois commits tinham o `ci-gate` verde.
- Cópia do banco antes da API: `/tmp/pre-deploy-20261116.dump` no contêiner do banco, 607.784 bytes, 29 tabelas com dados.
- API publicada no commit `59ca9a1` (25 s). No log do boot, `database_ready` com `resetApplied: false`. De fora, lendo a cada 5 s, nenhuma leitura falhou; a segunda pesquisa passou de 404 a 200.
- Contagem das tabelas antes e depois da API: 28 das 29 idênticas (votos, jogadores, sorteios e respostas da pesquisa incluídos). A diferença é `abuse_quota_counters`, de 69 para 55: a limpeza dos contadores com mais de 8 dias que o servidor faz ao iniciar.
- App publicado no commit `59ca9a1` (37 s), build de 2026-11-16T21:49:43Z. De fora, nenhuma leitura falhou.
- Conferido de fora, só por leitura: as duas pesquisas respondem com assunto e pergunta; o pacote da capa nova traz "Mais pesquisas", "Suas escolhas", a segunda pergunta, o compartilhar e o "Continuar"; `/?p=politica-2026-02` e "Como funciona" respondem 200; os endereços antigos seguem redirecionando.

O agente não fez pedido de escrita em produção. Não foram conferidos por ele o compartilhar num celular de verdade nem o botão real do Google. `version.json` continua com `sha: "unknown"` (#287).

Depois da publicação o Stefan escreveu: "Compartilhar: Deve gerar uma imagem com minhas escolhas, não apenas o link." O pedido virou o estágio 72 (#338).

## Não entregue / pendente

- Cartas novas e pesquisas de outros assuntos. "Famosos e influenciadores" e "Roupas" seguem como "em breve". (Desde 23/11/2026, com o estágio 73, "Roupas" tem pesquisa própria e saiu de "em breve". Desde 26/11/2026, com o estágio 74, "Famosos e influenciadores" também tem, e "em breve" ficou sem itens.)
- Resultado somado, top 5, comparação com a maioria (#177 e revisão jurídica).
- Som e háptica.
- Rota só de leitura para a resposta da pessoa: a capa usa o pedido de sorteio, que para quem já respondeu só devolve a resposta.

## Testes executados

No CI do PR #335, o commit `918f34c` falhou num cenário do roteiro novo, nos dois navegadores: com a fonte do Linux, mais larga, "Compartilhar minha escolha" quebrava em três linhas em 360×640 e o botão vizinho crescia junto. A asserção que falhou era minha e media "uma linha". O texto do botão ficou mais curto, e o cenário passou a rodar também com uma fonte larga, medindo altura de toque e largura em vez de linhas. Os testes de unidade, do servidor (com PostgreSQL) e a imagem do app passaram nesse commit.

Depois da correção, no commit `46ae6ff` (a ponta da branch antes de ser refeita sobre a `main`), o `ci-gate` passou: no Linux, `site-shell` com 34 cenários e `photo-survey` com 34, em Chromium e em WebKit; o relato de erros nos dois; os testes de unidade de `shared/`, do servidor e do app; o smoke do servidor com PostgreSQL, com o caso das duas pesquisas; a imagem do app e `smoke-nginx` com 14 de 14. A revisão automática (Codex) deixou um apontamento, sobre a capa se refazer quando a identidade muda; ele já estava corrigido no commit `70419fa`, foi respondido e a conversa foi encerrada. A branch refeita, com o commit do gate (`2cb8b0f`), passou no `ci-gate` antes do merge.

Em 14/11/2026, local (macOS), no código do PR:

- `npm run test:shared`: 106/106. `npm test --prefix back`: 293/293. `npm test --prefix app`: 195/195.
- Smoke do servidor da pesquisa num PostgreSQL 16 local, banco descartável: aprovado, com o caso das duas pesquisas.
- `app/e2e/site-shell.mjs`: 34 cenários aprovados em WebKit e em Chromium 140.
- `app/e2e/photo-survey.mjs`: 34 cenários aprovados em WebKit e em Chromium 140, agora no endereço da pesquisa.
- `app/e2e/client-error-report.mjs`: aprovado nos dois.
- Capturas conferidas a olho: capa em 390×844 e 360×640, capa de quem respondeu uma e de quem respondeu as duas, resposta registrada com os dois botões em 390×844 e 360×640, entrada da segunda pesquisa, menu, e a imagem que o compartilhar gera (1080×1350, 362 KB).

O que veio antes do código, e falhou primeiro pelo motivo esperado:

- As regras: os testes de `shared/` (4 falharam), os das regras da capa em `photo-survey-flow.test.js`, os do menu (3 falharam) e os de `share-choice.test.js`.
- Os cenários de navegador do compartilhar e do botão da próxima pesquisa (3 falharam antes de o botão existir).

O que não seguiu essa ordem: os cenários de navegador da capa (25 a 29 e o 32) foram escritos depois de a página mudar e passaram na primeira execução. Ficam para a revisão independente conferir, desfazendo o código, se eles pegam o que dizem pegar.

## Revisão independente

O mesmo agente das revisões do estágio 69, somente leitura, revisou os três commits do estágio (`db7d079..918f34c`) num clone à parte, em 14/11/2026. Rodou as três suítes de unidade, os três roteiros em WebKit e o smoke do servidor num banco próprio, escreveu roteiros para os casos que testou e desfez o código de 47 formas para ver os testes pegarem. Sem bloqueio: não achou caminho em que a capa comece ou confirme a pesquisa errada, mostre a resposta de uma na outra ou deixe o endereço e a tela em desacordo. Apontou dois pontos importantes, corrigidos com teste antes:

| O que a revisão apontou | O que mudou |
|---|---|
| A capa mandava para a pesquisa pela metade antes de saber se ela estava aberta: se ela fechasse, o aparelho ficava preso na tela de fechada | A capa não redireciona mais. A pesquisa pela metade, se aberta, vira o destaque, com "Continuar"; fechada, a capa destaca outra |
| Com a leitura de uma pesquisa falhando, a capa dizia "Você respondeu todas as pesquisas abertas" ou escondia a pesquisa, sem aviso | Qualquer falha que não seja 404 mostra o aviso com "Tentar de novo" |

Dos pontos menores, foram corrigidos: a capa não se refazia quando outra aba saía da conta, e uma resposta atrasada podia aparecer para a identidade errada; "Próxima pesquisa" apontava para uma pesquisa fechada ou desconhecida (agora leva à capa); compartilhar apagava um aviso que estava na tela; um estado desconhecido vindo do servidor travava a capa; e cinco pontos sem teste ganharam teste (resposta em pesquisa fechada, dois toques no compartilhar, a imagem no tamanho maior, duas mutações de unidade).

Sobre os cenários escritos depois do código (25 a 29 e 32): a revisão desfez o código de 25 formas e cada uma foi pega pelo cenário que diz cobrir o comportamento.

Ficaram anotados, sem mudança:

- O endereço compartilhado da segunda pesquisa aparece nas redes com o título da página, "PoliMatch — Quem você prefere?": o título é fixo no HTML.
- Com o celular deitado (667×375), o "Começar" da capa fica 24 px abaixo da dobra e, na resposta registrada, as finalistas ficam 27 px atrás dos botões. Em 320×480, no menu, o botão do Google fica abaixo da dobra.
- Toda tela de resposta registrada baixa a carta grande e monta a imagem (cerca de 360 KB), compartilhe a pessoa ou não.
- Um servidor que não conhece a segunda pesquisa ainda a mostra no menu, que leva a "Esta pesquisa não está disponível.", com saída para a capa.

Ela não conferiu Chromium, o CI no Linux, `navigator.share` num celular, a volta pelo histórico do navegador (só leu o código), o servidor de verdade junto com o app, nem produção.

## Riscos conhecidos

- **A imagem compartilhada leva a foto de uma pessoa real com a marca do PoliMatch.** Está na consulta jurídica sobre direito de imagem (decisão 0001, pendência de fotos). O compartilhamento por iniciativa da pessoa está na decisão 0001, item 8.
- **A segunda pergunta é escolha do agente.** "Em quem você confia mais?" é uma pergunta nova sobre pessoas reais, positiva. O Stefan viu a folha; pode trocar ou tirar.
- **O compartilhamento real não foi exercitado.** Nos testes `navigator.share` é simulado. Num iPhone ou Android de verdade o teste é do Stefan.
- **API e app precisam ir juntos.** Com o app novo e a API antiga, a capa mostra só a primeira pesquisa (testado). Com a API nova e o app antigo, nada muda para quem usa.
- **"Suas escolhas" confia no registro do aparelho.** Se o aparelho diz que uma pesquisa aberta foi respondida e o servidor não tem a resposta, o pedido da capa emite o sorteio dessa pesquisa para o jogador. Não grava resposta. A revisão não achou como chegar a isso sem perda de dados no servidor.
- **Quem respondeu em outro aparelho** só vê a escolha na capa deste depois de abrir a pesquisa aqui.
- **A capa rola em telas baixas.** Em 360×640 ela tem 727 px; "Começar" aparece sem rolar.
- As condições de publicação do estágio 69 seguem abertas: privacidade (#283) e backup externo (#279).

## Decisões tomadas

Avaliação do Stefan em 14/11/2026, com a capa nova no ar: "Subiu. Mas está bem simples. Precisa de mais coisas."

Escolhas do agente, por delegação dele, que pode mudar qualquer uma:

- O pacote: várias pesquisas na capa, "Suas escolhas" e compartilhar.
- A segunda pergunta e o código dela.
- O destaque na primeira pesquisa aberta sem resposta, e a capa retomar a pesquisa pela metade.
- Navegação entre capa e pesquisa por endereço, com recarga.
- O texto e o desenho da imagem compartilhada.

## Próximo passo exato

Nenhum neste estágio. O cadastro obrigatório (estágio 71) e o compartilhar com imagem (estágio 72) vieram em seguida.

## Ação do Stefan

- Dizer se a segunda pergunta fica.
- O compartilhar: a avaliação dele depois da publicação pediu imagem em vez de só o link, e virou o estágio 72.
- As cópias do banco em `/tmp` no contêiner do banco têm dado pessoal: apagar ou guardar fora é decisão dele.
- Para abrir "Famosos e influenciadores" e "Roupas": as cartas.

## Human gate

- Decisão das partes 70a a 70d e da publicação (70e): `aprovado`
- Responsável: Stefan
- Observação: a construção responde à avaliação dele de 14/11/2026 e à delegação registrada na decisão 0003. O merge e a publicação tiveram instrução direta dele em 16/11/2026. A mensagem do agente dizia que o pacote estava pronto e que nada dele estava no ar; que o CI tinha passado nos dois navegadores e no servidor com banco; que a revisão independente não achou bloqueio e que os dois pontos importantes dela foram corrigidos; que um botão quebrava em três linhas no Linux e o texto foi encurtado; as duas diferenças em relação à folha (os botões "Compartilhar" e "Próxima pesquisa", e a pesquisa pela metade em destaque com "Continuar"); que o compartilhar num celular de verdade e o "Entrar com Google" pelo menu não foram verificados; e o que a publicação envolve: o PR 333 primeiro e o 335 em seguida, a API antes do app porque a pergunta nova fica no servidor, e uma cópia do banco antes de publicar a API. A pergunta foi: "Mesclo os PRs 333 e 335 e publico a API e o app? Pode responder 'sim, mescla e publica' ou 'só mescla'." Ele respondeu: "Sim, mescla e publica". O merge e os dois deploys ficaram a cargo do agente, a pedido dele, com o check verde no commit final, e foram feitos em 16/11/2026 (ver "Publicação"). O combinado era parar e avisar se a API não subisse; ela subiu. As condições de privacidade (#283) e de backup externo (#279) seguem abertas e não foram tratadas na pergunta. A regra 6 do `AGENTS.md` não muda.
