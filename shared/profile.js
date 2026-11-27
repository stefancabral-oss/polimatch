// Perfil público da pessoa (ICM 76, #354, decisão 0008). Regras puras,
// usadas pelo servidor e pela tela.

// O aceite próprio do perfil, separado do cadastro. Mudar o texto pede versão
// nova: quem ligou com a versão antiga continua com o aceite que deu.
export const PROFILE_CONSENT_VERSION = "2026-11-26";
export const PROFILE_CONSENT_TEXT = "Quero mostrar no meu perfil público, para quem tiver o link, a carta em primeiro lugar nas minhas escolhas das pesquisas que eu marcar, inclusive de política. Posso desmarcar pesquisas ou desligar o perfil quando quiser.";

export const RESERVED_HANDLES = Object.freeze(["admin", "polimatch", "perfil", "suporte", "ajuda", "api", "www"]);
const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

/** O nome de perfil como é guardado e comparado: sem espaços nas pontas, em minúsculas. */
export function normalizeHandle(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** 3 a 20 letras sem acento, números ou sublinhado, fora da lista de reservados. */
export function isValidHandle(value) {
  const handle = normalizeHandle(value);
  return HANDLE_PATTERN.test(handle) && !RESERVED_HANDLES.includes(handle);
}
