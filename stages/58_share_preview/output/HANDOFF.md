# HANDOFF — [ICM 58] Compartilhamento com cartão de preview

## Status

- Estado: pronto para gate humano
- Issue de implementação: #300, continua aberta
- Acompanhamento: #316, continua aberto
- Base: `32c9276` (#311 já mesclada em main)
- Branch: `stefancabral-oss/share-preview-html-3d6d`
- PR: o link entra no commit seguinte a este handoff, no mesmo envio
- Produção: não foi alterada. O deploy continua com o Stefan

## O que foi reproduzido

Em 07/11/2026, GET de `https://polimatch.com.br/` devolveu HTTP 200,
`text/html`, 1189 bytes, SHA-256
`326e962fbd951998a8a55c86ff7af4afb891a4481438ed7546a9d8605fd46f5d`,
sem `og:` nem `twitter:`. As outras três entradas do build também vieram sem
essas tags. `robots.txt`, `sitemap.xml`, `version.json`, `privacidade.html` e
`criterios.html` devolveram o mesmo HTML da home. Isso foi observado antes e,
segundo a checagem informada depois do merge, continua assim. Não é evidência
de falha no código da #311: a publicação desse merge não foi confirmada.

A causa da prévia está no fonte. As quatro entradas do Vite não tinham meta
Open Graph nem Twitter Card, e nenhum script de cliente as escreve. O build só
repassa o head.

## O que este lote entrega

- Head estático, anterior a qualquer `<script>`, nas quatro páginas:
  `og:type=website`, `og:locale=pt_BR`, `og:site_name=PoliMatch`, `og:title`,
  `og:description`, `og:url`, `og:image`, tipo, largura, altura e alt,
  `twitter:card=summary_large_image` e os equivalentes de título, descrição e imagem.
- `og:title` e `og:description` copiam o título e a description que a página já
  tinha. Não há frase eleitoral nova.
- `og:url` usa as mesmas quatro URLs do sitemap da #311.
- Imagem: `https://polimatch.com.br/brand/logo-volumetric.png`, o PNG de
  apresentação volumétrica já versionado em `app/public/brand/` e já servido
  em produção. Medida real: 1600×1000, 604325 bytes, `image/png`. O kit em
  `docs/design/BRAND_ASSETS.md` reserva esse arquivo como material de marca, e
  o ícone funcional continua sendo o do PWA. Nenhum byte de imagem foi gerado
  ou regravado.
- `app/scripts/verify-share-preview.mjs` roda no `npm run build`, depois do Vite
  e antes de `verify-public-refs.mjs`. A checagem da #311 permanece por último,
  como o teste dela exige.
- `app/src/share-preview.test.js` cobre as quatro entradas, a entrada nova sem
  OG, URL relativa, a imagem local e o alinhamento com o sitemap existente.

## O que a #311 já cobre

`robots.txt` (`text/plain`, `Allow: /`, sitemap canônico) e `sitemap.xml`
(as quatro URLs) estão na main. O nginx da #311 entrega `.txt`, `.xml` e `.png`
como arquivo estático e responde 404 quando o arquivo não existe. Este lote não
altera esses arquivos. No preview local do dist, `/robots.txt` saiu
`200 text/plain` e `/sitemap.xml` saiu `200 text/xml`. O complemento é o deploy
da #311, feito pelo Stefan. Não há mudança de código pendente neste lote para
robots ou sitemap.

## Dependências e conflitos

- #310, #312 e #313 não tocam os HTML, o `package.json` do app nem os scripts
  desta branch.
- #314 altera `app/vite.config.js`, workflows e o plugin que injeta
  `polimatch-release` no head durante o build. Não edita o HTML fonte. As tags
  desta branch devem permanecer, e a meta de release entra ao lado. Conferir
  isso no rebase, quando a #314 for mesclada. `/version.json` e
  `health.revision` continuam com a #314. Em produção seguem ausentes até o
  deploy correspondente.
- A reconciliação com a main foi fast-forward de `7c0bb27` para `32c9276`.
  Não havia commit publicado nesta branch, então não houve rebase nem force-push.

## Pendências humanas

- Stefan revisa e, se aceitar, mescla. Nenhum agente aprova o gate, mescla ou
  publica.
- A issue #300 pede arte 1200×630. Esse arquivo não existe no repositório. A
  imagem usada é a apresentação oficial de 1600×1000. Um recorte novo só deve
  ser feito com autorização explícita.
- O PNG tem 604325 bytes e já contém um bloco C2PA. O cartão no WhatsApp só
  pode ser confirmado depois do deploy, num aparelho real.
- As descriptions atuais citam Eleições 2026, a corrida e o debate de Lula e
  Flávio porque esse texto já estava nas páginas. Q1–Q6 da #277 continuam sem
  resposta. Este lote não decide o pós-eleição, o controlador LGPD nem a
  revisão editorial.
- Depois do deploy autorizado, repetir os GETs públicos da #316. Até lá,
  branch e PR não são produção.

## Próximo passo

Revisão do Stefan. A #316 permanece o acompanhamento; não fecha por esta PR.
