import {
  AGE_RANGES,
  CONSENT_TEXT,
  CONSENT_VERSION,
  GENDERS,
  STATES,
  validateRegistration,
} from "../../shared/registration.js";

// Telas do cadastro com CPF (ICM 71, #336): a entrada com Google e o
// formulário. Só marcação e texto; quem fala com o servidor é a página da
// pesquisa. O CPF digitado vive na memória da página até o envio e nunca é
// escrito no aparelho.

const escapeText = (value = "") => String(value).replace(
  /[&<>"']/g,
  (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character],
);

export const EMPTY_REGISTRATION_FORM = Object.freeze({ cpf: "", ageRange: "", gender: "", state: "", consent: false });

const BACK_LINK = '<div class="ps-stack"><a class="ps-btn ps-btn--ghost" href="./">Voltar</a></div>';

/** A entrada: o lugar do botão do Google e a volta para a capa. */
export function signInMarkup({ googleReady = false, busy = false } = {}) {
  if (!googleReady) {
    return `<p class="ps-notice" role="alert">A entrada com Google não está disponível agora. Tente de novo mais tarde.</p>${BACK_LINK}`;
  }
  return `<div class="ps-gate"><div class="pm-google${busy ? " is-busy" : ""}" id="ps-google"><span>${busy ? "Confirmando…" : "Carregando Google…"}</span></div>
    <p class="ps-muted ps-cta-note">O cadastro é feito uma vez só. Depois, é só entrar.</p></div>${BACK_LINK}`;
}

const chips = (field, list, selected) => list
  .map((item) => `<button class="ps-chip" type="button" data-field="${field}" data-value="${escapeText(item.id)}" aria-pressed="${item.id === selected}">${escapeText(item.label)}</button>`)
  .join("");

/**
 * O formulário, com o que a pessoa já preencheu. `invalid` é o campo da
 * última recusa: ele aponta para o aviso da tela (`#ps-notice`), para o
 * leitor de tela dizer o motivo junto com o campo.
 */
export function registrationFormMarkup({ form = EMPTY_REGISTRATION_FORM, busy = false, invalid = "" } = {}) {
  const states = STATES.map((uf) => `<option value="${uf}"${uf === form.state ? " selected" : ""}>${uf}</option>`).join("");
  const described = (field) => (invalid === field ? ' aria-describedby="ps-notice"' : "");
  const wrong = (field) => (invalid === field ? ' aria-invalid="true" aria-describedby="ps-notice"' : "");
  return `<form class="ps-form" id="ps-register" novalidate autocomplete="off">
    <div class="ps-field"><label class="ps-flabel" for="ps-cpf">CPF</label><input class="ps-input" id="ps-cpf" name="cpf" type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00" aria-required="true"${wrong("cpf")} value="${escapeText(form.cpf)}"></div>
    <div class="ps-field"><p class="ps-flabel" id="ps-age-label">Idade</p><div class="ps-chips" role="group" aria-labelledby="ps-age-label"${described("ageRange")}>${chips("ageRange", AGE_RANGES, form.ageRange)}</div></div>
    <div class="ps-field"><p class="ps-flabel" id="ps-gender-label">Gênero</p><div class="ps-chips" role="group" aria-labelledby="ps-gender-label"${described("gender")}>${chips("gender", GENDERS, form.gender)}</div></div>
    <div class="ps-field"><label class="ps-flabel" for="ps-state">Estado</label><select class="ps-input" id="ps-state" name="state" aria-required="true"${wrong("state")}><option value="">Escolha</option>${states}</select></div>
    <label class="ps-consent"><input type="checkbox" id="ps-consent" name="consent" aria-required="true"${wrong("consent")}${form.consent ? " checked" : ""}><span>${escapeText(CONSENT_TEXT)}</span></label>
    <p class="ps-muted ps-form-note">Não guardamos o número do CPF, só um código gerado a partir dele, para reconhecer um CPF repetido. Do PoliMatch só sai o resultado somado, nunca a escolha de uma pessoa.</p>
    <div class="ps-stack"><button class="ps-btn" type="submit"${busy ? " disabled" : ""}>${busy ? "Concluindo…" : "Concluir"}</button><a class="ps-btn ps-btn--ghost" href="./">Voltar</a></div>
  </form>`;
}

const FIELD_PROBLEMS = Object.freeze({
  cpf: "Confira o CPF: os números não fecham.",
  ageRange: "Escolha a sua faixa de idade.",
  gender: "Escolha o gênero.",
  state: "Escolha o estado.",
  consent: "Marque a autorização para concluir.",
  consentVersion: "Atualize a página para concluir o cadastro.",
});

/**
 * Onde o cursor fica depois de a máscara reescrever o campo: logo depois do
 * mesmo número de dígitos que havia antes dele. Sem isso, corrigir um dígito
 * no meio do CPF jogaria o cursor para o fim.
 */
export function caretAfterDigits(masked, digits) {
  let position = 0;
  let seen = 0;
  while (position < masked.length && seen < digits) {
    if (/\d/.test(masked[position])) seen += 1;
    position += 1;
  }
  return position;
}

/** O pedido de cadastro: só os campos do contrato, com a versão do texto aceito. */
export function registrationBody(form) {
  const { cpf, ageRange, gender, state, consent } = form;
  return { cpf, ageRange, gender, state, consent, consentVersion: CONSENT_VERSION };
}

/** O primeiro campo que falta no formulário, com o texto dele; `null` quando está tudo certo. */
export function registrationProblem(form) {
  const checked = validateRegistration(registrationBody(form));
  return checked.ok ? null : { field: checked.field, text: FIELD_PROBLEMS[checked.field] };
}

const SERVER_REFUSALS = Object.freeze({
  CPF_INVALID: FIELD_PROBLEMS.cpf,
  REGISTRATION_INVALID: "Confira idade, gênero e estado.",
  CONSENT_REQUIRED: FIELD_PROBLEMS.consent,
  CONSENT_VERSION_MISMATCH: FIELD_PROBLEMS.consentVersion,
  CPF_ALREADY_REGISTERED: "Este CPF já tem cadastro em outra conta Google. Entre com a conta usada no cadastro.",
  REGISTRATION_ATTEMPT_LIMIT: "Muitas tentativas de cadastro hoje. Tente de novo amanhã.",
});

const CPF_REFUSALS = Object.freeze(["CPF_INVALID", "CPF_ALREADY_REGISTERED"]);

/**
 * O que fazer com uma recusa do cadastro. `next` diz para onde a pessoa vai:
 * `form` (fica no formulário, com o texto), `signin` (volta para a entrada)
 * ou `start` (a conta já tem cadastro: a pesquisa abre). `field` é o campo
 * que deve receber o foco, quando a recusa é sobre ele. O texto é sempre
 * daqui, nunca o que o servidor mandou.
 */
export function registrationRefusal(error) {
  const status = Number(error?.status) || 0;
  const code = String(error?.code || "");
  const refusal = (next, text, field = "") => ({ next, text, field });
  if (code === "REGISTRATION_EXISTS") return refusal("start", "");
  if (status === 401) return refusal("signin", "Sua sessão venceu. Entre de novo para concluir o cadastro.");
  if (code === "GOOGLE_ACCOUNT_REQUIRED") return refusal("signin", "Entre com Google para fazer o cadastro.");
  // As recusas sobre o CPF levam o foco de volta ao campo dele.
  if (Object.hasOwn(SERVER_REFUSALS, code)) return refusal("form", SERVER_REFUSALS[code], CPF_REFUSALS.includes(code) ? "cpf" : "");
  if (status === 429) return refusal("form", "Muitas tentativas agora. Espere um pouco e tente de novo.");
  if (status === 0) return refusal("form", "Não conseguimos falar com o servidor. Confira a conexão e tente de novo.");
  return refusal("form", "Não foi possível concluir o cadastro agora. Tente de novo.");
}
