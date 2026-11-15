# HANDOFF — [ICM 69] A pesquisa por foto vira a capa

## Status

- Estado: `pronto para gate` nas entregas 69a, 69b e 69c, que vão num PR só. A 69d (limpeza do código antigo) e a 69e (publicação) não começaram.
- Issue: #331
- Branch: `icm/69-survey-home`
- PR: a abrir
- Nada deste estágio está em produção.

## Entregue (69a — registro)

- `docs/decisions/0003-a-pesquisa-vira-a-capa.md`: a decisão do Stefan de 14/11/2026, com as palavras dele, o que ela muda nas decisões anteriores e as consequências a observar.
- `stages/69_survey_home/`: contexto, plano das entregas 69b e 69c e a folha com as telas desenhadas que ele recebeu.
- Ajustes no 0001 (item 7), no `CONTEXT.md`, no `README.md`, no `AGENTS.md` e no contexto do estágio 68: a segunda parte da 68e (entrada na capa e sitemap) passa para este estágio.

## Entregue (69b — casca nova)

- **Menu.** `app/src/site-menu.js` e `site-menu.css`. Abre por cima da tela, num `<dialog>` nativo. Traz a pesquisa aberta, as próximas ("Famosos e influenciadores" e "Roupas", marcadas "em breve", sem link), "Como funciona" e a conta.
- **Conta.** "Entrar com Google" e "Sair da conta" ficam no menu e usam as rotas que a capa antiga já usava. O menu reconhece a sessão Google pelo prefixo da chave do aparelho, sem consultar o servidor. Sair com a sessão já inválida no servidor esquece a chave; com falha de rede ou erro do servidor, a sessão fica e a pessoa lê o motivo. Se o servidor não reconhece mais a chave do aparelho, a entrada é refeita sem ela. Se o script do Google não carrega, o menu avisa e oferece tentar de novo.
- **Página da pesquisa.** O botão do menu aparece na entrada, na resposta registrada e nas telas de pesquisa parada; no voto, na final e na confirmação continua só o indicador de etapa. A resposta registrada e a pesquisa fechada mostram as próximas pesquisas no lugar de "Ir para o início". Os avisos de cota de rede e de sessão apontam o menu. Entrar ou sair pelo menu segue o mesmo caminho da troca de conta feita em outra aba, com duas diferenças: quem sai da conta na tela de resposta registrada continua nela, com aviso, sem convite para responder de novo; e com a pesquisa fechada a página reabre em vez de oferecer "Começar".
- **Como funciona.** `app/como-funciona.html`: página estática, com o formato em quatro linhas, a frase "Do PoliMatch só sai o resultado somado, nunca a escolha de uma pessoa." (decisão 0001, item 5) e o botão para responder.

## Entregue (69c — troca da capa)

- `app/index.html` carrega a pesquisa, sem `noindex`, com o manifesto. O build tem duas páginas: `index.html` e `como-funciona.html`.
- `pesquisa.html`, `quem-disse-isso.html`, `fato-ou-fake.html`, `duelos-da-corrida.html` e `integridade.html` saíram. No nginx os cinco endereços respondem 302 para `/`, com `Location` relativo.
- Sitemap com as duas páginas. Manifesto com o nome "PoliMatch" e fundo branco.
- CI: saíram 26 passos de teste de navegador das páginas antigas (o commit `fd22a56` diz 27; o passo do formulário do piloto ficou). Ficaram o roteiro novo (`site-shell.mjs`), o da pesquisa (`photo-survey.mjs`, agora em `/`), o relato de erros do navegador (`client-error-report.mjs`, reescrito para as duas páginas) e o formulário do piloto de arte, que não depende das páginas.
- O registro do service worker veio da capa antiga para a página da pesquisa. O `sw.js` não mudou: só limpa caches antigos.

## Não entregue / pendente

- **69d — limpeza.** Os módulos, os testes de unidade e os roteiros de e2e das páginas antigas continuam em `app/src` e `app/e2e`, sem uso pelo build. Saem em PR próprio, depois desta troca publicada. O servidor usa `app/src/photos.js` e `app/public/portraits` nos testes dele: a limpeza precisa preservar o que ele usa.
- **69e — publicação.** Depende do sim do Stefan e das condições de publicação do contexto do estágio.
- **Privacidade.** A folha traz a página; ela não foi construída. Entra no menu quando houver texto aprovado (#283).
- **Imagens do produto anterior.** Continuam servidas pelos endereços diretos (`/portraits/`, `/chromas/`, `/candidates/`). Nenhuma página nova aponta para elas, fora as 20 cartas da pesquisa.
- **Rotas do jogo anterior.** Continuam respondendo na API. Este estágio não toca no servidor.
- **Pesquisa de lançamento.** `politica-2026-01` segue com as respostas de ensaio. Abrir uma pesquisa nova, zerada, é proposta para o passo de publicação.

## Testes executados

Em 14/11/2026, local (macOS), no código final do PR:

- `npm test --prefix app`: 321/321. Eram 311: saíram os 2 da página de integridade e entraram 10 das regras do menu, 1 dos redirecionamentos do nginx e 1 do carregamento do script do Google.
- `npm run test:card-art-pilot-contract --prefix app`: 64/64. O formulário do piloto passou em WebKit.
- `npm run build --prefix app`, com as verificações de prévia e de referências: sem erro.
- `app/e2e/site-shell.mjs`: 20 cenários aprovados em WebKit e em Chromium 140 (11 da primeira versão e 9 que vieram da revisão).
- `app/e2e/photo-survey.mjs`: 34 cenários aprovados em WebKit e em Chromium 140, com a página em `/`.
- `app/e2e/client-error-report.mjs`: aprovado nos dois navegadores, nas duas páginas.
- `app/scripts/smoke-nginx.mjs` contra um nginx 1.31 local com o `nginx.conf` do app e o `dist` do build: 14 de 14. Os cinco endereços aposentados respondem 302 com `Location: /`; um `.html` que não existe continua respondendo 404.
- Capturas conferidas a olho: início, menu sem conta, menu com conta, resposta registrada em 390×844, 360×640 e 320×480, pesquisa fechada, "Como funciona" em 390×844 e 360×640, e a tela de voto, sem menu.

O que veio antes do código, e falhou primeiro pelo motivo esperado:

- As regras do menu (`site-menu.test.js`): com o módulo vazio, 9 de 10 falharam; o décimo só negava textos e ganhou uma afirmação.
- O roteiro de navegador do menu e da capa: falhou porque a capa ainda era a do jogo.
- Os testes das listas de páginas, do nginx e do relato de erros: 8 falharam antes da troca.

O que não seguiu essa ordem: a montagem do menu no DOM (`mountSiteMenu`) foi escrita junto com as regras, antes do roteiro de navegador que a cobre; ela só foi ligada à página depois de o roteiro existir e falhar. No e2e da pesquisa, as asserções dos textos trocados ("Ir para o início", aviso de cota e de sessão) foram ajustadas junto com o código.

## Revisão independente

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
- Com o celular deitado (667×375), a resposta registrada pede uns 55 px de rolagem e, no menu, o botão do Google fica abaixo da dobra.
- Em 320×480, na entrada, a lista fica 15 px atrás do botão até rolar, como já ficava.
- Abrir o menu carrega o script do Google, de `accounts.google.com`. A capa antiga fazia o mesmo ao abrir a tela de entrada.

Ele não rodou Chromium, não usou o botão real do Google, nem a imagem nginx do CI, nem o servidor de verdade: o comportamento da API na entrada e na saída ele leu no código.

## Riscos conhecidos

- **O botão real do Google não foi exercitado.** Nos testes o script do Google é simulado. Em produção o menu usa o mesmo identificador de cliente e a mesma origem da capa atual, mas a primeira entrada real pelo menu é o teste que vale.
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

1. Gate do Stefan para o PR das entregas 69a, 69b e 69c.
2. Com o sim dele para publicar: deploy do app pelo painel e conferência de fora (a capa com a pesquisa, os redirecionamentos, a API intocada). A API não precisa de deploy.
3. Depois da troca publicada: a 69d, em PR próprio.

## Ação do Stefan

- Decidir o merge deste PR e, depois, a publicação.
- Decidir, para a publicação: seguir com privacidade (#283) e backup (#279) abertos ou esperar; abrir ou não a pesquisa de lançamento com código novo.
- Texto da página de Privacidade, com o advogado.
- Entrar com Google pelo menu no celular depois de publicado: é o teste que os roteiros não fazem.

## Human gate

- Decisão das entregas 69a, 69b e 69c: `pendente`
- Responsável: Stefan
- Observação: a construção teve instrução direta dele em 14/11/2026 ("Pode seguir, vai pra frente. Pode ir construindo."), transcrita na decisão 0003. O merge e a publicação pedem o sim dele, um a um. A regra 6 do `AGENTS.md` não muda.
