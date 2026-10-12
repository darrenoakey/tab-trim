// Integration tests against a real headless Chromium running the extension.
// These cover worker behaviour that a person cannot drive in a headless
// browser (window focus) or that is invisible in the page UI (worker restarts,
// self-update from disk).

import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile, appendFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import { EXTENSION_DIR, launchBrowser } from '../support/browser.js';
import { startSite } from '../support/site.js';

let site;
before(async () => {
  site = await startSite();
});
after(async () => {
  await site.close();
});

async function openTabsFrom(browser, start, paths) {
  const pages = [];
  for (const target of paths) {
    pages.push(await browser.clickLinkToNewTab(start, target));
    await browser.settle();
  }
  return pages;
}

async function recencyOrder(browser) {
  const urls = await browser.evaluateInWorker(() => globalThis.tabTrim.recencyOrder());
  return urls.map(site.pathOf);
}

describe('with the packaged extension', { timeout: 60000 }, () => {
  let browser;
  before(async () => {
    browser = await launchBrowser();
  });
  after(async () => {
    await browser.close();
  });

  test('focusing another window makes its active tab the most recent', async () => {
    const home = await browser.reset();
    await home.goto(site.url('/home'));
    const lonely = await browser.shiftClickLink(home, '/wiki');
    await browser.settle();
    await openTabsFrom(browser, home, ['/docs', '/mail']);
    // Clicking the /mail link on /home switched back to /home first.
    assert.deepEqual(await recencyOrder(browser), ['/wiki', '/docs', '/home', '/mail']);

    const lonelyWindow = await browser.evaluateInWorker(
      async (url) => (await chrome.tabs.query({ url })).at(0).windowId,
      lonely.url(),
    );
    await browser.evaluateInWorker((id) => globalThis.tabTrim.windowFocused(id), lonelyWindow);
    assert.deepEqual(await recencyOrder(browser), ['/docs', '/home', '/mail', '/wiki']);

    // Unfocusing every window (switching to another app) changes nothing.
    await browser.evaluateInWorker(() => globalThis.tabTrim.windowFocused(chrome.windows.WINDOW_ID_NONE));
    assert.deepEqual(await recencyOrder(browser), ['/docs', '/home', '/mail', '/wiki']);

    // With a limit of 4, the next tab closes /docs, not the refocused /wiki.
    await browser.evaluateInWorker(() => chrome.storage.sync.set({ maxTabs: 4 }));
    await openTabsFrom(browser, home, ['/news']);
    assert.deepEqual(await recencyOrder(browser), ['/mail', '/wiki', '/home', '/news']);
  });

  test('the recency order survives the service worker being stopped', async () => {
    const home = await browser.reset();
    await home.goto(site.url('/home'));
    await openTabsFrom(browser, home, ['/docs', '/mail']);
    await home.bringToFront();
    await browser.settle();
    const before = await recencyOrder(browser);
    assert.deepEqual(before, ['/docs', '/mail', '/home']);

    const startedAt = () => browser.evaluateInWorker(() => performance.timeOrigin);
    const firstStart = await startedAt();
    await browser.stopWorker();

    // Opening a tab wakes a fresh worker, which must still know the order.
    await browser.clickLinkToNewTab(home, '/news');
    await browser.settle();
    assert.ok((await startedAt()) > firstStart, 'a new service worker handled the tab');
    assert.deepEqual(await recencyOrder(browser), ['/docs', '/mail', '/home', '/news']);
  });

  test('a new tab that is also a third copy closes only the oldest copy', async () => {
    const home = await browser.reset();
    await home.goto(site.url('/home'));
    await openTabsFrom(browser, home, ['/git/status', '/git/status', '/git/status']);
    const paths = browser.openPages().map((page) => site.pathOf(page.url())).sort();
    assert.deepEqual(paths, ['/git/status', '/git/status', '/home']);
  });
});

describe('an unpacked install whose files change on disk', { timeout: 60000 }, () => {
  let browser;
  let extensionDir;
  before(async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'tab-trim-ext-'));
    extensionDir = path.join(parent, 'extension');
    await cp(EXTENSION_DIR, extensionDir, { recursive: true });
    browser = await launchBrowser({ extensionDir });
  });
  after(async () => {
    await browser.close();
    await rm(path.dirname(extensionDir), { recursive: true, force: true });
  });

  test('reloads itself to run the new files, and keeps enforcing afterwards', async () => {
    const home = await browser.reset();
    await home.goto(site.url('/home'));
    const oldWorker = await browser.worker();
    const firstStart = await oldWorker.evaluate(() => performance.timeOrigin);
    assert.equal(await oldWorker.evaluate(() => globalThis.tabTrim.checkForUpdate()), false);

    await appendFile(path.join(extensionDir, 'options.css'), '\n/* changed on disk */\n');
    await writeFile(path.join(extensionDir, 'marker.txt'), 'not part of the package');
    const restarted = browser.context.waitForEvent('serviceworker');
    assert.equal(await oldWorker.evaluate(() => globalThis.tabTrim.checkForUpdate()), true);
    await restarted;

    const newWorker = await browser.worker();
    assert.ok((await newWorker.evaluate(() => performance.timeOrigin)) > firstStart, 'extension restarted');
    assert.equal(await newWorker.evaluate(() => globalThis.tabTrim.checkForUpdate()), false);
    const served = await newWorker.evaluate(async () => (await fetch(chrome.runtime.getURL('options.css'))).text());
    assert.match(served, /changed on disk/);

    // Reloading an unpacked extension closes its own pages but no web pages.
    const pages = browser.openPages().filter((page) => page.url().startsWith(site.origin));
    assert.ok(pages.length >= 1);
    const fresh = pages.find((page) => site.pathOf(page.url()) === '/home');
    await openTabsFrom(browser, fresh, ['/news', '/news', '/news']);
    const newsTabs = browser.openPages().filter((page) => site.pathOf(page.url()) === '/news');
    assert.equal(newsTabs.length, 2);
  });
});
