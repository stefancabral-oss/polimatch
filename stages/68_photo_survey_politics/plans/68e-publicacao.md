# 68e — Publicação da pesquisa por foto, escondida

Entrega 68e da issue #324. Publica a API e o app com a pesquisa por foto
ligada e a página fora do menu e do sitemap, para o Stefan testar no ar. A
entrada na capa e o sitemap ficam para um passo separado, com outro sim.

Cada passo abaixo só acontece com o sim do Stefan para aquele passo. Contra
produção, o agente só lê (GET), fora os cliques de Deploy que ele autorizar.

## Antes de começar

- `main` com a 68d mesclada e o CI de push verde.
- Produção em 14/11/2026, 08h, lida por GET: está como ficou na publicação de
  13/11 (commit `7a4c9db`). `GET /api/photo-surveys/politica-2026-01` e
  `/pesquisa.html` respondem 404; `/version.json` também, porque o estágio 45
  ainda não foi publicado; as quatro páginas respondem 200 e o sitemap lista
  só elas.
- O deploy leva tudo o que entrou na `main` desde então: o estágio 45
  (identificação do commit em produção, #314), a 68b (servidor), a 68c (tela)
  e a 68d (correções). Sem `SOURCE_COMMIT` no build, a API segue anunciando
  `revision: null` e o app passa a servir `version.json` com `sha: "unknown"`
  (ver `docs/ops/RELEASE.md`); isso não muda nesta entrega.
- O service worker do site não intercepta requisições, e o nginx do app serve
  qualquer `.html` existente: a página nova não depende de configuração.
- As 20 cartas da pesquisa já estão no ar, pelo jogo atual. Oito vêm de fotos
  de veículos ou de sites (#284): o Stefan confirma o uso delas neste teste
  escondido, ou a publicação espera as cartas refeitas.
- As respostas dadas antes do lançamento ficam gravadas para sempre, como
  toda resposta. A pesquisa `politica-2026-01` passa a ser tratada como
  ensaio; a de lançamento nasce com outro código, zerada.

## Passos

| # | Passo | Quem | Conferência |
|---|---|---|---|
| 1 | Cópia do banco de produção, como em 13/11/2026 | agente, no painel, com o sim | arquivo criado, com tamanho; contagem das tabelas anotada |
| 2 | `PHOTO_SURVEYS_ENABLED=true` na API | Stefan, na aba Environment (ou autoriza o agente a abrir a aba, que mostra segredos) | variável salva |
| 3 | Deploy da API | agente, botão Deploy, com o sim | `/api/health` ok; log com `database_ready` e `resetApplied: false`; tabelas antigas com a mesma contagem; `photo_survey_draws` e `photo_survey_responses` criadas e vazias; `GET` da pesquisa 200 com `status: open` |
| 4 | Deploy do app | agente, botão Deploy, com o sim | `/pesquisa.html` 200 com `noindex`; `sitemap.xml` sem a página; a capa sem link para ela; as quatro páginas antigas 200 |
| 5 | Teste do Stefan no celular | Stefan | `polimatch.com.br/pesquisa.html` |

Se a API não subir no passo 3, o agente para e avisa; não conserta no escuro.

## Voltar atrás

- Tirar `PHOTO_SURVEYS_ENABLED` e publicar a API de novo: as rotas voltam a
  responder 404 e a página diz que a pesquisa não está disponível. As
  respostas já gravadas ficam no banco.
- A página segue fora do menu e do sitemap; ninguém chega nela sem o endereço.

## O que o teste no ar tem de diferente do local

- São três pessoas novas por rede por dia: três testes no Wi-Fi, mais três no
  4G. Quem entrou com Google na capa responde com a conta.
- Cada resposta é única e não muda. Para testar de novo, é outra pessoa
  (outro aparelho, aba anônima ou outra rede).

## Fica para depois, com outro sim

- A entrada na capa e a página no sitemap.
- Antes de chamar gente de fora: política de privacidade (#283), backup
  externo (#279), o destino da edição Eleições 2026 (#285) e a decisão sobre
  a cota de três por rede.

## O que aconteceu em 14/11/2026

Cada passo teve o sim do Stefan em conversa, transcrito no HANDOFF do estágio.

| # | Passo | Resultado |
|---|---|---|
| 1 | Cópia do banco | `pg_dump` no contêiner do banco, sem erro: 592.947 bytes, 27 tabelas. Fica em `/tmp/pre-deploy-20261114.dump`, dentro do contêiner; é provisória, como a de 13/11, que continua lá. A contagem de linhas das 27 tabelas foi gravada antes do deploy |
| 2 | `PHOTO_SURVEYS_ENABLED=true` | O Stefan pediu que o agente abrisse a aba Environment da API. A linha foi acrescentada e salva; as quatro variáveis que já existiam ficaram idênticas, conferidas por tamanho e por resumo de cada linha, antes e depois de salvar, sem ler os valores |
| 3 | Deploy da API | Commit `eb729ed`, 35 s. De fora, a cada 5 s por 6 min: 72 respostas 200 em `/api/health`, nenhuma queda; a rota da pesquisa passou de 404 para 200, com `status: open`, 20 cartas e sorteio de 16. Log: `database_ready` com `resetApplied: false`, sem linha de erro. Banco: 24 tabelas com a mesma contagem; `photo_survey_draws` e `photo_survey_responses` criadas e vazias; migração `2026-11-13-photo-survey-v1` registrada; `abuse_quota_counters` de 66 para 61, a poda que a API faz ao subir |
| 4 | Deploy do app | O Stefan confirmou o uso das 20 cartas atuais. Commit `eb729ed`, 27 s. De fora, a cada 5 s: a capa respondeu 200 em todas as consultas; `/pesquisa.html` passou de 404 para 200 |
| 5 | Teste do Stefan no celular | com ele |

Conferido de fora depois do passo 4, só por GET e por um pré-voo de CORS, que
não grava nada:

- `/pesquisa.html` responde 200, com `noindex`; os cinco arquivos que ela
  carrega respondem 200, e o JavaScript publicado traz os textos da 68d.
- As 40 imagens das 20 cartas (dois tamanhos cada) respondem 200.
- O `sitemap.xml` lista só as quatro páginas antigas, e nenhuma delas aponta
  para a pesquisa.
- O pré-voo de `https://polimatch.com.br` para a rota do sorteio é aceito pela
  API.
- `version.json` existe, com `sha: "unknown"`, e a API segue com
  `revision: null`: o build do Dokploy não recebe `SOURCE_COMMIT` (#287).

Não foi feito: abrir a página de produção num navegador automatizado. O
primeiro toque em "Começar" em produção é do Stefan.
