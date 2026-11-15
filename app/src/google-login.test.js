import assert from "node:assert/strict";
import test from "node:test";
import { googleClientId, loadGoogleIdentity, mountGoogleButton } from "./google-login.js";

test("Google login is optional when the public client id is absent", async () => {
  assert.equal(googleClientId({}), "");
  assert.equal(await mountGoogleButton({}, { clientId: "" }), false);
});

test("the official GIS renderer receives a light, compact Portuguese button", async () => {
  const calls = [];
  const element = { replaceChildren() {}, getBoundingClientRect: () => ({ width: 300 }) };
  const windowRef = { google: { accounts: { id: {
    initialize: (options) => calls.push(["initialize", options]),
    renderButton: (_element, options) => calls.push(["render", options]),
  } } } };
  const callback = () => {};
  assert.equal(await mountGoogleButton(element, { clientId: "client-id", callback, windowRef, documentRef: {} }), true);
  assert.equal(calls[0][1].client_id, "client-id");
  assert.equal(calls[0][1].callback, callback);
  assert.deepEqual(calls[1][1], { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", locale: "pt_BR", width: 300 });
});

test("a failed script load is discarded, so a retry requests the script again", async () => {
  const appended = [];
  const documentRef = {
    getElementById: (id) => appended.find((script) => script.id === id && !script.removed) || null,
    createElement: () => {
      const script = { listeners: {}, removed: false };
      script.addEventListener = (type, listener) => { script.listeners[type] = listener; };
      script.remove = () => { script.removed = true; };
      return script;
    },
    head: { append: (script) => appended.push(script) },
  };
  const windowRef = {};
  const first = loadGoogleIdentity(windowRef, documentRef);
  appended[0].listeners.error();
  await assert.rejects(first, /Não foi possível carregar o acesso com Google/);
  assert.equal(appended[0].removed, true, "the failed script element is removed");

  const second = loadGoogleIdentity(windowRef, documentRef);
  assert.equal(appended.length, 2, "the retry appends a fresh script instead of waiting on the dead one");
  windowRef.google = { accounts: { id: {} } };
  appended[1].listeners.load();
  assert.equal(await second, windowRef.google);
});
