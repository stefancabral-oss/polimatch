# Entrega #239 — duas escolhas ordenadas

## Implementado
Primeiro toque marca, segundo em carta distinta confirma; retocar a primeira desmarca. UI 0/2 e 1/2, posições e pontos reais. API mantém selectionIds em ordem no recibo e histórico diário; migração aditiva preserva votos antigos. Pontos propostos +24/+8/-16/-16 através de cinco confrontos de oito pontos. O ranking pessoal conserva seu método de confrontos e recebe a relação primeira > segunda > duas restantes. Sem descarte na nova rodada. Capacidade orderedChoices permite implantação compatível.

## Verificação local
npm test: shared 90/90, backend 229/229, frontend 201/201. Build Vite aprovada. Chromium 390x844 e 1440x900: seleção, desmarcação, repetição com mesmo par/ID e conclusão diária com reload. Testes de PostgreSQL e WebKit estão no CI, pendentes nesta revisão do documento. Não há lint/typecheck configurado no projeto.

## Autorização e limites
Stefan pediu criar, buildar e colocar na main e autorizou continuar. Não foi fabricada aprovação visual humana. Os números +24/+8/-16/-16 são escolha de implementação que atende a ordem e a penalização igual solicitadas; não foram fornecidos pelo usuário. Backend aceita clientes legados com escolha única; o cliente novo usa duas somente quando a API anuncia suporte. Histórico anterior é imutável.

## Próximo passo
PR da branch feat/239-ordered-two-choices, CI PostgreSQL/WebKit e regressões. Integrar após checks e confirmar os dois serviços publicados. Não declarar deploy sem observar assets e capacidade novos no site.
