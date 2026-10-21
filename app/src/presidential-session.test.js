import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  freshPresidentialRound,
  restoredPresidentialSession,
  categoryDistribution,
} from "./presidential-session.js";
import { tcgCardMarkup } from "./tcg-card.js";
const people = Array.from({ length: 20 }, (_, i) => ({
  id: `person-${i}`,
  name: `Person ${i}`,
  personId: i + 1,
  photo: { path: "/portraits/001.jpg" },
}));
const fresh = () => ({
  ...freshPresidentialRound(people, { uuid: randomUUID }),
  completed: 0,
  confirmed: false,
});
test("category deck offers four distinct identities and cycles every identity", () => {
  let round,
    counts = new Map();
  for (let i = 0; i < 5; i++) {
    round = freshPresidentialRound(people, {
      queue: round?.queue,
      previous: round?.candidateIds,
      uuid: randomUUID,
    });
    assert.equal(new Set(round.candidateIds).size, 4);
    for (const id of round.candidateIds)
      counts.set(id, (counts.get(id) || 0) + 1);
  }
  assert.equal(counts.size, 20);
  assert.ok([...counts.values()].every((count) => count === 1));
  assert.equal(
    categoryDistribution({
      members: [
        { id: "a", support: "lula" },
        { id: "a", support: "flavio" },
      ],
    }).unique,
    1,
  );
});
test("pending reload retains UUID, order and original server baseline; foreign/corrupt state is rejected", () => {
  const state = fresh();
  state.selectionIds = state.candidateIds.slice(0, 2);
  state.pending = {
    roundId: state.roundId,
    winnerId: state.selectionIds[0],
    candidateIds: state.candidateIds,
    selectionIds: state.selectionIds,
    playerVersion: 4,
    personalDuels: 3,
    topicId: "corrida-politicos",
  };
  assert.deepEqual(restoredPresidentialSession(state, people), state);
  for (const mutate of [
    (s) => (s.candidateIds[0] = "foreign"),
    (s) => (s.roundId = "bad"),
    (s) => (s.completed = 11),
    (s) => (s.pending.selectionIds = [s.selectionIds[1], s.selectionIds[0]]),
    (s) => (s.pending.playerVersion = -1),
    (s) => (s.pending.winnerId = s.candidateIds[3]),
    (s) => (s.confirmed = true),
  ]) {
    const copy = structuredClone(state);
    mutate(copy);
    assert.equal(restoredPresidentialSession(copy, people), null);
  }
});
test("TCG card keeps one visible name, escapes markup, differentiates decorative and choice accessibility", () => {
  const card = tcgCardMarkup({ ...people[0], name: "A <B> & C" });
  assert.match(card, /aria-pressed="false"/);
  assert.match(card, /A &lt;B&gt; &amp; C/);
  assert.ok(!card.includes("<B>"));
  assert.equal((card.match(/class="tcg-name"/g) || []).length, 1);
  const decorative = tcgCardMarkup(people[0], { decorative: true });
  assert.ok(!decorative.includes("<button"));
  assert.match(decorative, /aria-hidden="true"/);
});
