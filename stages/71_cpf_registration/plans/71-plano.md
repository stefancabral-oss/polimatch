# 71 — Plano

Decisões de implementação das partes 71b a 71d. Cada tarefa começa pelo teste,
que precisa falhar pelo motivo esperado antes do código. Onde isso não
aconteceu, o HANDOFF diz.

## 71b — Regras (`shared/registration.js`)

- `cpfDigits(value)`: os dígitos de um CPF escrito com ou sem pontuação;
  qualquer outro caractere invalida. `isValidCpf(value)`: onze dígitos, não
  todos iguais, os dois verificadores certos. `formatCpf(value)`: a máscara.
- `AGE_RANGES`, `GENDERS` (com `id` e `label`) e `STATES`: as opções do
  protótipo de 12/11/2026. O servidor guarda o `id`.
- `CONSENT_VERSION` e `CONSENT_TEXT`.
- `validateRegistration(input)`: um campo por vez, na ordem da tela; devolve
  o CPF em dígitos ou `{ code, field }`, nunca o valor digitado.

## 71c — Servidor

- `back/src/registration-store.js`:
  - `cpfPseudonym(digits, secret)`: `HMAC(HMAC(secret, rótulo), dígitos)`.
  - `installRegistrationSchema`: `cpf_registrations` (chave `provider +
    subject`, `cpf_hmac` único, perfil, consentimento) e
    `cpf_registration_attempts` (`provider + subject + day`). Só cria tabelas.
  - `hasCpfRegistration` / `requireCpfRegistration(client, playerId)`: a
    conta do jogador tem cadastro; senão 403 `CPF_REGISTRATION_REQUIRED`.
  - `registrationStore({ pool, findPlayer, clock }).registerCpf(...)`: numa
    transação, com a trava do jogador. Conta a tentativa, grava com
    `ON CONFLICT (cpf_hmac) DO NOTHING`, e a recusa por CPF repetido sai
    depois do `COMMIT`, para a tentativa ficar contada.
- `photo-survey-store.js`: `transaction()` chama a exigência logo depois de
  achar o jogador, antes de qualquer leitura ou gravação. A exigência é uma
  opção (`requireRegistration`), que o servidor não troca.
- `topic-store.js`: instala o esquema, junta o `registrationStore` e repassa
  `requirePhotoSurveyRegistration` (usada só pelos smokes).
- `http-app.js`: `POST /api/registration`. Confere a sessão, valida com
  `shared/`, calcula o código com `VOTER_NETWORK_SECRET` e entrega ao store
  só o código. Atrás do mesmo `PHOTO_SURVEYS_ENABLED`.
- Smokes: `photo-survey-smoke.mjs` continua provando o sorteio e a resposta
  com jogadores sem conta, com a exigência desligada por opção;
  `cpf-registration-smoke.mjs` é novo e roda com a exigência ligada.

## 71d — App

- `account-session.js`: a leitura da chave do aparelho e a troca da
  credencial do Google pela sessão saem do menu para um módulo que o menu e a
  entrada do cadastro usam.
- `registration-view.js`: marcação da entrada e do formulário, o que falta no
  formulário (`registrationProblem`), o corpo do pedido (`registrationBody`)
  e o destino de cada recusa do servidor (`registrationRefusal`).
- `photo-survey-page.js`:
  - `start()`: sem conta Google, com toque, lê a pesquisa (para não pedir
    conta numa pesquisa que fechou) e abre a entrada; sem toque, mostra a
    entrada da pesquisa. Com conta, pede o sorteio; 403
    `CPF_REGISTRATION_REQUIRED` abre o formulário (com toque) ou a entrada da
    pesquisa (sem toque).
  - Tela nova `gate`, em dois passos: `signin` e `form`. Entrar chama
    `start()`; concluir o cadastro chama `start()`.
  - Sai a criação de jogador sem conta e o aviso de cota de rede
    (`identity-notice.js` deixa de existir).
  - A conta mudar com o cadastro na tela (menu ou outra aba) reavalia o
    passo.
- Textos: a capa diz o que é preciso para responder; o menu e "Como
  funciona" também.

## Roteiros de navegador

- `photo-survey.mjs`: as identidades viram sessões de conta cadastrada; o
  cenário da cota de rede dá lugar ao caminho sem conta → entrada → cadastro
  → pesquisa; nenhum cenário pode terminar com `POST /api/player`.
- `site-shell.mjs`: a conta de teste nasce cadastrada; entram os cenários do
  cadastro (recusas do servidor, sessão vencida, entrar e sair pelo menu,
  Google e servidor fora do ar, conta que perde o cadastro) e o de quem
  respondeu sem conta.
