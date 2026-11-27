# Política de integridade do voto público

Status: política normativa da API do PoliMatch, versão 7, vinculada às issues #170, #179, #282, #324, #336, #350 e #354.

Esta política existe para que o placar público seja um painel de preferências declaradas com limites conhecidos. Ela não transforma o resultado em pesquisa eleitoral nem prova que cada jogador corresponde a uma pessoa única.

## Quem pode votar

- Leituras de catálogo e perfis continuam públicas. Ranking, distribuição diária, revelação de previsões e futura comparação de espelho ficam retidos por padrão e seguem o [gate de publicação agregada](../legal/AGGREGATE_PUBLICATION_GATE.md).
- Uma escrita no ranking só é aceita quando vinculada a um jogador existente por um token opaco emitido pelo servidor (`pm2_` para visitante anônimo ou `pms_` para sessão Google).
- Requisições sem token, com token inválido ou expirado não alteram o ranking.
- Um login Google verificado é ligado a um único jogador por `provider + subject`; trocar de sessão não cria um novo histórico para a mesma identidade.
- O servidor persiste apenas o hash dos tokens. Tokens e endereços IP brutos não entram em logs nem no banco.

## Quanto cada jogador pode votar

Somente escolhas novas consomem cota. Repetir o mesmo `roundId` livre ou `answerId` diário com a mesma escolha é uma recuperação idempotente e não consome outra unidade.

| Escopo | Limite | Janela | Resultado ao exceder |
|---|---:|---|---|
| jogador | 8 escolhas | minuto do PostgreSQL | HTTP 429, `VOTE_RATE_LIMITED` |
| jogador, total | 30 escolhas | dia editorial de São Paulo | HTTP 429, `VOTE_DAILY_LIMIT` |
| jogador, rodada do dia | 10 escolhas | janela persistida da edição diária | HTTP 429, `DAILY_CHOICE_LIMIT` |
| jogador, conjunto não diário: livre, aquecimento e desempate | 20 escolhas compartilhadas | dia editorial de São Paulo | HTTP 429, `FREE_CHOICE_LIMIT` |
| pseudônimo de rede | 3 novos jogadores anônimos | dia editorial de São Paulo | HTTP 429, `PLAYER_ISSUANCE_LIMIT` |

Uma escolha entre quatro gera três comparações Elo, mas consome uma unidade; uma escolha entre duas também consome uma unidade. Na consolidação #182 de 17/09/2026, aquecimento e desempate usam o mesmo conjunto não diário do modo livre: três votos no aquecimento deixam dezessete escolhas para livre/desempate nessa data editorial. Esgotar esse conjunto impede novos votos nos três modos até a próxima data, mas preserva as dez escolhas diárias. Os nomes históricos `freeChoices` e `FREE_CHOICE_LIMIT` identificam esse conjunto compartilhado na API; não prometem vinte escolhas adicionais em quatro cartas. Os limites numéricos e snapshots anteriores permanecem inalterados.

A cota total é 30. A edição diária usa exatamente seus `opensAt` e `closesAt` persistidos; os modos não diários calculam a mesma janela no relógio injetado pela aplicação. Apenas o bucket de minuto usa `now()` do PostgreSQL.

Na migração da cota antiga por dia UTC, os buckets legados que se sobrepõem ao dia editorial são somados conservadoramente ao contador total v2, limitado a 30. A aproximação pode bloquear cedo, mas nunca concede uma segunda franquia de 30 escolhas durante o deploy.

A cota de jogos novos por rede usa a mesma janela das cotas por jogador: começa à meia-noite de São Paulo e o `Retry-After` da recusa conta os segundos até a próxima meia-noite, não 24 horas fixas. Na troca da janela antiga por dia UTC, o contador legado que se sobrepõe ao dia editorial é herdado, limitado a 3, para o dia do deploy não abrir uma segunda franquia para a mesma rede.

O login Google não consome a cota de jogos novos por rede, de propósito: ele é a saída para quem compartilha a rede com muita gente (CGNAT de operadora, Wi-Fi de escola ou escritório) e encontrou o limite anônimo esgotado. A identidade Google continua ligada a um único jogador por `provider + subject`, e as cotas por jogador valem igualmente para essa sessão. O smoke `back/scripts/vote-abuse-smoke.mjs` prova que um subject novo sem token entra mesmo com a rede esgotada, sem criar nem alterar contador de rede. Fechar essa saída, ou dar a ela uma cota própria, exige nova decisão versionada.

As recusas de criação de jogador são contadas na tabela agregada `quota_rejections_daily` (`day`, `scope`, `code`, `count`), fora da transação revertida. Ela não guarda IP, pseudônimo de rede, jogador nem token, e é retida por 400 dias para comparar períodos; os contadores por rede continuam sendo apagados depois de 8 dias.

O pseudônimo de rede é `HMAC-SHA-256(identidade de rede normalizada, VOTER_NETWORK_SECRET)`. IPv4 usa o endereço canônico; IPv6 usa o prefixo `/64`, para que endereços temporários da mesma rede não multipliquem cotas. Entradas de proxy que não sejam IP válidos caem numa identidade comum e não podem fabricar pseudônimos arbitrários. A cota de emissão por rede não é usada sozinha: ela limita a multiplicação de tokens, enquanto as cotas persistentes por jogador limitam a escrita. O segredo deve ser próprio do ambiente de produção e não pode ser versionado.

Alterar qualquer número exige nova decisão versionada, teste e registro no handoff; não é ajuste operacional silencioso. A revisão do limite de 3 jogos novos por rede é a decisão Q4 da issue #277 e continua pendente; a versão 3 muda só a janela e a contagem das recusas.

## Resposta de pesquisa por foto

A versão 4 acrescenta a pesquisa por foto ([ICM 68] #324). Ela não muda nenhum número das seções acima.

- A resposta de uma pesquisa é uma por identidade e por pesquisa. Identidade é o jogador mais os jogadores anônimos incorporados a ele no login Google. (Versão 6: uma por identidade, por pesquisa e por rodada. Ver "Rodadas da pesquisa por foto", abaixo.)
- O banco garante uma linha por jogador e pesquisa. Uma identidade pode acabar com mais de uma linha quando dois jogadores que já tinham respondido são ligados depois. Nesse caso vale a mais antiga, e qualquer contagem futura precisa contar por identidade, não por linha. (Versão 6: isto descreve a rodada 1. As rodadas seguintes ficam em tabelas próprias, com uma linha por jogador, pesquisa e rodada.)
- O servidor emite o sorteio das cartas uma vez por jogador e pesquisa. A resposta só é aceita se bater com esse sorteio: cada escolha na tela em que a carta foi mostrada, e a escolhida final entre as escolhidas. As cartas mostradas nunca vêm do cliente. (Versão 6: o sorteio é emitido uma vez por jogador, pesquisa e rodada, e a resposta é conferida contra o sorteio da rodada dela.)
- Repetir a mesma resposta é uma recuperação idempotente e devolve o recibo original. Outra escolha depois da primeira é recusada com HTTP 409, `PHOTO_SURVEY_ALREADY_ANSWERED`, e não regrava. (Versão 6: as duas regras valem por rodada.)
- Sorteio e resposta são gravados em tabelas próprias, imutáveis como os votos. Não há troca depois de confirmar.
- A resposta não consome a cota de 30 escolhas, não entra no limite de 8 escolhas por minuto e não altera o ranking nem o Elo. A emissão do sorteio também não consome cota.
- Fora da janela da pesquisa, sorteio novo e resposta são recusados com HTTP 409, `PHOTO_SURVEY_CLOSED`. (Versão 6: o pedido de rodada nova fora da janela não é erro: devolve a última rodada respondida e não emite outra.)
- Quem apaga os dados do aparelho vira outro jogador e pode responder de novo. O que limita isso é a cota de 3 jogos novos por rede descrita acima. O cadastro por CPF, previsto na decisão 0001, é o que fecha essa porta, e não faz parte desta versão. (Versão 5: essa porta fecha na pesquisa por foto. Ver "Cadastro com CPF", abaixo.)
- Um jogador anônimo que recebeu o sorteio de uma pesquisa, com ou sem resposta, e depois entra numa conta Google já existente é ligado à conta mesmo sem ter escolhas no jogo. A chave anônima deixa de valer, então uma aba aberta com ela não grava outra resposta. Nesse caso nada do jogo é somado: ranking, versão e Chromas da conta ficam como estavam.
- O recibo (`answerId`) é único entre todas as respostas. Um recibo já usado por outra pessoa é recusado com HTTP 400, mesmo em requisições simultâneas. (Versão 6: único entre as respostas de todas as rodadas; o recibo de uma rodada também não serve para outra rodada da mesma pessoa.)
- Nenhuma rota devolve soma de respostas. O [gate de publicação agregada](../legal/AGGREGATE_PUBLICATION_GATE.md) continua valendo.
- As rotas da pesquisa nascem desligadas. Só `PHOTO_SURVEYS_ENABLED=true` no ambiente da API as liga; sem isso respondem HTTP 404, `PHOTO_SURVEYS_DISABLED`, e nada é gravado.

## Cadastro com CPF

A versão 5 acrescenta o cadastro obrigatório ([ICM 71] #336, decisão 0004). Ela não muda nenhum número das seções acima.

- O sorteio e a resposta de uma pesquisa por foto só valem para a sessão de uma conta Google que tenha cadastro com CPF. Sem sessão: HTTP 401. Com chave de visitante anônimo, ou com conta sem cadastro: HTTP 403, `CPF_REGISTRATION_REQUIRED`, e nada é emitido nem gravado. A recusa vale também para ler a resposta já dada.
- A definição pública de cada pesquisa continua aberta a qualquer visitante.
- O cadastro (`POST /api/registration`) só é aceito com sessão de conta Google. Com chave de visitante anônimo: HTTP 403, `GOOGLE_ACCOUNT_REQUIRED`.
- Um CPF por conta e uma conta por CPF. Um CPF já cadastrado em outra conta é recusado com HTTP 409, `CPF_ALREADY_REGISTERED`, também em pedidos simultâneos. A mesma conta repetindo o próprio CPF recebe o cadastro existente; com outro CPF, HTTP 409, `REGISTRATION_EXISTS`.
- O CPF é conferido pelos dois dígitos verificadores (HTTP 400, `CPF_INVALID`). Isso não prova que o CPF existe na Receita Federal nem que pertence a quem digitou: a identidade continua sendo a da conta Google, e o CPF limita uma conta por número.
- O número do CPF não é persistido nem entra em log ou em resposta. O banco guarda `HMAC-SHA-256(CPF em onze dígitos, chave)`, em que a chave é `HMAC-SHA-256(VOTER_NETWORK_SECRET, "polimatch:cpf-registration:v1")`. O mesmo texto não produz o mesmo código que o pseudônimo de rede.
- O código protege o número num vazamento só do banco. Ele não é anonimização: existem cerca de um bilhão de CPFs com dígitos válidos, e quem tem o banco e o segredo juntos consegue testar todos contra os códigos. O cadastro continua sendo dado pessoal.
- Trocar `VOTER_NETWORK_SECRET` muda todos os códigos e desfaz a unicidade do CPF. A troca passa a exigir migração dos cadastros e nova decisão versionada.
- Cada conta pode fazer 5 pedidos de cadastro por dia editorial de São Paulo. O sexto é recusado com HTTP 429, `REGISTRATION_ATTEMPT_LIMIT`, com `Retry-After` até a meia-noite de São Paulo. O limite existe para que uma conta não sirva para descobrir quais CPFs já estão cadastrados. Pedido malformado e repetição do próprio cadastro não consomem tentativa.
- O cadastro pertence à conta (`provider + subject`), não ao jogador ativo: quando dois históricos são reunidos e o jogador ativo muda, o cadastro acompanha a conta.
- O cadastro guarda faixa de idade, gênero, estado, a versão do texto de consentimento aceito e o instante do aceite. O consentimento é obrigatório (HTTP 400, `CONSENT_REQUIRED`), e um texto desatualizado é recusado (HTTP 400, `CONSENT_VERSION_MISMATCH`).
- As respostas dadas por visitantes anônimos antes desta versão continuam no banco, imutáveis. Só voltam a ser lidas quando a pessoa entra com Google a partir do mesmo aparelho, o que liga o histórico à conta, e faz o cadastro.
- O login Google não consome a cota de jogos novos por rede (versão 3). Com o cadastro obrigatório, o que limita a multiplicação de respostas na pesquisa por foto é um CPF por conta; a cota de rede segue valendo para o jogo anterior. (Versão 6: uma conta passa a poder ter várias respostas na mesma pesquisa, uma por rodada. Elas contam como uma pessoa só; o que limita o número de pessoas continua sendo um CPF por conta.)
- O smoke `back/scripts/cpf-registration-smoke.mjs` prova estas regras num PostgreSQL de verdade.

## Rodadas da pesquisa por foto

A versão 6 acrescenta as rodadas ([ICM 75] #350, decisão 0007). Ela não muda nenhum número das seções acima.

- Depois de responder, a pessoa pode jogar rodadas novas da mesma pesquisa enquanto houver confronto que ela ainda não viu. Confronto é uma dupla de cartas que apareceu junta numa tela de uma rodada respondida: uma tela de voto ou a final. Continuar é opcional.
- A resposta é uma por identidade, por pesquisa e por rodada. Uma rodada só começa depois de a anterior ser respondida, e só com a pesquisa dentro da janela.
- A rodada 1 é o sorteio e a resposta que já existiam, nas mesmas tabelas e com a mesma regra de identidade: o jogador mais os anônimos incorporados a ele, valendo a resposta mais antiga. As respostas gravadas antes desta versão valem como rodada 1.
- As rodadas 2 em diante seguem a mesma regra de identidade: são procuradas no jogador e nos incorporados a ele. Se o jogador ativo da conta muda quando dois históricos são reunidos, as rodadas respondidas pelo anterior continuam valendo, a rodada aberta continua a mesma (da rodada 2 em diante; a rodada 1 emitida e sem resposta é a do próprio jogador, como antes desta versão) e a conta não ganha uma segunda resposta para a mesma rodada. Quando dois jogadores reunidos depois já tinham a mesma rodada, vale a respondida mais antiga; as outras linhas continuam gravadas.
- O servidor monta cada rodada nova com prioridade para as duplas que a pessoa ainda não viu. Enquanto houver dupla por ver, a rodada nova traz pelo menos uma numa tela de voto. Entre montagens equivalentes decide o sorteio, com a mesma fonte de acaso do servidor. As cartas mostradas nunca vêm do cliente, em rodada nenhuma.
- Qualquer contagem futura conta por pessoa, com todas as rodadas dela, e não por rodada: uma pessoa, um peso. Ela precisa reunir as rodadas por identidade, como o servidor faz ao montar a rodada nova. Nenhuma soma é calculada nesta versão.
- O sorteio e a resposta devolvem o progresso da própria pessoa: quantas rodadas ela respondeu e quantos confrontos já viu. Nenhuma rota devolve soma de respostas.
- Repetir a mesma resposta da mesma rodada é uma recuperação idempotente e devolve o recibo original daquela rodada. Outra escolha para uma rodada já respondida é recusada com HTTP 409, `PHOTO_SURVEY_ALREADY_ANSWERED`. Resposta para uma rodada que não existe é recusada com HTTP 400, `PHOTO_SURVEY_RESPONSE_INVALID`.
- O recibo (`answerId`) é único entre todas as respostas, de todas as rodadas e de todas as pessoas, também em requisições simultâneas. O recibo de uma rodada não serve para outra rodada da mesma pessoa.
- O cadastro com CPF vale em toda rodada: sem sessão ou sem cadastro não há sorteio nem resposta, e a recusa é a mesma da versão 5.
- Fora da janela não há rodada nova. A rodada emitida e ainda não respondida quando a pesquisa fecha continua visível e não aceita resposta (HTTP 409, `PHOTO_SURVEY_CLOSED`).
- Um aplicativo que não conhece rodadas, e por isso não pede a rodada seguinte nem diz a rodada da resposta, tem o comportamento de antes desta versão, inclusive a recusa ao tentar responder de novo. Uma resposta que não diz a rodada é sempre da rodada 1, mesmo com uma rodada nova aberta: ela nunca é gravada numa rodada cujas telas a pessoa não viu naquele aplicativo. Consequência: uma aba com o aplicativo antigo, usada enquanto a pessoa tem uma rodada nova aberta, mostra as telas dessa rodada e recebe a recusa ao confirmar.
- As rodadas 2 em diante são gravadas em duas tabelas novas, imutáveis como as da rodada 1. As tabelas e as linhas que já existiam não são alteradas.
- A resposta e o sorteio de uma rodada nova, como os da rodada 1, não consomem cota e não alteram o ranking nem o Elo.
- O smoke `back/scripts/photo-survey-smoke.mjs` prova estas regras num PostgreSQL de verdade.

## Perfil público (versão 7)

A versão 7 acrescenta o resultado da pessoa e o perfil público ([ICM 76] #354, decisão 0008). Ela não muda nenhum número das seções acima.

- O resultado (`GET /api/photo-surveys/:surveyId/result`) é só da própria pessoa, calculado com as mesmas rodadas respondidas que o progresso usa. Tem as mesmas recusas do sorteio e não grava nada.
- O perfil pertence à conta (`provider + subject`), como o cadastro. Nasce desligado. Só conta com cadastro com CPF liga o perfil ou muda marcações (HTTP 403, `CPF_REGISTRATION_REQUIRED`). Sem cadastro, a conta só pode desligar: o pedido de desligar não grava marcações nem cria perfil.
- Ligar exige o aceite do perfil na versão atual (HTTP 400, `PROFILE_CONSENT_REQUIRED`) e um nome de perfil válido (HTTP 400, `PROFILE_INVALID`) e livre (HTTP 409, `PROFILE_HANDLE_TAKEN`, também em pedidos simultâneos de contas diferentes). O banco guarda a versão e o instante do aceite. Depois de gravado, o nome de perfil não muda (HTTP 400, `PROFILE_INVALID`, motivo `handle-locked`) e não volta a ficar livre enquanto a conta existir: um link antigo nunca mostra as escolhas de outra pessoa.
- Desligar não exige aceite nem cadastro, só a conta, e vale na hora: a leitura pública confere se o perfil está ligado a cada pedido. Nome, aceite e marcações ficam guardados com o perfil desligado.
- O perfil público (`GET /api/profiles/:handle`) só mostra o nome de perfil e, para cada pesquisa marcada em que a pessoa tem rodada respondida, o assunto, a pergunta e a carta em primeiro lugar dela. Não mostra nome da conta, foto, CPF, faixa de idade, gênero, estado nem contagem de rodadas. Responde sem cache.
- Perfil desligado, nome inexistente e nome inválido recebem a mesma resposta: HTTP 404, `PROFILE_NOT_FOUND`.
- Nenhuma rota devolve soma de respostas nem contagem de outras pessoas. O [gate de publicação agregada](../legal/AGGREGATE_PUBLICATION_GATE.md) continua valendo.
- As quatro rotas seguem `PHOTO_SURVEYS_ENABLED`, como as rotas da pesquisa.
- O smoke `back/scripts/profile-smoke.mjs` prova estas regras num PostgreSQL de verdade.

## Origem e proxy

- Navegadores só podem chamar a API a partir das origens exatas em `APP_ORIGINS`. A ausência da variável usa apenas `https://polimatch.com.br` em produção. `https://www.polimatch.com.br` fica bloqueada enquanto não for uma origem realmente servida com TLS válido.
- Origens locais de desenvolvimento só são acrescentadas fora de produção.
- Uma requisição com cabeçalho `Origin` fora da lista é rejeitada com HTTP 403 antes de chegar às rotas, e não apenas privada de cabeçalhos CORS.
- Requisições sem `Origin` continuam possíveis para health checks e clientes não navegador, mas passam pelas mesmas exigências de token e cotas.
- `TRUST_PROXY_HOPS` é obrigatório em produção e deve refletir a quantidade real de proxies confiáveis até a API. Valor ausente ou inválido impede a inicialização. Um número incorreto ainda pode agrupar usuários ou aceitar IP forjado: a configuração só é válida se o container não tiver rota pública direta e o proxy sobrescrever/normalizar `X-Forwarded-For`; essa confirmação é parte do gate de deploy.

## Erros, auditoria e privacidade

- Erros 4xx podem explicar a correção necessária e expor apenas campos de contrato documentados.
- Erros 5xx sempre respondem `erro interno`, código `INTERNAL_ERROR` e um `requestId`; mensagens do PostgreSQL e stack traces ficam somente no log do servidor.
- O mesmo `requestId` é devolvido em `X-Request-Id` e incluído no log estruturado.
- Logs de erro não incluem `Authorization`, corpo da requisição, token ou IP bruto.
- Contadores de cota ficam no PostgreSQL, portanto reinício da API e múltiplas réplicas não reiniciam nem dividem o limite.

## Contrato de confirmação no aplicativo

- Abrir a capa, navegar e entrar nos quizzes não escreve nada na API. O jogador anônimo só é criado na primeira ação que precisa de identidade (jogar a rodada, entrar no duelo ou na arena da corrida); uma chave já salva é apenas lida.
- HTTP 429 com `PLAYER_ISSUANCE_LIMIT` na criação do jogador mostrava mensagem própria na capa do jogo anterior, com `Entrar com Google` e o horário de liberação. A capa atual não cria jogador sem conta ([ICM 71] #336): esse aviso saiu do app, e a recusa continua valendo na API para o jogo anterior.

- `ready`: as quatro cartas estão ativas e nenhuma tentativa está pendente.
- `sending`: rodada, vencedor e quatro IDs ficam congelados; cartas e troca são bloqueadas, sem avanço de contador.
- `confirmed`: rankings, contadores e feedback só mudam depois que a resposta completa do servidor é validada.
- HTTP 401: a rodada permanece intacta e a ação `Restabelecer sessão` pede no máximo uma nova credencial por acionamento. Se a leitura posterior falhar, a credencial já emitida é reutilizada.
- HTTP 429: a interface mostra o tempo de espera, mantém a tentativa original e só libera a repetição depois do prazo.
- HTTP 5xx: a interface mostra apenas `Não foi possível confirmar agora.` e oferece repetição idempotente; detalhes internos nunca entram no DOM.
- Falha de rede ou timeout é tratada como resultado incerto, pois o servidor pode ter confirmado a rodada antes de a resposta se perder.

Em todo estado não confirmado, outra carta e a troca da rodada ficam bloqueadas. Toda repetição usa o mesmo `roundId`, vencedor e conjunto de candidatos; o cliente não cria incrementos locais para compensar respostas ausentes ou incompletas.

## Limites conhecidos

Esta defesa reduz automação oportunista e mutirões a partir da mesma infraestrutura, mas não promete unicidade civil. Redes distribuídas, múltiplas contas Google legítimas ou comprometidas e dispositivos em redes diferentes ainda podem ampliar participação. Se os sinais de auditoria mostrarem abuso distribuído, o próximo degrau é exigir identidade verificada, desafio antiautomação ou excluir tráfego não elegível da publicação; nenhum desses passos deve ser ativado sem nova decisão de produto e privacidade.
