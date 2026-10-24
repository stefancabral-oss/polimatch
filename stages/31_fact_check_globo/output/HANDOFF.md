# Handoff — issue #267

## Implementado
Novo modo independente Fato ou fake?, edição Globo 23/10/2026. Oito afirmações (quatro por candidato), duas opções, autoria, veredito, explicação, recorte e provas após responder. Dados resumidos sem transcrição literal; seleções de verdadeiro/falso publicados, sem converter promessas ou contextuais em falso. Entrada na home e ligação com Quem disse isso. Progresso próprio versionado, retomada, placar, revisão, reinício, compartilhamento nativo/cópia/manual e armazenamento bloqueado.

## Fontes
references/editorial.json registra fontes por item e exclusões. IBGE, MCom reproduzido no NIC.br, MAPA, Rede PENSSAN, BCB corroborado pelo DNIT e textos legais. Entrevista original de 2017 contextualiza a acusação da cerveja. Registro do debate em checagens publicadas; sem minutagem inventada. O jogo não é auditoria integral nem placar de honestidade.

## Verificação local
221 testes unitários; build Vite de quatro entradas, 317 arquivos sem piloto #176. E2E Chromium nas larguras 320/390/440/1440: oito perguntas, erro/acerto, bloqueio de resposta duplicada, retomada, próximo, resultado, revisão, links (popups externos isolados em fixtures), reinício, três caminhos de compartilhamento, cancelamento e storage indisponível. Regressão do Quem disse isso passou nas duas edições.

## Pendências de publicação
CI Chromium/WebKit, merge, deploy e QA público serão registrados na PR. Não considerar publicado antes de conferir a rota real. Fontes externas podem impor login, JavaScript, restrições de leitura ou mudar; localizadores textuais são exibidos junto aos links.

## Gate humano
Aguardando avaliação de Stefan. Nenhum teste substitui revisão humana de produto/editorial. Issue não será fechada pelo agente como aprovada.
