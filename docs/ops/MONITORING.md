# Monitoramento, alertas e logs da API

Este documento descreve o que a API registra e como montar o alarme externo.
O código faz a parte de registro. O monitor externo e as notificações do
Dokploy dependem de contas e painéis do Stefan e estão marcados como
**Ação do Stefan**.

## O que já existe no código

- `GET /api/health` responde `200` com `"ok":true` quando a API e o PostgreSQL
  respondem. Se o banco falhar, responde `503`.
- O `HEALTHCHECK` da imagem faz o orquestrador reiniciar um container
  doente, mas **não avisa ninguém**. Por isso o monitor externo abaixo é
  obrigatório.
- A API grava no stdout uma linha JSON por requisição e uma linha por evento
  relevante (boot, erro de banco, falha 5xx, encerramento). Detalhes em
  [Campos do log](#campos-do-log).
- As quatro páginas do app relatam erros do navegador (erro de execução,
  promessa rejeitada sem tratamento e falha de import dinâmico) para
  `POST /api/client-errors`, e a API grava uma linha `client_error` com o build
  da página. Detalhes em [Erros do navegador](#erros-do-navegador).

## Ação do Stefan 1 — monitor externo com alerta em até 5 minutos

Recomendação: **Better Stack Uptime, plano gratuito**. Ele verifica a cada
3 minutos e manda alerta por e-mail (Slack também é gratuito). O plano
gratuito do UptimeRobot verifica só a cada 5 minutos, o que não garante alerta
antes de 5 minutos.

1. Criar a conta em betterstack.com, produto Uptime.
2. Confirmar o e-mail de destino dos alertas (o e-mail pessoal do Stefan) e,
   se quiser, ligar o Slack em Integrations.
3. Criar o monitor **PoliMatch — site**:
   - URL: `https://polimatch.com.br/`
   - Alert us when: *URL doesn't contain keyword*, palavra `PoliMatch`
   - Check frequency: **3 minutes**
   - Confirmation period: imediato ou no máximo 1 minuto
   - Recovery period: o padrão serve
   - Notificar por e-mail (e Slack, se ligado)
4. Criar o monitor **PoliMatch — API**:
   - URL: `https://api.polimatch.com.br/api/health`
   - Alert us when: *URL doesn't contain keyword*, palavra `"ok":true`
     (com as aspas, exatamente assim)
   - Mesmas configurações de frequência, confirmação e notificação do site.
5. Validade dos certificados: em cada um dos dois monitores, abrir
   **Configure → Advanced settings**, ligar a verificação SSL e o aviso de
   expiração com **14 dias** de antecedência. O Let's Encrypt renova com
   30 dias restantes; um aviso com 14 dias significa que a renovação falhou.
   - Se o plano gratuito não liberar esse aviso, criar no UptimeRobot
     (gratuito) um monitor HTTPS para cada domínio com o aviso de expiração
     ligado. Para validade de certificado, o intervalo de 5 minutos não
     importa.
6. `www.polimatch.com.br`: só adicionar depois do ICM 38, quando o `www`
   tiver certificado próprio e redirecionamento. Antes disso o monitor
   dispararia o tempo todo.
7. Teste do alarme (critério "parar a API gera alerta em até 5 min"):
   - Opção sem queda: criar um monitor temporário para
     `https://api.polimatch.com.br/api/health-teste-alerta` com a palavra
     `"ok":true`. A rota não existe, então o alerta tem de chegar em até
     5 minutos. Anotar o horário de criação e o de chegada do e-mail, depois
     apagar o monitor.
   - Opção completa, numa janela de pouco uso: parar o serviço da API no
     Dokploy, cronometrar até o alerta chegar, iniciar o serviço de novo e
     confirmar o aviso de recuperação.
   - Registrar o tempo medido na issue #281.

## Ação do Stefan 2 — avisos de build e deploy no Dokploy

1. No Dokploy, abrir **Settings → Notifications → Add Notification**.
2. Escolher o canal: e-mail (SMTP), Telegram (token do @BotFather e chat
   ID), Discord ou Slack. Usar o mesmo destino do monitor externo.
3. Marcar **App Build Error** (falha de build) e **App Deploy** (deploy
   concluído). Os demais eventos são opcionais.
4. Usar **Test** para conferir a entrega e salvar.
5. Conferir no próximo deploy que o aviso chegou. O nome dos eventos pode
   variar um pouco entre versões do Dokploy.

## Retenção dos logs

Uma linha por requisição faz o log crescer com o tráfego. A rotação do driver
de log do Docker (tamanho máximo e número de arquivos) está no escopo do
ICM 41. Cada deploy recria o container; `docker logs` só mostra o período desde
o último deploy.

## Campos do log

Toda linha é um objeto JSON com:

| Campo | Conteúdo |
| --- | --- |
| `t` | horário ISO 8601 em UTC |
| `level` | `info`, `warn`, `error` ou `fatal` |
| `service` | sempre `polimatch-api` |
| `rev` | SHA do build embutido na imagem; `null` até o ICM 45 passar `SOURCE_COMMIT` no deploy |
| `event` | tipo da linha |

Linha de requisição (`"event":"http_request"`, nível `info` para qualquer
status):

| Campo | Conteúdo |
| --- | --- |
| `requestId` | o mesmo valor do cabeçalho `X-Request-Id` da resposta |
| `method` | método HTTP |
| `route` | rota casada, como `/api/player`; `null` quando nenhuma rota casou |
| `path` | só quando `route` é `null`; caminho sem query string, até 120 caracteres |
| `status` | status HTTP da resposta |
| `ms` | duração em milissegundos |
| `code` | código de erro da resposta (`PLAYER_ISSUANCE_LIMIT`, `INVALID_JSON`, `DATABASE_UNAVAILABLE`…) ou `null` |
| `aborted` | `true` quando o cliente fechou a conexão antes do fim |

Nunca entram no log: IP do cliente, cabeçalhos (inclusive `Authorization`),
query string e corpo da requisição. Tokens e credenciais que apareçam em
mensagens de erro são mascarados.

Outros eventos:

| `event` | Quando |
| --- | --- |
| `request_failed` | resposta 5xx; traz `requestId`, `status`, `errorCode` (SQLSTATE quando houver) e `error` com a stack |
| `pg_pool_error` | o banco encerrou ou perdeu uma conexão (`scope` `idle` ou `checked-out`); a API continua |
| `database_ready`, `listening` | boot concluído |
| `boot_failed` | o boot falhou; o processo sai com código 1 |
| `client_error` | erro relatado pelo navegador, com `requestId` e os campos de [Erros do navegador](#erros-do-navegador) |
| `unhandled_rejection` | promessa rejeitada sem tratamento; registrada, a API continua |
| `uncaught_exception` | exceção não capturada; a API fecha servidor e pool e sai com código 1 |
| `shutdown_started`, `shutdown_completed`, `shutdown_failed`, `shutdown_forced` | encerramento ordenado (SIGTERM, falha fatal) |

## Erros do navegador

Cada página instala o relato antes de qualquer outro módulo. O navegador
envia por `sendBeacon`, como `text/plain`, um objeto de no máximo 2 KB com:

| Campo | Conteúdo |
| --- | --- |
| `build` | identificação do build da página: o `SOURCE_COMMIT` do build; enquanto o deploy não passa esse valor (ICM 45), vem o carimbo de horário do build |
| `page` | caminho da página, sem query string nem fragmento |
| `kind` | `error`, `unhandledrejection` ou `preload` (import dinâmico que falhou, como um chunk antigo depois de um deploy) |
| `message` | mensagem do erro, até 300 caracteres |
| `source`, `line`, `column` | arquivo e posição, quando o navegador informa |
| `stack` | stack curta, até 1200 caracteres |

Nada do jogador entra no relato: nem chave de recuperação, nem voto, nome ou
conteúdo do armazenamento local. Query string e fragmento saem das URLs,
tokens são mascarados no navegador e de novo na API, e a API descarta
qualquer campo fora da lista. Cada página envia no máximo 5 relatos e não
repete o mesmo erro. A API aceita até 10 relatos por minuto por rede
(pseudônimo HMAC, nunca o IP) e 120 por minuto no total; acima disso responde
`429` com `CLIENT_ERROR_RATE_LIMITED`.

Para testar em produção depois do deploy, abrir o console do navegador em
`https://polimatch.com.br/` e rodar
`setTimeout(() => { throw new Error("teste de alerta") })`. A linha aparece em
segundos:

```sh
docker logs --since 10m <api> 2>&1 | grep '"event":"client_error"' | grep 'teste de alerta'
```

## Consultas úteis no servidor

Trocar `<api>` pelo nome do container da API (`docker ps` mostra) ou usar a
aba de logs do serviço no Dokploy. Tudo sai no stdout; o `2>&1` só inclui
mensagens do próprio npm.

```sh
# requisições nas últimas 24 h
docker logs --since 24h <api> 2>&1 | grep -c '"event":"http_request"'

# recusas por limite (429) e por código
docker logs --since 24h <api> 2>&1 | grep -c '"status":429'
docker logs --since 24h <api> 2>&1 | grep '"status":429' | grep -o '"code":"[A-Z_]*"' | sort | uniq -c

# falhas 5xx com stack e requestId
docker logs --since 24h <api> 2>&1 | grep '"event":"request_failed"'

# banco instável ou travado
docker logs --since 24h <api> 2>&1 | grep -E '"event":"pg_pool_error"|"code":"DATABASE_UNAVAILABLE"'

# erros do navegador por build e mensagem
docker logs --since 24h <api> 2>&1 | grep '"event":"client_error"' | grep -o '"build":"[^"]*".*"message":"[^"]*"' | sort | uniq -c | sort -rn | head

# falhas do processo
docker logs --since 24h <api> 2>&1 | grep -E '"event":"(boot_failed|uncaught_exception|unhandled_rejection|shutdown_forced)"'

# requisições que levaram 1 s ou mais
docker logs --since 24h <api> 2>&1 | grep '"event":"http_request"' | grep -E '"ms":[0-9]{4,}'
```

## Variáveis de ambiente da API

Todas opcionais; os padrões valem para produção.

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `LOG_LEVEL` | `info` | `warn` esconde as linhas de requisição |
| `PG_POOL_MAX` | `10` | conexões no pool |
| `PG_CONNECT_TIMEOUT_MS` | `5000` | prazo para abrir conexão |
| `PG_STATEMENT_TIMEOUT_MS` | `10000` | prazo de cada consulta |
| `PG_LOCK_TIMEOUT_MS` | `5000` | prazo de espera por trava |
| `PG_IDLE_IN_TRANSACTION_TIMEOUT_MS` | `15000` | transação aberta sem uso é encerrada pelo banco |

A migração de boot usa prazos próprios (2 min por comando, 30 s de trava,
1 min de transação parada) que valem só dentro dela. Valor inválido em
qualquer variável `PG_*_TIMEOUT_MS` impede o boot com mensagem clara.

Quando o banco estoura um prazo, encerra a conexão ou está sem conexões
livres, a API responde `503` com `code: "DATABASE_UNAVAILABLE"` e
`Retry-After: 5`. O app já trata qualquer 5xx como falha passageira e oferece
repetir.

## Pendente

- O campo `build` dos relatos do navegador e o `rev` da API só trazem o SHA do
  commit depois que o ICM 45 passar `SOURCE_COMMIT` no build do app e da API.
