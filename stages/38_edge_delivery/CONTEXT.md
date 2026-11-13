# ICM 38 — Borda do site: www, compressão, cache, 404, ícones e service worker — #280

Base main 7c0bb27. Ler o contexto raiz, `app/nginx.conf`, `app/Dockerfile`,
`app/public/` e `.github/workflows/design-validator.yml`. Origem: auditoria de
maturidade de 30/10/2026 (bloqueio B7), com itens abertos desde a crítica de 13/09.

## Objetivo e entradas
Fazer o nginx entregar o site do jeito certo: arquivos de texto comprimidos,
assets com hash em cache longo, HTML sempre revalidado, 404 real para arquivo
que não existe, robots.txt e sitemap.xml de verdade, ícones do PWA versionados
e um service worker que não finge cache. Hoje qualquer arquivo ausente volta
como o index.html com status 200, o que pode deixar a tela em branco depois de
um deploy, e nada disso é testado porque o e2e roda contra o `vite preview`.

## Escopo
- `app/nginx.conf`: gzip (JS, CSS, JSON, SVG, XML, manifesto), `/assets/` com
  `immutable` e 404, HTML com `no-cache`, cache curto com revalidação para
  `/portraits` e `/chromas`, 404 para extensão estática ausente. sw.js e
  manifesto continuam com as regras atuais.
- `app/public/robots.txt` e `app/public/sitemap.xml` com https://polimatch.com.br
  e as quatro páginas públicas do build.
- Ícones 192, 512 e apple-touch gerados de `brand/app-icon-1024.png` e versionados.
- `app/scripts/verify-public-refs.mjs` no `npm run build`.
- Service worker mínimo: sem listener de fetch, sem precache.
- `app/scripts/smoke-nginx.mjs` (só GET) e um passo no design-validator que
  sobe a imagem e roda o smoke contra ela.

## Fora de escopo
- Cabeçalhos de segurança no nginx (ICM 51) e `access_log` (ICM 41).
- Compressão, cache e CORS da API, que não passa por este nginx.
- Service worker com precache e página offline. O app continua online-only.
- Mudanças de DNS, domínio e certificado: são ações do Stefan, documentadas no
  HANDOFF.

## Critérios de aceite
- `/assets/<main>.js` com Accept-Encoding gzip responde `content-encoding: gzip`
  e `cache-control` com `immutable`; `/assets/inexistente.js` responde 404.
- `/` responde `cache-control: no-cache`; `/robots.txt` sai como text/plain;
  `/icons/icon-192.png` sai como image/png.
- sw.js sem handler de fetch.
- Reverter `app/nginx.conf` para a versão de 7c0bb27 faz o smoke falhar;
  remover um ícone referenciado no manifesto faz o build falhar.
- www com certificado válido e 301 para o apex (ação do Stefan).

## Dependências
Nenhuma. Começa a partir de main. O ICM 51 vai acrescentar cabeçalhos ao mesmo
arquivo e deve estender o smoke.
