# HANDOFF — ICM 76 — Rodadas contínuas, resultado da pessoa, feed e perfil — #354

Estado: `aguardando gate do merge`. Nada deste estágio está em produção.

## O que foi pedido e o que é escolha do agente

Os pedidos e as respostas do Stefan, palavra por palavra, estão na decisão
0008 (`docs/decisions/0008-rodadas-continuas-resultado-feed-e-perfil.md`): as
rodadas seguem sem perguntar; o resultado prévio é o da própria pessoa e
aparece quando ela pede; quem entrou vê um feed das pesquisas; cada pessoa
tem um perfil, visível a outras como no Instagram, que só aparece depois de
ela ligar.

O resto é escolha do agente e está listado lá: nove de regra e de dado (1 a
9), que a pergunta do merge leva por extenso, e três de desenho (10 a 12).

## O que foi feito

### 76a — Registro

- Decisão 0008 e `stages/76_feed_profile/CONTEXT.md` (regras, contrato da
  API, banco, telas).
- `docs/security/VOTE_ABUSE_POLICY.md`, versão 7: seção "Perfil público".
- Notas no `AGENTS.md`, no `CONTEXT.md` e no `README.md` (rotas novas e
  decisões 0002 a 0008).

### 76b — Regras e servidor

- `shared/profile.js`: versão e texto do aceite do perfil, regras do nome de
  perfil e nomes reservados.
- `shared/photo-survey.js`: `personalRanking`, a regra de pontos (3 pela
  final, 1 por tela; desempate por finais, depois telas, depois a ordem das
  cartas).
- `back/src/profile-store.js`: tabelas `profile_settings` e
  `profile_surveys`, criadas na subida da API (migração
  `2026-11-26-profiles-v1`); ligar, desligar, marcações, nome único sem
  diferença de caixa (também em pedidos simultâneos, pelo índice único).
- `back/src/photo-survey-store.js`: o resultado da pessoa usa as mesmas
  rodadas que o progresso das rodadas (identidade da decisão 0007).
- Rotas novas em `back/src/http-app.js`:
  `GET /api/photo-surveys/:surveyId/result`, `GET /api/me/profile`,
  `PUT /api/me/profile` e `GET /api/profiles/:handle` (pública, sem cache,
  404 igual para perfil desligado, nome inexistente e nome inválido). Nenhuma
  rota existente mudou.
- Testes: `back/src/profile-store.test.js` e o roteiro de banco
  `back/scripts/profile-smoke.mjs` (`npm run test:profile --prefix back`),
  que entrou no CI depois do cadastro.

### 76c — Tela

- **Rodada contínua.** Ao confirmar, "Rodada registrada" e, sem toque, a
  rodada seguinte. Sem confronto por ver, ou com a pesquisa fechada, vai
  para o resultado.
- **Resultado** ("Ver meu resultado"): a primeira colocada grande, até mais
  quatro em lista, rodadas e confrontos vistos, "Continuar votando" e
  "Compartilhar". A imagem do compartilhar, no resultado, diz "MEU PRIMEIRO
  LUGAR" e "DEPOIS DELA".
- **Abrir uma pesquisa já respondida** mostra o resultado com "Continuar
  votando". Abrir a página nunca emite rodada.
- **Feed** na capa de quem entrou com Google: as pesquisas em cartões, com
  estado ("Começar", "Continuar", "Ver meu resultado") e a primeira colocada
  nas respondidas. Lê as pesquisas e um único `GET /api/me/profile`; não
  grava nada. Quem não entrou vê a capa de antes.
- **Meu perfil** (`meu-perfil.html`, no menu só com conta Google): ligar
  com nome de perfil, marcação das pesquisas (nenhuma vem marcada) e o
  aceite por extenso numa caixa de marcar; ligado, o link, "Copiar link",
  "Ver como os outros veem", "Salvar marcações" e "Desligar".
- **Perfil público** (`perfil.html?u=<nome>`): nome de perfil e grade de
  cartas com o assunto embaixo; `noindex`; fora do mapa do site.
- **"Como funciona"**: a nota passa a dizer que a escolha de uma pessoa só
  aparece no perfil que ela ligou, e só nas pesquisas que marcou.
- Roteiros de navegador estendidos (`photo-survey.mjs`, `site-shell.mjs`,
  `client-error-report.mjs`), com o servidor simulado no contrato novo.

O servidor e as telas foram construídos por dois agentes à parte, em
paralelo, a partir do contrato do CONTEXT. A revisão e os testes abaixo são
do agente que escreve este handoff.

## O que muda para quem já usa

- Quem já respondeu uma pesquisa, ao abri-la, vê o próprio resultado com
  "Continuar votando", em vez da escolha registrada com "Mais uma rodada".
- Quem entrou com Google deixa de ver a capa com destaque e "Suas escolhas":
  vê o feed.
- Nenhum perfil existe até alguém ligar o seu.

## Verificação

Rodado pelo agente que escreve este handoff, em 26/11/2026, neste computador
(macOS). O CI do GitHub (Linux) é a referência.

- `npm run test:shared`: 142 de 142.
- `npm test --prefix back`: 353 de 353.
- `npm test --prefix app`: 260 de 260.
- `npm run editorial:verify --prefix back`: passou.
- Roteiros de banco, na ordem do `back-shared.yml`, contra PostgreSQL 16
  local descartável: os dez passaram (integração, escolhas ordenadas, duelos
  presidenciais, abuso, progresso do jogo, esquema cívico num banco próprio,
  resiliência, pesquisa por foto, cadastro e perfil). Não rodei o ensaio de
  backup e restauração nem a restauração parcial.
- Build do app com o client id de teste do CI, e os três roteiros de
  navegador contra `vite preview` local, com o servidor simulado dos
  próprios roteiros: em WebKit e em Chromium, `photo-survey.mjs` com 42
  cenários, `site-shell.mjs` com 58 e `client-error-report.mjs` com 5
  páginas, todos passando. O Chromium é o que já estava na máquina (revisão
  1187), aberto por um roteiro auxiliar fora do repositório.

## O que não foi conferido

- Nada em produção: o estágio não está publicado.
- O aplicativo contra o servidor de verdade: as telas foram testadas contra
  o servidor simulado dos roteiros, e o servidor pelos testes dele. O
  contrato é o mesmo dos dois lados, conferido por leitura.
- Celular de verdade, conta Google de verdade, a cópia do link fora do
  navegador automatizado, leitor de tela.
- As fontes do Linux do CI.
- Os textos novos não passaram pela revisão jurídica (#283).

## Riscos conhecidos

- **Dado sensível em público.** O perfil mostra a terceiros a escolha de uma
  pessoa sobre política. A base é o aceite próprio, pesquisa por pesquisa;
  a redação precisa de revisão jurídica antes de publicar (decisão 0008,
  pendências).
- **Nome de perfil que imita outra pessoa.** Nada impede escolher o nome de
  uma pessoa conhecida.
- **Descobrir que um nome existe.** Uma conta com cadastro que tenta ligar
  com um nome usado recebe "Esse nome de perfil já está em uso", mesmo que o
  perfil dono esteja desligado. A página pública não revela isso.
- **A página pública do perfil não tem limite de pedidos por rede.**
- **Recarregar logo depois de confirmar** leva ao resultado, não à rodada
  seguinte, se a pessoa ainda não tocou em nenhuma carta dela.
- **Trocar o nome de perfil** com o perfil ligado não tem tela: é preciso
  desligar e ligar de novo.

## Publicação (76d)

Pede o sim do Stefan, depois do merge, e depois da revisão jurídica que ele
decidir fazer.

1. Cópia do banco.
2. **API primeiro.** Cria as duas tabelas novas e grava a migração. Com a
   API nova e o app antigo, nada muda para quem usa: o app antigo não chama
   as rotas novas.
3. **App depois.**
4. Voltar atrás: publicar de novo o commit anterior nos dois serviços, app
   primeiro. As tabelas novas ficam no banco sem uso; perfis ligados deixam
   de aparecer.

## Gate humano

- [ ] Merge: sim do Stefan, com as nove escolhas de regra e de dado por
      extenso na pergunta.
- [ ] Publicação (76d): outro sim, depois do merge.
- [ ] Fechamento da issue #354: outro sim.
