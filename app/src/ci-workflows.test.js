import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = (name) => readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), "utf8");
const ci = workflow("ci.yml");
const SUITES = {
  "back-shared": "back-shared.yml",
  "design-validator": "design-validator.yml",
  "ui-interaction-smoke": "ui-interaction-smoke.yml",
  "civic-planning": "civic-planning.yml",
};
const hasJq = spawnSync("jq", ["--version"]).status === 0;

function block(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  assert.ok(from > -1 && to > from, `bloco ${start.trim()} ausente`);
  return text.slice(from, to);
}

test("CI runs on every pull request and on every push to main, without path filters on the trigger", () => {
  assert.equal(
    block(ci, "\non:\n", "\npermissions:"),
    "\non:\n  pull_request:\n    branches: [main]\n  push:\n    branches: [main]\n  workflow_dispatch:\n",
  );
});

test("each suite is a reusable workflow called by ci.yml, so a single run carries every check", () => {
  for (const [job, file] of Object.entries(SUITES)) {
    const suite = workflow(file);
    assert.match(suite, /\non:\n {2}workflow_call:\n {2}workflow_dispatch:\n/, file);
    assert.doesNotMatch(suite, /\n {2}(?:pull_request|push):/, `${file} must not trigger on its own`);
    const caller = block(ci, `\n  ${job}:\n`, "\n\n");
    assert.match(caller, new RegExp(`uses: \\./\\.github/workflows/${file.replace(".", "\\.")}`), job);
    assert.match(caller, /needs: changes/);
    assert.match(caller, /if: github\.event_name != 'pull_request' \|\| needs\.changes\.outputs\.\w+ == 'true'/, job);
  }
  assert.match(block(ci, "\n  back-shared:\n", "\n\n"), /secrets: inherit/);
});

test("the path filter is pinned to a commit and only consulted for pull requests", () => {
  const changes = block(ci, "\n  changes:\n", "\n  back-shared:\n");
  assert.match(changes, /uses: dorny\/paths-filter@[0-9a-f]{40} # v\d+\.\d+\.\d+/);
  assert.match(changes, /if: github\.event_name == 'pull_request'/);
  assert.match(changes, /pull-requests: read/);
  for (const filter of ["back_shared", "design", "ui_smoke", "planning"]) {
    assert.match(changes, new RegExp(`\\n {12}${filter}:\\n`), filter);
    assert.match(changes, new RegExp(`${filter}: \\$\\{\\{ steps\\.filter\\.outputs\\.${filter} \\}\\}`), filter);
  }
});

test("ci-gate always runs and depends on every other job", () => {
  const gate = block(ci, "\n  ci-gate:\n", "# ci-gate:end");
  assert.match(gate, /\n {4}name: ci-gate\n/);
  assert.match(gate, /\n {4}if: always\(\)\n/);
  const needs = gate.match(/needs: \[([^\]]+)\]/)[1].split(",").map((name) => name.trim());
  assert.deepEqual(needs.sort(), ["changes", ...Object.keys(SUITES)].sort());
  const jobs = [...ci.slice(ci.indexOf("\njobs:\n")).matchAll(/\n {2}([a-z][a-z-]*):\n/g)].map(([, name]) => name).filter((name) => name !== "ci-gate");
  assert.deepEqual(jobs.sort(), needs.sort(), "every job must feed ci-gate");
});

function gateScript() {
  const script = block(ci, "# ci-gate:begin\n", "# ci-gate:end");
  return script.split("\n").map((line) => line.replace(/^ {10}/, "")).join("\n");
}

function runGate(event, results) {
  const needs = Object.fromEntries(Object.entries(results).map(([job, result]) => [job, { result, outputs: {} }]));
  return spawnSync("bash", ["-c", gateScript()], {
    env: { PATH: process.env.PATH, NEEDS: JSON.stringify(needs), EVENT_NAME: event },
    encoding: "utf8",
  });
}

const allSuites = (result) => Object.fromEntries(Object.keys(SUITES).map((job) => [job, result]));

test("ci-gate counts path-filter skips as success and fails on failure or cancellation", { skip: !hasJq && "jq indisponível" }, () => {
  const pr = (overrides) => runGate("pull_request", { changes: "success", ...allSuites("success"), ...overrides });
  assert.equal(pr({}).status, 0);
  assert.equal(pr(allSuites("skipped")).status, 0, "a docs-only pull request must pass");
  assert.equal(pr({ "civic-planning": "skipped", "back-shared": "skipped" }).status, 0);

  const failed = pr({ "ui-interaction-smoke": "failure", "civic-planning": "skipped" });
  assert.equal(failed.status, 1);
  assert.match(failed.stdout, /::error::ci-gate bloqueado por: ui-interaction-smoke/);
  assert.equal(pr({ "design-validator": "cancelled" }).status, 1);
  assert.equal(pr({ changes: "failure", ...allSuites("skipped") }).status, 1, "a broken filter must not open the gate");
});

test("ci-gate requires every suite to run and pass on push to main and manual runs", { skip: !hasJq && "jq indisponível" }, () => {
  for (const event of ["push", "workflow_dispatch"]) {
    assert.equal(runGate(event, { changes: "success", ...allSuites("success") }).status, 0, event);
    assert.equal(runGate(event, { changes: "success", ...allSuites("success"), "back-shared": "skipped" }).status, 1, event);
    assert.equal(runGate(event, { changes: "success", ...allSuites("success"), "back-shared": "failure" }).status, 1, event);
  }
});

test("CI builds must carry the commit SHA into the app and the API images", () => {
  const design = workflow("design-validator.yml");
  const smoke = workflow("ui-interaction-smoke.yml");
  const back = workflow("back-shared.yml");
  assert.match(design, /POLIMATCH_REQUIRE_RELEASE: '1'\n\s+run: \|\n\s+npm run build --prefix app\n\s+test "\$\(jq -r \.sha app\/dist\/version\.json\)" = "\$GITHUB_SHA"/);
  assert.match(design, /--build-arg SOURCE_COMMIT="\$GITHUB_SHA" --build-arg POLIMATCH_REQUIRE_RELEASE=1/);
  assert.match(design, /cat polimatch-app:pilot-176 \/usr\/share\/nginx\/html\/version\.json/);
  assert.match(design, /test "\$\(jq -r \.sha \/tmp\/polimatch-version\.json\)" = "\$GITHUB_SHA"/);
  assert.match(smoke, /POLIMATCH_REQUIRE_RELEASE: '1'/);
  assert.match(smoke, /\/version\.json \| jq -e --arg sha "\$GITHUB_SHA" '\.sha == \$sha'/);
  assert.match(back, /--build-arg SOURCE_COMMIT="\$GITHUB_SHA"/);
  assert.match(back, /assert\.equal\(EMBEDDED_RELEASE_REVISION,process\.env\.EXPECTED_RELEASE\)/);
});
