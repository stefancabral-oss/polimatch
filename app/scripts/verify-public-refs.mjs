// Confere, depois do `vite build`, que toda referência local de dist/*.html e
// dos manifestos aponta para um arquivo existente em dist/. Sem isso, um ícone
// ou asset ausente só aparece em produção, servido como outra coisa.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "http://dist.invalid";
const ATTRIBUTE = /\s(href|src|srcset|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const LINK_TAG = /<link\b[^>]*>/gi;

function attributeValues(html) {
  const values = [];
  for (const match of html.matchAll(ATTRIBUTE)) {
    const value = (match[2] ?? match[3] ?? match[4] ?? "").trim();
    if (match[1].toLowerCase() === "srcset") {
      for (const candidate of value.split(",")) {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) values.push(url);
      }
    } else if (value) {
      values.push(value);
    }
  }
  return values;
}

function manifestLinks(html) {
  return [...html.matchAll(LINK_TAG)]
    .map(([tag]) => tag)
    .filter((tag) => /\srel\s*=\s*["']?manifest["'\s>]/i.test(tag))
    .flatMap((tag) => attributeValues(tag));
}

function manifestValues(manifest) {
  const values = [];
  if (typeof manifest.start_url === "string") values.push(manifest.start_url);
  for (const icon of manifest.icons ?? []) values.push(icon.src);
  for (const screenshot of manifest.screenshots ?? []) values.push(screenshot.src);
  for (const shortcut of manifest.shortcuts ?? []) {
    values.push(shortcut.url);
    for (const icon of shortcut.icons ?? []) values.push(icon.src);
  }
  return values.filter((value) => typeof value === "string" && value.trim());
}

// Resolve como o navegador resolveria a partir do documento servido na raiz.
// Retorna null para o que não é local (outra origem, data:, mailto:, âncora).
function resolveLocal(distDir, sourcePath, ref) {
  if (ref.startsWith("#")) return null;
  const base = new URL(`${ORIGIN}${sourcePath}`);
  let url;
  try {
    url = new URL(ref, base);
  } catch {
    return { urlPath: ref, file: null };
  }
  if (url.origin !== base.origin) return null;
  const pathname = safeDecode(url.pathname);
  const relative = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  return { urlPath: url.pathname, file: path.join(distDir, ...relative.split("/").filter(Boolean)) };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isFile(file) {
  return Boolean(file) && existsSync(file) && statSync(file).isFile();
}

export function collectLocalReferences(distDir) {
  const root = path.resolve(distDir);
  const references = [];
  const manifests = new Set();
  const htmlFiles = readdirSync(root).filter((name) => name.toLowerCase().endsWith(".html")).sort();

  for (const name of htmlFiles) {
    const html = readFileSync(path.join(root, name), "utf8");
    const sourcePath = `/${name}`;
    for (const ref of attributeValues(html)) {
      const resolved = resolveLocal(root, sourcePath, ref);
      if (resolved) references.push({ source: name, ref, ...resolved });
    }
    for (const ref of manifestLinks(html)) {
      const resolved = resolveLocal(root, sourcePath, ref);
      if (resolved && isFile(resolved.file)) manifests.add(resolved.urlPath);
    }
  }
  if (isFile(path.join(root, "manifest.webmanifest"))) manifests.add("/manifest.webmanifest");

  for (const manifestPath of [...manifests].sort()) {
    const file = path.join(root, ...safeDecode(manifestPath).split("/").filter(Boolean));
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      references.push({ source: manifestPath.slice(1), ref: manifestPath, urlPath: manifestPath, file: null, error: `manifesto inválido: ${error.message}` });
      continue;
    }
    for (const ref of manifestValues(manifest)) {
      const resolved = resolveLocal(root, manifestPath, ref);
      if (resolved) references.push({ source: manifestPath.slice(1), ref, ...resolved });
    }
  }
  return { htmlFiles, manifests: [...manifests].sort(), references };
}

export function findMissingReferences(distDir) {
  const { references } = collectLocalReferences(distDir);
  return references.filter((reference) => reference.error || !isFile(reference.file));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const distDir = path.resolve(process.argv[2] ?? fileURLToPath(new URL("../dist/", import.meta.url)));
  const { htmlFiles, manifests, references } = collectLocalReferences(distDir);
  const missing = findMissingReferences(distDir);
  if (!htmlFiles.length) {
    console.error(`Nenhum HTML encontrado em ${distDir}. Rode o vite build antes.`);
    process.exit(1);
  }
  if (missing.length) {
    console.error("Referências locais apontam para arquivos que não existem no dist:");
    for (const { source, ref, error } of missing) console.error(`- ${source}: ${ref}${error ? ` (${error})` : ""}`);
    process.exit(1);
  }
  console.log(`verified ${references.length} local references in ${htmlFiles.length} HTML files and ${manifests.length} manifest(s): none missing`);
}
