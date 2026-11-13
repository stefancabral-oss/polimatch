import assert from "node:assert/strict";
import test from "node:test";
import { createSafeStorage } from "./safe-storage.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test("usa o armazenamento real quando ele funciona", () => {
  const backing = memoryStorage();
  backing.setItem("chave", "anterior");
  const storage = createSafeStorage(() => backing);
  assert.equal(storage.get("chave"), "anterior");
  assert.equal(storage.set("chave", "nova"), true);
  assert.equal(backing.values.get("chave"), "nova");
  assert.equal(storage.remove("chave"), true);
  assert.equal(storage.get("chave"), null);
  assert.equal(backing.values.has("chave"), false);
  assert.equal(storage.persistent, true);
});

test("getter bloqueado vira sessão em memória sem lançar", () => {
  const storage = createSafeStorage(() => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  });
  assert.equal(storage.get("polimatch:v3:recovery-key"), null);
  assert.equal(storage.persistent, false);
  assert.equal(storage.set("polimatch:v3:recovery-key", "pm2_sessao"), false);
  assert.equal(storage.get("polimatch:v3:recovery-key"), "pm2_sessao");
  assert.equal(storage.remove("polimatch:v3:recovery-key"), false);
  assert.equal(storage.get("polimatch:v3:recovery-key"), null);
});

test("escrita recusada preserva o valor desta aba e avisa que não persiste", () => {
  const backing = memoryStorage();
  backing.setItem = () => {
    throw new DOMException("cota cheia", "QuotaExceededError");
  };
  const storage = createSafeStorage(() => backing);
  assert.equal(storage.set("polimatch:v4:round-coach", "seen"), false);
  assert.equal(storage.persistent, false);
  assert.equal(storage.get("polimatch:v4:round-coach"), "seen");
});

test("leitura que lança devolve vazio", () => {
  const storage = createSafeStorage(() => ({
    getItem() { throw new Error("bloqueado"); },
    setItem() {},
    removeItem() {},
  }));
  assert.equal(storage.get("qualquer"), null);
  assert.equal(storage.persistent, false);
});

test("armazenamento ausente também é tratado como sessão", () => {
  const storage = createSafeStorage(() => undefined);
  storage.set("chave", 42);
  assert.equal(storage.get("chave"), "42");
  assert.equal(storage.persistent, false);
});
