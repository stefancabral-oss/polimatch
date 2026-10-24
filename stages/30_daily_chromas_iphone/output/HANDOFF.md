# Rodada diária e iPhone — #265

Causa: as artes v2 estavam na arena da corrida, enquanto o jogo principal ainda
usava apenas foto documental nos slots persistentes. As regras de altura fixas
também ignoravam a altura útil restante após cabeçalho, instrução e navegação.

A identidade canônica/personId resolve agora as 20 edições políticas, inaugurais
e especiais Lula/Flávio no jogo principal. As edições são apresentação, sem
grant de inventário. Personagens sem arte completa mantêm foto e nome originais.
Previsão continua documental. A troca de slot limpa a arte antiga antes de
carregar outra; só esconde o fallback após a imagem correta carregar.

A grade de quatro em celulares com ao menos 650px úteis consome o espaço
restante, com cartas inteiras 5:7 e ações de perfil de 44px. Telas menores
preservam a rolagem. Indicador da primeira escolha segue legível sobre a arte.

219 testes e build locais aprovados. Teste focal reproduz Carlos, Flávio, Rui e
Haddad na rodada diária, alturas 650/740/820/956, toque, perfil, primeira seleção
e falha de arte. Testes legados de anatomia passam a declarar explicitamente a
fotografia de reserva e substituem a altura fixa por limites de encaixe.
Regressões locais de duas escolhas/dez rodadas, navegação e 16 viewports passaram.
CI Chromium/WebKit e publicação serão registrados na PR. Gate visual com Stefan.

A verificação de recuperação fotográfica também força a indisponibilidade da
arte completa para medir explicitamente as quatro fotografias de reserva.
O teste em 820px inclui reserva equivalente aos insets superior/inferior do iOS.
