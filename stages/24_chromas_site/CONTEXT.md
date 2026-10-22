# [ICM 24] Integrar as Chromas aprovadas — #253

## Autorização
Em 22/10/2026 Stefan respondeu ao lote de dez: "Show. Implementa no site".
Isso aprova o lote visual apresentado e autoriza sua integração/disponibilização.
As outras 94 pessoas e as versões 2–12 não são declaradas produzidas/aprovadas.

## Entradas
PR #250 (duelos de 104 pessoas), PR #252 (dez PNGs), `app/src/tcg-card.js`,
`app/src/main.js`, `app/src/presidential-page.js`, `app/e2e/presidential-duels.mjs`.
Contexto global e AGENTS.md lidos. Preservar ranking/votos e retratos originais.

## Implementação
WebP responsivo em duas resoluções; carta completa sem sobrepor moldura/nome.
Carregamento progressivo com fotografia original como fallback. Manter os dois
indicadores de escolha, confirmação e pontos separados da arte. Disclosure de IA.
Integrar à home e aos duelos sem alterar inventário, pontuação ou autoria das fotos.
Mestres e provas ficam fora do bundle. Rotas das 104 pessoas dependem da PR #250.

## Verificação
Contrato de dez identidades/arquivos e derivações dos mestres; fallback em erro;
nome acessível; seleção e confirmação em Chromium/WebKit; celular e desktop;
build e CI. Publicação só pode ser declarada após conferir assets online.

## Gate
Lote artístico aprovado pelo usuário nesta mensagem. Implementação segue critérios
aprovados e será testada; não inventar aprovação para artes ainda não produzidas.
