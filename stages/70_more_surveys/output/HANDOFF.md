# HANDOFF — [ICM 70] Capa com várias pesquisas, suas escolhas e compartilhar

## Status

- Estado: `pronto para gate` nas partes 70a a 70d, num PR só. A publicação (70e) não começou.
- Issue: #334
- Branch: `icm/70-more-surveys`, feita sobre a da limpeza (`icm/69d-cleanup`, PR #333). Depois do merge da #333 ela é refeita sobre a `main`.
- PR: #335
- Nada deste estágio está em produção.

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

- Na tela de resposta registrada: "Compartilhar minha escolha" e "Próxima pesquisa" (ou "Ver pesquisas", quando não há outra sem resposta). Os dois levam à capa, que decide o destaque.
- `app/src/share-choice.js`: a imagem (1080×1350, JPEG) com "Minha escolha", o nome, a carta, a pergunta e "Responda em polimatch.com.br"; o texto; e o endereço da pesquisa.
- A imagem é montada quando a tela aparece, para o toque abrir o compartilhamento do aparelho na hora. Sem suporte a arquivo vai o texto com o endereço; sem compartilhamento, o endereço é copiado e a tela avisa. Fechar a folha de compartilhar não é erro.
- Nada é compartilhado sem o toque, e compartilhar não fala com a API.

## Não entregue / pendente

- **70e — publicação.** Precisa de deploy da API (a segunda pesquisa é definida em `shared/`) e do app, cada um com o sim do Stefan. A ordem é API primeiro.
- Cartas novas e pesquisas de outros assuntos. "Famosos e influenciadores" e "Roupas" seguem como "em breve".
- Resultado somado, top 5, comparação com a maioria (#177 e revisão jurídica).
- Som e háptica.
- Rota só de leitura para a resposta da pessoa: a capa usa o pedido de sorteio, que para quem já respondeu só devolve a resposta.

## Testes executados

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

1. Merge da #333 (limpeza); refazer esta branch sobre a `main`; PR; CI.
2. Gate do Stefan para o PR.
3. Com o sim dele: deploy da API, conferência de que a segunda pesquisa responde, deploy do app, conferência de fora.

## Ação do Stefan

- Decidir o merge e, depois, a publicação (API e app).
- Dizer se a segunda pergunta fica.
- Testar o compartilhar no celular depois de publicado.
- Para abrir "Famosos e influenciadores" e "Roupas": as cartas.

## Human gate

- Decisão das partes 70a a 70d: `pendente`
- Responsável: Stefan
- Observação: a construção responde à avaliação dele de 14/11/2026 e à delegação registrada na decisão 0003. O merge e cada publicação pedem o sim dele. A regra 6 do `AGENTS.md` não muda.
