# HANDOFF — [ICM 45] Saber qual commit está no ar e rodar CI em main

## Status

- Estado: `pronto para gate`
- Issue: #287
- Branch: `chore/release-identity-ci` (base main 7c0bb27)
- PR: não aberto por este agente
- Último commit: ver `git log` da branch

## Entregue

- **Revisão no app.** `app/Dockerfile` aceita `SOURCE_COMMIT` e `POLIMATCH_REQUIRE_RELEASE` e os repassa ao Vite. O plugin `app/scripts/release-identity.mjs` grava `dist/version.json` com `{sha, builtAt}` e a meta `polimatch-release` nas quatro páginas. Sem SHA, o build segue com `unknown` e um aviso, então o deploy atual do Dokploy não quebra. Com `POLIMATCH_REQUIRE_RELEASE=1` (ligado no CI), a falta vira erro. SHA malformado sempre falha, igual à API. `GITHUB_SHA` serve de reserva no CI.
- **SHA fora do JS.** Os chunks com hash só mudam quando o código do app muda. Builds de dois SHAs diferentes geram JS e CSS idênticos; só o HTML (meta) e o `version.json` mudam.
- **Retratos versionados pelo conteúdo.** `app/src/photos.js` troca o `?v=<horário do build>` pelos oito primeiros caracteres do sha256 de cada imagem de `public/portraits/**` e `public/chromas/approved/**`. É o mesmo hash do `shared/photo-recovery-manifest.json` e do `shared/presidential-roster.json`, e um teste confere isso. Dois builds do mesmo commit geram o mesmo `dist` byte a byte, exceto `version.json` (`builtAt`).
- **Cadeia da API conferida localmente.** A linha `RUN` do `back/Dockerfile`, executada com `SOURCE_COMMIT=<SHA>` numa cópia temporária, grava `release-identity.js`, e `GET /api/health` responde `revision` igual ao SHA. SHA curto falha; vazio grava `""` (`revision: null`).
- **CI em push para main.** Novo `.github/workflows/ci.yml` dispara em todo pull request e em todo push para main, sem filtro de caminho no gatilho. O job `changes` usa `dorny/paths-filter` fixado no commit da v4.0.3 e só roda em pull request. As quatro suítes viraram workflows reutilizáveis (`workflow_call`) e continuam com disparo manual.
- **`ci-gate`.** Sempre roda. Em pull request aceita `success` ou `skipped`. Em push e execução manual exige `success`. `failure` e `cancelled` derrubam o gate. Se o `changes` falhar, o gate também cai.
- **Filtros com dependências cruzadas conhecidas.** `back_shared` passa a incluir `app/src/photos.js` e as saídas do estágio 17, que os testes do back leem. `design` inclui `back/src/**` e as evidências dos estágios 23 e 29, que os testes do app leem.
- **Release conferido no CI.** O design validator confere `dist/version.json`, `version.json` dentro da imagem do app e a meta contra `GITHUB_SHA`. O smoke confere `/version.json` no preview. O back-shared confere `EMBEDDED_RELEASE_REVISION == GITHUB_SHA` na imagem da API.
- **Ruleset preparado, não aplicado.** `docs/ops/ruleset-main.json` exige PR, `ci-gate` vindo do app GitHub Actions (id 15368) e conversas resolvidas, e bloqueia force-push e deleção. Não exige segundo revisor e não tem bypass. Os comandos exatos estão em `docs/ops/RELEASE.md`.
- **Documentação.** `docs/ops/RELEASE.md` cobre release, Dokploy, CI e ruleset. O README ganhou o build-arg `SOURCE_COMMIT` do app.

## Não entregue / pendente

- **Ação do Stefan:**
  1. Revisar e mesclar o PR desta branch.
  2. Depois do merge, confirmar o primeiro run de push: `gh run list --workflow ci.yml --branch main --event push --limit 1`.
  3. Aplicar o ruleset e a limpeza de branches:
     - `gh api --method POST repos/stefancabral-oss/polimatch/rulesets --input docs/ops/ruleset-main.json`
     - `gh api --method PATCH repos/stefancabral-oss/polimatch -F delete_branch_on_merge=true`

     Verificar com os comandos da seção "Ruleset de main" do RELEASE.md.
  4. Provar o bloqueio com um PR de teste que quebre um teste de propósito: `gh pr merge` precisa recusar com `ci-gate` vermelho. Depois fechar o PR sem mesclar.
  5. Atualizar com main ("Update branch") os PRs abertos antes desta mudança. Sem isso eles não recebem `ci-gate`.
  6. Dokploy: ele não injeta o SHA sozinho (consulta de 31/10/2026; Dokploy/dokploy#4006 e #2715 abertos, PR #4007 não mesclado). Escolher um caminho:
     - ICM 50 (recomendado): imagem construída no CI com o SHA e Dokploy com fonte "Docker image".
     - Provisório: autodeploy desligado e, antes de cada deploy, em API e app → Environment → Build Time Arguments, `SOURCE_COMMIT=<SHA completo de origin/main>`, o mesmo nos dois.

     Não deixar um valor fixo com o autodeploy ligado.
  7. Depois do próximo deploy feito com o SHA: `curl -s https://api.polimatch.com.br/api/health | jq -r .revision` e `curl -s https://polimatch.com.br/version.json | jq -r .sha` iguais a `git rev-parse origin/main`.
  8. Opcional: ligar `strict_required_status_checks_policy` no JSON, se quiser exigir branch atualizada antes do merge. A troca é revalidar o CI a cada merge.
- O aceite "revision e sha iguais a origin/main no próximo deploy" depende do passo 6. Sem ele, a produção continua com `null`/`unknown`, agora sem quebrar o build.
- O comportamento real do `ci-gate`, do filtro e do primeiro push em main só aparece no GitHub Actions depois do push da branch.
- A seção desta issue no `CONTEXT.md` da raiz não foi escrita, para evitar conflito com os estágios paralelos. Registrar ao mesclar.
- `/version.json` sai sem `Cache-Control` (só ETag/Last-Modified). Headers do nginx são escopo do ICM 38; o arquivo deve receber `no-cache` lá.
- O smoke `photo-recovery.mjs` importa `back/src`, mas o filtro `ui_smoke` continua sem `back/**`, por decisão registrada no próprio workflow. O push em main cobre isso depois do merge. Remover a importação é escopo do ICM 66.

## Testes executados

- `npm test --prefix app`: 243/243. Eram 226; os 17 novos estão em `release-identity.test.js` (9), `ci-workflows.test.js` (7) e `photos.test.js` (+1).
- `npm test --prefix back`: 232/232.
- `npm run test:shared`: 93/93, mais a taxonomia validada.
- `npm run test:card-art-pilot-contract --prefix app`: 64/64.
- `npm run editorial:verify --prefix back`: ok.
- Builds:
  - com `SOURCE_COMMIT`: `version.json` e meta com o SHA;
  - sem SHA: aviso e `unknown`, rc 0;
  - `POLIMATCH_REQUIRE_RELEASE=1` sem SHA: rc 1;
  - SHA curto: rc 1;
  - `GITHUB_SHA` com a opção ligada: rc 0.
- Determinismo: dois builds do mesmo commit têm `dist` idêntico, exceto `version.json`. Um SHA diferente muda só os quatro HTML e o `version.json`. Nenhum JS contém o SHA.
- Navegador sobre o build servido pelo `app/nginx.conf` local: `/version.json` sai como `application/json`; antes da mudança, o preview devolvia o HTML de fallback. A página do quiz pede `/portraits/001.jpg?v=a791320d` e `/portraits/002.jpg?v=ed10021c`, iguais ao manifesto.
- E2E do smoke contra o preview local:
  - Chromium: 26/26.
  - WebKit: 21/26. As cinco falhas (`quote-quiz-checked`, `interaction-smoke` com e sem Google, `accessible-profile` e `civic-navigation`) se repetem com a mesma mensagem no build de main@7c0bb27. São foco por Tab no WebKit do macOS e um tempo esgotado já presente em main, não regressão. No CI, Linux.
  - O Chromium local é o 140.0.7339.16 em cache (revisão 1187), mapeado para o caminho que o Playwright 1.55.1 espera.
- Workflows:
  - actionlint (build wasm via npm, em pasta temporária): 0 problemas nos cinco arquivos; um controle negativo foi detectado;
  - parse YAML dos cinco arquivos e do texto de filtros;
  - simulação dos filtros com picomatch (`dot: true`, como o dorny);
  - mutações no gate (aceitar `failure`, trocar `always()`) derrubam `ci-workflows.test.js`.

## Riscos conhecidos

- Conflitos previsíveis de merge com o ICM 38 (passo depois do `docker build` em `design-validator.yml`), o ICM 50 (deploy), o ICM 52 (fixar actions) e o ICM 59 (CI). Os trechos tocados aqui são pequenos e localizados.
- Os nomes dos checks das suítes mudam (`design-validator / validate`, `ui-interaction-smoke / browser-smoke (chromium)` etc.). Nenhuma proteção dependia deles; o ruleset exige só `ci-gate`.
- O chunk `photos-*.js` passa de 0,65 KB (0,40 KB gzip) para 10,4 KB (3,4 KB gzip), por causa do mapa de 216 hashes. O chunk é carregado pela home, pelo quiz e pelo Fato ou fake.
- No primeiro deploy, todas as URLs de retrato e o nome do chunk principal mudam uma vez. Depois ficam estáveis enquanto os arquivos não mudarem.
- `dorny/paths-filter` é uma action de terceiros, fixada por commit, com `pull-requests: read` só no job `changes`.
- Sem bypass no ruleset, uma correção urgente com CI vermelho exige desligar o ruleset temporariamente (comando no RELEASE.md).
- Imagens servidas por `photos.js` fora de `portraits/` e `chromas/approved/` saem sem `?v=`. Hoje nenhuma imagem servida por ali fica fora dessas pastas.

## Decisões tomadas

- Workflows reutilizáveis chamados por `ci.yml`, em vez de `push` em cada arquivo. O `ci-gate` precisa estar no mesmo run das suítes para enxergar o resultado, e gatilhos duplicados rodariam tudo duas vezes. O efeito pedido (todas as suítes em todo push para main, sem filtro) fica garantido pelo `ci.yml`.
- `import.meta.env.VITE_RELEASE` foi testado e descartado. O app referencia `import.meta.env` inteiro (`google-login.js`, `civic/shell.js`), e o SHA entraria no chunk principal, mudando o nome do JS a cada commit, inclusive nos que só mexem no back. A revisão fica exposta na meta `polimatch-release` e em `/version.json`.
- Hash de oito caracteres hexadecimais, só nas pastas que passam por `photos.js`. As demais Chromas já trazem o hash no nome.
- Teste de contexto Docker atualizado. O comando da imagem ganhou `--build-arg`, e a regex passa a aceitar build-args mantendo a raiz como contexto; foi acrescentada uma checagem do `SOURCE_COMMIT`. A lista de caminhos agora é lida do filtro `design` em `ci.yml`, sem perder nenhum caminho.
- `back/src/photo-recovery.test.js` e `app/src/photos.test.js` esperavam `?v=test`, um marcador que só existia fora do build. Em Node o mapa de hashes é vazio e a URL sai sem `?v=`; a versão por conteúdo é testada à parte com o mapa real.
- Ruleset com conversas resolvidas, como pede a issue, `strict` desligado e `integration_id` do GitHub Actions, para que um status de mesmo nome vindo de outra origem não satisfaça a regra.

## Próximo passo exato

1. Stefan revisa a branch `chore/release-identity-ci`, abre e mescla o PR. O CI do próprio PR já roda pelo `ci.yml` novo.
2. Seguir a lista "Ação do Stefan" acima, na ordem.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan
- Observação: nenhum agente aprova este gate, mescla ou publica. Ruleset, `delete_branch_on_merge` e Dokploy ficam com o Stefan.
