// The two closing rules, as pure functions over a snapshot of the open tabs.
//
//  * Tab limit: when a tab is opened and more than `maxTabs` tabs are open across
//    all windows, close the least recently touched tabs until the limit holds.
//  * Duplicate limit: when a tab opens or navigates to a URL that is now open in
//    more than `maxDuplicates` tabs, close the oldest other copies.
//
// The tab that triggered the check is never closed. A window whose every tab is
// being closed is closed as a whole window.

import { stampOf } from './recency.js';

// Placeholder pages are not "a URL you opened"; a fresh blank tab is just on its
// way somewhere else, so it never counts as a duplicate.
const PLACEHOLDER_URLS = new Set([
  '',
  'about:blank',
  'chrome://newtab/',
  'chrome://new-tab-page/',
  'chrome-search://local-ntp/local-ntp.html',
]);

export function tabUrl(tab) {
  return tab.url || tab.pendingUrl || '';
}

export function isDuplicateCandidate(url) {
  return !PLACEHOLDER_URLS.has(url);
}

function oldestFirst(tabs, recency) {
  return [...tabs].sort((a, b) => stampOf(recency, a) - stampOf(recency, b) || a.id - b.id);
}

function duplicateVictims(tabs, trigger, recency, maxDuplicates) {
  const url = tabUrl(trigger);
  if (!isDuplicateCandidate(url)) {
    return [];
  }
  const others = tabs.filter((tab) => tab.id !== trigger.id && tabUrl(tab) === url);
  const excess = others.length + 1 - maxDuplicates;
  return excess > 0 ? oldestFirst(others, recency).slice(0, excess) : [];
}

function tabLimitVictims(tabs, trigger, recency, maxTabs, alreadyClosing) {
  const excess = tabs.length - alreadyClosing.size - maxTabs;
  if (excess <= 0) {
    return [];
  }
  const eligible = tabs.filter((tab) => tab.id !== trigger.id && !alreadyClosing.has(tab.id));
  return oldestFirst(eligible, recency).slice(0, excess);
}

// Split the victims into whole windows (every tab in the window is closing) and
// individual tabs.
function groupByWindow(tabs, victimIds) {
  const windows = new Map();
  for (const tab of tabs) {
    const entry = windows.get(tab.windowId) ?? { total: 0, closing: [] };
    entry.total += 1;
    if (victimIds.has(tab.id)) {
      entry.closing.push(tab.id);
    }
    windows.set(tab.windowId, entry);
  }
  const windowIds = [];
  const tabIds = [];
  for (const [windowId, entry] of windows) {
    if (entry.closing.length === 0) {
      continue;
    }
    if (entry.closing.length === entry.total) {
      windowIds.push(windowId);
    } else {
      tabIds.push(...entry.closing);
    }
  }
  return { tabIds: tabIds.sort((a, b) => a - b), windowIds: windowIds.sort((a, b) => a - b) };
}

// tabs: every tab in every normal window ({ id, windowId, url, pendingUrl, lastAccessed }).
// recency: state from recency.js. settings: { maxTabs, maxDuplicates }.
// triggerTabId: the tab that was just opened or navigated.
// enforceTabLimit: true when a tab was opened (the tab limit only applies then).
export function planClosures({ tabs, recency, settings, triggerTabId, enforceTabLimit }) {
  const trigger = tabs.find((tab) => tab.id === triggerTabId);
  if (!trigger) {
    return { tabIds: [], windowIds: [] };
  }
  const victims = new Set(
    duplicateVictims(tabs, trigger, recency, settings.maxDuplicates).map((tab) => tab.id),
  );
  if (enforceTabLimit) {
    for (const tab of tabLimitVictims(tabs, trigger, recency, settings.maxTabs, victims)) {
      victims.add(tab.id);
    }
  }
  return groupByWindow(tabs, victims);
}
