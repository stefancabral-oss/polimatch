# HANDOFF — [ICM 45] Saber qual commit está no ar e rodar CI em main

## Status

- Estado: `aprovado`
- Issue: #287
- Branch: `chore/release-identity-ci` (base main 7c0bb27; recebeu a main 7a4c9db em 13/11/2026)
- PR: #314, mesclado em 13/11/2026 no commit `29edba3`
- Último commit da branch antes do merge: `b0201b9`

## Entregue

- **Revisão no app.** `app/Dockerfile` aceita `SOURCE_COMMIT` e `POLIMATCH_REQUIRE_RELEASE` e os repassa ao Vite. O plugin `app/scripts/release-identity.mjs` grava `dist/version.json` com `{sha, builtAt}` e a meta `polimatch-release` nas quatro páginas. Sem SHA, o build segue com `unknown` e um aviso, então o deploy atual do Dokploy não quebra. Com `POLIMATCH_REQUIRE_RELEASE=1` (ligado no CI), a falta vira erro. SHA malformado sempre falha, igual à API. `GITHUB_SHA` serve de reserva no CI.
- **SHA fora do JS.** Os chunks com hash só mudam quando o código do app muda. Builds de dois SHAs diferentes geram JS e CSS idênticos; só o HTML (meta) e o `version.json` mudam.
- **Retratos versionados pelo conteúdo.** `app/src/photos.js` troca o `?v=<horário do build>` pelos oito primeiros caracteres do sha256 de cada imagem de `public/portraits/**` e `public/chromas/approved/**`. É o mesmo hash do `shared/photo-recovery-manifest.json` e do `shared/presidential-roster.json`, e um teste confere isso. Dois builds do mesmo commit geram o mesmo `dist` byte a byte, exceto `version.json` (`builtAt`).
- **Cadeia da API conferida localmente.** A linha `RUN` do `back/Dockerfile`, executada com `SOURCE_COMMIT=<SHA>` numa cópia temporária, grava `release-identity.js`, e `GET /api/health` responde `revision` igual ao SHA. SHA curto falha; vazio grava `""` (`revision: null`).
- **CI em push para main.** Novo `.github/workflows/ci.yml` dispara em todo pull request e em todo push para main, sem filtro de caminho no gatilho. O job `changes` usa `dorny/paths-filter` fixado no commit da v4.0.3 e só roda em pull request. As quatro suítes viraram workflows reutilizáveis (`workflow_call`) e continuam com disparo manual.
- **`ci-gate`.** Sempre roda. Em pull request aceita `success` ou `skipped`. Em push e execução manual exige `success`. `failure` e `cancelled` derrubam o gate. Se o `changes` falhar, o gate também cai.
- **Filtros com dependências cruzadas conhecidas.** `back_shared` passa a incluir `app/src/photos.js` e as saídas do estágio 17, que os testes do back leem, e `app/public/portraits/**` e `.dockerignore`, porque a API confere o sha256 dos retratos e a imagem da API copia essa pasta. `design` inclui `back/src/**`, as evidências dos estágios 23 e 29, todos os workflows e `docs/ops/ruleset-main.json`, que os testes do app leem.
- **Release conferido no CI.** O design validator confere `dist/version.json`, `version.json` dentro da imagem do app e a meta contra `GITHUB_SHA`. O smoke confere `/version.json` no preview. O back-shared confere `EMBEDDED_RELEASE_REVISION == GITHUB_SHA` na imagem da API.
- **Ruleset preparado, não aplicado.** `docs/ops/ruleset-main.json` exige PR, `ci-gate` vindo do app GitHub Actions (id 15368) e conversas resolvidas, e bloqueia force-push e deleção. Não exige segundo revisor e não tem bypass. Os comandos exatos estão em `docs/ops/RELEASE.md`. Um teste confere que o check exigido tem o mesmo nome do job `ci-gate`: se o job for renomeado, o teste falha antes de o ruleset passar a esperar um check que nunca aparece.
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

     Não deixar um valor fixo com o autodeploy ligado. Quando o SHA chegar ao build em todo deploy, passar também `POLIMATCH_REQUIRE_RELEASE=1` ao build do app, para que um deploy sem SHA falhe em vez de publicar `unknown` (veja a decisão sobre falha por padrão abaixo).
  7. Depois do próximo deploy feito com o SHA: `curl -s https://api.polimatch.com.br/api/health | jq -r .revision` e `curl -s https://polimatch.com.br/version.json | jq -r .sha` iguais a `git rev-parse origin/main`.
  8. Opcional: ligar `strict_required_status_checks_policy` no JSON, se quiser exigir branch atualizada antes do merge. A troca é revalidar o CI a cada merge.
- O aceite "revision e sha iguais a origin/main no próximo deploy" depende do passo 6. Sem ele, a produção continua com `null`/`unknown`, agora sem quebrar o build.
- O comportamento real do `ci-gate`, do filtro e do primeiro push em main só aparece no GitHub Actions depois do push da branch.
- A seção desta issue no `CONTEXT.md` da raiz foi escrita em 13/11/2026, na junção com a main.
- `/version.json` sai com `Cache-Control: no-cache` desde o ICM 38 (#311), que já trouxe a regra no `nginx.conf` e o teste em `edge-delivery.test.js`.
- O smoke `photo-recovery.mjs` importa `back/src`, mas o filtro `ui_smoke` continua sem `back/**`, por decisão registrada no próprio workflow. O push em main cobre isso depois do merge. Remover a importação é escopo do ICM 66.

## Testes executados

Medições de 31/10/2026, sobre a base 7c0bb27, antes da junção com a main. Os números depois da junção estão na "Atualização de 13/11/2026".

- `npm test --prefix app`: 244/244. Eram 226; os 18 novos estão em `release-identity.test.js` (9), `ci-workflows.test.js` (8) e `photos.test.js` (+1).
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
- E2E do smoke contra o preview local de um build igual ao do CI (`POLIMATCH_REQUIRE_RELEASE=1` e `GITHUB_SHA`), com os 25 scripts node do `ui-interaction-smoke.yml`. O `card-art-pilot-form-smoke` não rodou localmente: ele serve as referências do estágio 12, não o build, e não é afetado.
  - Chromium: 25/25.
  - WebKit: 20/25 na rodada completa. Quatro falhas são fixas e se repetem com a mesma mensagem no build de main@7c0bb27: `interaction-smoke` com e sem Google, `accessible-profile` e `civic-navigation` (foco por Tab no WebKit do macOS). A quinta, `fact-check`, é intermitente nos dois builds: passou em 2 de 4 rodadas na branch e em 3 de 4 em main. `quote-quiz-checked` também oscila nos dois (7 de 9 na branch, 11 de 12 em main), por tempo esgotado ou por ler o texto de compartilhamento logo depois do clique. Nenhuma dessas falhas envolve retratos ou `version.json`; não é regressão. No CI, Linux.
  - O Chromium local é o 140.0.7339.16 em cache (revisão 1187), mapeado por `PLAYWRIGHT_BROWSERS_PATH` numa pasta temporária para o caminho que o Playwright 1.55.1 espera.
- Imagem da API: a asserção inline do `back-shared.yml`, rodada numa cópia temporária depois da linha `RUN` do `back/Dockerfile`, passa com `EXPECTED_RELEASE` igual ao SHA e falha com outro SHA.
- Workflows:
  - actionlint 2.0.6 (wasm, em pasta temporária, um arquivo por processo): 0 problemas nos cinco arquivos; um controle negativo foi detectado;
  - parse YAML dos cinco arquivos e do texto de filtros;
  - simulação dos filtros com picomatch (`dot: true`, como o dorny): mudanças só em docs ou estágios dispensam todas as suítes; retratos, `.dockerignore` e workflows chegam às suítes certas;
  - mutações no gate (aceitar `failure`, trocar `always()`, renomear o check exigido no ruleset) derrubam `ci-workflows.test.js`.

## Riscos conhecidos

- Conflitos previsíveis de merge com o ICM 38 (passo depois do `docker build` em `design-validator.yml`), o ICM 50 (deploy), o ICM 52 (fixar actions) e o ICM 59 (CI). Os trechos tocados aqui são pequenos e localizados.
- Os nomes dos checks das suítes mudam (`design-validator / validate`, `ui-interaction-smoke / browser-smoke (chromium)` etc.). Nenhuma proteção dependia deles; o ruleset exige só `ci-gate`.
- O chunk `photos-*.js` passa de 0,65 KB (0,40 KB gzip) para 10,4 KB (3,4 KB gzip), por causa do mapa de 216 hashes. O chunk é carregado pela home, pelo quiz e pelo Fato ou fake.
- No primeiro deploy, todas as URLs de retrato e o nome do chunk principal mudam uma vez. Depois ficam estáveis enquanto os arquivos não mudarem.
- `dorny/paths-filter` é uma action de terceiros, fixada por commit, com `pull-requests: read` só no job `changes`.
- Sem bypass no ruleset, uma correção urgente com CI vermelho exige desligar o ruleset temporariamente (comando no RELEASE.md).
- Imagens servidas por `photos.js` fora de `portraits/` e `chromas/approved/` saem sem `?v=`. Hoje nenhuma imagem servida por ali fica fora dessas pastas.

## Decisões tomadas

- **Desvio do texto da issue: falha sem SHA é opt-in.** A issue pedia que o `vite.config` falhasse sem `SOURCE_COMMIT` em build de produção, com escape para dev. Ficou ao contrário: por padrão o build segue com `unknown` e um aviso, e só falha com `POLIMATCH_REQUIRE_RELEASE=1`. Motivo: hoje o Dokploy constrói `app/Dockerfile` sem build-args, e a falha por padrão derrubaria o deploy de produção no primeiro merge. O CI já liga a opção. Quando o SHA passar no deploy (passo 6 acima), basta passar também `POLIMATCH_REQUIRE_RELEASE=1` ao build do app para chegar ao comportamento pedido. Precisa do aceite do Stefan no gate.
- Workflows reutilizáveis chamados por `ci.yml`, em vez de `push` em cada arquivo. O `ci-gate` precisa estar no mesmo run das suítes para enxergar o resultado, e gatilhos duplicados rodariam tudo duas vezes. O efeito pedido (todas as suítes em todo push para main, sem filtro) fica garantido pelo `ci.yml`.
- `import.meta.env.VITE_RELEASE` foi testado e descartado. O app referencia `import.meta.env` inteiro (`google-login.js`, `civic/shell.js`), e o SHA entraria no chunk principal, mudando o nome do JS a cada commit, inclusive nos que só mexem no back. A revisão fica exposta na meta `polimatch-release` e em `/version.json`.
- Hash de oito caracteres hexadecimais, só nas pastas que passam por `photos.js`. As demais Chromas já trazem o hash no nome.
- Teste de contexto Docker atualizado. O comando da imagem ganhou `--build-arg`, e a regex passa a aceitar build-args mantendo a raiz como contexto; foi acrescentada uma checagem do `SOURCE_COMMIT`. A lista de caminhos agora é lida do filtro `design` em `ci.yml`, sem perder nenhum caminho.
- `back/src/photo-recovery.test.js` e `app/src/photos.test.js` esperavam `?v=test`, um marcador que só existia fora do build. Em Node o mapa de hashes é vazio e a URL sai sem `?v=`; a versão por conteúdo é testada à parte com o mapa real.
- Ruleset com conversas resolvidas, como pede a issue, `strict` desligado e `integration_id` do GitHub Actions, para que um status de mesmo nome vindo de outra origem não satisfaça a regra.

## Próximo passo exato

1. Stefan revisa a branch `chore/release-identity-ci`, abre e mescla o PR. O CI do próprio PR já roda pelo `ci.yml` novo.
2. Seguir a lista "Ação do Stefan" acima, na ordem.

## Atualização de 13/11/2026

- **A branch recebeu a main atual (7a4c9db).** Entraram os estágios 37 (#310), 38 (#311), 39 (#312) e 40 (#313), o ICM 58 (#317), o ICM 67 (#319, #320) e o hotfix do CI (#321). Três workflows conflitavam; a junção está em 36096e8.
  - `back-shared.yml`: continua chamado pelo `ci.yml`. Ficam a conferência do SHA na imagem da API e, depois dela, o passo do estágio 37 que confere a imagem sem smokes.
  - `design-validator.yml`: build e imagem com o SHA obrigatório, seguidos do smoke do nginx do estágio 38.
  - `ui-interaction-smoke.yml`: o passo do `/version.json` e o da primeira visita do estágio 40. O runner fixo em `ubuntu-24.04` (#321) veio da main.
  - `ci.yml`: `scripts/ops/**` entrou no filtro do back, como a main já tinha no gatilho do `back-shared.yml`.
- **Choque com o estágio 39 que o git não mostra, corrigido em 71d43bc.** Na main, o relato de erros do navegador usava a meta `polimatch-release` e, sem ela, a constante `__POLIMATCH_ASSET_VERSION__`. Este estágio remove a constante e grava a meta sempre, com `unknown` quando o build não recebe o SHA, que é o caso do deploy de hoje. Juntos, os relatos de produção sairiam com build `unknown`, e o `client-error-report.mjs` falhava num build sem SHA. Agora, sem o SHA, o campo `build` leva o nome com hash do script de entrada da página (por exemplo `main-BBiuPtfp`). Com o SHA nada muda. `docs/ops/MONITORING.md` descreve o campo como ficou.
- **Testes locais depois da junção:** app 286/286, contrato do piloto 64/64, shared 93 com a taxonomia validada. Builds: com SHA obrigatório, `version.json` e a meta nas quatro páginas trazem o SHA, que não aparece em nenhum JS; sem SHA, saem com `unknown` e o aviso. Em WebKit: `client-error-report.mjs` passa sem SHA e com SHA exigido, `first-visit.mjs` 6 cenários e `photo-recovery.mjs` passam. Os testes do back e o Chromium rodam só no CI do PR.
- **Revisão independente da junção, somente leitura, em 13/11/2026: sem bloqueio.** Ajustes aplicados depois dela: `.gitignore` entrou no filtro `design` do `ci.yml`, porque `edge-delivery.test.js` (ICM 38) lê esse arquivo; o teste de ordem do smoke do nginx passou a procurar o contêiner do smoke, e não o primeiro `docker run`; um teste confere que cada página tem um único script de módulo; o `CONTEXT.md` do estágio registra a exceção de escopo no relato de erros; e o texto sobre o campo `build` ficou preciso. Notas que ficam: o caminho sem SHA não tem e2e no CI, que sempre constrói com o SHA (rodou aqui em WebKit); `client-error-report.mjs` não cobre `duelos-da-corrida.html`; no servidor de desenvolvimento o `build` do relato sai `client`.
- **Produção em 13/11/2026.** API e app foram publicados no commit 7a4c9db, sem este estágio. O Dokploy ainda constrói sem `SOURCE_COMMIT`: `/api/health` responde `revision: null`.
- **O que muda no primeiro deploy depois do merge, sem o SHA no build:** o site passa a servir `/version.json` com `sha: "unknown"`, as URLs dos retratos mudam uma vez para `?v=<hash>` e os relatos de erro levam o nome do script de entrada no campo `build`.
- **Não muda com o merge:** o ruleset de `main` não é aplicado, e nada é publicado.

## Depois do merge — 13/11/2026

- O CI passou inteiro no commit final da branch, `b0201b9`, e o PR foi mesclado em `29edba3`.
- Primeiro run de push em `main`: todas as suítes e o `ci-gate` passaram no commit `29edba3`.
- Bateria local em WebKit na `main`, com o SHA no build: 23 de 27; as quatro falhas são as de foco por teclado do WebKit do macOS (`interaction-smoke` nas duas variantes, `accessible-profile` e `civic-navigation`), que não ocorrem no CI em Linux. Em repetições à parte na `main`, `fact-check.mjs` passou 8 de 8 e `quote-quiz-checked.mjs` 5 de 6 (falha na linha 81, intermitência já registrada para o ICM 66).
- Antes do merge, a mesma bateria num build sem SHA, como o Dokploy constrói hoje: 22 de 27; as cinco falhas são as quatro de foco por teclado do WebKit do macOS, que se repetem na `main`, e uma intermitente do `fact-check.mjs` (linha 50), que passou em 13 repetições.
- **Ruleset de `main` aplicado em 13/11/2026**, por instrução do Stefan em conversa ("Sim, aplica"), depois do primeiro CI de push verde. Id 27227559, `enforcement: active`, com as regras `deletion`, `non_fast_forward`, `pull_request` e `required_status_checks` (`ci-gate`). `delete_branch_on_merge` não foi alterado, e o bloqueio ainda não foi provado com um PR de teste.
- Produção não mudou com o merge: segue em `7a4c9db`, sem `/version.json` e com `revision: null`.
- Continuam com o Stefan: provar o bloqueio, `delete_branch_on_merge`, a chegada do SHA ao build do Dokploy e a conferência depois do primeiro deploy com o SHA. A issue #287 segue aberta.

## Human gate

- Decisão: `aprovado`
- Responsável: Stefan
- Observação: aprovado por instrução direta do Stefan para este PR, em conversa de 13/11/2026 ("Sim, mescla"), transcrita no PR. O merge ficou a cargo do agente, a pedido dele, com o CI verde no commit final. O desvio do texto da issue (falha do build por falta do SHA é opcional) não foi apresentado a ele em separado; o aceite específico segue pendente. A regra 6 do `AGENTS.md` não muda.
