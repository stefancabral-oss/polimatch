# ICM 58 — Compartilhamento com cartão de preview — #300

Base main `32c9276f54a5baacf8a367c19cde677d27451dc3` (merge da #311).
Ler o contexto raiz, `AGENTS.md`, as quatro entradas do Vite e
`docs/design/BRAND_ASSETS.md`.

## Objetivo

Fazer os links das quatro páginas públicas mostrarem título, descrição e imagem
no HTML inicial, para crawlers de redes e mensageiros que não executam JavaScript.

## Entradas

- Issue #300 e o acompanhamento #316.
- `app/index.html`, `app/quem-disse-isso.html`, `app/fato-ou-fake.html` e
  `app/duelos-da-corrida.html`, que são o `rollupOptions.input` do Vite.
- A apresentação volumétrica já publicada em `app/public/brand/logo-volumetric.png`.
- `app/public/robots.txt` e `app/public/sitemap.xml` entregues pela #311.

## Escopo

- `og:title`, `og:description`, `og:url`, `og:image`, `og:locale=pt_BR` e
  `twitter:card` no head estático de cada entrada.
- URLs absolutas em `https://polimatch.com.br`, iguais às `<loc>` do sitemap.
- A imagem de preview é um arquivo local, raster, neutro e já incluído no build.
- Título e descrição repetem o `<title>` e a `meta description` de cada página.
- Teste de build que falha se uma entrada nova vier sem Open Graph ou se a
  `og:image` não for absoluta, raster e presente no diretório publicado.

## Fora de escopo

- `robots.txt`, `sitemap.xml` e `app/nginx.conf`. Já estão na main pela #311.
- Identidade de release, `/version.json` e `/api/health` (PR #314, issue #287).
- Páginas ausentes em produção (`/privacidade.html`, `/criterios.html`),
  navegação, aviso de edição, pontuação, cartas, catálogo, login e inventário.
- Decisões Q1–Q6 da issue #277, inclusive destino pós-eleição, controlador LGPD
  e aprovação editorial.
- Arte nova, recorte 1200×630 e deploy.

## Critérios de aceite

- O HTML inicial de cada uma das quatro URLs contém a prévia, sem depender de
  script de cliente.
- A `og:image` responde 200 com `Content-Type` `image/*` no artefato servido
  localmente.
- O teste de build falha sem essas tags e passa com a correção.
- O gate humano continua com o Stefan. A issue #300 só fecha no aceite integral.

## Dependências

- Nenhuma para começar. A base inclui a #311.
- A #314 pode acrescentar a meta `polimatch-release` no build sem remover estas
  tags. Não há arquivo em comum com as PRs #310, #312 e #313.
- Publicar `robots.txt` e `sitemap.xml` depende do deploy da #311, não deste lote.
