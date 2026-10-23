# Menu da corrida sem sobreposição — #255

Causa: position:fixed com bottom+safe-area deixava a navegação sobre o showcase,
cartas e controles intermediários; padding no final da página não evita esse
recobrimento durante a rolagem. O navegador interno do iPhone agrava a impressão
de menu solto, próxima aos próprios controles de navegação.

Correção: shell com altura dinâmica e duas linhas reais; conteúdo/header/rodapé
rolam dentro da primeira, menu ocupa a segunda e reserva o safe-area inferior.
A barra tem fundo sólido contínuo e não moldura flutuante. Trocar de tela zera a
rolagem do contêiner certo, preservando foco do título e retorno do perfil.

Verificação local: 214 testes unitários aprovados; build e exclusão de ativos
piloto aprovados; regressão nova falha na versão anterior e passa em Chromium
em 320/390/430/768/1440 com alturas 568/640/844/1000. Confere que conteúdo termina
antes do menu, menu termina na viewport, não há overflow, alvos >=44px, destinos
Início/Duelos/Elenco/Ranking e abrir/fechar perfil com retorno de foco.
Smokes anteriores completos da corrida e dez Chromas/fallback aprovados em
Chromium 390/1440. WebKit pela matriz de CI antes da integração/publicação.

Autorização: correção explicitamente pedida por Stefan em 23/10/2026. Sem alterações
a API, artes ou regras. As duas novas artes estão em PR separada para avaliação.
Publicação e verificação pública ainda pendentes na abertura desta PR.
