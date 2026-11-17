# HANDOFF — [ICM 69] A pesquisa por foto vira a capa

## Status

- Estado: `concluído`. As entregas 69a, 69b e 69c foram aprovadas e mescladas (PR #332, commit `6de6bbe`). A 69e aconteceu em 14/11/2026: o app foi publicado nesse commit e a pesquisa virou a capa do site. A 69d (limpeza do código antigo) foi aprovada pelo Stefan em 16/11/2026 e mesclada no mesmo dia (PR #333, commit `e220a96`).
- Issue: #331
- 69a, 69b e 69c: PR #332, mesclado em `6de6bbe`.
- 69e: publicação de 14/11/2026 no commit `6de6bbe`; registro na issue #331 e neste documento.
- 69d: PR #333, mesclado em `e220a96` em 16/11/2026, com a mesma árvore do commit `94b9bfb`, que tinha o `ci-gate` verde.

## Entregue (69a — registro)

- `docs/decisions/0003-a-pesquisa-vira-a-capa.md`: a decisão do Stefan de 14/11/2026, com as palavras dele, o que ela muda nas decisões anteriores e as consequências a observar.
- `stages/69_survey_home/`: contexto, plano das entregas 69b e 69c e a folha com as telas desenhadas que ele recebeu.
- Ajustes no 0001 (item 7), no `CONTEXT.md`, no `README.md`, no `AGENTS.md` e no contexto do estágio 68: a segunda parte da 68e (entrada na capa e sitemap) passa para este estágio.

## Entregue (69b — casca nova)

- **Menu.** `app/src/site-menu.js` e `site-menu.css`. Abre por cima da tela, num `<dialog>` nativo. Traz a pesquisa aberta, as próximas ("Famosos e influenciadores" e "Roupas", marcadas "em breve", sem link), "Como funciona" e a conta.
- **Conta.** "Entrar com Google" e "Sair da conta" ficam no menu e usam as rotas que a capa antiga já usava. O menu reconhece a sessão Google pelo prefixo da chave do aparelho, sem consultar o servidor. Sair com a sessão já inválida no servidor esquece a chave; com falha de rede ou erro do servidor, a sessão fica e a pessoa lê o motivo. Se o servidor não reconhece mais a chave do aparelho, a entrada é refeita sem ela; se a recusa é da credencial do Google, não, para a chave continuar valendo. Se o script do Google não carrega, o menu avisa e oferece tentar de novo.
- **Página da pesquisa.** O botão do menu aparece na entrada, na resposta registrada e nas telas de pesquisa parada; no voto, na final e na confirmação continua só o indicador de etapa. A resposta registrada e a pesquisa fechada mostram as próximas pesquisas no lugar de "Ir para o início". Os avisos de cota de rede e de sessão apontam o menu. Entrar ou sair pelo menu segue o mesmo caminho da troca de conta feita em outra aba, com duas diferenças: quem sai da conta na tela de resposta registrada continua nela, com aviso, sem convite para responder de novo; e com a pesquisa fechada a página reabre em vez de oferecer "Começar".
- **Como funciona.** `app/como-funciona.html`: página estática, com o formato em quatro linhas, a frase "Do PoliMatch só sai o resultado somado, nunca a escolha de uma pessoa." (decisão 0001, item 5) e o botão para responder.

## Entregue (69c — troca da capa)

- `app/index.html` carrega a pesquisa, sem `noindex`, com o manifesto. O build tem duas páginas: `index.html` e `como-funciona.html`.
- `pesquisa.html`, `quem-disse-isso.html`, `fato-ou-fake.html`, `duelos-da-corrida.html` e `integridade.html` saíram. No nginx os cinco endereços respondem 302 para `/`, com `Location` relativo.
- Sitemap com as duas páginas. Manifesto com o nome "PoliMatch" e fundo branco.
- CI: saíram 26 passos de teste de navegador das páginas antigas (o commit `fd22a56` diz 27; o passo do formulário do piloto ficou). Ficaram o roteiro novo (`site-shell.mjs`), o da pesquisa (`photo-survey.mjs`, agora em `/`), o relato de erros do navegador (`client-error-report.mjs`, reescrito para as duas páginas) e o formulário do piloto de arte, que não depende das páginas.
- O registro do service worker veio da capa antiga para a página da pesquisa. O `sw.js` não mudou: só limpa caches antigos.

## Entregue (69e — publicação)

- Em 14/11/2026 o app foi publicado pelo painel, no commit `6de6bbe` (20 s). A API não foi publicada: nada mudou em `back/` nem em `shared/`.
- `polimatch.com.br` abre na pesquisa, sem `noindex`; "Como funciona" responde; os cinco endereços aposentados respondem 302 para `/`; o sitemap lista as duas páginas.
- Durante o deploy a capa e a API foram lidas de fora a cada 5 s, por pouco mais de quatro minutos: 54 leituras, todas com resposta 200. A capa trocou de uma leitura para a outra.
- A pesquisa que foi ao ar na capa em 14/11/2026 é a `politica-2026-01`, com as respostas de ensaio. Privacidade (#283) e backup externo (#279) seguem abertos.

## Entregue (69d — limpeza)

- Saíram 112 arquivos do produto anterior: 81 de `app/src` (a capa do jogo, os quizzes, os duelos, a parte cívica, som, coleção e os testes de unidade deles), 30 de `app/e2e` (roteiros, fixtures e o executor local) e `app/scripts/measure-home-lcp.mjs`, que media a capa antiga.
- `app/src/repo-hygiene.test.js`: quatro testes que falham se um módulo de `app/src` ficar sem uso, se um teste cobrir código sem uso, se uma fixture ficar órfã ou se um roteiro de `app/e2e` não rodar no CI.
- Ficaram em `app/src`, além do site novo:
  - O piloto de arte das cartas (`card-art-pilot-*`), com os testes dele e `styles.css`, que o formulário do piloto lê como referência de geometria. O piloto é do estágio 12 e segue no build e no CI; decidir o destino dele não é desta entrega.
  - `photos.js`, que um teste do servidor (`back/src/photo-recovery.test.js`) confere contra a API.
- `app/src/political-chromas.test.js` voltou, só com a conferência das 20 cartas contra o elenco, as artes de origem e os arquivos publicados, e com a conferência de que a pesquisa usa exatamente essas cartas. O arquivo antigo tinha saído porque também testava módulos do jogo.
- Nada em `back/` nem em `shared/`. O build publicado não muda: um build antes e outro depois da limpeza dão os mesmos 311 arquivos, com o mesmo conteúdo, fora a data em `version.json`.
- Mesclada em 16/11/2026. Não teve deploy próprio: o app publicado no mesmo dia pelo estágio 70 foi montado, pelo commit que o painel registrou (`59ca9a1`; `version.json` segue com `sha: "unknown"`, #287), a partir da `main` já sem esses arquivos.

## Não entregue / pendente

- **`app/src/api.js`.** O módulo fica, com funções das rotas do jogo anterior que nenhuma página chama mais; elas não entram no arquivo publicado. Enxugar é mexer nos testes do cliente da API, e ficou fora.
- **O piloto de arte e os três verificadores de imagens do build** (`editorial-assets`, `portraits`, `presidential-assets`) continuam: validam imagens que ainda estão em `app/public`.
- **Outros restos, sem uso pelo site.** Em `identity-notice.js`, os textos do jogo e duas funções que só os testes chamam (o arquivo saiu no estágio 71). O build ainda calcula o resumo das imagens de `portraits/` e `chromas/approved` para `photos.js`, que só um teste do servidor lê. No `ci.yml`, dois filtros de caminho de artes antigas e um comentário que cita um módulo apagado. `docs/design/APPROVED_CHROMA_BATCH.md` aponta para um módulo apagado.
- **README.** Ainda abre descrevendo o jogo e traz o produto anterior em "Produto atual", com um aviso em cima. A correção é da [ICM 61] #303.
- **Privacidade.** A folha traz a página; ela não foi construída. Entra no menu quando houver texto aprovado (#283).
- **Imagens do produto anterior.** Continuam em `app/public` e seguem servidas pelos endereços diretos (`/portraits/`, `/chromas/`, `/candidates/`): o `dist` tem 75 MB, quase tudo delas. Nenhuma página aponta para elas, fora as 20 cartas da pesquisa. Tirar pede cuidado com os testes do servidor, que leem algumas, e conversa com a #284.
- **Rotas do jogo anterior.** Continuam respondendo na API. Este estágio não toca no servidor.
- **Pesquisa de lançamento.** `politica-2026-01` segue com as respostas de ensaio; desde o estágio 70 (16/11/2026) há também a `politica-2026-02` no ar. A proposta de abrir uma pesquisa de lançamento com código novo, zerada, segue sem decisão.

## Testes executados

Em 14/11/2026, local (macOS), no código final do PR:

- `npm test --prefix app`: 321/321. Eram 311: saíram os 2 da página de integridade e entraram 10 das regras do menu, 1 dos redirecionamentos do nginx e 1 do carregamento do script do Google.
- `npm run test:card-art-pilot-contract --prefix app`: 64/64. O formulário do piloto passou em WebKit.
- `npm run build --prefix app`, com as verificações de prévia e de referências: sem erro.
- `app/e2e/site-shell.mjs`: 24 cenários aprovados em WebKit e em Chromium 140 (11 da primeira versão, 9 da primeira passada da revisão e 4 da segunda).
- `app/e2e/photo-survey.mjs`: 34 cenários aprovados em WebKit e em Chromium 140, com a página em `/`.
- `app/e2e/client-error-report.mjs`: aprovado nos dois navegadores, nas duas páginas.
- `app/scripts/smoke-nginx.mjs` contra um nginx 1.31 local com o `nginx.conf` do app e o `dist` do build: 14 de 14. Os cinco endereços aposentados respondem 302 com `Location: /`; um `.html` que não existe continua respondendo 404.
- Capturas conferidas a olho: início, menu sem conta, menu com conta, resposta registrada em 390×844, 360×640 e 320×480, pesquisa fechada, "Como funciona" em 390×844 e 360×640, e a tela de voto, sem menu.

No CI do PR #332, no commit `8d85655` (antes da segunda passada da revisão): `ci-gate` verde. No Linux, `site-shell` com 20 cenários e `photo-survey` com 34, em Chromium e em WebKit; relato de erros nos dois; os testes de unidade, a imagem do app e o `smoke-nginx` com 14 de 14 na imagem nginx 1.27, incluídos os cinco redirecionamentos. A revisão automática do Codex leu esse commit e não deixou apontamento. No commit `482d1e7`, com as correções da segunda passada: `ci-gate` verde de novo, com `site-shell` em 24 cenários e `photo-survey` em 34, em Chromium e em WebKit, e o `smoke-nginx` com 14 de 14. O commit que registra o gate, `05f3cff`, passou no `ci-gate` antes do merge.

O que veio antes do código, e falhou primeiro pelo motivo esperado:

- As regras do menu (`site-menu.test.js`): com o módulo vazio, 9 de 10 falharam; o décimo só negava textos e ganhou uma afirmação.
- O roteiro de navegador do menu e da capa: falhou porque a capa ainda era a do jogo.
- Os testes das listas de páginas, do nginx e do relato de erros: 8 falharam antes da troca.

O que não seguiu essa ordem: a montagem do menu no DOM (`mountSiteMenu`) foi escrita junto com as regras, antes do roteiro de navegador que a cobre; ela só foi ligada à página depois de o roteiro existir e falhar. No e2e da pesquisa, as asserções dos textos trocados ("Ir para o início", aviso de cota e de sessão) foram ajustadas junto com o código.

69d, em 14/11/2026, local (macOS), depois da limpeza:

- O teste de limpeza veio antes: com o código antigo no repositório, três dos quatro testes falharam, listando os módulos sem uso, os testes de código sem uso e os roteiros fora do CI.
- `npm test --prefix app`: 185/185 (eram 321; saíram 142 testes do produto anterior, entraram os 4 de limpeza e os 2 das cartas).
- `npm run test:card-art-pilot-contract --prefix app`: 64/64. Formulário do piloto: aprovado em WebKit.
- `npm run test:shared`: 104/104. `npm test --prefix back`: 293/293. A checagem de planejamento do estágio 17: aprovada.
- `npm run build --prefix app`: sem erro. `site-shell` (24 cenários), `photo-survey` (34) e o relato de erros: aprovados em WebKit e em Chromium 140.
- `smoke-nginx` contra o nginx local: 14 de 14.

69e, em 14/11/2026, em produção, só por leitura fora o clique de Deploy autorizado:

- `/` 200, com a página da pesquisa, sem `noindex`, com o manifesto; o script publicado traz a lista da entrada e o aviso de cota apontando o menu; o módulo do menu traz o identificador do cliente Google e a rota de entrada.
- `/como-funciona.html` 200, com as quatro linhas e a nota.
- Os cinco endereços aposentados: 302 com `Location: /`, seguindo para a capa com 200. Um `.html` que não existe: 404.
- Sitemap com as duas páginas; manifesto "PoliMatch", fundo branco; as 40 imagens das 20 cartas com 200.
- API: `health` 200, pesquisa aberta, pré-voo de CORS do site aceito para o sorteio e para a entrada com Google.
- Não foi feito: abrir a produção em navegador automatizado, nem entrar com Google pelo menu em produção.

## Revisão independente

**69d.** O mesmo agente das revisões anteriores, somente leitura, revisou o commit da limpeza (`8774fa5`) num clone à parte. Sem bloqueio. Conferiu que nada apagado é referenciado por código, workflows, Dockerfiles, scripts de pacote, `back/`, `shared/` ou scripts de estágio, e que o build antes e depois é idêntico. Desfez a limpeza de várias formas para ver o teste de limpeza pegar. Apontou um ponto importante, corrigido antes do merge:

| O que a revisão apontou | O que mudou |
|---|---|
| O teste das 20 cartas tinha saído inteiro, e a parte dele que conferia o catálogo e os arquivos publicados era a única conferência de unidade do que a capa mostra: com uma imagem apagada ou uma carta a menos, tudo passava | O teste voltou, só com essa parte; apagar uma imagem ou tirar uma carta do catálogo faz falhar, conferido |

Anotado, sem mudança: o teste de limpeza é uma rede larga (o que ele deixa passar está no plano da 69d), e os restos listados em "Não entregue / pendente". Ele não conferiu produção, Chromium, o CI no Linux nem os smokes do servidor com banco, cujos imports ele leu.

Um agente separado, somente leitura, revisou os commits `548440a` e `fd22a56` em 14/11/2026. Rodou os testes de unidade, os três roteiros de navegador em WebKit e o smoke do nginx num nginx local, e escreveu roteiros próprios para os casos que testou. Não achou bloqueio: nada perde nem duplica a resposta de uma identidade. Apontou seis pontos importantes, todos corrigidos antes do PR, cada um com teste escrito antes da correção:

| O que a revisão apontou | O que mudou |
|---|---|
| O script do Google que falhava ao carregar ficava no documento, e "tentar de novo" não fazia nada | O script que falha sai do documento; a nova tentativa pede o arquivo outra vez |
| O menu lia a chave da memória da aba: outra aba saía da conta e este menu continuava dizendo "Você entrou" | O menu lê a chave do aparelho, como a página; a memória só vale quando o navegador não guarda nada |
| Com a chave anônima recusada pelo servidor, o aviso mandava entrar com Google e a entrada falhava sempre | Recusada com 401, a entrada é refeita sem a chave |
| Sair da conta na resposta registrada levava à entrada, com "Começar" | A tela de resposta registrada fica, com aviso; com a pesquisa fechada, volta a tela de fechada |
| O foco ia para o documento a cada troca de conteúdo do menu, e "Você entrou com Google" não era anunciado | O foco volta ao painel; o estado da conta tem `role="status"` |
| Faltavam testes para esses caminhos, e um cenário esperava voto novo para quem já tinha respondido | 9 cenários novos; o cenário corrigido espera a resposta registrada; três asserções que não podiam falhar foram trocadas |

Dos pontos menores, foram corrigidos: jogador anônimo criado quando a entrada com Google terminava enquanto a pesquisa abria; entrar com a pesquisa fechada não buscava a resposta da conta; sair podia apagar uma sessão nova gravada por outra aba; resposta de entrada sem sessão seria gravada como texto; navegador sem `showModal` dava erro a cada toque; contraste de "Em breve" e tamanho do botão do menu; a nota de "Como funciona" atrás do botão em 320×480; e três trechos de documento que não batiam com o código.

Ficaram anotados, sem mudança:

- Num build sem o identificador do Google, os avisos ainda mandam entrar pelo menu, que nesse build não tem a entrada. Produção e CI têm o identificador.
- Um menu aberto no instante em que a pesquisa abre continua aberto sobre a tela de voto; ao fechar, o foco vai para o título.
- Com o celular deitado (667×375), a resposta registrada pede uns 59 px de rolagem e, no menu, o botão do Google fica abaixo da dobra.
- Em 320×480, na entrada, a lista fica 19 px atrás do botão até rolar (eram 15 px antes de o botão do menu crescer para 44 px).
- Abrir o menu carrega o script do Google, de `accounts.google.com`. A capa antiga fazia o mesmo ao abrir a tela de entrada.

Ele não rodou Chromium, não usou o botão real do Google, nem a imagem nginx do CI, nem o servidor de verdade: o comportamento da API na entrada e na saída ele leu no código.

**Segunda passada**, sobre o commit das correções (`8d85655`). O mesmo agente refez os próprios roteiros, rodou os cenários novos contra um build do commit anterior (oito falham ali; três cobrem comportamento que já estava certo) e desfez correções uma a uma para ver os testes pegarem. Confirmou os seis pontos como corrigidos e achou um ponto novo, importante, corrigido antes do merge com teste antes:

| O que a segunda passada apontou | O que mudou |
|---|---|
| A nova tentativa de entrada sem a chave valia para qualquer 401, inclusive a recusa da credencial do Google: uma chave anônima ainda válida ficava para trás, e quem já tinha respondido via a tela de voto | A nova tentativa não acontece quando o código é `INVALID_GOOGLE_CREDENTIAL` |
| A pesquisa que fecha depois de a página abrir chega como 409, e a página não guardava isso: sair da conta ali oferecia "Começar" | A recusa 409 passa a valer como estado da pesquisa |
| Sem `showModal`, o Esc só fechava com o foco dentro do painel | O Esc é ouvido no documento |
| Três correções menores não tinham teste | Cenários novos para a sessão ausente na resposta e para a corrida na saída; cada um falha com a correção desfeita |
| Contraste da etiqueta "Aberta" (4,4:1) | Verde mais escuro no texto da etiqueta |

Da segunda passada ficaram anotados, sem mudança:

- O aviso "Você saiu da conta neste aparelho. A sua resposta continua registrada." continua na tela se outra aba entra de novo na conta; some ao recarregar ou ao abrir o menu e entrar nesta aba.
- "Você entrou com Google" tem `role="status"`, mas chega junto com o painel refeito: leitores de tela podem não anunciar. Não foi testado com leitor de tela.
- No e2e, a saída com sessão vencida é simulada com 401; o servidor de verdade responde 204 para uma sessão que não conhece. O menu trata os dois.

## Riscos conhecidos

- **O botão real do Google não foi exercitado.** Nos testes o script do Google é simulado. Em produção o menu usa o mesmo identificador de cliente e a mesma origem da capa antiga, mas a primeira entrada real pelo menu é o teste que vale. (Até 16/11/2026 o agente não a exercitou; o relato do Stefan desse dia, "No celular funcionou", não diz o que ele testou.)
- **`<dialog>` em navegador antigo.** Antes do Safari 15.4 o menu abre pelo atributo, sem prender o foco. O e2e simula isso; um aparelho de verdade com esse navegador não foi usado.
- **Abrir o menu fala com o Google.** O script de entrada vem de `accounts.google.com`, como já vinha na capa antiga. Pesa na política de privacidade (#283).
- **Redirecionamento só existe no nginx.** O `vite preview` dos e2e não o reproduz. Foi conferido num nginx local e é conferido pelo smoke da imagem, no CI.
- **Teclado no WebKit do macOS.** Ali o Tab não percorre botões e links. O teste de foco do menu aceita isso; no Linux do CI o Tab percorre.
- **A pesquisa fica à vista de qualquer visitante.** As condições de publicação que o estágio 68 listou para antes de divulgar a pessoas de fora (privacidade, #283; backup, #279) seguem abertas. Publicar com elas abertas é decisão do Stefan.
- **A frase "Não é pesquisa eleitoral" sai com a capa antiga.** O site novo não exibe enquadramento nenhum; o texto que a substitui depende da revisão jurídica.
- **Quem jogava o jogo anterior perde a interface dele.** Rodada diária, ranking, coleção e quizzes saem do site. Os dados ficam no banco e as rotas seguem respondendo.
- **Anúncio de pesquisas futuras.** "Famosos e influenciadores" e "Roupas" aparecem como "em breve" sem data. São a ordem da decisão 0002, não um compromisso de prazo.
- **A entrada ilustra com dez das 20 cartas** (estágio 68). Com a troca, essa ilustração passa a ser a primeira tela do site.

## Decisões tomadas

Decidida pelo Stefan em 14/11/2026 (decisão 0003): a pesquisa vira a capa, as páginas existentes dão lugar à ideia nova, com menu arrumado e no padrão novo; o que é velho sai.

Escolhas do agente, por delegação dele, que pode mudar qualquer uma:

- O menu num painel de tela cheia, aberto por um botão no canto, e sem menu durante o voto.
- "Famosos e influenciadores" e "Roupas" como "em breve", no menu e depois da resposta.
- Os textos de "Como funciona".
- A página de Privacidade fora deste estágio, até haver texto aprovado.
- Redirecionamento temporário (302) dos endereços antigos, para a volta ser possível.
- A entrada com Google continua existindo, no menu.
- A limpeza do código antigo em PR próprio, depois da troca publicada.

## Próximo passo exato

Nenhum neste estágio: o PR #333 foi mesclado em 16/11/2026. Seguem abertos, fora dele: o destino das imagens do produto anterior em `app/public` e do piloto de arte, e a página de Privacidade quando houver texto (#283). A segunda pesquisa está no estágio 70.

## Ação do Stefan

- Dizer se entrou com Google pelo menu no celular: é o teste que os roteiros não fazem, e o relato dele de 16/11/2026 não diz se cobre isso (ver o HANDOFF do estágio 71).
- Texto da página de Privacidade, com o advogado (#283), e o backup externo (#279): seguem abertos com a pesquisa à vista.
- Dizer se quer a pesquisa de lançamento com código novo, zerada. Desde o estágio 70 (16/11/2026) estão no ar a `politica-2026-01`, com as respostas de ensaio, e a `politica-2026-02`.

## Human gate

- Decisão da entrega 69d: `aprovado`
- Responsável: Stefan
- Observação: a limpeza é parte do pedido dele de 14/11/2026 ("tira o que é velho, deixa novo"), transcrito na decisão 0003. O merge teve instrução direta dele em 16/11/2026. A mensagem do agente dizia que a limpeza estava no PR 333, com CI verde e revisão feita, que ela não muda nada do que está no ar e não precisa de publicação, e que o pacote do estágio 70 (PR 335) tinha sido feito em cima dela; a pergunta foi: "Mesclo os PRs 333 e 335 e publico a API e o app? Pode responder 'sim, mescla e publica' ou 'só mescla'." Ele respondeu: "Sim, mescla e publica". O `ci-gate` estava verde no commit `db7d079`. O merge ficou a cargo do agente, a pedido dele: o PR foi mesclado em `e220a96`, com a mesma árvore do commit final `94b9bfb`, que tinha o `ci-gate` verde. O gate do estágio 70 está no HANDOFF dele.
- Decisão das entregas 69a, 69b e 69c e da publicação (69e): `aprovado`
- Responsável: Stefan
- Observação: a construção teve instrução direta dele em 14/11/2026 ("Pode seguir, vai pra frente. Pode ir construindo."), transcrita na decisão 0003. O merge do PR #332 e a publicação do app também tiveram instrução direta dele, no mesmo dia. A mensagem do agente dizia o que ficou pronto, que o CI estava verde no commit final e que a revisão independente não achou bloqueio; que o botão real do Google não foi testado; que a página de Privacidade e a limpeza do código antigo não entraram; e, antes da pergunta, que ao publicar a pesquisa fica à vista de qualquer visitante, com a política de privacidade e o backup externo ainda em aberto, e que o site novo deixa de mostrar a frase "Não é pesquisa eleitoral". A pergunta foi: "Mesclo o PR 332 e publico o app em seguida? Pode responder 'sim, mescla e publica' ou 'só mescla'." Ele respondeu: "Sim mescla e publica". O merge e o deploy ficaram a cargo do agente, a pedido dele, com o check verde no commit final: o PR foi mesclado em `6de6bbe` e o app publicado nesse commit no mesmo dia. A pesquisa de lançamento com código novo não foi tratada na pergunta: vai ao ar a `politica-2026-01`. A limpeza (69d) tem gate próprio. A regra 6 do `AGENTS.md` não muda.
