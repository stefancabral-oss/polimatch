# ICM 76 — Rodadas contínuas, resultado da pessoa, feed e perfil — #354

Base: `main` em `5934e46`.
Ler o contexto raiz, o `AGENTS.md`, as decisões 0004, 0007 e 0008, a
política `docs/security/VOTE_ABUSE_POLICY.md` e o contexto do estágio 75.

## Objetivo

Decisão 0008: as rodadas seguem sem perguntar; a pessoa vê o próprio
resultado prévio quando pede; quem entrou vê um feed das pesquisas; cada
pessoa pode ligar um perfil público com a primeira colocada de cada pesquisa
que ela marcar.

## Regras

1. **Pontos.** Para uma pessoa e uma pesquisa, cada rodada respondida dá 3
   pontos à campeã da final e 1 ponto a cada vencedora de tela (as cartas de
   `pickIds`). Ordem: pontos; depois vitórias na final; depois vitórias em
   tela; depois a ordem de `cardIds` da pesquisa. Só entram cartas com ao
   menos 1 ponto. Cartas que saíram da pesquisa não entram.
2. **Rodadas da pessoa:** as mesmas que o progresso da 0007 usa (identidade,
   rodada 1 mais rodadas seguintes respondidas).
3. **Perfil.** Pertence à conta (provider + subject), como o cadastro. Só
   conta com cadastro com CPF liga perfil. Nasce desligado. Ligar exige
   `consentVersion` igual à versão atual do aceite do perfil, um nome de
   perfil válido e livre, e grava a data do aceite. Desligar não exige aceite nem cadastro (só a conta)
   e vale na hora. As marcações de pesquisa ficam guardadas mesmo com o
   perfil desligado.
4. **Nome de perfil:** `^[a-z0-9_]{3,20}$` depois de passar para minúsculas;
   único; nomes reservados recusados (`admin`, `polimatch`, `perfil`,
   `suporte`, `ajuda`, `api`, `www`). Depois de gravado, o nome não muda
   (400 `PROFILE_INVALID`, motivo `handle-locked`) e não volta a ficar livre
   enquanto a conta existir.
5. **Perfil público:** só existe com perfil ligado. Mostra o nome de perfil
   e, para cada pesquisa marcada em que a pessoa tem ao menos uma rodada
   respondida, `{ surveyId, subject, question, cardId }` da primeira
   colocada, na ordem de `PHOTO_SURVEYS`. Perfil desligado e nome inexistente
   respondem igual (404 `PROFILE_NOT_FOUND`).
6. **Nada de soma.** Nenhuma rota devolve contagem de outras pessoas.

## Contrato da API

Aditivo; nenhuma rota existente muda.

`GET /api/photo-surveys/:surveyId/result` — com sessão de conta com cadastro
(mesmas recusas do sorteio). Resposta:
`{ surveyId, answeredRounds, ranking: [{ cardId, points, finalWins, screenWins }] }`.
Sem rodada respondida: `answeredRounds: 0`, `ranking: []`.

`GET /api/me/profile` — com sessão de conta Google (cadastro não exigido para
ler). Resposta:
`{ enabled, handle, consentVersion, consentedAt, surveys: [surveyId], firstPlaces: [{ surveyId, cardId }], canEnable }`.
`canEnable` é falso sem cadastro. `firstPlaces` traz todas as pesquisas em que
a pessoa tem rodada respondida, marcadas ou não (é a vista dela).

`PUT /api/me/profile` — com sessão de conta Google. Ligar e mudar marcações
exigem cadastro; sem cadastro, o pedido só desliga e não grava marcações.
Corpo:
`{ enabled: boolean, handle?: string, surveys?: [surveyId], consentVersion?: string }`.
- `enabled: true` exige `handle` válido e livre (ou o atual) e
  `consentVersion` igual a `PROFILE_CONSENT_VERSION`.
- `enabled: false` só desliga; `surveys` pode vir junto.
- Recusas: 400 `PROFILE_INVALID` (motivo `handle`, `handle-locked`,
  `surveys`, `enabled`),
  400 `PROFILE_CONSENT_REQUIRED`, 409 `PROFILE_HANDLE_TAKEN`, 403
  `CPF_REGISTRATION_REQUIRED`.
- Resposta: a mesma de `GET /api/me/profile`.

`GET /api/profiles/:handle` — pública, sem sessão. Resposta:
`{ handle, surveys: [{ surveyId, subject, question, cardId }] }` ou 404
`PROFILE_NOT_FOUND`. `Cache-Control: no-store`.

## Banco

Tabelas novas, criadas na subida da API, migração
`2026-11-26-profiles-v1`:

- `profile_settings(provider, subject, handle, enabled, consent_version, consented_at, updated_at)`,
  chave `(provider, subject)`, `handle` único (índice em `lower(handle)`),
  referência a `player_identities`.
- `profile_surveys(provider, subject, survey_id)`, chave nos três.

Não são imutáveis: a pessoa liga, desliga e muda marcações. Nenhuma tabela
existente muda.

## Regras compartilhadas (`shared/`)

- `shared/profile.js`: `PROFILE_CONSENT_VERSION`, `PROFILE_CONSENT_TEXT`,
  `normalizeHandle`, `isValidHandle`, `RESERVED_HANDLES`.
- `shared/photo-survey.js`: `personalRanking(survey, rounds)`, com `rounds`
  no formato de `seenPairKeys` mais `championId`.

Texto do aceite (versão `2026-11-26`):
"Quero mostrar no meu perfil público, para quem tiver o link, a carta em
primeiro lugar nas minhas escolhas das pesquisas que eu marcar, inclusive de
política. Posso desmarcar pesquisas ou desligar o perfil quando quiser."

## Tela

1. **Rodada contínua.** Ao confirmar, aviso "Rodada registrada" e, sem
   toque, o sorteio da rodada seguinte com `next: true`. Sem confronto por
   ver, ou com a pesquisa fora da janela, vai para o resultado. A tela de
   resposta registrada com "Mais uma rodada" deixa de existir no fluxo. A
   página de uma pesquisa já respondida abre no resultado, com "Continuar
   votando" se cabe rodada: abrir a página nunca emite rodada. Só volta
   direto ao voto quem tem escolha guardada no aparelho para a rodada
   aberta.
2. **Ver meu resultado.** Link discreto nas telas de voto e na confirmação;
   abre o resultado: a primeira colocada grande, as seguintes em lista
   (até 5), quantas rodadas e quantos confrontos vistos, "Continuar votando"
   (se há rodada) e "Compartilhar" (imagem da primeira colocada, como hoje).
3. **Feed.** Na capa de quem entrou: cartões das pesquisas abertas, em
   `PHOTO_SURVEYS`, com estado ("Começar", "Continuar", "Ver meu resultado")
   e, nas respondidas, a primeira colocada da pessoa. Quem não entrou vê a
   capa de hoje.
4. **Meu perfil** (`meu-perfil.html`, no menu só com conta): estado ligado ou desligado; para
   ligar, nome de perfil, marcação das pesquisas (nenhuma marcada), o texto
   do aceite e o botão "Ligar meu perfil"; ligado, o link para copiar, as
   marcações e "Desligar".
5. **Perfil público** `perfil.html?u=<nome>`: nome de perfil e grade de
   fotos (uma por pesquisa), com assunto embaixo; `noindex`; perfil não
   encontrado com a mesma mensagem para desligado e inexistente.
6. **Textos de privacidade.** "Como funciona", item 5: "Um CPF, uma pessoa:
   todas as suas rodadas contam como a resposta de uma pessoa só."; nota: "Do
   PoliMatch só sai o resultado somado. A sua escolha só aparece no perfil
   que você ligar, e só nas pesquisas que marcar. Do CPF guardamos só um
   código, nunca o número." Tela do cadastro: título "Um CPF, uma pessoa. A
   sua escolha só aparece no perfil que você ligar." e a nota sobre o CPF
   termina em "A sua escolha só aparece no perfil que você ligar." (textos
   encurtados para caber em 360×640 com a fonte do Linux).

## Entregas

| Parte | O que traz |
|---|---|
| 76a — Registro | Decisão 0008, este contexto, política de integridade do voto versão 7 |
| 76b — Regras e servidor | `shared/profile.js`, `personalRanking`, tabelas, quatro rotas, testes |
| 76c — Tela | Rodada contínua, resultado, feed, meu perfil, perfil público, textos; testes e roteiros |
| 76d — Publicação | API e app, com o sim do Stefan, depois da revisão jurídica que ele decidir |

## Critérios de aceite

- Confirmar uma rodada leva à seguinte sem toque enquanto houver confronto.
- O resultado bate com a regra de pontos em teste com rodadas conhecidas.
- Perfil nasce desligado; ligar sem aceite é recusado; desligar esconde na
  hora; pesquisa não marcada nunca aparece no perfil público.
- Perfil desligado e inexistente respondem igual.
- Nenhuma rota devolve soma de outras pessoas.
- Os roteiros de navegador dos estágios 68 a 75 passam, ajustados onde a tela
  mudou de propósito.

## Gate humano

Merge e publicação pedem o sim do Stefan, um a um. A pergunta do merge leva
as escolhas 1 a 13 da decisão 0008 por extenso. A publicação do perfil depende
da revisão jurídica que ele decidir fazer.
