# ICM 27 — Menu principal sem sobreposição — #259

Stefan apontou em image(20261023-215300).png que o menu da página principal
continua flutuando. A correção do estágio 25 cobriu apenas a arena independente.
O estágio atual completa a mesma decisão visual em Início/Duelo/Coleção/Ranking.

Entradas: AGENTS.md e contexto global lidos; shell persistente main.js/styles.css,
navegação cívica e testes de scroll/responsividade. Manter DOM persistente,
ranking, votos, modais, Mais e rotas habilitadas. Sem artes ou backend.

Aceite: navegação em linha própria, conteúdo rola acima dela, sem overlap e
sem overflow horizontal; botões funcionam e estado/rolagem preservados conforme
a tela; cartões e ações continuam alcançáveis em alturas curtas. Chromium e
WebKit, build e QA público antes de declarar publicação. Correção autorizada
pelo pedido do usuário; não inventar aprovação das novas Chromas especiais.
