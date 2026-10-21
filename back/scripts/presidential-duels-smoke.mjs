import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTopicStore } from "../src/topic-store.js";
import {
  PRODUCTION_CANDIDATE_REGISTRY as registry,
  RECOVERED_CANDIDATE_REGISTRY as legacy,
} from "../src/candidates.js";
import ROSTER from "../../shared/presidential-roster.json" with { type: "json" };
import { projectVoteResponseV2 } from "../src/aggregate-publication.js";
const connection = process.env.DATABASE_URL;
if (!connection)
  throw new Error("DATABASE_URL is required (disposable database only)");
const options = { clock: () => new Date("2036-10-21T12:00:00Z") };
const old = createTopicStore(connection, {
  ...options,
  candidateRegistry: legacy,
});
let store;
try {
  await old.init();
  const player = await old.createPlayer({ networkHash: "3".repeat(64) });
  const legacyBefore = await old.playerRanking(
    player.recoveryKey,
    "eleicoes-2026",
  );
  await old.close();
  store = createTopicStore(connection, {
    ...options,
    candidateRegistry: registry,
  });
  await store.init();
  const fresh = await store.createPlayer({ networkHash: "4".repeat(64) });
  for (const category of ROSTER.categories) {
    const ids = registry
      .candidatesForTopic(category.topicId)
      .slice(0, 4)
      .map((p) => p.id);
    // Backfill creates new pools for an existing player, and is safe to repeat.
    const before = await store.playerRanking(
      player.recoveryKey,
      category.topicId,
    );
    assert.equal(before.version, 0);
    assert.equal(before.duels, 0);
    assert.equal(
      before.ranking.length,
      registry.candidatesForTopic(category.topicId).length,
    );
    const request = {
      topicId: category.topicId,
      winnerId: ids[0],
      candidateIds: ids,
      selectionIds: ids.slice(0, 2),
      roundId: randomUUID(),
      recoveryKey: player.recoveryKey,
      playerVersion: 0,
    };
    const created = await store.roundVote(request);
    const replay = await store.roundVote(request);
    assert.equal(created.round.status, "created");
    assert.equal(replay.round.status, "alreadyProcessed");
    assert.equal(created.player.duels, 1);
    assert.equal(replay.player.duels, 1);
    const projected = projectVoteResponseV2(created);
    assert.deepEqual(projected.round.selectionIds, ids.slice(0, 2));
    for (const [index, id] of ids.entries())
      assert.equal(
        created.player.ranking.find((p) => p.id === id).elo -
          before.ranking.find((p) => p.id === id).elo,
        [24, 8, -16, -16][index],
      );
    await assert.rejects(
      store.roundVote({
        ...request,
        selectionIds: [ids[1], ids[0]],
        winnerId: ids[1],
      }),
      (e) => e.code === "ROUND_REPLAY_DIVERGENT",
    );
    await assert.rejects(
      store.roundVote({
        ...request,
        roundId: randomUUID(),
        winnerId: "lula",
        candidateIds: ["lula", ...ids.slice(1)],
      }),
    );
    const other = await store.playerRanking(
      fresh.recoveryKey,
      category.topicId,
    );
    assert.equal(other.duels, 0);
    await store.init();
    assert.equal(
      (await store.playerRanking(player.recoveryKey, category.topicId)).duels,
      1,
    );
    assert.equal(
      (await store.roundVote(request)).round.status,
      "alreadyProcessed",
    );
  }
  assert.deepEqual(
    await store.playerRanking(player.recoveryKey, "eleicoes-2026"),
    legacyBefore,
  );
  console.log(
    "presidential PostgreSQL: six categories, existing-player backfill, new-player pools, atomic +24/+8/−16/−16, exact replay, conflict rejection, category isolation, restart and unchanged election history passed",
  );
} finally {
  await store?.close();
  await old.close().catch(() => {});
}
