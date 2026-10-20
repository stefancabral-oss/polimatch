import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import CATALOG from '../../shared/elections-2026.json' with {type:'json'};
import {createApprovedTestRegistry} from '../test-support/editorial-fixtures.js';
import {createTopicStore} from '../src/topic-store.js';
import {projectVoteResponseV2} from '../src/aggregate-publication.js';

// Never point this smoke at production; CI provides a disposable PostgreSQL database.
const connection=process.env.DATABASE_URL;
if (!connection) throw new Error('DATABASE_URL is required (disposable test database)');
const store=createTopicStore(connection,{candidateRegistry:createApprovedTestRegistry(CATALOG.map(p=>p.id)),clock:()=>new Date('2033-09-17T15:00:00Z')});
const audit=new pg.Pool({connectionString:connection});
await store.init();
const player=await store.createPlayer({networkHash:'1'.repeat(64)});
const other=await store.createPlayer({networkHash:'2'.repeat(64)});
const ids=['lula','jair-bolsonaro','anitta','neymar-jr'];
const request={topicId:'eleicoes-2026',winnerId:ids[0],selectionIds:ids.slice(0,2),candidateIds:ids,roundId:randomUUID(),recoveryKey:player.recoveryKey,playerVersion:0};
try {
  const before=await store.playerRanking(player.recoveryKey,request.topicId);
  const [created,replay]=await Promise.all([store.roundVote(request),store.roundVote(request)]);
  assert.equal(created.round.status,'created'); assert.equal(replay.round.status,'alreadyProcessed');
  assert.equal(created.round.comparisons,5); assert.equal(created.player.duels,1);
  assert.deepEqual(created.round.personalFeedback,replay.round.personalFeedback);
  assert.deepEqual(created.round.selectionIds,ids.slice(0,2));
  const expected=[24,8,-16,-16];
  for (const [index,id] of ids.entries()) {
    const a=before.ranking.find(r=>r.id===id), b=created.player.ranking.find(r=>r.id===id);
    assert.equal(b.elo-a.elo,expected[index]);
    assert.equal(created.round.personalFeedback.outcomes.find(r=>r.id===id).delta,expected[index]);
  }
  const rows=await audit.query('SELECT winner_id,loser_id,winner_delta,loser_delta FROM votes WHERE round_id=$1',[request.roundId]);
  assert.equal(rows.rowCount,5); assert.ok(rows.rows.every(r=>r.winner_delta===8 && r.loser_delta===-8));
  await assert.rejects(store.roundVote({...request,selectionIds:[ids[0],ids[2]]}),e=>e.code==='ROUND_REPLAY_DIVERGENT');
  await assert.rejects(store.roundVote({...request,selectionIds:undefined}),e=>e.code==='ROUND_REPLAY_DIVERGENT');
  await assert.rejects(store.roundVote({...request,recoveryKey:other.recoveryKey}),e=>e.code==='ROUND_REPLAY_DIVERGENT');
  for (const selectionIds of [[],[ids[0]],[ids[0],ids[0]],[ids[0],'x'],null]) {
    await assert.rejects(store.roundVote({...request,roundId:randomUUID(),selectionIds,playerVersion:1}),e=>e.code==='ORDERED_CHOICE_INVALID');
  }
  assert.equal((await store.playerRanking(player.recoveryKey,request.topicId)).duels,1);
  const projected=projectVoteResponseV2(created);
  assert.deepEqual(projected.vote.selectionIds,request.selectionIds);
  assert.equal(projected.vote.personalFeedback.outcomes.find(r=>r.id===ids[1]).selectionOrder,2);
  // Legacy single-card receipt remains readable after migration and restart.
  const legacy=await store.roundVote({...request,roundId:randomUUID(),selectionIds:undefined,playerVersion:1});
  assert.equal(legacy.round.comparisons,3);
  await store.init();
  assert.equal((await store.roundVote(request)).round.status,'alreadyProcessed');
  let session=await store.dailySession(other.recoveryKey,request.topicId);
  let version=0;
  for (let slot=1;slot<=10;slot++) {
    await audit.query("DELETE FROM abuse_quota_counters WHERE scope='player-round-minute'");
    const selectionIds=session.round.candidateIds.slice(0,2);
    const dailyRequest={topicId:request.topicId,editionId:session.edition.id,slot,answerId:randomUUID(),winnerId:selectionIds[0],selectionIds,recoveryKey:other.recoveryKey,playerVersion:version};
    const result=await store.dailyVote(dailyRequest);
    assert.equal(result.round.comparisons,5);
    assert.equal(result.dailySession.progress.answered,slot);
    assert.deepEqual(result.dailySession.answers[slot-1].selectionIds,selectionIds);
    const repeat=await store.dailyVote(dailyRequest);
    assert.equal(repeat.round.status,'alreadyProcessed');
    await assert.rejects(store.dailyVote({...dailyRequest,selectionIds:[selectionIds[0],session.round.candidateIds[2]]}),e=>e.code==='ROUND_REPLAY_DIVERGENT');
    assert.deepEqual(projectVoteResponseV2(result).dailySession.answers[slot-1].selectionIds,selectionIds);
    version=result.player.version; session=result.dailySession;
  }
  assert.equal(session.status,'completed'); assert.equal(version,10);
  assert.equal((await store.dailySession(other.recoveryKey,request.topicId)).progress.answered,10);
  console.log('ordered choices PostgreSQL: atomic scoring, 5 audit pairs, replay/conflict, restart, legacy, 10 daily rounds and receipts passed');
} finally { await store.close(); await audit.end(); }
