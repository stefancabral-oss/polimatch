// Primeiro import de cada página: o relato de erros fica ativo antes de os
// demais módulos rodarem.
import { CLIENT_ERROR_PATH, installErrorReporter, releaseBuild } from "./error-reporter.js";

// Mesma base de api.js, sem levar o cliente da API para as páginas de quiz.
const API_BASE = String(import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
// Sem a meta do release, vale a versão de assets do build.
const ASSET_VERSION = typeof __POLIMATCH_ASSET_VERSION__ === "undefined" ? "unknown" : __POLIMATCH_ASSET_VERSION__;

if (typeof window !== "undefined") {
  const build = releaseBuild(window.document, ASSET_VERSION);
  installErrorReporter({ target: window, endpoint: `${API_BASE}${CLIENT_ERROR_PATH}`, build });
}
