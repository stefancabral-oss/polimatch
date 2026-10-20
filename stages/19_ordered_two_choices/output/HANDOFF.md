# Entrega #239 — duas escolhas ordenadas

## Implementado
Primeiro toque marca, segundo em carta distinta confirma; retocar a primeira desmarca. UI 0/2 e 1/2, posições e pontos reais. API mantém selectionIds em ordem no recibo e histórico diário; migração aditiva preserva votos antigos. Pontos propostos +24/+8/-16/-16 através de cinco confrontos de oito pontos. O ranking pessoal conserva seu método de confrontos e recebe a relação primeira > segunda > duas restantes. Sem descarte na nova rodada. Capacidade orderedChoices permite implantação compatível.

## Verificação local
npm test: shared 91/91, backend 230/230, frontend 201/201. Build Vite aprovada. Chromium 390x844 e 1440x900: seleção, desmarcação, falha de rede, repetição com mesmo par/ID, dez rodadas diárias com reload e modo livre. Comprovante mostra ambas em ordem e Espelho considera ambas. PostgreSQL aprovado na revisão d189604 (run 39354878774), incluindo scoring, concorrência, reinício e diário. A revisão final adiciona uma regressão para primeira preferência fora da primeira posição visual. O resultado atual dos checks está na PR #241; o snapshot deste documento não substitui o CI. Não há lint/typecheck configurado no projeto.

## Autorização e limites
Stefan pediu criar, buildar e colocar na main e autorizou continuar. Não foi fabricada aprovação visual humana. Os números +24/+8/-16/-16 são escolha de implementação que atende a ordem e a penalização igual solicitadas; não foram fornecidos pelo usuário. Backend aceita clientes legados com escolha única; o cliente novo usa duas somente quando a API anuncia suporte. Histórico anterior é imutável.

## Ajuste encontrado no CI
A integração antiga falhava em daily_quota_used porque a limpeza inicial usava now() do PostgreSQL enquanto as partidas usavam o relógio injetado. A retenção agora recebe o mesmo instante do store; em produção o relógio padrão continua sendo o atual. O smoke existente é a regressão que capturou a diferença.

## Entrega e publicação
PR #241: https://github.com/stefancabral-oss/polimatch/pull/241. Código e build prontos; integração condicionada aos checks dessa PR. Confirmar os dois serviços publicados. Não declarar deploy sem observar assets e capacidade novos no site.

## Publicação e ajuste de conferência — #242
Em 20/10/2026 UTC, os serviços API e PWA no Dokploy concluíram deploy de a2a859ed987f1ea64688e6197806b9ff4c152973. A API pública passou a anunciar orderedChoices=true e discard=false; o site passou a servir index-BPtVlyMw.js. Uma rodada real de teste avançou de 1/10 para 2/10 após dois toques; o primeiro toque e a desmarcação não avançaram a rodada.

A inspeção encontrou título legado no tutorial e mensagem do aquecimento persistindo na entrada das dez escolhas. O ajuste #242 torna o título dependente da capacidade e limpa a mensagem ao sair dos modos binários. O smoke ordered-choices agora passa pelo aquecimento e valida o tutorial e a instrução 0/2 antes da seleção. Frontend 201/201, build e Chromium 390x844 e 1440x900 passaram localmente. Verificar os checks da PR e republicar a PWA antes de considerar o texto corrigido em produção. A API não muda neste ajuste.

O build da API também reportou alerta npm em proxy-addr 2.0.7 (GHSA-jqcg-44mw-7w3h), anterior à feature. O app configura confiança por quantidade de saltos inteira, não pela lista de sub-redes descrita no aviso. A atualização dessa dependência fica separada do ajuste visual.
