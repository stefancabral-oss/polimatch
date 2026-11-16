// Regras do cadastro com CPF (ICM 71, #336). Funções puras, usadas pelo
// servidor e pela tela. Nada aqui lê relógio, banco ou rede, e nenhuma recusa
// devolve o que foi digitado.

const option = (id, label) => Object.freeze({ id, label });

// As opções são as do protótipo aprovado em 12/11/2026. O servidor guarda o `id`.
export const AGE_RANGES = Object.freeze([
  option("16-24", "16 a 24"),
  option("25-34", "25 a 34"),
  option("35-44", "35 a 44"),
  option("45-59", "45 a 59"),
  option("60+", "60 ou mais"),
]);

export const GENDERS = Object.freeze([
  option("mulher", "Mulher"),
  option("homem", "Homem"),
  option("outro", "Outro"),
  option("nao-informado", "Prefiro não dizer"),
]);

export const STATES = Object.freeze("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

// O texto que a pessoa aceita. Mudar o texto pede versão nova: o servidor
// guarda a versão aceita e recusa a de um app desatualizado.
export const CONSENT_VERSION = "2026-11-16";
export const CONSENT_TEXT = "Autorizo o PoliMatch a usar meu CPF para garantir um voto por pessoa e a guardar minhas escolhas, minha faixa de idade, meu gênero e meu estado para o resultado somado das pesquisas.";

/** Os dígitos de um CPF escrito com ou sem pontuação. Qualquer outro caractere invalida. */
export function cpfDigits(value) {
  if (typeof value !== "string" || !/^[\d.\-\s]*$/.test(value)) return "";
  return value.replace(/\D/g, "");
}

function checkDigit(digits, length) {
  let sum = 0;
  for (let index = 0; index < length; index += 1) sum += Number(digits[index]) * (length + 1 - index);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/**
 * Confere os dois dígitos verificadores. Barra erro de digitação e número
 * inventado ao acaso; não prova que o CPF existe nem que é de quem digitou.
 */
export function isValidCpf(value) {
  const digits = cpfDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  return checkDigit(digits, 9) === Number(digits[9]) && checkDigit(digits, 10) === Number(digits[10]);
}

/** A máscara 000.000.000-00, para o que já foi digitado. */
export function formatCpf(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter(Boolean).join(".")
    + (digits.length > 9 ? `-${digits.slice(9)}` : "");
}

const refused = (code, field) => ({ ok: false, code, field });
const listed = (list, value) => typeof value === "string" && list.some((item) => item.id === value);

/**
 * Confere um pedido de cadastro, um campo por vez, na ordem da tela. Devolve
 * o CPF só em dígitos, ou o código da recusa com o nome do campo.
 */
export function validateRegistration(input) {
  const { cpf, ageRange, gender, state, consent, consentVersion } = input && typeof input === "object" ? input : {};
  if (!isValidCpf(cpf)) return refused("CPF_INVALID", "cpf");
  if (!listed(AGE_RANGES, ageRange)) return refused("REGISTRATION_INVALID", "ageRange");
  if (!listed(GENDERS, gender)) return refused("REGISTRATION_INVALID", "gender");
  if (typeof state !== "string" || !STATES.includes(state)) return refused("REGISTRATION_INVALID", "state");
  if (consent !== true) return refused("CONSENT_REQUIRED", "consent");
  if (consentVersion !== CONSENT_VERSION) return refused("CONSENT_VERSION_MISMATCH", "consentVersion");
  return { ok: true, value: { cpf: cpfDigits(cpf), ageRange, gender, state, consentVersion } };
}
