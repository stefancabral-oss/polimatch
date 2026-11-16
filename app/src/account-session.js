import { exchangeGoogleCredential } from "./api.js";
import { safeStorage } from "./safe-storage.js";

// A conta neste aparelho: a chave guardada e a entrada com Google. Usado pelo
// menu (ICM 69) e pela entrada do cadastro (ICM 71, #336).

export const IDENTITY_KEY = "polimatch:v3:recovery-key";
const GOOGLE_CREDENTIAL_REJECTED = "INVALID_GOOGLE_CREDENTIAL";

/**
 * Lê direto do navegador: vale o que está no aparelho agora, inclusive o que
 * outra aba mudou. A cópia em memória só serve quando o navegador não deixa
 * guardar nada.
 */
export function readIdentityKey() {
  try {
    const value = window.localStorage.getItem(IDENTITY_KEY);
    if (value) return value;
    return safeStorage.persistent ? "" : safeStorage.get(IDENTITY_KEY) || "";
  } catch {
    return safeStorage.get(IDENTITY_KEY) || "";
  }
}

/**
 * A chave que já está no aparelho vai junto, para o servidor ligar à conta as
 * escolhas feitas com ela. Se o servidor não reconhece mais essa chave, a
 * entrada é refeita sem ela: senão a pessoa nunca conseguiria entrar. Uma
 * recusa da credencial do Google também chega como 401, com código próprio:
 * nela a chave continua valendo e não há nova tentativa, para as escolhas
 * dadas sem conta não ficarem para trás.
 */
async function exchange(credential) {
  const key = readIdentityKey();
  try {
    return await exchangeGoogleCredential(credential, key);
  } catch (error) {
    if (error.status === 401 && key && error.code !== GOOGLE_CREDENTIAL_REJECTED) return exchangeGoogleCredential(credential, "");
    throw error;
  }
}

/** Troca a credencial do Google pela sessão e guarda a sessão no aparelho. */
export async function signInWithGoogleCredential(credential) {
  const result = await exchange(credential);
  if (typeof result?.sessionToken !== "string" || !result.sessionToken) throw new Error("resposta sem sessão");
  safeStorage.set(IDENTITY_KEY, result.sessionToken);
  return result;
}
