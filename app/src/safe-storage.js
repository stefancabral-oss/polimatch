/**
 * Acesso ao localStorage que nunca lança.
 *
 * Com dados de site bloqueados, só tocar em `localStorage` já lança
 * SecurityError. Sem esta camada, o erro subia até a inicialização e a capa
 * dizia "Não conseguimos falar com o servidor", culpando a rede. Aqui a falha
 * vira armazenamento de sessão: o valor fica em memória enquanto a aba estiver
 * aberta e `persistent` passa a `false`, para a interface avisar que o
 * progresso não fica salvo neste aparelho.
 */
export function createSafeStorage(resolveStorage = () => globalThis.localStorage) {
  const memory = new Map();
  let persistent = true;

  function backend() {
    try {
      const storage = resolveStorage();
      if (storage) return storage;
    } catch {
      // O próprio getter de `localStorage` lança quando o navegador bloqueia.
    }
    persistent = false;
    return null;
  }

  return {
    get persistent() {
      return persistent;
    },
    get(key) {
      // O que esta aba gravou vale mais que o armazenamento: se a escrita
      // falhou, o valor só existe aqui.
      if (memory.has(key)) return memory.get(key);
      const storage = backend();
      if (!storage) return null;
      try {
        return storage.getItem(key);
      } catch {
        persistent = false;
        return null;
      }
    },
    set(key, value) {
      const text = String(value);
      memory.set(key, text);
      const storage = backend();
      if (!storage) return false;
      try {
        storage.setItem(key, text);
        return true;
      } catch {
        persistent = false;
        return false;
      }
    },
    remove(key) {
      memory.delete(key);
      const storage = backend();
      if (!storage) return false;
      try {
        storage.removeItem(key);
        return true;
      } catch {
        persistent = false;
        return false;
      }
    },
  };
}

export const safeStorage = createSafeStorage();
