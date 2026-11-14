# HANDOFF — [ICM 68] Pesquisa por foto, etapa 1: rodada de Política com as cartas de moldura

## Status

- Estado: `em andamento`. As entregas 68a (registro), 68b (regras e servidor), 68c (tela) e 68d (teste por agentes) foram aprovadas. A 68e está pela metade: em 14/11/2026 a API e o app foram publicados com a pesquisa ligada e a página escondida. Falta a entrada na capa e o sitemap, com outro sim.
- Issue: #324
- 68a: PR #325, mesclado em `3a59344`.
- 68b: PR #326, mesclado em `3e1f771`.
- 68c: PR #327, mesclado em `82ffed5`.
- 68d: PR #328, mesclado em `eb729ed`.
- 68e: publicação de 14/11/2026 no commit `eb729ed`; registro no branch `icm/68e-publicacao`.

## Entregue (68a — registro)

- `docs/decisions/0002-ordem-de-construcao-e-cartas-com-moldura.md`: a decisão do Stefan de 13/11/2026 sobre a ordem de construção e as cartas com moldura no voto, com o que ela altera na decisão 0001.
- `stages/68_photo_survey_politics/CONTEXT.md`: formato, regras, entregas, fora de escopo e critérios de aceite da etapa 1.
- `stages/68_photo_survey_politics/references/`: as quatro telas aprovadas. A de entrada foi desenhada depois das outras três e aprovada com este PR.
- `docs/decisions/0001-pesquisa-de-preferencia-por-foto.md`: marca nos quatro pontos alterados. Nada foi apagado.
- `CONTEXT.md`, `README.md` e `AGENTS.md` da raiz: apontam para a decisão 0002 e para esta etapa.

## Entregue (68b — regras e servidor)

- `shared/photo-survey.js`: a pesquisa `politica-2026-01` (20 cartas, sorteio de 16, telas de 4), o sorteio, as telas, a validação da chave e o estado pela janela. Funções puras, com 10 testes.
- `back/src/photo-survey-store.js`: as tabelas `photo_survey_draws` e `photo_survey_responses`, aditivas e imutáveis, o sorteio por jogador e a resposta única por identidade.
- `back/src/http-app.js`: `GET /api/photo-surveys/:surveyId`, `POST …/draw` e `POST …/response`.
- `back/scripts/photo-survey-smoke.mjs` e o passo dele em `.github/workflows/back-shared.yml`.
- `docs/security/VOTE_ABUSE_POLICY.md`, versão 4, com a seção da pesquisa por foto.
- `README.md`: as três rotas na tabela da API.
- `stages/68_photo_survey_politics/plans/68b-regras-e-servidor.md`: o plano seguido.

O que muda no jogo atual: nada no que a pessoa vê. No servidor, o login Google passa a ligar à conta o jogador anônimo que recebeu o sorteio de uma pesquisa sem ter jogado; antes ele era descartado. A resposta do login traz `merge.status: "linked"` nesse caso, nada do jogo é somado, e o app, que só reage a `combined` e `alreadyCombined`, não mostra aviso. Se a pessoa repetir o login com a chave antiga, o app mostra o aviso que já existe para acesso recuperado.

Nada desta entrega é visível no site: não há tela, e as rotas novas nascem desligadas. Só `PHOTO_SURVEYS_ENABLED=true` no ambiente da API as liga; sem isso respondem 404 `PHOTO_SURVEYS_DISABLED`.

## Entregue (68c — tela)

- `app/pesquisa.html`: a página nova, com `noindex`, fora do menu e do sitemap. Nenhuma página pública aponta para ela.
- `app/src/photo-survey-flow.js`: as regras de escolher, voltar, trocar e retomar. Funções puras, com 20 testes.
- `app/src/photo-survey-page.js` e `app/src/photo-survey.css`: a tela. Estados: entrada, voto (4 telas), final, confirmação, registrada, fechada, ainda não abriu e indisponível.
- `app/src/api.js`: `loadPhotoSurvey`, `drawPhotoSurvey` e `respondPhotoSurvey`.
- `app/e2e/photo-survey.mjs`: 27 cenários de navegador, com passo próprio em `.github/workflows/ui-interaction-smoke.yml`.
- `app/vite.config.js`: a página entra no build.
- `stages/68_photo_survey_politics/plans/68c-tela.md`: o plano seguido, com as decisões que o contexto deixava abertas.

Como a tela se comporta:

- Abrir a página só lê a definição da pesquisa. O jogador e o sorteio nascem no toque em "Começar". Quem já começou nesta identidade vai direto ao sorteio ao abrir de novo, que não grava nada novo.
- As escolhas parciais ficam no aparelho. A resposta vai ao servidor uma vez, na confirmação, sempre com o mesmo recibo. Depois de registrada, o aparelho guarda só que a pessoa respondeu; a escolha vem do servidor.
- Se a confirmação fica sem resposta, a tela diz que não deu para saber se chegou e trava a troca até a nova tentativa responder.
- O toque só é liberado quando as quatro cartas da tela carregaram. Se uma falha, a tela inteira espera.
- As quatro cartas cabem na tela sem rolar: a largura da grade acompanha a altura livre. Em tela baixa o cabeçalho encolhe, e com o celular deitado as quatro ficam numa fileira.
- Depois de trocar uma escolha, a pessoa segue para a primeira tela sem escolha, ou direto para a final. Trocar a carta que era a escolhida apaga a escolhida.
- Com as rotas desligadas, que é o estado de hoje em qualquer ambiente sem `PHOTO_SURVEYS_ENABLED=true`, a página diz que a pesquisa não está disponível.

O que muda no jogo atual: nada. `main.js` e as outras três páginas não foram alterados. Só mudaram os três testes que fixam a lista de páginas do build.

O jogador criado pelo "Começar" é o mesmo jogador anônimo do jogo: nasce com as linhas iniciais do ranking pessoal, como qualquer jogador novo. Responder a pesquisa não mexe nelas.

## Entregue (68d — teste por agentes)

- Seis agentes jogaram a pesquisa num ambiente local descartável, com a página e a API de verdade, de origens diferentes como em produção, e PostgreSQL novo. Cada agente teve banco e API próprios e duas "redes". Os oito caminhos pedidos no contexto foram jogados em WebKit e em Chromium: direto, voltar e trocar, recarga no meio, segunda aba, troca de identidade no meio, cota de rede esgotada, API fora do ar e pesquisa fechada.
- Resultado da primeira rodada: os oito caminhos funcionam. Em nenhum houve resposta gravada antes de confirmar, duas respostas do mesmo jogador, escolha gravada diferente da tela, escolhas de uma identidade gravadas em outra, linha nova em `votes` ou mudança em `ranking_stats`.
- Saíram dez correções de tela e de texto, cada uma com o cenário de e2e escrito antes do código. As que mais pesavam: quem confirmava depois de a pesquisa fechar não lia que a escolha não tinha sido registrada; um toque em "Começar" numa entrada aberta antes do fechamento criava jogador e gastava a cota da rede; e, se a conta mudasse no instante da confirmação, a resposta ia para a conta certa sem a pessoa ser avisada.
- Segunda rodada: três agentes conferiram cada correção na página e na API de verdade, com o código corrigido. Todas se comportam como descrito. Saíram mais dois ajustes, também com teste antes: a conta que troca e volta dentro do tempo de uma confirmação passa a ver a resposta registrada, e a entrada com aviso em tela baixa não deixa a lista atrás do botão.
- Depois da revisão do código (abaixo) entraram mais quatro acertos, que não passaram pela segunda rodada de agentes e estão cobertos pelo e2e nos dois navegadores.
- `stages/68_photo_survey_politics/plans/68d-teste-por-agentes.md`: os caminhos, o que cada agente viu e o que mudou.
- `stages/68_photo_survey_politics/references/68d-ambiente/`: o roteiro do ambiente (`ambiente.sh`, `porta.mjs`) e o texto dado aos agentes, para repetir a rodada.

## Entregue (68e — publicação, primeira parte)

- Em 14/11/2026 a API e o app foram publicados pelo painel, no commit `eb729ed`, com `PHOTO_SURVEYS_ENABLED=true` na API. A pesquisa `politica-2026-01` está aberta em `https://polimatch.com.br/pesquisa.html`.
- A página está escondida: fora do menu, fora do sitemap, com `noindex`, e nenhuma página do site aponta para ela.
- A publicação levou também o estágio 45 (#314), que estava mesclado e ainda não publicado.
- Antes do deploy foi feita uma cópia do banco, e a contagem de linhas de cada tabela foi comparada antes e depois: as 24 tabelas antigas não mudaram.
- As respostas dadas antes do lançamento ficam gravadas, como toda resposta. Proposta do agente, por delegação: tratar `politica-2026-01` como ensaio e criar a pesquisa de lançamento com outro código, zerada.
- `stages/68_photo_survey_politics/plans/68e-publicacao.md`: os passos, o que foi conferido e como voltar atrás.

## Não entregue / pendente

- A entrada na capa e a página no sitemap (segunda parte da 68e), com outro sim.

- As entregas 68d (teste por agentes) e 68e (publicação).
- O botão voltar do navegador sai da página em vez de voltar uma tela. Ao abrir de novo, a pessoa retoma de onde parou. Fica para avaliar na 68d.
- Som e háptica das telas novas, fora do escopo da etapa.
- A pesquisa `politica-2026-01` está sem janela (`opensAt` e `closesAt` nulos), ou seja, aberta assim que as rotas forem ligadas. Definir a janela e ligar `PHOTO_SURVEYS_ENABLED` em produção são assunto da 68e.
- Fechar uma pesquisa exige mudar a definição no código e publicar. Não há painel para isso.

## Testes executados

68a: `npm test --prefix app` e `npm run test:shared`; o PR não alterava código.

68b, em 13/11/2026, numa máquina com PostgreSQL 16.14 local e banco descartável:

- `npm run test:shared`: 104/104 (11 novos).
- `npm test --prefix back`: 293/293 (8 novos: 7 das rotas e a guarda de banco descartável do smoke novo).
- `npm test --prefix app`: 286/286.
- Smokes na ordem do CI, todos aprovados: integração, duas escolhas, duelos, abuso, progresso, cívico, resiliência e o novo, da pesquisa.
- Backup com manifesto e ensaio de restauração: 47 tabelas, com as duas novas no manifesto e sem diferença depois do boot. Restauração parcial: aprovada.
- A API real, local: definição, sorteio, resposta, repetição (`alreadyProcessed`), outra escolha (409) e chamada sem sessão (401).
- O smoke novo foi escrito antes do código e falhou primeiro por método ausente; depois apontou o caso do login Google descrito acima.

68c, em 13/11/2026, na mesma máquina:

- `npm test --prefix app`: 310/310 (24 novos: 20 das regras do percurso, 3 do cliente da API e 1 das listas de páginas).
- `npm run test:shared` 104/104 e `npm test --prefix back` 293/293, sem mudança.
- `app/e2e/photo-survey.mjs` em WebKit, contra o build local: 27 cenários aprovados. O Chromium não abre nesta máquina e fica com o CI.
- Página, API e PostgreSQL de verdade, locais, com `PHOTO_SURVEYS_ENABLED=true` e sem simulação: três pessoas, três sorteios, duas respostas iguais às escolhas feitas na tela; votos e ranking do jogo sem mudança; o ranking pessoal dos três jogadores no valor inicial.
- Capturas conferidas em 390×844, 375×667, 360×640, 375×548 e 667×375.
- Bateria e2e completa em WebKit local, antes das correções da revisão: 23 de 27 roteiros. Os quatro que falham são os já conhecidos desta máquina e não tocam a página nova: três de foco de teclado (`interaction-smoke`, `accessible-profile`, `civic-navigation`), que passam no CI, e o `fact-check`, intermitente (#298), que passou nas duas repetições.
- As regras e o e2e foram escritos antes do código. O e2e novo apontou um caso real depois da revisão: em 360×640 os botões cobriam as finalistas.

68c, em 14/11/2026, depois do primeiro CI do PR #327:

- O `ci-gate` falhou no commit `fc5e153`, em Chromium e em WebKit, num cenário só: em 320×480, na confirmação, as finalistas ficavam atrás dos botões. Os outros cenários passaram nos dois navegadores.
- Causa: a fonte do sistema no Linux do CI é mais larga que a do macOS. O texto da confirmação quebrava em uma linha a mais, e a carta escolhida e as finalistas tinham tamanho fixo por faixa de altura; em 320×480 a folga era de 5 px. A tela de resposta registrada tinha o mesmo defeito, já no macOS, e não tinha medida no e2e.
- Correção: nessas duas telas a carta escolhida ocupa a altura que sobra entre o texto e as finalistas, até o tamanho que já tinha; abaixo de 520 px de altura o sobretítulo some e as finalistas ficam menores. O botão ganhou respiro para texto em mais de uma linha. As telas de entrada, de voto e a final não mudaram.
- O e2e passou a medir as duas telas em todos os tamanhos e ganhou dois cenários com o texto mais largo e mais alto (360×640 e 320×480), para a medida não depender da máquina. Escrito antes da correção, falhou primeiro aqui, na resposta registrada em 320×480.
- `npm test --prefix app`: 310/310. `app/e2e/photo-survey.mjs`: 30 cenários aprovados em WebKit e em Chromium 140, locais (29 no commit `0d9ce3f`, que passou no CI nos dois navegadores; o trigésimo veio da revisão automática, abaixo). O Chromium abre aqui pelo caminho do executável em cache; o Playwright do repositório pede outra revisão, que só o CI tem.
- Capturas e medidas conferidas na confirmação, na confirmação com aviso e na resposta registrada, em 390×844, 375×667, 360×640, 375×548, 320×480 (com e sem fonte larga) e 667×375. Com o celular deitado, na confirmação as finalistas passaram a caber sem rolar; na resposta registrada ainda pedem cerca de 20 px de rolagem.

68d, em 14/11/2026, na mesma máquina:

- Primeira rodada, sobre o commit `0d9ce3f`: 34 jogadores, 32 sorteios e 27 respostas nos seis bancos, pelos números finais de cada agente; `votes` em zero e `ranking_stats` igual em todos.
- Segunda rodada, sobre as correções: 18 jogadores, 18 sorteios e 13 respostas em três bancos novos; `votes` em zero e `ranking_stats` igual.
- `npm test --prefix app`: 310/310. `app/e2e/photo-survey.mjs`: 33 cenários aprovados em WebKit e em Chromium 140, locais. Cada cenário que mudava comportamento falhou antes da correção pelo motivo esperado; os que só fixam comportamento que já existia passaram de primeira.
- O cenário de fonte larga passou a usar uma fonte de largura fixa, que mede quase igual no macOS e no Linux, e as telas de voto e a final precisam caber sem rolar em pé.
- Capturas conferidas: entrada com aviso de cota, final com escolhida, fechada com aviso e saída da conta, em 360×640 e 390×844.
- Página, API e PostgreSQL de verdade, locais, sobre o código final: três pessoas, três sorteios, duas respostas iguais às escolhas da tela; `votes` e `ranking_stats` sem mudança.
- CI do PR #328: `ci-gate` verde no commit `424bf62`, em Chromium e em WebKit no Linux, com os 33 cenários. A revisão automática do Codex leu o mesmo commit e não deixou apontamento.

68e, em 14/11/2026, em produção, só por leitura fora os passos autorizados:

- Cópia do banco: `pg_dump` sem erro, 592.947 bytes, 27 tabelas.
- API: deploy em 35 s; 72 consultas de fora em 6 min, todas 200; rota da pesquisa de 404 para 200, aberta; log com `database_ready` e `resetApplied: false`; 24 tabelas antigas com a mesma contagem, as duas da pesquisa vazias, migração `2026-11-13-photo-survey-v1` registrada.
- App: deploy em 27 s; a capa respondeu 200 em todas as consultas de fora; `/pesquisa.html` 200 com `noindex`; os cinco arquivos da página e as 40 imagens das cartas 200; sitemap só com as quatro páginas antigas; pré-voo de CORS do site para a rota do sorteio aceito.
- Não foi aberto navegador automatizado em produção.

## Revisão independente

**68a.** Um agente separado, somente leitura, revisou o PR #325 em 13/11/2026 e não achou bloqueio. Correções aplicadas depois dela: a tela de entrada, que faltava no formato; a regra do desfazer, que vale até a confirmação; critérios de aceite por entrega, com os que faltavam (resposta forjada, sorteio uniforme, tabelas imutáveis, janela, troca de identidade); a página nova fora do sitemap e os testes que fixam a lista de páginas; a troca da entrada do site só na 68e; e as condições de publicação, com os bloqueios de maturidade que pesam nesta etapa.

**68b.** Outro agente separado, somente leitura no repositório e com banco descartável, revisou o PR #326 em 13/11/2026. Não achou bloqueio e reproduziu dois problemas, corrigidos com teste antes do código:

- Duas pessoas mandando o mesmo recibo (`answerId`) ao mesmo tempo causavam erro 500. Agora uma grava e a outra recebe 400.
- O anônimo que tinha sorteio, mas ainda não tinha respondido, não era ligado à conta no login Google. A chave dele continuava valendo, e uma aba aberta com ela gravava uma segunda resposta da mesma pessoa. Agora o vínculo acontece com o sorteio, e a chave antiga deixa de valer.

Também saíram da revisão: o vínculo da pesquisa deixou de mexer na versão do ranking da conta; o teste de uniformidade passou a medir pares e vizinhos; o smoke ganhou a conta com duas respostas e o anônimo que vira o jogador ativo; e a política passou a dizer que, depois de vínculos, vale a resposta mais antiga da identidade.

Notas que ficam para a 68c: quando o anônimo vira o jogador ativo da conta, outro aparelho da conta passa a receber o sorteio dele, e uma resposta montada com o sorteio antigo é recusada com 400. A tela precisa buscar o sorteio de novo quando isso acontecer, e também quando a chave anônima deixar de valer no meio da pesquisa.

Não corrigido, por ser igual ao resto do banco: `TRUNCATE` não é barrado pelos gatilhos de imutabilidade, nas tabelas novas nem nas antigas.

**68c.** Outro agente separado, somente leitura no repositório, revisou a tela em 13/11/2026. Não achou bloqueio nem caminho para duas respostas, perda de resposta confirmada ou escolha trocada no servidor. Reproduziu dez pontos, todos corrigidos com teste antes do código; a lista completa está no plano da 68c. Os três que mais pesavam:

- Quem já tinha respondido e recarregava com a API fora via a entrada com "Nenhuma escolha foi registrada". Agora vê que a resposta está registrada.
- Com a confirmação sem resposta do servidor, a tela dizia que não tinha registrado e deixava trocar; a pessoa via uma escolha e ficava registrada outra. Agora a tela diz que não deu para saber e trava a troca até conferir.
- Em tela baixa, duas das quatro cartas saíam da tela. Agora cabem as quatro, inclusive com o celular deitado.

Saiu também da revisão: depois de registrada, o aparelho guarda só que a pessoa respondeu, não em quem.

**68c, correção depois do CI.** Um agente separado, somente leitura no repositório, revisou a correção em 14/11/2026, antes do commit. Não achou bloqueio. Confirmou a causa pelas contas e por reprodução: com uma fonte larga no lugar da do Linux, o código anterior falha em 320×480 com os mesmos números do CI, a menos de 1 px. Rodou o e2e inteiro, sem alteração, em Chromium 140 e em WebKit, com a fonte do sistema e com a fonte larga: 29 de 29 em todos. Comparou 240 medidas das telas de entrada, de voto, final e fechada antes e depois: nenhuma diferença. Um pedido, atendido: o teste aceitava as finalistas até 16 px atrás dos botões; agora a folga é de 1 px e a tela precisa caber sem rolar. Ficam anotados, sem correção nesta entrega:

- Com o celular deitado, a carta escolhida fica no tamanho mínimo e, na resposta registrada, as finalistas ainda pedem cerca de 20 px de rolagem. Antes eram cerca de 100.
- Na final, em 360×640 com uma fonte bem larga, o título quebra em duas linhas e a página rola 17 px; as quatro cartas e o voltar continuam à vista, com pouca folga. A 68d confere esse caso.
- Em tela estreita, ao tocar em confirmar o botão muda de três linhas para uma e a carta escolhida cresce uns 15 px por um instante.
- Não foram conferidos: Linux de verdade fora do CI, Firefox e Safari anterior ao 26.

**68c, revisão automática no PR.** O Codex, configurado no repositório, revisou o commit `fc5e153` e deixou um apontamento, procedente: depois de uma confirmação sem resposta do servidor, se a nova tentativa voltasse com limite de requisições ou com sessão recusada, a tela destravava "Voltar e trocar" sem saber se a primeira confirmação tinha sido gravada. A pessoa podia trocar a escolha e só no fim ler que valia a primeira. Corrigido com o cenário escrito antes do código: a trava só sai quando o servidor responde sobre a resposta guardada. A regra da `main` exige as conversas de revisão resolvidas; a conversa foi respondida e resolvida depois da correção.

**68d.** Um agente separado, somente leitura no repositório, revisou o código das correções em 14/11/2026. Não achou bloqueio, nem caminho que enfraqueça uma resposta por jogador, nada enviado antes de confirmar ou a trava da troca. Conferiu no servidor que, com a pesquisa fechada, pedir o sorteio não grava nada. Pediu quatro acertos, todos feitos, com teste antes onde mudava comportamento:

- Com a pesquisa fechada e a conferência da resposta falhando, a tela voltava para a entrada e dizia "Nenhuma escolha foi registrada" a quem podia ter respondido. Agora fica na tela de fechada, com um aviso e nova tentativa.
- Quem saía da conta no instante da confirmação lia que a resposta tinha sido registrada e, na mesma frase, um convite para responder sem conta. Agora vê a tela de registrada, sem convite.
- Faltavam testes para trechos novos: fechada com sessão recusada, fechada com identidade que nunca abriu a pesquisa, falha tardia da confirmação depois da troca de conta, as guardas da aba que acompanha a outra e o aviso com o aparelho sem rede.
- O roteiro do ambiente servia erro 403 na pasta padrão, aceitava banco fora da máquina, apagava pastas sem conferir e encerrava processo pelo número sem conferir o comando. Agora só aceita banco local, só mexe em pasta que ele criou e só encerra o que abriu.

Da mesma revisão: a aba que acompanha a outra lê o que está guardado agora, não o evento, e confere também ao voltar a aparecer; o filtro de cenários não vale no CI e falha se não casar com nada. Ficam anotados, sem correção nesta entrega:

- Com a pesquisa fechada e uma identidade no aparelho, abrir a página pede o sorteio ao servidor. Fechada, o servidor não grava nada; a garantia de "abrir não grava" passa a depender do servidor nesse caso. Uma rota só de leitura para a resposta da pessoa tiraria essa dependência.
- Com a pesquisa fechada e a sessão recusada, a pessoa vê "Fechada", sem saber que entrar de novo mostraria a resposta dela.
- Em 390 px de largura com uma fonte muito larga, o título de 28 px ainda pode quebrar; só pesa onde a altura aperta, como em 390×664.
- Se a confirmação falha depois de a conta mudar, o aviso fica só em "Sua conta mudou"; nada se perde, e as escolhas continuam no aparelho.

## Riscos conhecidos

- A 68b mexe em `combineGoogleHistory`, a função que junta o histórico no login Google. A mudança é uma condição e um status; os smokes de integração e de identidade continuam aprovados.
- Um deploy da API com a 68b não abre a pesquisa: as rotas ficam desligadas até `PHOTO_SURVEYS_ENABLED=true`. As tabelas novas são criadas vazias no boot.
- A decisão 0002 muda a ordem "maturidade primeiro" da 0001. Os bloqueios de maturidade continuam abertos (#278, #279, #280, #281, #283, #284, #285 e #286) e correm em paralelo.
- A primeira pesquisa fica sem Lula e Flávio Bolsonaro, porque as cartas deles têm moldura diferente das outras 20.
- Das 20 cartas, 8 vêm de fotos de veículos ou de sites. Sem refazer essas 8 ou sem a confirmação do Stefan, a publicação (68e) não acontece com elas, e com 12 cartas o formato de 16 não fecha.
- A cota de jogos novos por rede é de 3 por dia. Numa casa, escola ou escritório com a mesma rede, a quarta pessoa só responde entrando com Google. A tela mostra o aviso próprio, mas isso limita a pesquisa e o teste por agentes; a decisão sobre a cota é da política de abuso e fica para antes da 68e.
- As escolhas parciais ficam no aparelho até a confirmação ou até outra identidade começar. Sair do Google na capa não as apaga. Entra nas condições da 68e, com a política de privacidade (#283).
- Na máquina de desenvolvimento os e2e rodam em WebKit e num Chromium de revisão diferente da do CI, com a fonte do macOS. A fonte do Linux só aparece no CI, que já apontou uma diferença (acima).
- Em 320×480, com aviso na tela da confirmação, a carta escolhida chega ao tamanho mínimo e as finalistas pedem rolagem. Os botões continuam à vista.
- "Uma resposta por jogador" não é "uma por pessoa": quem apaga os dados do aparelho pode responder de novo, dentro da cota de rede. O cadastro por CPF é o que resolve.
- A etapa grava escolha política ligada à identidade do jogo, como o jogo atual já faz. A [ICM 41] #283, de privacidade, continua aberta.

## Decisões tomadas

Decididas pelo Stefan em 13/11/2026:

- A ordem de construção: política, depois celebridades e influenciadores, depois roupas com imagens próprias.
- As cartas com moldura valem na tela de voto.
- Ninguém de fora é chamado antes de o aplicativo estar testado por agentes.
- O desenho da etapa 1: 16 cartas em 4 telas de 4, final, confirmação; página nova ao lado do jogo atual; sem CPF, sem top 5 público, sem compartilhar, avisos e indicação nesta etapa.

Escolhas de desenho do agente, dentro do que ele aprovou. Estão implementadas na 68b; ele delegou esse tipo de escolha e pode mudar qualquer uma até a publicação:

- Cada pessoa recebe 16 das 20 cartas por sorteio, em vez de uma lista fixa de 16. Evita excluir quatro nomes por escolha editorial.
- O sorteio é emitido pelo servidor quando a pessoa começa, e as escolhas parciais ficam só no aparelho até a confirmação.
- A coleção fica fora desta etapa.
- A resposta da pesquisa não altera o Elo do jogo atual.

Escolhas de desenho do agente na 68c, no mesmo regime:

- O endereço `pesquisa.html`.
- O toque só é liberado quando as quatro cartas carregaram.
- Depois de trocar uma escolha, a pessoa vai para a primeira tela sem escolha, ou direto para a final.
- Depois de registrada, o aparelho guarda só que a pessoa respondeu.
- O botão voltar do navegador sai da página; ao abrir de novo, a pessoa retoma de onde parou.

## Próximo passo exato

1. O Stefan testa no celular, em `https://polimatch.com.br/pesquisa.html`. São três pessoas novas por rede por dia.
2. Com o que ele achar: correções, e a decisão sobre a entrada na capa e o sitemap (segunda parte da 68e).
3. Antes de chamar gente de fora: política de privacidade (#283), backup externo (#279), o destino da edição Eleições 2026 (#285), a cota de três por rede e a pesquisa de lançamento com código próprio.

## Ação do Stefan

- Testar a pesquisa no celular.
- Decidir o que fazer com as duas cópias provisórias do banco, que têm dado pessoal e ficam dentro do contêiner (`/tmp/pre-deploy-20261113.dump` e `/tmp/pre-deploy-20261114.dump`).
- Decidir sobre as 8 cartas vindas de fotos de veículos: refazer a partir de retrato oficial ou de licença livre, ou confirmar o uso.
- Confirmar as condições de publicação propostas no contexto do estágio.
- Dizer se quer cartas de Lula e Flávio Bolsonaro no padrão comum, para entrarem numa próxima pesquisa.

## Human gate

- Decisão da entrega 68a: `aprovado`
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para o PR #325, em conversa de 13/11/2026. À pergunta "Mesclo o PR 325, com a tela de entrada incluída, ou quer mudar alguma coisa?", ele respondeu: "Toca". O merge fica a cargo do agente, a pedido dele, com o check verde no commit final. As entregas 68b a 68e têm gate próprio. A regra 6 do `AGENTS.md` não muda.
- Decisão da entrega 68b: `aprovado`
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para o PR #326, em conversa de 13/11/2026. À pergunta "Com o CI verde no commit final, mesclo o PR 326, sim ou não?", ele respondeu: "Sim". O merge fica a cargo do agente, a pedido dele, com o check verde no commit final. O merge não publica nada: as rotas seguem desligadas, e ligar `PHOTO_SURVEYS_ENABLED` em produção é assunto da 68e, com um sim próprio. As escolhas de desenho do agente listadas acima não foram discutidas uma a uma: seguem por delegação dele e podem ser mudadas até a publicação. As entregas 68c a 68e têm gate próprio.
- Decisão da entrega 68c: `aprovado`
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para o PR #327, em conversa de 14/11/2026. À pergunta "Com o CI verde no commit final, mesclo o PR 327, sim ou não?", ele respondeu: "Sim". Antes da pergunta ele foi avisado de que o CI ainda rodava e de que, se o Chromium apontasse algo, a correção viria antes do merge; foi o que aconteceu (acima). Entrou também, antes do merge, a correção do apontamento da revisão automática. O PR foi mesclado em `82ffed5`, com o `ci-gate` verde no commit final `61509d3`. O merge fica a cargo do agente, a pedido dele, com o check verde no commit final. O merge não publica nada: a página fica fora do menu e do sitemap, e o servidor segue com as rotas desligadas. As escolhas de desenho do agente na 68c não foram discutidas uma a uma: seguem por delegação dele e podem ser mudadas até a publicação. As entregas 68d e 68e têm gate próprio.
- Decisão da entrega 68d: `aprovado`
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para o PR #328, em conversa de 14/11/2026. À pergunta "Com o CI verde no commit final, mesclo o PR 328, sim ou não?", ele respondeu: "Mescla". Quando respondeu, o CI e a revisão automática do PR ainda rodavam, e isso estava dito na mesma mensagem; os dois fecharam sem apontamento antes do merge. O merge fica a cargo do agente, a pedido dele, com o check verde no commit final. O merge não publica nada. As correções da 68d são escolhas de tela e de texto do agente, por delegação dele, e podem ser mudadas até a publicação. A 68e tem gate próprio, com um sim para cada passo.
- Decisão da entrega 68e: `em andamento`
- Responsável: Stefan
- Observação: cada passo da publicação de 14/11/2026 teve instrução direta do Stefan em conversa. À pergunta "Começo a publicação agora, pela cópia do banco, sim ou não?", ele respondeu: "Sim". À pergunta sobre quem ligaria a variável `PHOTO_SURVEYS_ENABLED=true`, com as opções "Liguei, publica a API" e "Liga você" (o agente abre a aba Environment, acrescenta a linha, salva e publica a API), ele respondeu: "Liga vc". À pergunta "Publico o app agora, com as 20 cartas atuais, sim ou não?", feita depois de lembrar que 8 delas vêm de fotos de veículos ou de sites e já estão no ar no jogo atual, ele respondeu: "Sim". A entrada na capa, o sitemap e o convite a pessoas de fora não foram autorizados e dependem de outro sim. A regra 6 do `AGENTS.md` não muda.
