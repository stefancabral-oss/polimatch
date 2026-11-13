# Entrega 68b — Regras e servidor da pesquisa por foto: plano de implementação

> **Para quem executa:** seguir tarefa por tarefa, com teste antes do código.
> Os passos usam caixas (`- [ ]`) para acompanhar.

**Objetivo:** o servidor emite, por jogador, um sorteio de 16 entre as 20
cartas de política e grava, uma única vez, a resposta dele.

**Arquitetura:** regras puras em `shared/photo-survey.js`. Banco e transações
em `back/src/photo-survey-store.js`, no molde de `back/src/game-progress.js`:
uma função `install…Schema(client)` chamada no `init()` do store e um
sub-store misturado com `Object.assign`. Três rotas novas em
`back/src/http-app.js`. Nada do jogo atual muda.

**Stack:** Node 22 (ESM, `node --test`), Express 5, `pg`, PostgreSQL 16.

**Especificação:** `stages/68_photo_survey_politics/CONTEXT.md`, seções
"O formato desta etapa", "Regras" e os critérios de aceite da 68b.

## Restrições globais

- `back/src/topic-store.js` muda no registro (um import, uma linha no
  `init()`, um `Object.assign` e a opção `photoSurveys` para testes) e em um
  ponto do login Google, descoberto na Tarefa 2: `combineGoogleHistory`
  devolvia `null` para o anônimo sem escolhas no jogo, o que deixava solta a
  participação dele na pesquisa. Ele passa a ser ligado à conta, com status
  `linked`, quando tem sorteio emitido, e nesse caso nada do jogo é somado.
- Tabelas novas são aditivas (`CREATE TABLE IF NOT EXISTS`) e imutáveis, com o
  gatilho `reject_vote_mutation()` que o jogo já usa.
- A resposta não toca `votes`, `choice_rounds`, `ranking_stats`,
  `player_stats` nem `abuse_quota_counters`.
- Nenhuma rota nova devolve soma de respostas (gate #177).
- As rotas nascem desligadas: só `PHOTO_SURVEYS_ENABLED=true` as liga. Sem
  isso respondem 404 `PHOTO_SURVEYS_DISABLED`. Acrescentado ao fim da
  entrega, para um deploy da API não abrir a pesquisa antes da publicação.
- Erros de domínio são `Error` com `.status`, `.code` e `.current` opcional,
  como no resto da API.
- Todo smoke em `back/scripts/*-smoke.mjs` chama `requireDisposableDatabase()`
  no topo.
- Identificador da pesquisa: `politica-2026-01`. Pergunta: "Quem você
  prefere?". 20 cartas, sorteio de 16, telas de 4.

## Foco de revisão

Entradas que a especificação implica e que precisam de teste próprio:

1. Duas abas confirmam escolhas diferentes ao mesmo tempo: uma grava, a outra
   recebe 409 com a resposta gravada. (Tarefa 2, smoke)
2. A pesquisa fecha entre o sorteio e a resposta: 409 `PHOTO_SURVEY_CLOSED`,
   nada gravado. (Tarefa 2, smoke)
3. O jogador anônimo responde e depois entra no Google: a conta enxerga a
   resposta e não responde de novo. (Tarefa 2, smoke)
4. Corpo malformado: `pickIds` que não é lista, ids repetidos, `answerId` que
   não é UUID. 400, nada gravado. (Tarefas 1 e 3)
5. Uma carta sai do conjunto depois de sorteios emitidos: a resposta é
   validada contra o sorteio gravado, não contra o conjunto atual. (Tarefa 1)

---

### Tarefa 1: Regras puras

**Arquivos:**
- Criar: `shared/photo-survey.js`
- Teste: `shared/photo-survey.test.js`

**Interfaces (produz):**
- `PHOTO_SURVEYS`: lista congelada de definições
  `{ id, question, cardIds, drawSize, groupSize, opensAt, closesAt }`.
  `opensAt` e `closesAt` são ISO ou `null` (sem limite).
- `photoSurveyById(id, surveys = PHOTO_SURVEYS)` → definição ou `null`.
- `photoSurveyStatus(survey, now)` → `"scheduled" | "open" | "closed"`.
- `publicPhotoSurvey(survey, now)` →
  `{ id, question, cardIds, drawSize, groupSize, screens, opensAt, closesAt, status }`.
- `drawCards(survey, randomInt)` → lista de `drawSize` ids. `randomInt(n)`
  devolve inteiro em `[0, n)`.
- `drawGroups(shownIds, groupSize)` → lista de grupos, em ordem.
- `validateBracket(survey, shownIds, { pickIds, championId })` →
  `{ ok: true, pickIds, championId }` ou `{ ok: false, reason }`, com `reason`
  em `"shown" | "picks" | "pick-outside-group" | "champion"`.

- [x] **Passo 1: testes que falham**, em `shared/photo-survey.test.js`:
  - a definição `politica-2026-01` tem 20 `cardIds` únicos e ordenados,
    `drawSize` 16, `groupSize` 4 e a pergunta "Quem você prefere?";
  - `drawCards` com `randomInt` fixo devolve 16 ids únicos do conjunto, e com
    um gerador com semente, em 20.000 sorteios, cada carta entra entre 78% e
    82% das vezes e ocupa cada uma das 16 posições entre 4% e 6% das vezes;
  - `drawGroups` devolve 4 grupos de 4, na ordem do sorteio;
  - `validateBracket` aceita uma chave válida e recusa: `shownIds` de outro
    tamanho ou com repetição; `pickIds` que não é lista de 4; escolha fora do
    grupo da tela; campeã fora das quatro; e aceita carta que saiu do
    conjunto, se está no sorteio;
  - `photoSurveyStatus` devolve `scheduled` antes de `opensAt`, `open` no
    intervalo e `closed` a partir de `closesAt`; com os dois `null`, `open`.
- [x] **Passo 2:** `node --test shared/photo-survey.test.js` falha por módulo
  ausente.
- [x] **Passo 3: implementar.** `drawCards` usa Fisher–Yates parcial sobre a
  cópia de `cardIds`: para `i` de 0 a `drawSize - 1`, troca a posição `i` com
  `i + randomInt(n - i)`.
- [x] **Passo 4:** `npm run test:shared` passa.
- [x] **Passo 5:** commit.

### Tarefa 2: Tabelas e armazenamento

**Arquivos:**
- Criar: `back/src/photo-survey-store.js`
- Criar: `back/scripts/photo-survey-smoke.mjs`
- Modificar: `back/src/topic-store.js` (import; `await installPhotoSurveySchema(client)`
  depois de `installGameSchema`; `Object.assign(store, photoSurveyStore({ pool, findPlayer, clock }))`)
- Modificar: `back/package.json` (script `test:photo-survey`)

**Interfaces:**
- Consome: tudo da Tarefa 1; `findPlayer(client, accessToken)` → `{ id }`,
  que já trava `player:<id>`.
- Produz: `installPhotoSurveySchema(client)` e
  `photoSurveyStore({ pool, findPlayer, clock, surveys = PHOTO_SURVEYS, randomInt = crypto.randomInt })`
  com:
  - `photoSurvey(surveyId, { now })` → `publicPhotoSurvey`; 404
    `PHOTO_SURVEY_NOT_FOUND`.
  - `photoSurveyDraw(recoveryKey, surveyId, { now })` →
    `{ survey, draw: { groups }, response }`, com `response` `null` ou
    `{ answerId, pickIds, championId, respondedAt }`.
  - `photoSurveyRespond({ recoveryKey, surveyId, answerId, pickIds, championId, now })` →
    `{ status: "created" | "alreadyProcessed", survey, draw, response }`.

**Tabelas** (migração `2026-11-13-photo-survey-v1`):

```sql
CREATE TABLE IF NOT EXISTS photo_survey_draws (
  survey_id text NOT NULL,
  player_id uuid NOT NULL REFERENCES anonymous_players(id),
  shown_ids text[] NOT NULL CHECK (cardinality(shown_ids) > 0),
  issued_at timestamptz NOT NULL,
  PRIMARY KEY (survey_id, player_id)
);
CREATE TABLE IF NOT EXISTS photo_survey_responses (
  survey_id text NOT NULL,
  player_id uuid NOT NULL REFERENCES anonymous_players(id),
  answer_id uuid NOT NULL UNIQUE,
  shown_ids text[] NOT NULL,
  pick_ids text[] NOT NULL,
  champion_id text NOT NULL,
  responded_at timestamptz NOT NULL,
  PRIMARY KEY (survey_id, player_id),
  FOREIGN KEY (survey_id, player_id) REFERENCES photo_survey_draws (survey_id, player_id)
);
```

As duas recebem o gatilho `…_are_immutable` com `reject_vote_mutation()`.

**Regras de comportamento:**
- "Identidade" é o jogador mais os anônimos ligados a ele em
  `player_history_links` (mesmo padrão de `game-progress.js`). A resposta
  procurada é a mais antiga da identidade.
- `photoSurveyDraw`: se a identidade já respondeu, devolve a resposta com o
  sorteio dela. Senão, devolve o sorteio do jogador; se não existe, cria,
  desde que a pesquisa esteja `open` (senão 409 `PHOTO_SURVEY_CLOSED`).
- `photoSurveyRespond`: `answerId` tem de ser UUID (400
  `PHOTO_SURVEY_RESPONSE_INVALID`). Se a identidade já respondeu: as mesmas
  escolhas devolvem `alreadyProcessed`, com qualquer `answerId`; outra
  escolha dá 409 `PHOTO_SURVEY_ALREADY_ANSWERED` com `current`, mesmo com o
  mesmo `answerId`. Sem resposta: exige sorteio
  do jogador (409 `PHOTO_SURVEY_DRAW_REQUIRED`), pesquisa `open` (409
  `PHOTO_SURVEY_CLOSED`) e chave válida (400
  `PHOTO_SURVEY_RESPONSE_INVALID`); grava com o relógio do servidor.
- Cada operação com jogador roda em transação. A trava é a do próprio
  `findPlayer` (`player:<id>`), que já enfileira as abas do mesmo jogador.

- [x] **Passo 1: smoke que falha**, `back/scripts/photo-survey-smoke.mjs`, no
  molde de `game-progress-smoke.mjs`, com `requireDisposableDatabase()` no
  topo. Cobre, com `assert`:
  - sorteio: 4 grupos de 4, ids do conjunto, e o mesmo sorteio numa segunda
    chamada e para a mesma chave em paralelo (duas chamadas simultâneas);
  - resposta válida grava uma linha; repetir com o mesmo `answerId` devolve
    `alreadyProcessed` e não grava outra; outro `answerId` com outras
    escolhas dá 409 `PHOTO_SURVEY_ALREADY_ANSWERED` com `current`;
  - duas respostas diferentes em paralelo: exatamente uma `created`;
  - forjadas dão 400 e não gravam: carta fora do sorteio, escolha de outra
    tela, campeã fora das quatro, `pickIds` malformado, `answerId` inválido;
  - responder sem sorteio dá 409 `PHOTO_SURVEY_DRAW_REQUIRED`;
  - pesquisa fechada (definição de teste com `closesAt` no passado): sorteio
    e resposta dão 409 `PHOTO_SURVEY_CLOSED`; fechar entre sorteio e
    resposta também;
  - `UPDATE` e `DELETE` diretos nas duas tabelas falham com "imutáveis";
  - contagem de `votes`, `choice_rounds`, `ranking_stats`, `player_stats` e
    `abuse_quota_counters` igual antes e depois das respostas;
  - anônimo responde, entra no Google numa conta que já existia
    (`signInWithGoogle`): `photoSurveyDraw` da conta devolve a resposta, e
    `photoSurveyRespond` dá `PHOTO_SURVEY_ALREADY_ANSWERED`;
  - um segundo `init()` no mesmo banco não falha nem perde linhas.
- [x] **Passo 2:** rodar o smoke contra o PostgreSQL descartável; falha por
  método ausente.
- [x] **Passo 3: implementar** o módulo e o registro no `topic-store.js`.
- [x] **Passo 4:** o smoke passa; `npm test --prefix back` e
  `npm run test:integration --prefix back` continuam passando.
- [x] **Passo 5:** commit.

### Tarefa 3: Rotas

**Arquivos:**
- Modificar: `back/src/http-app.js`
- Teste: `back/src/photo-survey-http.test.js`

**Interfaces (produz):**
- `GET /api/photo-surveys/:surveyId` → `store.photoSurvey`, sem jogador.
- `POST /api/photo-surveys/:surveyId/draw` → `store.photoSurveyDraw`, exige
  `Authorization: Bearer`.
- `POST /api/photo-surveys/:surveyId/response`, corpo
  `{ answerId, pickIds, championId }` → `store.photoSurveyRespond`, exige
  `Bearer`.
- As três respondem com `Cache-Control: no-store` e usam `clock()` como
  `now`.

- [x] **Passo 1: testes que falham**, com store falso, no molde de
  `http-app.test.js`: as duas rotas `POST` sem `Bearer` dão 401
  `PLAYER_SESSION_REQUIRED` sem chamar o store; a `GET` funciona sem
  `Bearer`; cada rota repassa `surveyId`, o corpo e o `now` ao método certo;
  um erro do store com `status` 409, `code` e `current` chega ao cliente com
  os três; as respostas têm `no-store`.
- [x] **Passo 2:** `node --test back/src/photo-survey-http.test.js` falha
  com 404.
- [x] **Passo 3: implementar** as três rotas, antes do `app.use` final de
  erro.
- [x] **Passo 4:** `npm test --prefix back` passa.
- [x] **Passo 5:** commit.

### Tarefa 4: Política de abuso, CI e registro

**Arquivos:**
- Modificar: `docs/security/VOTE_ABUSE_POLICY.md` (versão 4, vinculada também
  à #324; seção "Resposta de pesquisa por foto")
- Modificar: `.github/workflows/back-shared.yml` (passo novo, antes do backup
  e da restauração parcial: `npm run test:photo-survey --prefix back`)
- Modificar: `stages/68_photo_survey_politics/output/HANDOFF.md` e
  `verification.json`

**O que a política passa a dizer:** a resposta de pesquisa é uma por
identidade e pesquisa; não consome a cota de 30 escolhas nem altera o
ranking; a emissão do sorteio não consome cota; o que limita respostas
repetidas por quem apaga o aparelho é a cota de 3 jogos novos por rede; a
resposta é imutável.

- [x] **Passo 1:** escrever a seção da política e subir a versão.
- [x] **Passo 2:** acrescentar o passo do smoke no workflow e conferir
  `npm test --prefix app` (o `ci-workflows.test.js` lê os workflows).
- [x] **Passo 3:** rodar tudo: `npm run test:shared`, `npm test --prefix back`,
  os smokes de integração, abuso, progresso e pesquisa contra o PostgreSQL
  descartável, e `npm test --prefix app`.
- [x] **Passo 4:** atualizar o handoff e a verificação com os números.
- [x] **Passo 5:** commit, PR e revisão independente do ramo inteiro.

## Depois da revisão independente

A revisão do ramo inteiro, somente leitura, não achou bloqueio e reproduziu
dois problemas, corrigidos com teste antes do código:

- Recibo disputado: duas pessoas com o mesmo `answerId` ao mesmo tempo davam
  erro 500 por violação de unicidade. A gravação passou a usar
  `ON CONFLICT (answer_id) DO NOTHING` e responde 400.
- Anônimo com sorteio e sem resposta: não era ligado à conta no login, a chave
  dele continuava valendo e uma aba aberta gravava uma segunda resposta. O
  vínculo passou a acontecer com o sorteio, e não soma nada do jogo.

Também entraram: índice por jogador em `photo_survey_draws`, teste de
uniformidade com pares e vizinhos, e no smoke os casos de conta com duas
respostas e de anônimo que vira o jogador ativo da conta.
