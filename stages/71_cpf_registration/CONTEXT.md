# ICM 71 — Cadastro obrigatório com CPF para responder — #336

Base: `main` depois do estágio 70 (#334).
Ler o contexto raiz, o `AGENTS.md`, as decisões 0001 a 0004 e os contextos dos
estágios 68, 69 e 70.

## Objetivo

Para responder uma pesquisa a pessoa precisa entrar com Google e ter o
cadastro com CPF. Sem o cadastro não há sorteio nem resposta.

## Entradas

- Issue #336. Instrução do Stefan em 16/11/2026: "cria o login obrigatório
  para cpf para poder entrar e jogar. sem esse cadastro a pessoa não pode
  entrar e dar voto."
- Decisão 0004, que registra a mudança e as escolhas do agente.
- A tela de cadastro do protótipo aprovado em 12/11/2026
  (`stages/67_photo_survey_direction/references/prototipo-pesquisa.html`).
- O que existe: regras em `shared/photo-survey.js`, servidor em
  `back/src/photo-survey-store.js`, página em `app/src/photo-survey-page.js`,
  menu com a entrada Google em `app/src/site-menu.js`.

## O que existe hoje e o que muda

| Tema | Hoje | Depois deste estágio |
|---|---|---|
| Quem responde | Qualquer visitante: "Começar" cria um jogador sem conta | Só quem entrou com Google e tem cadastro com CPF |
| Entrada com Google | Opcional, pelo menu | Obrigatória para responder; continua no menu e aparece no caminho do "Começar" |
| Cadastro | Não existe | CPF, faixa de idade, gênero, estado e consentimento, uma vez por conta |
| Servidor | Sorteio e resposta aceitam qualquer jogador | Sorteio e resposta recusam quem não tem cadastro |
| Jogador sem conta | Criado pela página (`POST /api/player`) | A página não cria mais |

## O formato deste estágio

1. **Capa aberta.** A capa, a pergunta e as cartas da entrada continuam à
   vista de qualquer visitante, sem gravar nada. Abaixo do botão, a capa diz
   que para responder é preciso entrar e cadastrar o CPF.
2. **"Começar" decide o caminho.** Sem conta Google no aparelho: tela de
   entrada, com o botão do Google. Com conta e sem cadastro: o formulário.
   Com cadastro: a pesquisa abre, como hoje.
3. **Formulário.** Título e frase do protótipo ("Faça seu voto contar"; "Um
   CPF, um voto. Só o resultado somado aparece, nunca o seu nome."). CPF com
   máscara, idade e gênero em botões, estado numa lista, a caixa de
   consentimento e "Concluir". O CPF é conferido pelos dígitos no aparelho
   antes de ir ao servidor, que confere de novo.
4. **Depois de concluir,** a pesquisa abre direto.
5. **Quem já respondeu sem conta** entra com Google (o servidor liga a
   resposta antiga à conta, como já fazia), faz o cadastro e vê a resposta
   que deu. Não responde de novo.

## Regras

- **O servidor é quem barra.** Sorteio e resposta sem cadastro: HTTP 403,
  `CPF_REGISTRATION_REQUIRED`, e nada é gravado. Vale também para ler a
  resposta já dada.
- **Cadastro só com sessão Google.** Chave de jogador sem conta: HTTP 403,
  `GOOGLE_ACCOUNT_REQUIRED`.
- **Um CPF por conta e uma conta por CPF.** CPF já cadastrado em outra conta:
  HTTP 409, `CPF_ALREADY_REGISTERED`. A mesma conta repetindo o mesmo CPF
  recebe a resposta do cadastro feito. A mesma conta com outro CPF: HTTP 409,
  `REGISTRATION_EXISTS`.
- **O número do CPF não é guardado.** O servidor guarda
  `HMAC-SHA-256(CPF, chave)`, com a chave derivada de `VOTER_NETWORK_SECRET`
  com um rótulo próprio. O número não entra em log nem em resposta, e o app
  não o guarda no aparelho. Trocar `VOTER_NETWORK_SECRET` passa a exigir
  migração dos cadastros.
- **Conferência pelos dígitos.** Onze dígitos, os dois verificadores certos,
  e não todos iguais. HTTP 400, `CPF_INVALID`.
- **Consentimento obrigatório,** com a versão do texto guardada. Sem ele:
  HTTP 400, `CONSENT_REQUIRED`.
- **Limite de tentativas.** Cinco pedidos de cadastro por conta por dia
  editorial de São Paulo. Acima disso: HTTP 429,
  `REGISTRATION_ATTEMPT_LIMIT`.
- **O cadastro é da conta,** não do jogador ativo: se o jogador ativo da
  conta mudar (união de históricos), o cadastro acompanha.
- **Abrir não grava.** A capa não pergunta ao servidor se há cadastro: quem
  decide é o pedido de sorteio, no toque.
- **O formulário é de uma sessão.** O que foi preenchido fica só na memória
  da página e é apagado quando a pessoa sai da conta, quando a sessão vence
  e quando outra conta entra: o CPF de uma pessoa não aparece para a próxima
  conta que entra na mesma aba.
- **Sessão vencida não prende.** Recusada no começo, na retomada ou no
  cadastro, a sessão sai do aparelho e a pessoa é levada a entrar de novo.
  Na confirmação da resposta continua valendo a regra do estágio 68: a
  escolha fica na tela, com o aviso.
- **Ninguém se cadastra para uma pesquisa fechada.** Antes de abrir a entrada
  ou o formulário, a página confere se a pesquisa segue aberta.
- **Chave sem conta guardada no aparelho** não vale como "respondida" na
  capa: a capa convida a entrar.
- **As regras dos estágios 68 a 70 valem** para quem tem cadastro, sem
  mudança.
- **Sem resultado público** (#177).

## Entregas

Um PR, com commits por parte:

| Parte | O que traz |
|---|---|
| 71a — Registro | Decisão 0004, este contexto, contexto raiz e política de integridade do voto |
| 71b — Regras | `shared/registration.js`: CPF, opções do perfil, consentimento; testes |
| 71c — Servidor | Tabelas, rota de cadastro, exigência no sorteio e na resposta; testes e smoke com PostgreSQL |
| 71d — App | Entrada, formulário, travas na página e textos; testes e roteiros de navegador |
| 71e — Publicação | API e app, com o sim do Stefan. Feita em 16/11/2026, com um sim para os dois (ver o HANDOFF) |

## Fora de escopo

- Conferência do CPF na Receita Federal.
- Página de política de privacidade (#283) e tela de exclusão do cadastro.
- Editar o cadastro depois de feito.
- Resultado somado, top 5, recortes por perfil.
- Avisos, indicação de amigos, som.
- Mudar as rotas do jogo anterior, que continuam na API.

## Critérios de aceite

Servidor:

- S1. Sorteio e resposta com chave sem conta, ou com conta sem cadastro:
  403 `CPF_REGISTRATION_REQUIRED`; nenhum sorteio nem resposta é gravado.
- S2. Cadastro com chave sem conta: 403 `GOOGLE_ACCOUNT_REQUIRED`. Sem
  chave: 401.
- S3. CPF com dígito errado, curto, longo ou de dígitos repetidos: 400
  `CPF_INVALID`. Idade, gênero ou estado fora das listas: 400
  `REGISTRATION_INVALID`, com o campo. Sem consentimento: 400
  `CONSENT_REQUIRED`.
- S4. O mesmo CPF em duas contas: a segunda recebe 409
  `CPF_ALREADY_REGISTERED`, também em pedidos simultâneos. A mesma conta com
  o mesmo CPF: 200 com o cadastro existente. Com outro CPF: 409
  `REGISTRATION_EXISTS`.
- S5. O número do CPF não aparece em nenhuma coluna do banco, em nenhuma
  linha de log e em nenhuma resposta. O código guardado muda com o segredo e
  não é o mesmo que o pseudônimo de rede do mesmo texto.
- S6. A sexta tentativa de cadastro da conta no dia: 429
  `REGISTRATION_ATTEMPT_LIMIT`.
- S7. Com cadastro, o percurso do estágio 68 passa inteiro; a resposta dada
  sem conta antes de entrar continua sendo a resposta da pessoa.
- S8. A migração só cria tabelas novas.

App:

- A1. Abrir a capa: uma leitura por pesquisa, nenhuma gravação, nenhum
  pedido de cadastro. A capa diz o que é preciso para responder.
- A2. "Começar" sem conta mostra a entrada com Google e não chama
  `POST /api/player`. Nenhum caminho da página cria jogador sem conta.
- A3. Entrar: com cadastro, a pesquisa abre; sem cadastro, o formulário.
- A4. O formulário recusa no aparelho CPF inválido e campo vazio, sem chamar
  o servidor; mostra o texto certo para CPF já cadastrado, tentativas
  esgotadas, servidor fora do ar e sessão vencida.
- A5. Concluir abre a pesquisa sem outro toque.
- A6. O CPF não é escrito no armazenamento do aparelho nem no endereço.
- A7. Quem respondeu sem conta, entra e se cadastra, vê a resposta que deu.
- A8. Sair da conta no meio volta para a entrada, sem convite para responder
  sem conta.
- A9. Os cenários dos estágios 68 a 70 passam, com identidade cadastrada,
  ajustados onde a tela mudou de propósito.
- A10. O formulário preenchido por uma conta não aparece para a seguinte
  (saída da conta, sessão vencida, outra conta em outra aba).
- A11. Sessão vencida no toque em "Começar", na retomada e no cadastro leva
  à entrada, sem repetir o pedido recusado e sem a sessão morta no aparelho.
- A12. O erro do formulário leva o foco ao campo, com o motivo ligado a ele;
  corrigir um dígito no meio do CPF não perde o lugar.
- A13. A entrada e o formulário cabem na largura em 390×844, 360×640 e
  320×568, também com fonte larga.

## Condições de publicação

- A ordem é API e depois app. Entre um e outro, o app antigo não consegue
  começar pesquisa (o servidor recusa e ele mostra o aviso de falha).
- As do estágio 69 seguem abertas (privacidade, #283; backup, #279) e pesam
  mais aqui: ver "Pendências" da decisão 0004.
- A entrada com Google pelo menu está no ar desde 14/11/2026 e não foi
  exercitada com o botão real. Com o cadastro obrigatório ela vira o único
  caminho para responder: testar antes de publicar.

A publicação aconteceu em 16/11/2026, por instrução do Stefan, com estas
condições abertas e sem registro de teste do botão real do Google antes dela.
O que se sabe e o que não se sabe está no HANDOFF.

## Dependências e riscos

- **Dado pessoal sensível.** CPF ligado a preferência política. O desenho
  reduz o que é guardado (sem o número do CPF), mas a resposta passa a
  pertencer a uma pessoa identificável pela conta.
- **Conferência fraca.** Dígitos não provam a posse do CPF: alguém pode usar
  o CPF de outra pessoa, que depois não consegue se cadastrar.
- **Menos gente responde.** Entrar e preencher um formulário antes da
  primeira carta custa participação. É o preço da regra pedida.
- **Dependência do Google.** Com o serviço do Google fora do ar, ninguém
  novo responde.
- **Respostas de ensaio.** A pesquisa em produção tem respostas de jogadores
  sem conta. Elas ficam no banco e só voltam a aparecer para quem entrar e se
  cadastrar a partir do mesmo aparelho.
