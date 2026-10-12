// Recency bookkeeping: when was each tab last touched (opened, switched to, or
// brought forward by focusing its window)? Stamps are epoch milliseconds so tabs
// we have not seen yet can be ranked by Chrome's own `tab.lastAccessed`.
// Every function is pure: it returns a new state and never mutates its input.

export function emptyRecency() {
  return { stamps: {}, lastStamp: 0 };
}

// Mark a tab as the most recently used. Stamps strictly increase so two touches
// in the same millisecond still have a well-defined order.
export function touch(state, tabId, now) {
  const stamp = Math.max(now, state.lastStamp + 1);
  return { stamps: { ...state.stamps, [tabId]: stamp }, lastStamp: stamp };
}

export function forget(state, tabId) {
  if (!(tabId in state.stamps)) {
    return state;
  }
  const stamps = { ...state.stamps };
  delete stamps[tabId];
  return { stamps, lastStamp: state.lastStamp };
}

// Chrome swapped one tab for another (prerender / instant navigation). The new
// tab inherits the old one's place in the order.
export function replace(state, addedTabId, removedTabId) {
  const stamps = { ...state.stamps };
  if (removedTabId in stamps) {
    stamps[addedTabId] = stamps[removedTabId];
    delete stamps[removedTabId];
  }
  return { stamps, lastStamp: state.lastStamp };
}

// Align the bookkeeping with the tabs that actually exist: drop stamps for tabs
// that are gone and rank unknown tabs by Chrome's lastAccessed time.
export function reconcile(state, tabs) {
  const stamps = {};
  let lastStamp = state.lastStamp;
  for (const tab of tabs) {
    const stamp = state.stamps[tab.id] ?? tab.lastAccessed ?? 0;
    stamps[tab.id] = stamp;
    lastStamp = Math.max(lastStamp, stamp);
  }
  return { stamps, lastStamp };
}

export function stampOf(state, tab) {
  return state.stamps[tab.id] ?? tab.lastAccessed ?? 0;
}
