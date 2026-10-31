import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  ASSET_HASH_LENGTH,
  HASHED_IMAGE_ROOTS,
  RELEASE_META_NAME,
  UNKNOWN_RELEASE,
  buildTimestamp,
  publicAssetHashes,
  releaseIdentity,
  resolveRelease,
} from "../scripts/release-identity.mjs";
import { versionedAssetUrl } from "./photos.js";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const SHA1 = "7c0bb27d55b756f62cf20398aabcd180b8c54203";
const SHA2 = "f6e8fec0000000000000000000000000000000aa";
const readJson = (file) => JSON.parse(readFileSync(path.join(repoRoot, file), "utf8"));

test("the release prefers SOURCE_COMMIT, falls back to GITHUB_SHA and otherwise warns with unknown", () => {
  assert.deepEqual({ ...resolveRelease({ SOURCE_COMMIT: SHA1, GITHUB_SHA: SHA2 }) }, { sha: SHA1, source: "SOURCE_COMMIT", warning: "" });
  assert.deepEqual({ ...resolveRelease({ SOURCE_COMMIT: "", GITHUB_SHA: SHA2 }) }, { sha: SHA2, source: "GITHUB_SHA", warning: "" });
  assert.equal(resolveRelease({ SOURCE_COMMIT: "a".repeat(64) }).sha, "a".repeat(64));
  const missing = resolveRelease({});
  assert.equal(missing.sha, UNKNOWN_RELEASE);
  assert.equal(missing.source, null);
  assert.match(missing.warning, /SOURCE_COMMIT ausente/);
});

test("POLIMATCH_REQUIRE_RELEASE=1 turns a missing SHA into a build error", () => {
  assert.throws(() => resolveRelease({ POLIMATCH_REQUIRE_RELEASE: "1" }), /POLIMATCH_REQUIRE_RELEASE=1 exige/);
  assert.throws(() => resolveRelease({ POLIMATCH_REQUIRE_RELEASE: "1", SOURCE_COMMIT: "" }), /POLIMATCH_REQUIRE_RELEASE=1 exige/);
  assert.equal(resolveRelease({ POLIMATCH_REQUIRE_RELEASE: "1", GITHUB_SHA: SHA1 }).sha, SHA1);
  assert.equal(resolveRelease({ POLIMATCH_REQUIRE_RELEASE: "0" }).sha, UNKNOWN_RELEASE);
});

test("a present but malformed SHA always fails, like back/Dockerfile", () => {
  for (const value of ["7c0bb27", SHA1.toUpperCase(), `${SHA1}\n`, ` ${SHA1}`, "main", "g".repeat(40)]) {
    assert.throws(() => resolveRelease({ SOURCE_COMMIT: value }), /SOURCE_COMMIT precisa ser o SHA completo/, value);
  }
  assert.throws(() => resolveRelease({ GITHUB_SHA: "abc" }), /GITHUB_SHA precisa ser o SHA completo/);
});

test("builtAt honours SOURCE_DATE_EPOCH and otherwise uses the clock", () => {
  assert.equal(buildTimestamp({ SOURCE_DATE_EPOCH: "1793404800" }), "2026-10-31T00:00:00.000Z");
  assert.equal(buildTimestamp({}, () => new Date("2026-10-31T12:00:00Z")), "2026-10-31T12:00:00.000Z");
  assert.throws(() => buildTimestamp({ SOURCE_DATE_EPOCH: "ontem" }), /SOURCE_DATE_EPOCH/);
});

test("portrait versions are the SHA-256 already recorded in the recovery manifest and the presidential roster", () => {
  const hashes = publicAssetHashes(path.join(appRoot, "public"));
  assert.deepEqual(publicAssetHashes(path.join(appRoot, "public")), hashes, "two builds must produce the same map");
  const keys = Object.keys(hashes);
  assert.deepEqual(keys, [...keys].sort());
  for (const [publicPath, hash] of Object.entries(hashes)) {
    assert.ok(HASHED_IMAGE_ROOTS.some((root) => publicPath.startsWith(`/${root}/`)), publicPath);
    assert.match(hash, new RegExp(`^[0-9a-f]{${ASSET_HASH_LENGTH}}$`));
  }

  const recovery = readJson("shared/photo-recovery-manifest.json").photos;
  assert.ok(recovery.length > 0);
  for (const photo of recovery) {
    assert.equal(hashes[photo.image], photo.sha256.slice(0, ASSET_HASH_LENGTH), photo.image);
    assert.equal(versionedAssetUrl(photo.image, hashes), `${photo.image}?v=${photo.sha256.slice(0, ASSET_HASH_LENGTH)}`);
  }
  const roster = readJson("shared/presidential-roster.json").people;
  assert.ok(roster.length > 0);
  for (const person of roster) {
    assert.equal(hashes[person.photo.path], person.photo.sha256.slice(0, ASSET_HASH_LENGTH), person.photo.path);
  }
  const approvedChroma = "/chromas/approved/001_luiz-inacio-lula-da-silva.jpg";
  const bytes = readFileSync(path.join(appRoot, "public", approvedChroma));
  assert.equal(hashes[approvedChroma], createHash("sha256").update(bytes).digest("hex").slice(0, ASSET_HASH_LENGTH));
});

function fixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), "polimatch-release-"));
  mkdirSync(path.join(root, "public/portraits/presidential"), { recursive: true });
  mkdirSync(path.join(root, "public/chromas/cover"), { recursive: true });
  writeFileSync(path.join(root, "public/portraits/001.jpg"), "abc");
  writeFileSync(path.join(root, "public/portraits/presidential/pessoa.webp"), "def");
  writeFileSync(path.join(root, "public/portraits/notas.txt"), "fora");
  writeFileSync(path.join(root, "public/chromas/cover/capa-1234abcd.webp"), "ghi");
  return root;
}

function runPlugin(env, root, { command = "build" } = {}) {
  const plugin = releaseIdentity({ env, now: () => new Date("2026-10-31T12:00:00Z") });
  const config = plugin.config({ root });
  const warnings = [];
  plugin.configResolved({ command, logger: { warn: (message) => warnings.push(message) } });
  const emitted = [];
  plugin.generateBundle.call({ emitFile: (file) => emitted.push(file) });
  return { config, warnings, emitted, html: plugin.transformIndexHtml() };
}

test("the Vite plugin writes version.json and the release meta, keeping the SHA out of JS", () => {
  const root = fixtureRoot();
  try {
    const { config, warnings, emitted, html } = runPlugin({ SOURCE_COMMIT: SHA1 }, root);
    assert.deepEqual(Object.keys(config.define), ["__POLIMATCH_ASSET_HASHES__"]);
    assert.deepEqual(JSON.parse(config.define.__POLIMATCH_ASSET_HASHES__), {
      "/portraits/001.jpg": "ba7816bf",
      "/portraits/presidential/pessoa.webp": "cb8379ac",
    });
    assert.deepEqual(warnings, []);
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0].type, "asset");
    assert.equal(emitted[0].fileName, "version.json");
    assert.deepEqual(JSON.parse(emitted[0].source), { sha: SHA1, builtAt: "2026-10-31T12:00:00.000Z" });
    assert.deepEqual(html, [{ tag: "meta", attrs: { name: RELEASE_META_NAME, content: SHA1 }, injectTo: "head" }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("portrait URLs depend only on image bytes, not on the release or the build time", () => {
  const root = fixtureRoot();
  try {
    const first = runPlugin({ SOURCE_COMMIT: SHA1 }, root).config.define.__POLIMATCH_ASSET_HASHES__;
    const second = runPlugin({ GITHUB_SHA: SHA2, SOURCE_DATE_EPOCH: "0" }, root).config.define.__POLIMATCH_ASSET_HASHES__;
    const third = runPlugin({}, root).config.define.__POLIMATCH_ASSET_HASHES__;
    assert.equal(second, first);
    assert.equal(third, first);
    writeFileSync(path.join(root, "public/portraits/001.jpg"), "abd");
    const changed = JSON.parse(runPlugin({ SOURCE_COMMIT: SHA1 }, root).config.define.__POLIMATCH_ASSET_HASHES__);
    assert.notEqual(changed["/portraits/001.jpg"], JSON.parse(first)["/portraits/001.jpg"]);
    assert.equal(changed["/portraits/presidential/pessoa.webp"], JSON.parse(first)["/portraits/presidential/pessoa.webp"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a build without SHA warns and ships unknown; the CI flag makes it fail", () => {
  const root = fixtureRoot();
  try {
    const { warnings, emitted, html } = runPlugin({}, root);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /SOURCE_COMMIT ausente/);
    assert.equal(JSON.parse(emitted[0].source).sha, UNKNOWN_RELEASE);
    assert.equal(html[0].attrs.content, UNKNOWN_RELEASE);
    assert.deepEqual(runPlugin({}, root, { command: "serve" }).warnings, []);
    assert.throws(() => releaseIdentity({ env: { POLIMATCH_REQUIRE_RELEASE: "1" } }).config({ root }), /POLIMATCH_REQUIRE_RELEASE=1 exige/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("vite.config, photos.js and the Dockerfile are wired to the same release identity", () => {
  const viteConfig = readFileSync(path.join(appRoot, "vite.config.js"), "utf8");
  const photos = readFileSync(path.join(appRoot, "src/photos.js"), "utf8");
  const plugin = readFileSync(path.join(appRoot, "scripts/release-identity.mjs"), "utf8");
  const dockerfile = readFileSync(path.join(appRoot, "Dockerfile"), "utf8");
  assert.match(viteConfig, /plugins: \[releaseIdentity\(\)\]/);
  assert.doesNotMatch(viteConfig + photos, /Date\.now|__POLIMATCH_ASSET_VERSION__/);
  assert.match(photos, /__POLIMATCH_ASSET_HASHES__/);
  assert.match(plugin, /__POLIMATCH_ASSET_HASHES__: JSON\.stringify/);

  const build = dockerfile.indexOf("RUN npm run build --prefix app");
  for (const line of [
    'ARG SOURCE_COMMIT=""',
    'ARG POLIMATCH_REQUIRE_RELEASE=""',
    "ENV SOURCE_COMMIT=${SOURCE_COMMIT}",
    "ENV POLIMATCH_REQUIRE_RELEASE=${POLIMATCH_REQUIRE_RELEASE}",
  ]) {
    const position = dockerfile.indexOf(line);
    assert.notEqual(position, -1, line);
    assert.ok(position < build, `${line} must come before the Vite build`);
  }
  const finalStage = dockerfile.slice(dockerfile.indexOf("FROM nginx:"));
  assert.equal(finalStage.includes("SOURCE_COMMIT"), false);
});
