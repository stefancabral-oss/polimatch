import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ROSTER from "../../shared/presidential-roster.json" with { type: "json" };
import {
  PRODUCTION_CANDIDATE_REGISTRY as registry,
  RECOVERED_CANDIDATE_REGISTRY as base,
  CANDIDATES,
  serializeCandidate,
} from "./candidates.js";
import { withPresidentialRoster } from "./presidential-roster.js";
import { validateRoundVote } from "./topic-store.js";
import { categoryPeople } from "../../shared/presidential-curation.js";
test("six curated pools add identities without changing the legacy election catalog", () => {
  assert.equal(CANDIDATES.length, 125);
  assert.equal(registry.candidatesForTopic("eleicoes-2026").length, 54);
  assert.deepEqual(
    registry.candidatesForTopic("eleicoes-2026"),
    base.candidatesForTopic("eleicoes-2026"),
  );
  assert.equal(registry.topics.filter((t) => t.active).length, 7);
  for (const category of ROSTER.categories) {
    const candidates = registry.candidatesForTopic(category.topicId);
    assert.deepEqual(
      candidates.map((p) => p.id),
      categoryPeople(ROSTER, category.id).map((p) => p.id),
    );
    assert.equal(new Set(candidates.map((p) => p.id)).size, candidates.length);
    for (const candidate of candidates) {
      assert.ok(
        registry.candidateBelongsToTopic(candidate.id, category.topicId),
      );
      const projection = serializeCandidate(candidate);
      assert.equal(projection.reviewStatus, "pending");
      assert.equal(projection.publication.documentaryPhoto.status, "curated");
      assert.deepEqual(projection.facts, []);
      assert.equal(projection.party, null);
    }
    const ids = candidates.slice(0, 4).map((p) => p.id);
    assert.equal(
      validateRoundVote(category.topicId, ids[0], ids, registry).topic,
      category.topicId,
    );
    assert.throws(() =>
      validateRoundVote(
        category.topicId,
        "lula",
        ["lula", ...ids.slice(0, 3)],
        registry,
      ),
    );
  }
});
test("presidential startup fails closed when a packaged asset changes", () => {
  const load = (path) =>
    readFileSync(new URL("../../" + path, import.meta.url));
  assert.throws(
    () =>
      withPresidentialRoster(base, ROSTER, (path) =>
        path.endsWith(ROSTER.people[0].photo.path)
          ? Buffer.from("changed")
          : load(path),
      ),
    /Retrato presidencial alterado/,
  );
});
