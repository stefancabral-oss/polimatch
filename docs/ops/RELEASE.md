# Release e CI

Estágio 45 (issue #287). Este documento diz como saber qual commit está no ar, como o CI valida `main` e como aplicar a proteção de `main`.

## Identidade do release

### API

`back/Dockerfile` recebe `--build-arg SOURCE_COMMIT=<SHA completo>` e grava o valor em `back/src/release-identity.js`. `GET /api/health` devolve esse valor em `revision`. Sem o build-arg, `revision` é `null`. Um valor presente que não seja SHA completo (40 ou 64 caracteres hexadecimais minúsculos) faz o build falhar.

### App

`app/Dockerfile` recebe o mesmo `SOURCE_COMMIT` e o repassa ao Vite. O plugin `app/scripts/release-identity.mjs`:

- grava `dist/version.json` com `{"sha", "builtAt"}`;
- acrescenta `<meta name="polimatch-release" content="<sha>">` às quatro páginas HTML;
- usa `GITHUB_SHA` quando `SOURCE_COMMIT` não vem (CI);
- sem nenhum dos dois, segue com `"sha": "unknown"` e um aviso no log do build, para não quebrar o deploy atual;
- com `POLIMATCH_REQUIRE_RELEASE=1`, a falta do SHA vira erro (o CI liga essa opção);
- um valor presente e malformado sempre falha, como na API;
- `SOURCE_DATE_EPOCH`, se definido, fixa `builtAt`.

O SHA fica fora dos chunks JS de propósito: um commit que só mexe no back não muda o nome de nenhum asset do app. Para ler a revisão no navegador, use `document.querySelector('meta[name="polimatch-release"]')?.content`.

### Versão dos retratos

`app/src/photos.js` acrescenta `?v=<8 primeiros caracteres do sha256 do arquivo>` às imagens de `public/portraits/**` e `public/chromas/approved/**`. É o mesmo hash já registrado em `shared/photo-recovery-manifest.json` e `shared/presidential-roster.json` (o teste `app/src/release-identity.test.js` confere). Dois builds do mesmo commit geram as mesmas URLs, e uma foto só muda de URL quando o arquivo muda. Imagens fora dessas pastas saem sem `?v=`.

### Conferir depois de um deploy

```sh
git fetch origin && git rev-parse origin/main
curl -s https://api.polimatch.com.br/api/health | jq -r .revision
curl -s https://polimatch.com.br/version.json | jq -r .sha
```

Os três valores precisam ser iguais. `null` na API ou `unknown` no app significa que o build foi feito sem `SOURCE_COMMIT`.

## Dokploy

Consulta feita em 31/10/2026: o Dokploy não injeta o SHA do commit automaticamente em builds por Dockerfile. A aba Environment tem o campo **Build Time Arguments**, repassado ao `docker build` como `ARG`, mas o valor é fixo. A única variável predefinida documentada é `DOKPLOY_DEPLOY_URL`, de preview deployments. Os pedidos para injetar o commit estão abertos no projeto (Dokploy/dokploy#4006 e #2715; PR #4007 não mesclado).

Não grave um `SOURCE_COMMIT` fixo com o autodeploy ligado: no deploy seguinte o valor fica velho e a produção passa a anunciar um commit errado, o que é pior que `null`/`unknown`.

Caminhos possíveis:

1. **Recomendado (ICM 50, issue #292):** o GitHub Actions constrói as imagens com `--build-arg SOURCE_COMMIT=${{ github.sha }}`, publica por SHA e o Dokploy implanta a imagem pronta (fonte "Docker image"), com o autodeploy por webhook desligado.
2. **Provisório, deploy manual:** com o autodeploy desligado nos dois serviços, antes de cada deploy abrir API e app → Environment → Build Time Arguments e definir `SOURCE_COMMIT=<SHA completo de origin/main>` (o mesmo SHA nos dois), salvar, clicar em Deploy e conferir com os comandos acima.
3. **Nada:** o build continua passando e a produção continua com `revision: null` e `sha: "unknown"`.

A issue pedia que o build do app falhasse sem `SOURCE_COMMIT`. Isso ficou atrás de `POLIMATCH_REQUIRE_RELEASE=1` porque hoje o Dokploy constrói sem o SHA, e um build que falha por padrão derrubaria o deploy. Quando o SHA chegar ao build em todo deploy (caminho 1 ou 2), passe também `POLIMATCH_REQUIRE_RELEASE=1` ao build do app: a partir daí um deploy sem SHA falha em vez de publicar `unknown`.

## CI

`.github/workflows/ci.yml` é o ponto de entrada:

- dispara em todo `pull_request` para `main`, em todo `push` para `main` e em `workflow_dispatch`, sem filtro de caminho no gatilho;
- o job `changes` usa `dorny/paths-filter` (fixado por commit) só em pull requests, para decidir quais suítes rodar;
- em push para `main` e em execução manual, todas as suítes rodam;
- as suítes são os workflows de sempre, agora chamados por `workflow_call`: `back-shared.yml`, `design-validator.yml`, `ui-interaction-smoke.yml` e `civic-planning.yml`. Cada um ainda pode ser disparado à mão;
- o job `ci-gate` sempre roda. Em pull request, aceita `success` e `skipped` (suíte dispensada pelo filtro); em push e execução manual, só `success`. Qualquer `failure` ou `cancelled` derruba o gate.

Nos checks do PR, as suítes aparecem como `back-shared / back-unit`, `design-validator / validate`, `ui-interaction-smoke / browser-smoke (chromium)` etc. O único check que o ruleset precisa exigir é `ci-gate`.

O CI também confere a identidade do release: `dist/version.json` e a imagem do app (`/usr/share/nginx/html/version.json` e a meta) precisam trazer `GITHUB_SHA`, o preview do smoke serve `/version.json` com o mesmo SHA e a imagem da API precisa ter `EMBEDDED_RELEASE_REVISION` igual a `GITHUB_SHA`. Em pull request, `GITHUB_SHA` é o commit de merge de teste.

Para acrescentar uma suíte: criar o workflow com `on: workflow_call`, chamá-lo de `ci.yml`, incluir o job em `needs` do `ci-gate` e criar o filtro em `changes`. `app/src/ci-workflows.test.js` falha se um job ficar fora do gate.

## Ruleset de `main` (ação do Stefan)

O arquivo `docs/ops/ruleset-main.json` exige PR, `ci-gate` verde (emitido pelo app GitHub Actions, id 15368) e conversas resolvidas; bloqueia force-push e deleção; não exige aprovação de outra pessoa e não tem bypass.

Aplicar **depois** que esta mudança estiver em `main` e o primeiro run de push tiver passado:

```sh
gh run list --workflow ci.yml --branch main --event push --limit 1

gh api --method POST repos/stefancabral-oss/polimatch/rulesets --input docs/ops/ruleset-main.json
gh api --method PATCH repos/stefancabral-oss/polimatch -F delete_branch_on_merge=true
```

Verificar:

```sh
gh api repos/stefancabral-oss/polimatch/rulesets --jq '.[] | {id, name, enforcement}'
gh api repos/stefancabral-oss/polimatch/rules/branches/main --jq '.[].type'
gh api repos/stefancabral-oss/polimatch --jq .delete_branch_on_merge
gh api repos/stefancabral-oss/polimatch/commits/$(git rev-parse origin/main)/check-runs --jq .total_count
```

O esperado é um ruleset `main` com `enforcement: active`; as regras `deletion`, `non_fast_forward`, `pull_request` e `required_status_checks`; `true` para `delete_branch_on_merge`; e `total_count` maior que zero.

Para provar o bloqueio, abrir um PR de teste que quebre um teste de propósito: com `ci-gate` vermelho, `gh pr merge <número> --merge` precisa recusar. Depois fechar o PR sem mesclar e apagar a branch.

Observações:

- PRs abertos antes desta mudança não têm `ci.yml`. Eles ficam sem `ci-gate` até a branch ser atualizada com `main` (botão "Update branch").
- `strict_required_status_checks_policy` está `false`: o PR não precisa estar atualizado com `main` para mesclar. O CI de push em `main` pega quebras de integração depois do merge. Ligar a opção evita essas quebras, mas obriga a atualizar a branch e esperar o CI de novo antes de cada merge.
- Sem bypass, nem o administrador mescla com `ci-gate` vermelho. Numa emergência, desligar o ruleset e religar logo depois:

```sh
gh api --method PUT repos/stefancabral-oss/polimatch/rulesets/<id> -f enforcement=disabled
gh api --method PUT repos/stefancabral-oss/polimatch/rulesets/<id> -f enforcement=active
```

- Para atualizar o ruleset depois de editar o JSON: `gh api --method PUT repos/stefancabral-oss/polimatch/rulesets/<id> --input docs/ops/ruleset-main.json`.
