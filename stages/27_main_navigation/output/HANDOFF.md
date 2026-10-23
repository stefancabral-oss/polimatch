# Menu principal — #259

## Causa e correção
A PR #258 tratou a arena independente. O menu da imagem seguinte pertence ao
shell principal main.js/styles.css e ainda usava position:fixed.
O shell principal agora também usa duas linhas reais: conteúdo rolável e
navegação inferior opaca de largura inteira, com safe area reservada. Retirado
o padding inferior artificial. Mudança de painel ou toque em uma aba reinicia
a rolagem do conteúdo, sem desmontar cartas ou modais.

## Verificação
214 testes unitários e build aprovados. Novo teste de regressão falha no build
anterior e passa em Chromium em 320/390/768/1440 nas alturas 568/844/1000, com
Início/Duelo/Coleção/Ranking, geometria, rolagem e alvos de 44px. Smokes anteriores
de interação e 16 viewports passaram na nova região rolável. As mesmas garantias
de alcançar a segunda linha, pular e ler resultados foram preservadas: testes
agora rolam a superfície do app, em vez de tentar rolar um documento travado.

Matriz de CI Chromium/WebKit deve passar no SHA final; conferir produção após
publicação. Sem mudança de backend, regras ou artes. Chromas especiais #257
continuam como entrega visual separada.

Autorização: Stefan apontou persistência do problema no menu principal e pediu
correção. Não se declara aprovação visual das artes ou conclusão sem deploy.
