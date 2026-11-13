// Primeiro import de cada página: o relato de erros fica ativo antes de os
// demais módulos rodarem.
import { CLIENT_ERROR_PATH, entryScriptBuild, installErrorReporter, releaseBuild } from "./error-reporter.js";

// Mesma base de api.js, sem levar o cliente da API para as páginas de quiz.
const API_BASE = String(import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");

if (typeof window !== "undefined") {
  // Sem o SHA do release na meta, vale o nome com hash do script de entrada.
  const build = releaseBuild(window.document, entryScriptBuild(window.document));
  installErrorReporter({ target: window, endpoint: `${API_BASE}${CLIENT_ERROR_PATH}`, build });
}
