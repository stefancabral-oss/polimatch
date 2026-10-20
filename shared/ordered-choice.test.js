import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedChoiceComparisons, ORDERED_PAIR_POINTS } from './ordered-choice.js';
test('ordered choices award +24/+8/-16/-16 regardless of table order', () => {
  for (const candidates of [['a','b','c','d'], ['d','b','a','c']]) {
    const pairs = orderedChoiceComparisons(candidates, ['a','b']);
    const scores = Object.fromEntries(candidates.map(id => [id,0]));
    for (const p of pairs) { scores[p.winnerId] += ORDERED_PAIR_POINTS; scores[p.loserId] -= ORDERED_PAIR_POINTS; }
    assert.equal(pairs.length,5);
    assert.deepEqual(scores, Object.fromEntries(candidates.map(id => [id,{a:24,b:8,c:-16,d:-16}[id]])));
    assert.ok(!pairs.some(p => p.winnerId === 'c' || p.winnerId === 'd'));
  }
});
test('malformed, duplicate, foreign and mismatched selections are rejected', () => {
  for (const ids of [null, [], ['a'], ['a','a'], ['a','x'], ['a','b','c'], ['a',null]]) {
    assert.throws(() => orderedChoiceComparisons(['a','b','c','d'], ids));
  }
  assert.throws(() => orderedChoiceComparisons(['a','b','c','d'], ['b','a'], 'a'));
});
