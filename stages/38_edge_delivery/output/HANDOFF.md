# HANDOFF — [ICM 38] Borda do site: www, compressão, cache, 404, ícones e service worker

## Status

- Estado: `pronto para gate`
- Issue: #280
- Branch: `fix/edge-delivery` (a partir de main 7c0bb27)
- PR: ainda não aberta. Push e PR ficam com o Stefan.
- Último commit: 1d2adc0 (código). Este HANDOFF e o `verification.json` entram
  no commit seguinte da mesma branch.

## Entregue

- `app/nginx.conf` (5018581):
  - gzip para JS, CSS, JSON, SVG, XML, texto e manifesto, com `gzip_vary on`,
    `gzip_min_length 1024`, nível 6 e `gzip_proxied any`;
  - `location ^~ /assets/` com `Cache-Control: public, max-age=31536000, immutable`
    e `try_files $uri =404`;
  - `location ~* \.html$` com `no-cache` e 404. O `/` e os caminhos sem extensão
    também saem com `no-cache`, porque terminam no index.html;
  - `/portraits/` e `/chromas/` com `public, max-age=86400` e 404 quando o
    arquivo não existe;
  - extensões estáticas (js, css, png, jpg, webp, svg, ico, json, txt, xml,
    webmanifest, woff2 e outras) respondem 404 quando ausentes;
  - o fallback do app ficou só para caminhos sem extensão. sw.js e manifesto
    mantêm as regras de antes.
- Medido localmente com gzip: `main-*.js` 195.200 → 60.348 B, `main-*.css`
  79.946 → 18.321 B, `tcg-card-*.js` 116.586 → 32.570 B. Os JS e CSS da home
  somam 413.596 B sem compressão e 118.487 B com gzip (−71%).
- Ícones (b2b6f3c): `app/public/icons/icon-192.png`, `icon-512.png` e
  `apple-touch-icon.png` (180×180), gerados de `app/public/brand/app-icon-1024.png`
  com `sips -z <lado> <lado> brand/app-icon-1024.png --out icons/<nome>.png`.
  `app/public/icons/` saiu do `.gitignore`. O `index.html` aponta o
  apple-touch-icon para o arquivo de 180×180. O manifesto não mudou.
- `app/public/robots.txt` (`Allow: /` e `Sitemap:` canônico) e
  `app/public/sitemap.xml` com `/`, `/quem-disse-isso.html`, `/fato-ou-fake.html`
  e `/duelos-da-corrida.html` em https://polimatch.com.br.
- `app/scripts/verify-public-refs.mjs`, que roda no fim do `npm run build`. Ele lê
  `href`, `src` e `srcset` de `dist/*.html` e `start_url`, `icons`, `screenshots`
  e `shortcuts` dos manifestos, e falha se alguma referência local não existir no
  dist. Ignora outras origens, `data:`, `mailto:` e âncoras.
- `app/public/sw.js` sem listener de fetch. Mantém install com `skipWaiting`,
  activate que apaga caches antigos e `clients.claim()`. A versão subiu para v2.
  O registro em `main.js` não mudou e continua com `.catch(() => {})`.
- `app/scripts/smoke-nginx.mjs` (1d2adc0), só com GET, em 13 verificações:
  `/` e cada HTML com no-cache; JS e CSS com hash acima de 1 KB com gzip e
  `Vary`; todos os assets com hash com `max-age=31536000` e `immutable`; SVG
  grande com gzip; 404 para assets, ícones, retratos, Chromas, html, txt, xml e
  json ausentes e para `/<pasta>/assets/main-*.js`; robots text/plain com o
  Sitemap canônico; sitemap XML com `<urlset>`; ícones image/png com assinatura
  PNG; nenhuma referência local de `dist/*.html` ou do manifesto voltando como
  HTML; sw.js `no-store` e manifesto `application/manifest+json` com no-cache;
  retratos e Chromas com cache de um dia sem immutable; caminho sem extensão
  abrindo o app com no-cache.
- `.github/workflows/design-validator.yml`: depois do `docker build`, sobe a
  imagem, espera responder, copia o dist servido com `docker cp` e roda o
  smoke. Se falhar, mostra os logs do container.
- `app/src/edge-delivery.test.js`: 11 testes para nginx.conf, service worker,
  ícones (PNG com o tamanho declarado), robots e sitemap alinhados às entradas
  do `vite.config.js`, verificador de referências (casos com e sem ausência) e
  a ordem build → run → cp → smoke no CI.

## Não entregue / pendente

- Compressão da API: o issue cita "compressão também na API", mas a API não
  passa por este nginx e o estágio não mexe em `back/`. `/api/candidates` segue
  com cerca de 86 KB sem gzip. Opções: middleware `compress` do Traefik no
  router da API (painel) ou `compression()` no Express num estágio de back.
- Cache-Control e `maxAge` de CORS da API.
- Pré-compressão no build (`gzip_static`) e brotli. Hoje o gzip é feito a cada
  requisição. Com o tráfego atual o custo é pequeno.
- Cabeçalhos de segurança (ICM 51) e `access_log` (ICM 41) não foram tocados.
- O `?v=` dos retratos muda a cada build, porque a imagem não recebe
  `SOURCE_COMMIT` e o Vite cai em `Date.now()`. Cada deploy invalida as URLs
  das fotos do duelo mesmo com o cache novo. Fica para um estágio de build e
  deploy.
- Service worker com precache e página offline: não entra aqui (o app é
  online-only).
- Recarga automática quando um chunk falha depois de um deploy
  (`vite:preloadError`). O 404 real e o no-cache no HTML reduzem o problema,
  mas o cliente ainda não se recupera sozinho.
- Ícone maskable dedicado, com margem de área segura, e `<link rel="manifest">`
  e apple-touch-icon nas três páginas secundárias.
- `app/public/og-cover.png` continua no `.gitignore`. Não é referenciado em
  lugar nenhum.
- O e2e continua rodando contra o `vite preview`. Só o smoke roda contra a imagem.

## Testes executados

- `npm test --prefix app`: 237 aprovados, 0 falhas (226 antes, mais 11 novos).
- `npm run test:card-art-pilot-contract --prefix app`: 64 aprovados.
- `node --test shared/*.test.js`: 93 aprovados.
- `npm test --prefix back`: 232 aprovados (sem mudança em back/).
- `npm test` na raiz (editorial:verify, shared com taxonomia, back e app): passa.
- `npm run build --prefix app`: passa, com 36 referências locais conferidas em
  5 HTML e 1 manifesto.
- Build sem `icons/icon-512.png`: falha (exit 1) com a lista do que falta. O
  verificador também falha contra o dist de 7c0bb27 (três PNG ausentes).
- `nginx -t` no `app/nginx.conf` real, incluído num `http {}` igual ao da imagem:
  ok (nginx 1.31.5 do Homebrew, sem root).
- Smoke contra nginx local servindo `app/dist`:
  - config nova: 13 de 13;
  - `app/nginx.conf` de 7c0bb27 com o mesmo dist: 5 de 13 (falham no-cache,
    gzip, immutable, 404 e cache das imagens);
  - config de 7c0bb27 com um dist sem ícones, robots e sitemap, como em
    produção hoje: 1 de 13.
- Os testes estáticos de `edge-delivery.test.js` também falham com o nginx.conf
  e o sw.js de 7c0bb27 (5 de 11).
- Service worker, Playwright contra o nginx local: com o sw.js novo, 0 de 7
  respostas de JS e CSS passam pelo worker no Chromium e no WebKit, e
  `caches.keys()` fica vazio. Com o sw.js de 7c0bb27, 7 de 7 passam pelo worker
  nos dois.
- E2E com `vite preview`:
  - Chromium: interaction-smoke, accessible-profile, main-navigation,
    responsive-layout e presidential-navigation passam;
  - WebKit: main-navigation, responsive-layout e presidential-navigation passam.
    interaction-smoke e accessible-profile falham na navegação por Tab, e falham
    igual no build de 7c0bb27. No macOS o WebKit só foca campos de formulário
    com Tab. O CI (Ubuntu) roda esses dois.
- E2E contra o nginx local com a config nova:
  - Chromium: interaction-smoke, accessible-profile, main-navigation e
    responsive-layout passam;
  - WebKit: main-navigation, responsive-layout e presidential-navigation passam.
- O Chromium local é a revisão em cache (140.0.7339.16). O Playwright foi
  apontado para ela por `PLAYWRIGHT_BROWSERS_PATH`, porque a revisão pedida pelo
  Playwright 1.55.1 não estava em cache.
- Não executado localmente: `docker build` e `docker run`, porque não há Docker
  na máquina. O passo novo do design-validator só roda no CI.

## Riscos conhecidos

- Mudança de comportamento: arquivo com extensão estática que não existe agora
  responde 404, e não mais o index.html. As rotas do app usam hash, e caminhos
  sem extensão continuam abrindo o app, então o risco é baixo.
- O que estiver em `/assets/` fica um ano em cache como imutável. Isso só é certo
  porque o Vite põe hash no nome. Não colocar arquivos sem hash em
  `app/public/assets/`.
- Retratos e Chromas ficam até um dia em cache. Uma foto trocada com o mesmo nome
  e sem `?v=` (os retratos da capa) pode demorar até um dia para aparecer.
- `add_header` dentro de um `location` anula os `add_header` do nível do
  `server`. Quando o ICM 51 colocar cabeçalhos de segurança no server, vai
  precisar repeti-los em cada location com `add_header` (ou usar um include) e
  acrescentar a checagem ao smoke.
- A prova local usa o nginx 1.31.5 do Homebrew, e a imagem usa o
  `nginx:1.27-alpine`. As diretivas são as mesmas, mas a prova na imagem real é
  o passo do CI, que ainda não rodou.
- Quem tem o sw.js antigo instalado recebe o novo na próxima navegação, porque o
  sw.js sai com `no-store`. Até lá, o worker antigo continua repassando
  requisições, sem efeito funcional.

## Decisões tomadas

- Cache de um dia (`max-age=86400`) com revalidação por ETag para retratos e
  Chromas. Os nomes não têm hash, então `immutable` seria errado. Um dia limita
  quanto tempo uma foto substituída pode ficar velha e ainda evita baixar tudo de
  novo em cada visita. A auditoria sugeria 7 dias. Escolhi menos porque há
  retratos sem `?v=`.
- Demais estáticos fora de `/assets`, `/portraits` e `/chromas` (ícones, marca,
  robots, sitemap) só ganharam o 404. O cache deles continua heurístico.
- O fallback do app só vale para caminhos sem extensão.
- O apple-touch-icon passa a usar um arquivo próprio de 180×180, o tamanho que o
  iOS usa, em vez do PNG de 192.
- O manifesto ficou como estava (`any maskable` nos PNGs). O ícone tem fundo
  sangrado e o símbolo fica quase todo dentro da área segura. Só as pontas das
  cartas encostam na borda do círculo de 80%. Um ícone maskable separado é
  decisão de design.
- O sitemap lista as quatro entradas do Vite, sem `lastmod`, para não publicar
  data desatualizada. `integridade.html` ficou de fora, para seguir a lista das
  quatro páginas públicas do issue.
- O smoke lê o dist de dentro do container, porque o build da imagem gera hashes
  próprios (o `__POLIMATCH_ASSET_VERSION__` muda) e o dist do runner não serve
  de referência.
- O smoke não confere cabeçalhos de segurança. Essa parte entra com o ICM 51.

## Ação do Stefan

1. DNS: criar registros explícitos para o apex, `www` e `api` antes de mexer no
   curinga. Para o `www`, usar um CNAME para `polimatch.com.br` ou o mesmo A do
   apex. Se o DNS estiver na Cloudflare, deixar o `www` como "DNS only" até haver
   decisão registrada sobre o proxy, porque o proxy muda o IP do cliente
   (TRUST_PROXY_HOPS e pseudônimo de rede).
2. Dokploy, serviço do app: adicionar o domínio `www.polimatch.com.br` com HTTPS
   e certificado Let's Encrypt.
3. No mesmo serviço, criar o redirecionamento permanente (301) do www para o
   apex. Pode ser pela configuração de redirects do serviço ou por um middleware
   `redirectRegex` do Traefik. Regex `^https?://www\.polimatch\.com\.br/(.*)`,
   destino `https://polimatch.com.br/${1}`, permanente. Não incluir www em
   `APP_ORIGINS`, porque o redirecionamento acontece antes do app.
4. Conferir:
   - `curl -sI https://www.polimatch.com.br/abc` dá 301 com
     `location: https://polimatch.com.br/abc`;
   - `curl -sI http://www.polimatch.com.br/` também redireciona;
   - `echo | openssl s_client -connect www.polimatch.com.br:443 -servername www.polimatch.com.br 2>/dev/null | openssl x509 -noout -issuer -subject`
     mostra um certificado Let's Encrypt para www.
5. Só depois disso, apagar o registro curinga (`*`) e conferir que
   `dig +short qualquercoisa.polimatch.com.br` volta vazio.
6. Push da branch `fix/edge-delivery` e PR citando #280. Confirmar no log do
   Design Validator que o passo "Smoke the nginx image" passou com 13 de 13.
7. Depois do merge e do deploy, conferir em produção:
   - `curl -sI -H 'Accept-Encoding: gzip' https://polimatch.com.br/assets/<main>.js`
     com `content-encoding: gzip` e `immutable`;
   - `curl -sI https://polimatch.com.br/assets/inexistente.js` dá 404;
   - `curl -sI https://polimatch.com.br/` com `cache-control: no-cache`;
   - `/robots.txt` text/plain e `/icons/icon-192.png` image/png.
8. Decidir onde fica a compressão da API: middleware `compress` do Traefik no
   router da API ou `compression()` no Express em outro estágio.

## Próximo passo exato

1. Stefan revisa o diff de `fix/edge-delivery`, faz o push e abre a PR para #280.
2. CI: Design Validator (com o smoke da imagem) e UI Interaction Smoke verdes.
3. Itens 1 a 5 da "Ação do Stefan" (www e DNS), em qualquer ordem em relação ao
   merge.
4. Deploy e conferência do item 7.
5. Human gate.

## Human gate

- Decisão: `pendente`
- Responsável: Stefan
- Observação: nenhum agente aprova o próprio gate, faz merge ou publica em
  produção. www, DNS e a conferência em produção dependem do Stefan.
