import assert from 'node:assert/strict';
import { test } from 'node:test';

import { emptyRecency, forget, reconcile, replace, stampOf, touch } from '../../extension/lib/recency.js';

test('touch stamps strictly increase even within the same millisecond', () => {
  let state = emptyRecency();
  state = touch(state, 1, 500);
  state = touch(state, 2, 500);
  state = touch(state, 3, 400);
  assert.ok(state.stamps[1] < state.stamps[2]);
  assert.ok(state.stamps[2] < state.stamps[3]);
});

test('touching an old tab again makes it the newest', () => {
  let state = emptyRecency();
  state = touch(state, 1, 100);
  state = touch(state, 2, 200);
  state = touch(state, 1, 300);
  assert.ok(state.stamps[1] > state.stamps[2]);
});

test('touch does not mutate its input', () => {
  const before = touch(emptyRecency(), 1, 100);
  const snapshot = structuredClone(before);
  touch(before, 2, 200);
  assert.deepEqual(before, snapshot);
});

test('forget drops a tab', () => {
  const state = forget(touch(emptyRecency(), 1, 100), 1);
  assert.deepEqual(state.stamps, {});
  assert.equal(forget(state, 42), state);
});

test('replace hands the old tab its place to the new tab', () => {
  let state = touch(emptyRecency(), 1, 100);
  state = touch(state, 2, 200);
  state = replace(state, 9, 1);
  assert.equal(state.stamps[9], 100);
  assert.equal(state.stamps[1], undefined);
});

test('reconcile keeps known tabs, drops closed ones and seeds unknown ones from lastAccessed', () => {
  let state = touch(emptyRecency(), 1, 100);
  state = touch(state, 2, 200);
  const next = reconcile(state, [
    { id: 1, lastAccessed: 999 },
    { id: 3, lastAccessed: 5000 },
  ]);
  assert.deepEqual(next.stamps, { 1: 100, 3: 5000 });
  assert.equal(next.lastStamp, 5000);
  assert.equal(stampOf(next, { id: 4, lastAccessed: 7 }), 7);
  assert.equal(stampOf(next, { id: 5 }), 0);
});
