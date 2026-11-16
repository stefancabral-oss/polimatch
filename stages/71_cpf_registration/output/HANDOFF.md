# HANDOFF — [ICM 71] Cadastro obrigatório com CPF para responder

## Status

- Estado: `pronto para gate` nas partes 71a a 71d, num PR só, depois da revisão independente. A publicação (71e) não começou.
- Issue: #336
- Branch: `icm/71-cpf-registration`, sobre a `main` em `59ca9a1` (estágio 70 mesclado).
- PR: #337
- Nada deste estágio está em produção.

## Entregue (71a — registro)

- `docs/decisions/0004-cadastro-obrigatorio-com-cpf.md`: a instrução do Stefan de 16/11/2026, o que ela muda nas decisões 0001 e 0002, as escolhas do agente por delegação e as pendências.
- Marcações nas decisões 0001 e 0002; contexto raiz, README e AGENTS; política de integridade do voto na versão 5, com a seção "Cadastro com CPF".

## Entregue (71b — regras)

- `shared/registration.js`: conferência do CPF pelos dois dígitos verificadores, máscara, as opções de idade, gênero e estado do protótipo aprovado em 12/11/2026, o texto de consentimento com versão e a validação do pedido. A recusa diz o código e o campo, nunca o que foi digitado.

## Entregue (71c — servidor)

- `POST /api/registration`, só para sessão de conta Google. Um CPF por conta e uma conta por CPF, também em pedidos simultâneos. Cinco tentativas por conta por dia editorial de São Paulo.
- O número do CPF não passa da rota: o store recebe e guarda `HMAC-SHA-256(CPF, chave)`, com a chave derivada de `VOTER_NETWORK_SECRET` com rótulo próprio.
- Sorteio e resposta da pesquisa recusam com 403 `CPF_REGISTRATION_REQUIRED` quem não tem cadastro, antes de qualquer leitura ou gravação. A definição pública da pesquisa continua aberta.
- O cadastro pertence à conta, não ao jogador ativo.
- Migração aditiva: `cpf_registrations` e `cpf_registration_attempts`.
- A rota fica atrás do mesmo `PHOTO_SURVEYS_ENABLED` das rotas da pesquisa. Não há variável nova no ambiente.

## Entregue (71d — app)

- O formulário pertence a uma sessão: o que foi preenchido é apagado quando a pessoa sai da conta, quando a sessão vence e quando outra conta entra.
- Sessão vencida no toque em "Começar", na retomada e no cadastro: a sessão sai do aparelho e a pessoa é levada a entrar de novo.
- O erro do formulário leva o foco ao campo, marcado e ligado ao aviso; a máscara do CPF mantém o cursor no lugar.

- "Começar" decide o caminho. Sem conta Google: a entrada, com o botão do Google. Com conta e sem cadastro: o formulário (CPF com máscara, idade, gênero, estado, consentimento). Com cadastro: a pesquisa, como antes. Quem diz se falta o cadastro é o pedido de sorteio.
- Concluir o cadastro abre a pesquisa sem outro toque.
- A página não cria mais jogador sem conta. Saíram o aviso de cota de rede e `identity-notice.js`.
- O CPF fica só na memória da página até o envio: não vai para o armazenamento do aparelho nem para o endereço.
- Antes de pedir a conta, a página confere se a pesquisa segue aberta.
- Quem respondeu sem conta entra, faz o cadastro e vê a resposta que deu.
- A capa diz o que é preciso para responder. O menu e "Como funciona" também.
- `app/src/account-session.js`: a entrada com Google virou um módulo que o menu e o cadastro usam.

## Não entregue / pendente

- **71e — publicação.** Deploy da API e do app, cada um com o sim do Stefan. A ordem é API primeiro. Entre um e outro, o app antigo não começa pesquisa: o servidor recusa e ele mostra o aviso de falha.
- Conferência do CPF na Receita Federal.
- Página de política de privacidade (#283) e tela para apagar o cadastro.
- Editar o cadastro depois de feito.
- Limpeza dos contadores de tentativa antigos: ficam uma linha por conta e por dia em que houve tentativa.
- Resultado somado e recortes por perfil (#177).

## Testes executados

No CI do PR #337, o commit `8806a4a` falhou num teste de unidade do servidor: o teste procurava os dígitos "529" numa resposta de erro, e o `requestId` aleatório da resposta saiu com eles. Era defeito do teste, não do código: a busca passou a ser pelo CPF inteiro. Nesse mesmo commit passaram, no Linux, o servidor com PostgreSQL (com o smoke novo do cadastro), os roteiros de navegador em Chromium e em WebKit e a imagem do app.

Em 16/11/2026, local (macOS), no código final do PR:

- `npm run test:shared`: 118/118. `npm test --prefix back`: 305/305. `npm test --prefix app`: 203/203.
- `back/scripts/cpf-registration-smoke.mjs` num PostgreSQL 16 local, banco descartável: aprovado. `photo-survey-smoke.mjs`: aprovado. Os outros seis smokes de integração do CI passaram no mesmo banco, com as tabelas novas.
- `app/e2e/site-shell.mjs`: 44 cenários aprovados em WebKit e em Chromium 140.
- `app/e2e/photo-survey.mjs`: 34 cenários aprovados em WebKit e em Chromium 140.
- `app/e2e/client-error-report.mjs`: aprovado nos dois.
- Capturas conferidas a olho, em 390×844: capa, entrada, formulário vazio, com erro, preenchido, com CPF recusado e a pesquisa depois do cadastro. A folha está em `references/`.

O que veio antes do código, e falhou primeiro pelo motivo esperado:

- As regras: `shared/registration.test.js`.
- A rota: `back/src/registration-http.test.js` (7 dos 9 falharam antes de a rota existir).
- A tela: `app/src/registration-view.test.js`, inclusive os ajustes pedidos pela revisão (campo com erro, cursor, textos por campo).
- Os testes do servidor pedidos pela revisão (derivação da chave e dia do limite): escritos, e conferidos desfazendo o código.

O que não seguiu essa ordem:

- `back/src/registration-store.js` foi escrito antes do smoke dele. O smoke passou na primeira execução; depois, o código foi desfeito de oito formas e todas foram pegas.
- A mudança da página veio antes dos cenários de navegador do cadastro. Os cenários antigos falharam com a mudança e foram ajustados; os novos passaram de primeira. Os consertos pedidos pela revisão também vieram antes dos cenários deles. Depois, o código da página foi desfeito de doze formas, uma por conserto, e cada uma foi pega pelo cenário que diz cobrir o comportamento.

## Revisão independente

Um agente à parte, somente leitura, revisou a branch num clone próprio em 16/11/2026 (commits `73d6692` a `1186b68`). Rodou as três suítes de unidade, os dois smokes do servidor num banco dele, os dois roteiros em WebKit, uma sonda HTTP de ponta a ponta com o store real, 14 sondas de comportamento no navegador e as telas em quatro tamanhos com duas fontes. Desfez o código de 25 formas; os testes pegaram 15.

No servidor ele não achou caminho para sortear, responder ou ler resposta sem conta Google com cadastro, nem o número do CPF fora do corpo do pedido (31 tabelas, logs, respostas de erro, armazenamento do navegador, endereço e relato de erros). A unicidade segurou em pedidos simultâneos e o limite de tentativas não foi contornado.

Ele apontou dois pontos que bloqueavam o merge, corrigidos com teste:

| O que a revisão apontou | O que mudou |
|---|---|
| O formulário preenchido por uma conta aparecia para a conta seguinte na mesma aba (ao sair da conta ou quando a sessão vencia no envio), com CPF e autorização marcada | O formulário pertence a uma sessão: é apagado ao voltar para a entrada e quando outra conta entra |
| O roteiro `site-shell.mjs` tinha ficado sem a conferência de que a página não cria jogador sem conta: o laço estava vazio | A conferência voltou, por método e caminho inteiros |

E outros, também corrigidos:

- Sessão vencida deixava a chave morta no aparelho: a página repetia o mesmo pedido recusado e, voltando à aba, saía da tela de entrada. Agora a sessão recusada sai do aparelho e a pessoa é levada a entrar, no toque em "Começar", na retomada e no cadastro.
- Conta sem cadastro fazia o cadastro para descobrir que a pesquisa tinha fechado. A página confere a pesquisa antes de abrir o formulário.
- Corrigir um dígito no meio do CPF jogava o cursor para o fim.
- O erro do formulário levava o foco ao título. Agora vai ao campo, marcado como inválido e ligado ao aviso, e cada campo que falta tem o texto dele.
- Entrar pelo botão do menu com o cadastro na tela deixava o menu aberto e desatualizado. A tela fecha o menu.
- Quem tinha respostas guardadas de uma chave sem conta lia na capa "Você respondeu todas as pesquisas abertas". A capa passou a tratar essa pessoa como visitante e convida a entrar.
- A decisão 0004 dizia que "não dá para listar os CPFs cadastrados" e que o texto do consentimento era guardado. O código guardado é reversível por quem tem o banco e o segredo juntos, e o banco guarda a versão do texto, não o texto. Os dois pontos foram reescritos; um teste passou a prender o texto à versão.
- `docs/ops/DR.md` dizia que perder `VOTER_NETWORK_SECRET` só reiniciava as cotas. Com o cadastro, a perda desfaz a unicidade do CPF sem volta. Corrigido lá e no README.
- Texto antigo na política (aviso de cota na capa) e no contexto do estágio 68 (o toque cria o jogador): anotados.

Das dez mutações que os testes não pegavam, nove ganharam teste: a derivação da chave do código, o dia do limite no fuso de São Paulo, o pedido de jogador sem conta, o CPF no armazenamento enquanto é digitado, dado no endereço de um pedido, o formulário não apagado depois do envio, a falta de cadastro na confirmação, a outra aba e a volta à aba com o cadastro na tela. A décima (dois envios seguidos) ganhou um cenário com dois envios do formulário.

Ficaram anotados, sem mudança:

- Entrar numa conta Google nova mandando a sessão viva de outra conta dá 500 em `POST /api/auth/google`. É anterior a esta branch, e a revisão não achou caminho normal do app que chegue lá.
- "Escolha o estado" e os demais avisos ficam no topo da tela; num celular baixo o campo citado pode estar abaixo da dobra.

Ele não conferiu o botão real do Google, Chromium, o CI no Linux, leitor de tela de verdade, a volta pelo histórico com a página preservada, o app contra a API real, nem produção.

## Riscos conhecidos

- **CPF junto com preferência política.** É a primeira pergunta para o advogado na decisão 0001 e segue sem resposta registrada no repositório (#283). Com este estágio, toda resposta nova pertence a uma pessoa identificável pela conta. O site não tem página de privacidade; o texto de consentimento do formulário descreve o tratamento, mas não é a política. Publicar assim é decisão do Stefan.
- **O código do CPF é reversível por quem tem o banco e o segredo juntos.** Existem cerca de um bilhão de CPFs com dígitos válidos; testar todos contra os códigos é rápido. O código protege o número num vazamento só do banco; o cadastro continua sendo dado pessoal.
- **A conferência é pelos dígitos.** Não prova que o CPF existe nem que é de quem digitou. Alguém pode usar o CPF de outra pessoa, que depois não consegue se cadastrar. O que amarra a pessoa é a conta Google; o CPF limita uma conta por número.
- **A entrada com Google nunca foi exercitada com o botão real.** Está no menu, em produção, desde 14/11/2026, e nos testes é simulada. Com este estágio ela vira o único caminho para responder. Testar no site, pelo menu, antes de publicar.
- **Menos gente responde.** Entrar e preencher um formulário antes da primeira carta custa participação.
- **Dependência do Google.** Com o serviço do Google fora do ar, ninguém novo responde.
- **`VOTER_NETWORK_SECRET` não pode mais ser trocado nem perdido:** os códigos dos CPFs mudariam e a unicidade se perderia, sem volta, porque o número não é guardado. Hoje o segredo só existe no painel; precisa ir para o cofre (`docs/ops/DR.md`).
- **Menores.** A faixa mais baixa do protótipo é "16 a 24". Se o cadastro aceita 16 e 17 anos é pergunta para a revisão jurídica.
- **Respostas de ensaio.** A pesquisa em produção tem respostas de jogadores sem conta. Ficam no banco; só voltam a aparecer para quem entrar e se cadastrar a partir do mesmo aparelho.
- **Quem não tem conta Google não responde.**
- As condições de publicação dos estágios 69 e 70 seguem abertas: privacidade (#283) e backup externo (#279).

## Decisões tomadas

Instrução do Stefan em 16/11/2026: "cria o login obrigatório para cpf para poder entrar e jogar. sem esse cadastro a pessoa não pode entrar e dar voto."

Escolhas do agente, por delegação dele (decisão 0003, item 5), que pode mudar qualquer uma. Estão na decisão 0004:

- A entrada é a conta Google; o CPF é o cadastro, um por conta.
- O formulário é o do protótipo de 12/11/2026, com a caixa de consentimento a mais.
- Conferência pelos dígitos, sem a Receita.
- O servidor não guarda o número do CPF.
- A capa continua aberta; o que pede cadastro é começar a responder.
- A chave do código do CPF sai de `VOTER_NETWORK_SECRET`, para a publicação não depender de variável nova no painel.
- Limite de cinco tentativas de cadastro por conta por dia.

## Próximo passo exato

1. PR; CI.
2. Gate do Stefan para o PR.
3. Com o sim dele: cópia do banco, deploy da API, conferência, deploy do app, conferência de fora.

## Ação do Stefan

- Testar "Entrar com Google" pelo menu do site, que já está no ar.
- Guardar `VOTER_NETWORK_SECRET` no cofre de senhas antes de publicar este estágio.
- Decidir o merge e a publicação, sabendo que a revisão jurídica do CPF com preferência política e a página de privacidade estão em aberto.
- Dizer se quer a conferência do CPF na Receita (serviço pago).

## Human gate

- Decisão das partes 71a a 71d: `pendente`
- Responsável: Stefan
- Observação: a construção teve instrução direta dele em 16/11/2026, transcrita na decisão 0004. O merge e cada publicação pedem o sim dele. A regra 6 do `AGENTS.md` não muda.
