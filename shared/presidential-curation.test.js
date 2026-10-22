import test from "node:test";
import assert from "node:assert/strict";
import ROSTER from "./presidential-roster.json" with { type: "json" };
import {
  categoryPeople,
  supportLabel,
  validatePresidentialRoster,
  PRESIDENTIAL_EXCLUSIONS,
} from "./presidential-curation.js";
test("presidential roster preserves six lists, unique identities and explicit exclusions", () => {
  validatePresidentialRoster(ROSTER);
  assert.equal(ROSTER.people.length, 104);
  assert.deepEqual(
    ROSTER.categories.map((c) => categoryPeople(ROSTER, c.id).length),
    [20, 11, 20, 20, 15, 20],
  );
  for (const id of PRESIDENTIAL_EXCLUSIONS)
    assert.ok(!ROSTER.people.some((p) => p.id === id));
  assert.equal(ROSTER.people.filter((p) => p.id === "pablo-marcal").length, 1);
  assert.equal(
    ROSTER.people.find((p) => p.id === "pablo-marcal").memberships.length,
    3,
  );
  const erasmo = ROSTER.people.find(
    (p) => p.id === "erasmo-carlos-battistella",
  );
  assert.equal(
    supportLabel(erasmo, "empresarios"),
    "Apoio documentado aos dois",
  );
  assert.equal(
    categoryPeople(ROSTER, "empresarios").filter((p) => p.id === erasmo.id)
      .length,
    1,
  );
});
test("roster fails closed for duplicated identities, paths, missing photos and orphan memberships", () => {
  for (const mutate of [
    (r) => r.people.push(r.people[0]),
    (r) => (r.people[0].photo.path = "/portraits/../../secret"),
    (r) => (r.people[0].photo = null),
    (r) => (r.people[0].memberships[0].category = "other"),
    (r) => (r.people[0].memberships[0].sourceUrl = "javascript:alert(1)"),
    (r) => r.categories[0].members.push(r.categories[0].members[0]),
  ]) {
    const copy = structuredClone(ROSTER);
    mutate(copy);
    assert.throws(() => validatePresidentialRoster(copy));
  }
});
