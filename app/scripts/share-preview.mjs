import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Origem já usada pelos links de compartilhamento e pelo sitemap da PR de borda.
export const CANONICAL_ORIGIN = "https://polimatch.com.br";
// Apresentação volumétrica oficial. Não é ícone funcional nem retrato de pessoa.
export const SHARE_IMAGE_PATH = "/brand/logo-volumetric.png";
export const SHARE_IMAGE_URL = `${CANONICAL_ORIGIN}${SHARE_IMAGE_PATH}`;
export const SHARE_IMAGE_ALT = "PoliMatch";

const REQUIRED_ONCE = [
  "description",
  "og:type",
  "og:locale",
  "og:site_name",
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "og:image:type",
  "og:image:width",
  "og:image:height",
  "og:image:alt",
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
];

export function htmlEntries(viteConfig) {
  const input = viteConfig?.build?.rollupOptions?.input;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("rollupOptions.input precisa ser o mapa das páginas do build");
  }
  return Object.entries(input)
    .map(([name, file]) => ({ name, file: String(file).replaceAll("\\", "/") }))
    .sort((left, right) => (left.file < right.file ? -1 : left.file > right.file ? 1 : 0));
}

export function canonicalPageUrl(file) {
  const name = path.basename(file);
  return name === "index.html" ? `${CANONICAL_ORIGIN}/` : `${CANONICAL_ORIGIN}/${name}`;
}

export function mediaTypeFor(file) {
  switch (path.extname(file).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".html":
      return "text/html; charset=utf-8";
    default:
      return null;
  }
}

export function readRaster(bytes) {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes.toString("ascii", 1, 4) === "PNG" && bytes.toString("ascii", 12, 16) === "IHDR") {
    return { type: "image/png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { type: "image/jpeg", width: null, height: null };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { type: "image/webp", width: null, height: null };
  }
  return null;
}

function attributes(source) {
  const values = {};
  for (const match of source.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    values[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return values;
}

function metaMap(head) {
  const map = new Map();
  for (const match of head.matchAll(/<meta\b([^>]*?)\/?>/gi)) {
    const attrs = attributes(match[1]);
    const key = attrs.property || attrs.name;
    if (!key || attrs.content == null) continue;
    const current = map.get(key) ?? [];
    current.push(attrs.content);
    map.set(key, current);
  }
  return map;
}

function single(map, key, errors) {
  const values = map.get(key) ?? [];
  if (values.length !== 1 || values[0].trim() === "") {
    errors.push(`${key} ausente ou duplicado no head`);
    return "";
  }
  return values[0];
}

export function validateSharePreview(html, { file, assetRoot }) {
  const errors = [];
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  if (!head) {
    errors.push("head ausente");
    return errors;
  }
  const scriptAt = html.search(/<script\b/i);
  const imageAt = html.search(/<meta\b[^>]*(?:property|name)=["']og:image["']/i);
  if (imageAt === -1 || (scriptAt !== -1 && imageAt > scriptAt)) {
    errors.push("og:image não está no HTML inicial, antes de qualquer script");
  }
  const metas = metaMap(head);
  const values = Object.fromEntries(REQUIRED_ONCE.map((key) => [key, single(metas, key, errors)]));
  const title = (head.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  if (!title) errors.push("title ausente");
  if (values["og:title"] && title && values["og:title"] !== title) errors.push("og:title difere do title da página");
  if (values["og:description"] && values.description && values["og:description"] !== values.description) {
    errors.push("og:description difere da meta description da página");
  }
  if (values["twitter:title"] && values["og:title"] && values["twitter:title"] !== values["og:title"]) {
    errors.push("twitter:title difere de og:title");
  }
  if (values["twitter:description"] && values["og:description"] && values["twitter:description"] !== values["og:description"]) {
    errors.push("twitter:description difere de og:description");
  }
  const pageUrl = canonicalPageUrl(file);
  if (values["og:url"] && values["og:url"] !== pageUrl) errors.push(`og:url deve ser ${pageUrl}`);
  if (values["og:image"] && values["og:image"] !== SHARE_IMAGE_URL) errors.push(`og:image deve ser ${SHARE_IMAGE_URL}`);
  if (values["twitter:image"] && values["twitter:image"] !== SHARE_IMAGE_URL) errors.push(`twitter:image deve ser ${SHARE_IMAGE_URL}`);
  if (values["og:locale"] && values["og:locale"] !== "pt_BR") errors.push("og:locale deve ser pt_BR");
  if (values["og:type"] && values["og:type"] !== "website") errors.push("og:type deve ser website");
  if (values["og:site_name"] && values["og:site_name"] !== "PoliMatch") errors.push("og:site_name deve ser PoliMatch");
  if (values["og:image:alt"] && values["og:image:alt"] !== SHARE_IMAGE_ALT) errors.push(`og:image:alt deve ser ${SHARE_IMAGE_ALT}`);
  if (values["twitter:card"] && values["twitter:card"] !== "summary_large_image") {
    errors.push("twitter:card deve ser summary_large_image");
  }
  for (const key of ["og:url", "og:image", "twitter:image"]) {
    if (values[key] && !values[key].startsWith(`${CANONICAL_ORIGIN}/`)) errors.push(`${key} precisa ser URL absoluta em ${CANONICAL_ORIGIN}`);
  }
  const relativeImage = SHARE_IMAGE_PATH.replace(/^\/+/, "");
  const imageFile = path.resolve(assetRoot, relativeImage);
  const root = path.resolve(assetRoot);
  const inside = imageFile === root || imageFile.startsWith(`${root}${path.sep}`);
  if (!inside) errors.push("caminho da imagem de preview escapa do diretório publicado");
  if (!existsSync(imageFile) || !inside) {
    errors.push("og:image não está incluída no build");
    return errors;
  }
  const raster = readRaster(readFileSync(imageFile));
  const declaredType = mediaTypeFor(imageFile);
  if (!raster || !declaredType?.startsWith("image/")) errors.push("og:image não é uma imagem raster válida");
  if (raster && values["og:image:type"] && values["og:image:type"] !== raster.type) {
    errors.push(`og:image:type deve ser ${raster.type}`);
  }
  if (raster?.width != null && values["og:image:width"] && Number(values["og:image:width"]) !== raster.width) {
    errors.push(`og:image:width deve ser ${raster.width}`);
  }
  if (raster?.height != null && values["og:image:height"] && Number(values["og:image:height"]) !== raster.height) {
    errors.push(`og:image:height deve ser ${raster.height}`);
  }
  return errors;
}

export function validateEntries(entries, readHtml, assetRoot) {
  return entries.flatMap((entry) => {
    let html = "";
    try {
      html = readHtml(entry);
    } catch (error) {
      return [`${entry.file}: HTML ausente (${error.message})`];
    }
    return validateSharePreview(html, { file: entry.file, assetRoot }).map((error) => `${entry.file}: ${error}`);
  });
}

function resolveStatic(root, pathname) {
  let relative = decodeURIComponent(pathname);
  if (relative === "/") relative = "/index.html";
  relative = relative.replace(/^\/+/, "");
  const file = path.resolve(root, relative);
  const inside = file === root || file.startsWith(`${root}${path.sep}`);
  if (!inside || !existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

function serve(rootDir) {
  const root = path.resolve(rootDir);
  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const file = resolveStatic(root, url.pathname);
    if (!file) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("ausente");
      return;
    }
    const type = mediaTypeFor(file);
    if (!type) {
      response.writeHead(415, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("tipo não suportado");
      return;
    }
    const bytes = readFileSync(file);
    response.writeHead(200, { "Content-Type": type, "Content-Length": bytes.length });
    response.end(bytes);
  });
}

export async function probeStatic(rootDir, urlPath) {
  const server = serve(rootDir);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}${urlPath}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    return { status: response.status, contentType: response.headers.get("content-type") ?? "", bytes };
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

export async function probeSharePreview(rootDir, entries) {
  const server = serve(rootDir);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const findings = [];
  try {
    for (const entry of entries) {
      const pagePath = path.basename(entry.file) === "index.html" ? "/" : `/${path.basename(entry.file)}`;
      const page = await fetch(`http://127.0.0.1:${port}${pagePath}`);
      const html = await page.text();
      const type = page.headers.get("content-type") ?? "";
      if (page.status !== 200 || !type.startsWith("text/html")) {
        findings.push(`${pagePath}: HTTP ${page.status} ${type}`);
      }
      const image = html.match(/<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)?.[1]
        ?? html.match(/<meta\b[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i)?.[1];
      if (!image) {
        findings.push(`${pagePath}: resposta sem og:image`);
        continue;
      }
      let imageUrl;
      try {
        imageUrl = new URL(image);
      } catch {
        findings.push(`${pagePath}: og:image inválida`);
        continue;
      }
      const asset = await fetch(`http://127.0.0.1:${port}${imageUrl.pathname}`);
      const assetType = asset.headers.get("content-type") ?? "";
      if (asset.status !== 200 || !assetType.startsWith("image/")) {
        findings.push(`${imageUrl.pathname}: HTTP ${asset.status} ${assetType}`);
      }
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  return findings;
}
