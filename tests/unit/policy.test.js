import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planClosures } from '../../extension/lib/policy.js';
import { emptyRecency, touch } from '../../extension/lib/recency.js';

// Build tabs and a recency state where tabs are touched in the listed order
// (first = least recently used).
function scenario(specs) {
  let recency = emptyRecency();
  const tabs = specs.map(([id, windowId, url], index) => {
    recency = touch(recency, id, 1000 + index);
    return { id, windowId, url };
  });
  return { tabs, recency };
}

const limits = { maxTabs: 20, maxDuplicates: 2 };

test('nothing closes while under both limits', () => {
  const { tabs, recency } = scenario([
    [1, 10, 'https://a.test/'],
    [2, 10, 'https://a.test/'],
    [3, 11, 'https://b.test/'],
  ]);
  const plan = planClosures({ tabs, recency, settings: limits, triggerTabId: 3, enforceTabLimit: true });
  assert.deepEqual(plan, { tabIds: [], windowIds: [] });
});

test('opening one tab past the limit closes the least recently used tab across windows', () => {
  const { tabs, recency } = scenario([
    [5, 11, 'https://e.test/'],
    [1, 10, 'https://a.test/'],
    [2, 10, 'https://b.test/'],
    [3, 11, 'https://c.test/'],
  ]);
  const plan = planClosures({
    tabs,
    recency,
    settings: { maxTabs: 3, maxDuplicates: 2 },
    triggerTabId: 3,
    enforceTabLimit: true,
  });
  assert.deepEqual(plan, { tabIds: [5], windowIds: [] });
});

test('closing the only tab in a window closes the window instead', () => {
  const { tabs, recency } = scenario([
    [7, 12, 'https://lonely.test/'],
    [1, 10, 'https://a.test/'],
    [2, 10, 'https://b.test/'],
  ]);
  const plan = planClosures({
    tabs,
    recency,
    settings: { maxTabs: 2, maxDuplicates: 2 },
    triggerTabId: 2,
    enforceTabLimit: true,
  });
  assert.deepEqual(plan, { tabIds: [], windowIds: [12] });
});

test('the tab limit only applies when a tab is opened', () => {
  const { tabs, recency } = scenario([
    [1, 10, 'https://a.test/'],
    [2, 10, 'https://b.test/'],
    [3, 10, 'https://c.test/'],
  ]);
  const plan = planClosures({
    tabs,
    recency,
    settings: { maxTabs: 2, maxDuplicates: 2 },
    triggerTabId: 3,
    enforceTabLimit: false,
  });
  assert.deepEqual(plan, { tabIds: [], windowIds: [] });
});

test('lowering the limit closes every excess tab, oldest first', () => {
  const { tabs, recency } = scenario([
    [1, 10, 'https://a.test/'],
    [2, 10, 'https://b.test/'],
    [3, 10, 'https://c.test/'],
    [4, 10, 'https://d.test/'],
    [5, 10, 'https://e.test/'],
  ]);
  const plan = planClosures({
    tabs,
    recency,
    settings: { maxTabs: 2, maxDuplicates: 2 },
    triggerTabId: 5,
    enforceTabLimit: true,
  });
  assert.deepEqual(plan, { tabIds: [1, 2, 3], windowIds: [] });
});

test('a third copy of a URL closes the oldest copy, wherever it is', () => {
  const { tabs, recency } = scenario([
    [1, 10, 'https://git.test/status'],
    [2, 10, 'https://other.test/'],
    [3, 11, 'https://git.test/status'],
    [4, 11, 'https://git.test/status'],
  ]);
  const plan = planClosures({ tabs, recency, settings: limits, triggerTabId: 4, enforceTabLimit: true });
  assert.deepEqual(plan, { tabIds: [1], windowIds: [] });
});

test('a duplicate that is alone in its window closes its window', () => {
  const { tabs, recency } = scenario([
    [1, 12, 'https://git.test/status'],
    [3, 11, 'https://git.test/status'],
    [4, 11, 'https://git.test/status'],
  ]);
  const plan = planClosures({ tabs, recency, settings: limits, triggerTabId: 4, enforceTabLimit: true });
  assert.deepEqual(plan, { tabIds: [], windowIds: [12] });
});

test('the triggering tab survives even when it is the oldest copy', () => {
  const { tabs, recency } = scenario([
    [4, 11, 'https://git.test/status'],
    [1, 10, 'https://git.test/status'],
    [3, 10, 'https://git.test/status'],
  ]);
  const plan = planClosures({ tabs, recency, settings: limits, triggerTabId: 4, enforceTabLimit: false });
  assert.deepEqual(plan, { tabIds: [1], windowIds: [] });
});

test('the duplicate limit is configurable', () => {
  const { tabs, recency } = scenario([
    [1, 10, 'https://x.test/'],
    [2, 10, 'https://x.test/'],
    [3, 10, 'https://x.test/'],
  ]);
  const plan = planClosures({
    tabs,
    recency,
    settings: { maxTabs: 20, maxDuplicates: 1 },
    triggerTabId: 3,
    enforceTabLimit: false,
  });
  assert.deepEqual(plan, { tabIds: [1, 2], windowIds: [] });
});

test('URLs that differ only by fragment or query are different URLs', () => {
  const { tabs, recency } = scenario([
    [1, 10, 'https://x.test/page'],
    [2, 10, 'https://x.test/page#top'],
    [3, 10, 'https://x.test/page?a=1'],
  ]);
  const plan = planClosures({ tabs, recency, settings: { maxTabs: 20, maxDuplicates: 1 }, triggerTabId: 3, enforceTabLimit: false });
  assert.deepEqual(plan, { tabIds: [], windowIds: [] });
});

test('blank and new-tab pages never count as duplicates', () => {
  for (const url of ['', 'about:blank', 'chrome://newtab/']) {
    const { tabs, recency } = scenario([
      [1, 10, url],
      [2, 10, url],
      [3, 10, url],
    ]);
    const plan = planClosures({ tabs, recency, settings: limits, triggerTabId: 3, enforceTabLimit: false });
    assert.deepEqual(plan, { tabIds: [], windowIds: [] }, `url ${JSON.stringify(url)}`);
  }
});

test('a tab still loading is matched by its pending URL', () => {
  const { tabs, recency } = scenario([
    [1, 10, 'https://git.test/status'],
    [2, 10, 'https://git.test/status'],
  ]);
  tabs.push({ id: 3, windowId: 10, url: '', pendingUrl: 'https://git.test/status' });
  const plan = planClosures({ tabs, recency: touch(recency, 3, 5000), settings: limits, triggerTabId: 3, enforceTabLimit: true });
  assert.deepEqual(plan, { tabIds: [1], windowIds: [] });
});

test('duplicate closures count toward the tab limit', () => {
  const { tabs, recency } = scenario([
    [1, 10, 'https://other.test/'],
    [2, 10, 'https://dup.test/'],
    [3, 10, 'https://dup.test/'],
    [4, 10, 'https://dup.test/'],
  ]);
  const plan = planClosures({
    tabs,
    recency,
    settings: { maxTabs: 3, maxDuplicates: 2 },
    triggerTabId: 4,
    enforceTabLimit: true,
  });
  assert.deepEqual(plan, { tabIds: [2], windowIds: [] });
});

test('tabs never seen by the extension rank by Chrome lastAccessed', () => {
  const tabs = [
    { id: 1, windowId: 10, url: 'https://a.test/', lastAccessed: 3000 },
    { id: 2, windowId: 10, url: 'https://b.test/', lastAccessed: 1000 },
    { id: 3, windowId: 10, url: 'https://c.test/', lastAccessed: 2000 },
  ];
  const plan = planClosures({
    tabs,
    recency: emptyRecency(),
    settings: { maxTabs: 2, maxDuplicates: 2 },
    triggerTabId: 1,
    enforceTabLimit: true,
  });
  assert.deepEqual(plan, { tabIds: [2], windowIds: [] });
});

test('an unknown trigger tab plans nothing', () => {
  const { tabs, recency } = scenario([[1, 10, 'https://a.test/']]);
  const plan = planClosures({ tabs, recency, settings: { maxTabs: 0, maxDuplicates: 1 }, triggerTabId: 99, enforceTabLimit: true });
  assert.deepEqual(plan, { tabIds: [], windowIds: [] });
});
