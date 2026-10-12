// Tab Trim background worker.
//
// Tracks the order in which tabs across every normal window were last touched,
// and enforces two limits whenever a tab opens or navigates:
//   * at most `maxTabs` open tabs (closing the least recently touched), and
//   * at most `maxDuplicates` tabs showing the same URL (closing the oldest copy).
// When every tab of a window has to go, the whole window is closed.

import { packageFingerprint } from './lib/fingerprint.js';
import { planClosures, tabUrl } from './lib/policy.js';
import { emptyRecency, forget, reconcile, replace, stampOf, touch } from './lib/recency.js';
import { normalizeSettings } from './lib/settings.js';

const RECENCY_KEY = 'recency';
const FINGERPRINT_KEY = 'packageFingerprint';
const UPDATE_ALARM = 'tab-trim-update-check';

// Every event is handled strictly in arrival order. Chrome fires tab events
// concurrently; serialising them keeps the recency order and the closing
// decisions consistent with each other.
let queue = Promise.resolve();
function enqueue(task) {
  queue = queue.then(task).catch((error) => console.error('tab-trim:', error));
  return queue;
}

async function normalTabs() {
  return chrome.tabs.query({ windowType: 'normal' });
}

// Recency lives in memory and is mirrored to session storage so a service
// worker restart keeps the order. Session storage is cleared when the browser
// or the extension restarts; unknown tabs then rank by Chrome's lastAccessed.
let recency = null;
async function loadRecency() {
  if (recency === null) {
    const stored = (await chrome.storage.session.get(RECENCY_KEY))[RECENCY_KEY];
    recency = reconcile(stored ?? emptyRecency(), await normalTabs());
  }
  return recency;
}

async function saveRecency(next) {
  recency = next;
  await chrome.storage.session.set({ [RECENCY_KEY]: next });
}

async function readSettings() {
  return normalizeSettings(await chrome.storage.sync.get(null));
}

async function enforce(triggerTabId, enforceTabLimit) {
  const tabs = await normalTabs();
  const current = reconcile(await loadRecency(), tabs);
  await saveRecency(current);
  const plan = planClosures({
    tabs,
    recency: current,
    settings: await readSettings(),
    triggerTabId,
    enforceTabLimit,
  });
  // Close one at a time so a tab the user closed meanwhile cannot stop the rest.
  for (const windowId of plan.windowIds) {
    await chrome.windows.remove(windowId).catch((error) => console.warn('tab-trim: window', windowId, error));
  }
  for (const tabId of plan.tabIds) {
    await chrome.tabs.remove(tabId).catch((error) => console.warn('tab-trim: tab', tabId, error));
  }
}

async function touchTab(tabId) {
  await saveRecency(touch(await loadRecency(), tabId, Date.now()));
}

function onTabCreated(tab) {
  return enqueue(async () => {
    await touchTab(tab.id);
    await enforce(tab.id, true);
  });
}

function onTabUpdated(tabId, changeInfo) {
  if (changeInfo.url === undefined) {
    return queue;
  }
  return enqueue(() => enforce(tabId, false));
}

function onTabActivated({ tabId }) {
  return enqueue(() => touchTab(tabId));
}

function onWindowFocused(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    return queue;
  }
  return enqueue(async () => {
    const [active] = await chrome.tabs.query({ windowId, active: true, windowType: 'normal' });
    if (active) {
      await touchTab(active.id);
    }
  });
}

function onTabRemoved(tabId) {
  return enqueue(async () => saveRecency(forget(await loadRecency(), tabId)));
}

function onTabReplaced(addedTabId, removedTabId) {
  return enqueue(async () => saveRecency(replace(await loadRecency(), addedTabId, removedTabId)));
}

// --- Self-update for unpacked installs ------------------------------------
// Chrome reads an unpacked extension's files from its folder. When the folder
// changes (a new release landed in the checkout), reload so Chrome runs it.

function readPackageFile(path) {
  return fetch(chrome.runtime.getURL(path), { cache: 'no-store' }).then((response) => {
    if (!response.ok) {
      throw new Error(`${path}: HTTP ${response.status}`);
    }
    return response.arrayBuffer();
  });
}

async function isUnpacked() {
  return (await chrome.management.getSelf()).installType === 'development';
}

async function recordStartupFingerprint() {
  const stored = (await chrome.storage.session.get(FINGERPRINT_KEY))[FINGERPRINT_KEY];
  if (stored === undefined) {
    await chrome.storage.session.set({ [FINGERPRINT_KEY]: await packageFingerprint(readPackageFile) });
  }
}

// Resolves to true when the files on disk differ from the running version (in
// which case the extension reloads itself).
async function checkForUpdate() {
  if (!(await isUnpacked())) {
    return false;
  }
  const stored = (await chrome.storage.session.get(FINGERPRINT_KEY))[FINGERPRINT_KEY];
  const current = await packageFingerprint(readPackageFile);
  if (stored === undefined) {
    await chrome.storage.session.set({ [FINGERPRINT_KEY]: current });
    return false;
  }
  if (stored === current) {
    return false;
  }
  console.info('tab-trim: extension files changed on disk; reloading');
  setTimeout(() => chrome.runtime.reload(), 0);
  return true;
}

async function ensureUpdateAlarm() {
  if (!(await isUnpacked())) {
    return;
  }
  await recordStartupFingerprint();
  if (!(await chrome.alarms.get(UPDATE_ALARM))) {
    await chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 1 });
  }
}

chrome.tabs.onCreated.addListener(onTabCreated);
chrome.tabs.onUpdated.addListener(onTabUpdated);
chrome.tabs.onActivated.addListener(onTabActivated);
chrome.tabs.onRemoved.addListener(onTabRemoved);
chrome.tabs.onReplaced.addListener(onTabReplaced);
chrome.windows.onFocusChanged.addListener(onWindowFocused);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) {
    enqueue(checkForUpdate);
  }
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

enqueue(ensureUpdateAlarm);

// Test hooks: the integration and BDD suites drive and observe the worker
// through these. They expose existing behaviour only.
async function recencyOrder() {
  const state = await loadRecency();
  const tabs = await normalTabs();
  return [...tabs]
    .sort((a, b) => stampOf(state, a) - stampOf(state, b) || a.id - b.id)
    .map((tab) => tabUrl(tab));
}

globalThis.tabTrim = Object.freeze({
  // Resolves once every event received so far has been fully handled.
  idle: () => enqueue(() => undefined),
  checkForUpdate: () => enqueue(checkForUpdate),
  // Headless Chrome never fires windows.onFocusChanged when focus moves between
  // existing windows, so tests deliver that event to the real listener here.
  windowFocused: (windowId) => onWindowFocused(windowId),
  // URLs of all open tabs, least recently touched first.
  recencyOrder: () => enqueue(recencyOrder),
});
