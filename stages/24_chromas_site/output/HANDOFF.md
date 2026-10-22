# Integração das dez Chromas — #253

## Comportamento
As dez artes aprovadas aparecem completas na home e nas cartas dos duelos da
corrida, nos perfis e no fechamento. Não há repetição de moldura ou placa de nome.
Indicadores de 1ª/2ª escolha e resultados +24/+8/−16 continuam como elementos do
jogo, sobre o tronco e sem cobrir a placa do nome. O rosto mantém o enquadramento
do arquivo aprovado. As outras 94 pessoas preservam fotografia e moldura TCG.

Original fotográfico permanece enquanto a arte carrega e em qualquer falha da
imagem. Nome acessível e identificação de IA preservados. Não altera inventário,
economia ou pontuação. Versões WebP responsivas (530/1060) têm nome com hash do
mestre; PNGs aprovados permanecem intactos em stages/23 e fora do dist.

## Dependências incorporadas
PR #250: catálogo/duelos das 104 pessoas e endpoints de ranking/voto compatíveis.
PR #252: mestres das dez artes e catálogo de produção. Aprovação do lote: Stefan,
22/10/2026, “Show. Implementa no site”. Reúne as dependências para uma publicação
coordenada de frontend/API. Não declara que os outros 1.238 espaços têm arte.

## Verificações
539 testes de unidade (93 shared, 232 backend, 214 frontend), build e governança
editorial passaram. Chromium em 390/1440: dez rodadas completas por largura,
retentativa da mesma confirmação após perda da resposta/reload, offline, seis
categorias, todos os perfis, busca, som, compartilhar (três caminhos), reiniciar e
ranking. Layout em 320/375/768/1440. Teste dedicado abre as dez artes, confere
proporção integral, nome único e fallback após falha de ambas as variantes WebP.
Screenshots em output/screenshots. Sem erros de console.

WebKit local bloqueado por bibliotecas de sistema; execução adicionada à matriz
Chromium/WebKit do CI remoto. Acompanhar resultado do SHA final antes de merge.

## Publicação
Pendente. API pública consultada devolvia zero candidatos para corrida-politicos.
Publicação requer API e frontend do mesmo código novo, seguida de verificação
dos assets públicos e dos endpoints. Não confundir commit em main com deploy.
Desktop Commander disponível está offline e navegador cloud não tem sessão do
Dokploy. Se o autodeploy não promover os dois serviços, falta acesso ao painel
para acionar essa publicação. Não alterar configurações/credenciais para contornar.
