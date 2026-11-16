import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Limpeza da ICM 69 (#331): depois que a pesquisa virou a capa, nada do
// produto anterior deve sobrar em app/src ou em app/e2e. Estes testes falham
// quando um módulo fica sem uso ou quando um roteiro de navegador deixa de
// rodar no CI.

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const at = (relative) => path.join(repoRoot, relative);
const relative = (file) => path.relative(repoRoot, file).split(path.sep).join("/");

function walk(directory, out = []) {
  if (!existsSync(directory)) return out;
  for (const name of readdirSync(directory)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = path.join(directory, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Arquivos locais que um módulo, script ou folha de estilo carrega. */
function localReferences(file) {
  if (!/\.(m?js|css|html)$/.test(file)) return [];
  const text = readFileSync(file, "utf8");
  const patterns = [
    /(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g,
    /@import\s+(?:url\()?["']([^"']+)["']/g,
    /<script\b[^>]*\bsrc="([^"]+)"/g,
  ];
  const specs = patterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[1]));
  return specs
    .filter((spec) => spec.startsWith(".") || spec.startsWith("/src/"))
    .map((spec) => (spec.startsWith("/src/") ? at(`app${spec}`) : path.resolve(path.dirname(file), spec)))
    .filter((target) => existsSync(target) && statSync(target).isFile());
}

function reach(seeds) {
  const seen = new Set();
  const stack = [...seeds];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    stack.push(...localReferences(file));
  }
  return seen;
}

const viteConfig = readFileSync(at("app/vite.config.js"), "utf8");
const pages = [...viteConfig.match(/input:\s*\{([^}]*)\}/)[1].matchAll(/"([^"]+\.html)"/g)].map(([, name]) => at(`app/${name}`));
const scripts = (directory, { tests = false } = {}) => walk(at(directory)).filter((file) => /\.m?js$/.test(file) && (tests || !/\.test\.m?js$/.test(file)));
// O que roda de verdade: as páginas do build, os scripts do app (build e CI),
// o servidor e o código compartilhado. Os testes do servidor contam: um deles
// confere `app/src/photos.js` contra a recuperação de fotos da API.
const outside = ["back", "shared", "scripts"].flatMap((directory) => scripts(directory, { tests: true }));
const used = reach([...pages, at("app/vite.config.js"), ...scripts("app/scripts"), ...outside]);
const sources = walk(at("app/src"));
const isTest = (file) => /\.test\.js$/.test(file);
const isFixture = (file) => relative(file).startsWith("app/src/fixtures/");

test("todo módulo de app/src é usado pelo build, por um script do app ou pelo servidor", () => {
  const unused = sources.filter((file) => !isTest(file) && !isFixture(file) && !used.has(file)).map(relative).sort();
  assert.deepEqual(unused, [], `módulos sem uso:\n${unused.join("\n")}`);
});

test("todo teste de app/src testa código que está em uso", () => {
  const stale = [];
  for (const file of sources.filter(isTest)) {
    const targets = localReferences(file).filter((target) => relative(target).startsWith("app/src/") && !isFixture(target) && !isTest(target));
    const dead = targets.filter((target) => !used.has(target)).map(relative);
    if (dead.length) stale.push(`${relative(file)} -> ${dead.join(", ")}`);
  }
  assert.deepEqual(stale, [], `testes de código sem uso:\n${stale.join("\n")}`);
});

test("toda fixture de app/src é usada por algum teste", () => {
  const fromTests = reach(sources.filter(isTest));
  const orphans = sources.filter((file) => isFixture(file) && !fromTests.has(file)).map(relative).sort();
  assert.deepEqual(orphans, []);
});

test("todo roteiro de app/e2e roda no CI", () => {
  const workflow = readFileSync(at(".github/workflows/ui-interaction-smoke.yml"), "utf8");
  const runsInCi = new Set([...workflow.matchAll(/node app\/e2e\/([\w-]+\.mjs)/g)].map(([, name]) => at(`app/e2e/${name}`)));
  const reachedByCi = reach(runsInCi);
  const idle = walk(at("app/e2e")).filter((file) => !reachedByCi.has(file)).map(relative).sort();
  assert.deepEqual(idle, [], `roteiros que o CI não roda:\n${idle.join("\n")}`);
  assert.deepEqual([...runsInCi].map(relative).sort(), ["app/e2e/client-error-report.mjs", "app/e2e/photo-survey.mjs", "app/e2e/site-shell.mjs"]);
});
