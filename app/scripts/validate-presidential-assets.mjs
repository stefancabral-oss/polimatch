import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import ROSTER from "../../shared/presidential-roster.json" with { type: "json" };
import { validatePresidentialRoster } from "../../shared/presidential-curation.js";
validatePresidentialRoster(ROSTER);
const used = new Set();
for (const person of ROSTER.people) {
  const bytes = readFileSync(
    new URL("../public" + person.photo.path, import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    person.photo.sha256,
    person.id,
  );
  const source = new URL(person.photo.sourceUrl);
  assert.equal(source.protocol, "https:");
  if (person.photo.path.startsWith("/portraits/presidential/"))
    used.add(person.photo.path.split("/").at(-1));
}
assert.deepEqual(
  readdirSync(
    new URL("../public/portraits/presidential/", import.meta.url),
  ).sort(),
  [...used].sort(),
  "Unreferenced portrait cannot ship",
);
console.log(
  `Presidential roster: ${ROSTER.people.length} identities, six categories, local images, source URLs, exclusion list and SHA-256 verified`,
);
