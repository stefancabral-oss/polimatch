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

## Ajuste encontrado no CI
O cenário com Google habilitado precisava de 8px adicionais de folga no duelo
móvel. Compactado apenas o espaçamento do cabeçalho nessa tela, preservando
a altura das cartas e o mínimo de 12px entre a ação de trocar e o menu. Smoke
com login, regressão dos quatro destinos e 16 viewports aprovados localmente.

## Contrato preservado e CI
Removida a reserva artificial de largura da barra de rolagem para preservar
as larguras canônicas das cartas. A fixture do piloto acompanha o novo wrapper
sem mudar contratos, tolerâncias ou gates editoriais. Os dois cenários passaram.
O smoke aguarda a pintura da rolagem antes de pressionar uma carta, e mantém
a pressão até o perfil aparecer; os asserts de ausência de voto e foco seguem.

No commit de código `64ef86c`, Design Validator e toda a matriz Chromium passaram
no CI (runs 40031981935/40031981997). O WebKit ficou na instalação por tempo
incomum; uma nova execução acompanha esta atualização de evidência, sem alterar
código de produção. O resultado definitivo e o QA do deploy serão registrados
na PR #260. Não declarar Safari ou publicação aprovados antes da confirmação.
