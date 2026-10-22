# Chromas 104 — lote visual de dez

Issue: https://github.com/stefancabral-oss/polimatch/issues/251
Branch: `art/chromas-104-pilot`, criada sobre main dac70018.

## Entrega concreta
- 104 pessoas da nova curadoria; 104 retratos de origem conferidos por SHA-256.
- 1.248 espaços planejados (12 por identidade). Não confundir com artes prontas.
- Dez PNGs mestres novos em 1060 × 1484, 29,72 MB no conjunto.
- 10 geradas, 0 aprovadas pelo usuário, 1.238 espaços ainda sem arte.
- Produção por imagegen nativo; prompts em `../references/generation-records.json`.
- Acabamento Malaquita inaugural: ouro gravado, inlays verdes, foil nas bordas,
  retrato dominante e nome em porcelana. Sem cenas ou citações inventadas.

## Revisão
Abra [o índice visual](review.md). Os arquivos `artwork/*.png` são os mestres,
sem recompressão ou manipulação posterior. Manifesto guarda estado por versão;
`artwork-receipts.json` contém dimensões, tamanho e hash de cada arquivo.

Conferência do agente: nomes legíveis, pessoas reconhecíveis, sem erros anatômicos
óbvios no enquadramento. Isso não substitui revisão humana de semelhança.
Erika e Luciano têm pequenas diferenças de moldura/tipografia em relação ao
master usado nas sete últimas cartas; eventual integração deverá padronizar
as camadas de marca/nome sem regenerar rostos aprovados desnecessariamente.

## Limites
Nenhum arquivo do aplicativo, inventário, voto ou ranking foi alterado. As novas
artes não estão publicadas. PNGs não foram incluídos no bundle e ainda precisam
de derivados otimizados para distribuição. Sem mudança de runtime, não se
executou a suíte do jogo nesta unidade; verificações de dados e imagens foram
executadas e estão em `verification.json`.

## Gate e próximo passo
O CONTEXT.md global exige: “A aprovação visual dos retratos começa por um lote
de dez pessoas antes da escala fotográfica completa.” Stefan revisa este lote
para estabelecer o padrão antes das outras 94 pessoas e das 11 versões adicionais.
Não há aprovação implícita, execução em segundo plano ou arte futura prometida.
Temas das versões 2–12 ainda não definidos para a nova curadoria; não reaproveitar
acontecimentos do catálogo antigo sem conferir fonte e identidade.

## Aprovação posterior — 22/10/2026
Stefan aprovou este lote de dez e autorizou integração: “Show. Implementa no site”.
O estado pendente acima descreve a entrega anterior. As outras 94 pessoas e
as versões adicionais continuam sem arte/aprovação. Integração: estágio 24, #253.
