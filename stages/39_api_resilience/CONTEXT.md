# ICM 39 — API que não cai, erros visíveis e alarme — #281
Base main 7c0bb27. Ler o contexto raiz, o README (deploy) e
docs/security/VOTE_ABUSE_POLICY.md. Bloqueio B7 da auditoria de 30/10/2026.

## Objetivo e entradas
A API precisa sobreviver a falhas comuns de infraestrutura e deixar rastro
quando algo dá errado. Em main, o processo não sobrevive ao encerramento de
uma conexão ociosa pelo PostgreSQL, roda sem prazos de banco nem handlers de
processo, o parser de corpo aceita conteúdo que o cliente nunca envia, há
dependências com avisos de segurança e só respostas 5xx são registradas. Não
existe nenhum alerta externo.

## Escopo
- Pool com ouvinte de erro (ocioso e emprestado), prazo de conexão e limites
  de sessão para consulta, trava e transação parada; migração de boot com
  prazos próprios e finitos.
- Política explícita para unhandledRejection, uncaughtException, sinais e
  falha de boot.
- Parser de corpo: Content-Encoding diferente de identity recebe 415; JSON
  malformado, corpo grande e charset desconhecido recebem 4xx com código.
- npm audit fix em back/ sem --force; app.disable('x-powered-by').
- Uma linha JSON por requisição (método, rota, status, ms, código, requestId,
  revisão), sem IP e sem Authorization; 5xx com stack; 429 com o código.
- docs/ops/MONITORING.md com o passo a passo do monitor externo e dos avisos
  do Dokploy, que são ação do Stefan.

## Fora de escopo
Captura de erros no navegador (depende do SHA do build no cliente, ICM 45).
Compressão, 404 em JSON e cabeçalhos de segurança da API (ICM 38).
Dependabot e npm audit no CI (ICM 52). Rotação de logs do Docker (ICM 41).
SOURCE_COMMIT no deploy (ICM 45). Mudanças no app, no jogo ou no ranking.

## Critérios de aceite
- Smoke local: depois de pg_terminate_backend, a chamada seguinte a
  /api/health responde 200 sem reiniciar o processo.
- Corpos malformados ou com codificação inesperada recebem 4xx sem derrubar
  o processo.
- npm audit --omit=dev em back/ sem nada high ou critical.
- Respostas sem x-powered-by.
- Parar a API gera alerta em até 5 min (Stefan).
- Recusas 429 contáveis no log com o código; 5xx registrado com stack e
  requestId.

## Dependências e gate
Nenhuma dependência de código. Monitor externo, destino dos alertas e
notificações do Dokploy dependem do Stefan. Revisão e merge pelo Stefan;
nenhum agente aprova o próprio gate nem publica em produção.
