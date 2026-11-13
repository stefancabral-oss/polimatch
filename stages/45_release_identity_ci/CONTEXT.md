# ICM 45 — Identidade do release e CI em main — #287
Base main 7c0bb27. Ler contexto raiz, AGENTS.md e docs/ops/RELEASE.md.

## Objetivo e entradas
Fazer `/api/health` e `/version.json` dizerem qual commit está no ar e fazer o
CI rodar também em main, com um check agregador (`ci-gate`) que possa ser
exigido. Entradas: auditoria de maturidade de 30/10/2026 (OPS-02, API-05,
TEST-03, GOV-07, FE-08, PERF-06, PROBE-3-05, OPS-03, TEST-02, GOV-03).
Hoje `revision` é null, o app embute só o horário do build e nenhum workflow
roda em push. main não tem proteção.

## Escopo e aceite
- app/Dockerfile aceita `SOURCE_COMMIT`; o Vite grava `dist/version.json`
  `{sha, builtAt}` e a meta `polimatch-release`. Sem SHA: `unknown` e aviso;
  `POLIMATCH_REQUIRE_RELEASE=1` (CI) falha. SHA malformado sempre falha.
- Retratos versionados pelo sha256 do arquivo, igual ao do manifesto e do
  roster. Dois builds do mesmo commit geram as mesmas URLs. Teste incluso.
- `ci.yml` em pull_request e push para main, job `changes` com
  dorny/paths-filter fixado por commit e `ci-gate` sempre executado: skip do
  filtro conta como sucesso, falha ou cancelamento derrubam o gate.
- CI confere `version.json` da imagem do app igual a `GITHUB_SHA`.
- `docs/ops/ruleset-main.json` e comandos `gh api` preparados, não aplicados.
- Aceite final depende de deploy e de ação do Stefan: revision e sha iguais a
  `git rev-parse origin/main`, ruleset ativo com ci-gate, PR vermelho
  bloqueado e check-runs em todo commit novo de main.

## Fora de escopo
Workflow de deploy, GHCR e smoke pós-deploy (ICM 50). Cache-Control e
headers no nginx (ICM 38). Captura de erros no cliente e logs da API (ICM 39).
Configurar Dokploy, ruleset ou settings do GitHub: só o Stefan.
Exceção registrada na junção com a main, em 13/11/2026: o campo `build` do
relato de erros do navegador (ICM 39) lia uma constante que este estágio
remove. O ajuste desse campo em `app/src/error-reporter.js` e em
`install-error-reporter.js` entra aqui, e só ele; o resto da captura de erros
continua fora.
Nenhum agente aprova o gate, mescla ou publica.
