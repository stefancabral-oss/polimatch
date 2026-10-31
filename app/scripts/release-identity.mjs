import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Identidade do release no app: o SHA vem de SOURCE_COMMIT (build-arg do
// Dockerfile) ou de GITHUB_SHA (CI). Sem SHA, o build segue com "unknown" e um
// aviso, para não quebrar o deploy atual; POLIMATCH_REQUIRE_RELEASE=1 (no CI)
// transforma a ausência em erro. Um valor presente e malformado sempre falha,
// como no back/Dockerfile.
export const UNKNOWN_RELEASE = "unknown";
export const RELEASE_META_NAME = "polimatch-release";
// Somente as pastas cujas imagens passam por app/src/photos.js. As demais
// Chromas já trazem o hash no nome do arquivo.
export const HASHED_IMAGE_ROOTS = Object.freeze(["portraits", "chromas/approved"]);
export const ASSET_HASH_LENGTH = 8;

const RELEASE_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const IMAGE_PATTERN = /\.(?:avif|jpe?g|png|webp)$/i;

export function resolveRelease(env = process.env) {
  const required = env.POLIMATCH_REQUIRE_RELEASE === "1";
  const source = ["SOURCE_COMMIT", "GITHUB_SHA"].find((name) => String(env[name] ?? "") !== "");
  if (!source) {
    if (required) {
      throw new Error("POLIMATCH_REQUIRE_RELEASE=1 exige SOURCE_COMMIT ou GITHUB_SHA com o SHA completo do commit");
    }
    return Object.freeze({
      sha: UNKNOWN_RELEASE,
      source: null,
      warning: `SOURCE_COMMIT ausente: dist/version.json sai com sha "${UNKNOWN_RELEASE}". Passe --build-arg SOURCE_COMMIT=<SHA completo>.`,
    });
  }
  const sha = String(env[source]);
  if (!RELEASE_PATTERN.test(sha)) {
    throw new Error(`${source} precisa ser o SHA completo do commit (40 ou 64 caracteres hexadecimais minúsculos)`);
  }
  return Object.freeze({ sha, source, warning: "" });
}

export function buildTimestamp(env = process.env, now = () => new Date()) {
  const epoch = String(env.SOURCE_DATE_EPOCH ?? "");
  if (epoch === "") return now().toISOString();
  if (!/^\d+$/.test(epoch)) throw new Error("SOURCE_DATE_EPOCH precisa ser um inteiro de segundos");
  return new Date(Number(epoch) * 1000).toISOString();
}

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(file) : [file];
  });
}

// Mapa "/caminho/publico" -> prefixo do sha256 dos bytes. Depende só do
// conteúdo: dois builds do mesmo commit geram as mesmas URLs de retrato.
export function publicAssetHashes(publicDir, roots = HASHED_IMAGE_ROOTS) {
  const entries = [];
  for (const root of roots) {
    const directory = path.join(publicDir, root);
    if (!existsSync(directory)) continue;
    for (const file of filesBelow(directory)) {
      if (!IMAGE_PATTERN.test(file)) continue;
      const publicPath = `/${path.relative(publicDir, file).split(path.sep).join("/")}`;
      const digest = createHash("sha256").update(readFileSync(file)).digest("hex");
      entries.push([publicPath, digest.slice(0, ASSET_HASH_LENGTH)]);
    }
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}

export function versionDocument(release, builtAt) {
  return `${JSON.stringify({ sha: release.sha, builtAt }, null, 2)}\n`;
}

export function releaseIdentity({ env = process.env, now = () => new Date() } = {}) {
  let release;
  let builtAt;
  return {
    name: "polimatch-release-identity",
    config(config) {
      release = resolveRelease(env);
      builtAt = buildTimestamp(env, now);
      const root = path.resolve(config.root ?? process.cwd());
      const publicDir = config.publicDir === false ? null : path.resolve(root, config.publicDir ?? "public");
      // O SHA não entra no JS: só no HTML (meta) e em version.json. Assim os
      // chunks com hash não mudam em commits que não tocam o app.
      return { define: { __POLIMATCH_ASSET_HASHES__: JSON.stringify(publicDir ? publicAssetHashes(publicDir) : {}) } };
    },
    configResolved(resolved) {
      if (resolved.command === "build" && release.warning) resolved.logger.warn(release.warning);
    },
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: RELEASE_META_NAME, content: release.sha }, injectTo: "head" }];
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: versionDocument(release, builtAt) });
    },
  };
}
