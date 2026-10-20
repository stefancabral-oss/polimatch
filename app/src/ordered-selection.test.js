import test from 'node:test';
import assert from 'node:assert/strict';
import { selectOrderedCard } from './ordered-selection.js';
test('first tap drafts, retap clears, second distinct tap commits exactly two in order', () => {
  const ids=['a','b','c','d'];
  assert.deepEqual(selectOrderedCard([], 'a', ids), {selectionIds:['a'],complete:false});
  assert.deepEqual(selectOrderedCard(['a'], 'a', ids), {selectionIds:[],complete:false});
  assert.deepEqual(selectOrderedCard(['a'], 'b', ids), {selectionIds:['a','b'],complete:true});
  assert.deepEqual(selectOrderedCard(['a','b'], 'c', ids), {selectionIds:['a','b'],complete:false});
  assert.deepEqual(selectOrderedCard([], 'x', ids), {selectionIds:[],complete:false});
});
