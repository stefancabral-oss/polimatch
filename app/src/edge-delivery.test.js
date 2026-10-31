import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { collectLocalReferences, findMissingReferences } from "../scripts/verify-public-refs.mjs";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const nginx = read("../nginx.conf");
const sw = read("../public/sw.js");
const main = read("./main.js");
const indexHtml = read("../index.html");
const manifest = JSON.parse(read("../public/manifest.webmanifest"));
const robots = read("../public/robots.txt");
const sitemap = read("../public/sitemap.xml");
const viteConfig = read("../vite.config.js");
const packageJson = JSON.parse(read("../package.json"));
const gitignore = read("../../.gitignore");
const workflow = read("../../.github/workflows/design-validator.yml");

function locationBlock(spec) {
  const start = nginx.indexOf(`location ${spec} {`);
  assert.notEqual(start, -1, `nginx.conf must declare location ${spec}`);
  return nginx.slice(start, nginx.indexOf("}", start) + 1);
}

function pngSize(relative) {
  const bytes = readFileSync(new URL(relative, import.meta.url));
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], `${relative} must be a PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

function withDist(files, run) {
  const dir = mkdtempSync(path.join(tmpdir(), "polimatch-refs-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      writeFileSync(path.join(dir, name), content);
    }
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("nginx compresses every text format the app ships", () => {
  assert.match(nginx, /^\s*gzip on;$/m);
  assert.match(nginx, /^\s*gzip_vary on;$/m);
  assert.match(nginx, /^\s*gzip_min_length \d+;$/m);
  const types = nginx.match(/^\s*gzip_types ([^;]+);$/m)?.[1].split(/\s+/) ?? [];
  for (const type of ["text/css", "application/javascript", "application/json", "image/svg+xml", "application/manifest+json", "text/xml", "application/xml"]) {
    assert.ok(types.includes(type), `gzip_types must include ${type}`);
  }
});

test("hashed assets are immutable and a missing one is a real 404", () => {
  const assets = locationBlock("^~ /assets/");
  assert.match(assets, /add_header Cache-Control "public, max-age=31536000, immutable";/);
  assert.match(assets, /try_files \$uri =404;/);
});

test("HTML always revalidates and only extensionless paths fall back to the app", () => {
  const html = locationBlock("~* \\.html$");
  assert.match(html, /add_header Cache-Control "no-cache";/);
  assert.match(html, /try_files \$uri =404;/);

  const fallback = locationBlock("/");
  assert.match(fallback, /try_files \$uri \$uri\/ \/index\.html;/);
  assert.equal(nginx.match(/\/index\.html;/g).length, 1, "only the extensionless fallback may serve index.html");

  const staticFiles = nginx.match(/location ~\* \\\.\(\?:([^)]+)\)\$ \{[^}]*try_files \$uri =404;[^}]*\}/);
  assert.ok(staticFiles, "a static-extension location must answer 404 for missing files");
  const extensions = staticFiles[1].split("|");
  for (const extension of ["m?js", "css", "png", "jpe?g", "webp", "svg", "ico", "json", "txt", "xml", "webmanifest", "woff2?"]) {
    assert.ok(extensions.includes(extension), `static 404 must cover ${extension}`);
  }
});

test("portraits and Chromas get a short revalidated cache, never immutable", () => {
  for (const directory of ["/portraits/", "/chromas/"]) {
    const block = locationBlock(`^~ ${directory}`);
    assert.match(block, /add_header Cache-Control "public, max-age=86400";/);
    assert.doesNotMatch(block, /immutable/);
    assert.match(block, /try_files \$uri =404;/);
  }
});

test("service worker and manifest keep their dedicated locations", () => {
  assert.match(locationBlock("= /sw.js"), /no-store/);
  const manifestBlock = locationBlock("= /manifest.webmanifest");
  assert.match(manifestBlock, /default_type application\/manifest\+json;/);
  assert.match(manifestBlock, /no-cache/);
  assert.match(locationBlock("= /version.json"), /add_header Cache-Control "no-cache";/);
});

test("service worker only installs and never intercepts requests", () => {
  assert.doesNotMatch(sw, /addEventListener\(\s*["']fetch["']/);
  assert.doesNotMatch(sw, /respondWith/);
  assert.match(sw, /addEventListener\("install"/);
  assert.match(sw, /addEventListener\("activate"/);
  assert.match(main, /navigator\.serviceWorker\.register\("\.\/sw\.js"\)\.catch\(\(\) => \{\}\)/);
});

test("PWA icons are committed PNGs with the declared sizes", () => {
  assert.doesNotMatch(gitignore, /^app\/public\/icons\/?$/m);
  const pngIcons = manifest.icons.filter(({ type }) => type === "image/png");
  assert.deepEqual(pngIcons.map(({ src }) => src), ["./icons/icon-192.png", "./icons/icon-512.png"]);
  for (const { src, sizes } of pngIcons) assert.equal(pngSize(`../public/${src.slice(2)}`), sizes);

  const appleTouch = indexHtml.match(/<link rel="apple-touch-icon" href="\.\/([^"]+)"/)?.[1];
  assert.equal(appleTouch, "icons/apple-touch-icon.png");
  assert.equal(pngSize(`../public/${appleTouch}`), "180x180");
});

test("robots.txt and sitemap.xml describe the public pages at the canonical origin", () => {
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.doesNotMatch(robots, /^Disallow: \/\s*$/m);
  assert.match(robots, /^Sitemap: https:\/\/polimatch\.com\.br\/sitemap\.xml$/m);

  const inputs = [...viteConfig.match(/input:\s*\{([^}]*)\}/)[1].matchAll(/"([^"]+\.html)"/g)].map(([, name]) => name);
  assert.equal(inputs.length, 4);
  const expected = inputs.map((name) => `https://polimatch.com.br/${name === "index.html" ? "" : name}`).sort();
  const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc).sort();
  assert.deepEqual(listed, expected);
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
});

test("public reference check accepts a dist whose local references all exist", () => {
  withDist({
    "index.html": `<link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="./icon.svg?v=1#x">
      <script type="module" src="./assets/main-abc.js"></script><img srcset="./a.png 1x, ./b.png 2x">
      <a href="./">início</a><a href="#topo">topo</a><a href="https://polimatch.com.br/x.png">fora</a>
      <img src="data:image/png;base64,AAAA"><a href="mailto:contato@example.org">e-mail</a><script src="//cdn.example.org/x.js"></script>`,
    "manifest.webmanifest": JSON.stringify({ start_url: "./", icons: [{ src: "./icons/icon-192.png" }] }),
    "icon.svg": "<svg/>",
    "assets/main-abc.js": "",
    "a.png": "",
    "b.png": "",
    "icons/icon-192.png": "",
  }, (dir) => {
    assert.deepEqual(findMissingReferences(dir), []);
    const { references, manifests } = collectLocalReferences(dir);
    assert.deepEqual(manifests, ["/manifest.webmanifest"]);
    assert.deepEqual(references.map(({ urlPath }) => urlPath).sort(), [
      "/", "/", "/a.png", "/assets/main-abc.js", "/b.png", "/icon.svg", "/icons/icon-192.png", "/manifest.webmanifest",
    ]);
  });
});

test("public reference check reports a missing manifest icon and a missing page asset", () => {
  withDist({
    "index.html": `<link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">`,
    "quiz.html": `<script type="module" src="./assets/quiz-old.js"></script>`,
    "manifest.webmanifest": JSON.stringify({ start_url: "./", icons: [{ src: "./icons/icon-512.png" }] }),
    "icons/apple-touch-icon.png": "",
  }, (dir) => {
    assert.deepEqual(findMissingReferences(dir).map(({ source, ref }) => `${source} ${ref}`), [
      "quiz.html ./assets/quiz-old.js",
      "manifest.webmanifest ./icons/icon-512.png",
    ]);
  });
});

test("the build verifies public references and CI smokes the real nginx image", () => {
  assert.match(packageJson.scripts.build, /vite build && .*node scripts\/verify-public-refs\.mjs$/);
  const build = workflow.indexOf("docker build --file app/Dockerfile --tag polimatch-app:pilot-176 .");
  const run = workflow.indexOf("docker run");
  const copy = workflow.indexOf("docker cp");
  const smoke = workflow.indexOf("node app/scripts/smoke-nginx.mjs");
  assert.ok(build !== -1 && build < run && run < copy && copy < smoke, "CI must build, run, copy the served dist and then smoke the container");
});
