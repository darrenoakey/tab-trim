// Launch a real (headless) Chromium with Tab Trim loaded unpacked, plus helpers
// to act on it the way a person would and to observe the result.

import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

export const EXTENSION_DIR = fileURLToPath(new URL('../../extension/', import.meta.url));

const SETTLE_TIMEOUT_MS = 5000;

export async function launchBrowser({ extensionDir = EXTENSION_DIR } = {}) {
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'tab-trim-profile-'));
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
  });
  const firstWorker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const browser = new Browser(context, firstWorker, profileDir);
  await browser.enableDeveloperMode();
  return browser;
}

class Browser {
  constructor(context, firstWorker, profileDir) {
    this.context = context;
    this.extensionId = new URL(firstWorker.url()).host;
    this.profileDir = profileDir;
    this.liveWorker = null;
    this.track(firstWorker);
    context.on('serviceworker', (worker) => this.track(worker));
  }

  track(worker) {
    if (!worker.url().includes(this.extensionId)) {
      return;
    }
    this.liveWorker = worker;
    worker.on('close', () => {
      if (this.liveWorker === worker) {
        this.liveWorker = null;
      }
    });
  }

  // Chrome only lets an unpacked extension reload itself while Developer mode
  // is on, exactly as in a real profile where it was installed with "Load
  // unpacked". Flip the same toggle a person would.
  async enableDeveloperMode() {
    const page = this.context.pages()[0] ?? (await this.context.newPage());
    await page.goto('chrome://extensions');
    const toggle = page.locator('#devMode');
    if ((await toggle.getAttribute('aria-pressed')) !== 'true') {
      await toggle.click();
    }
    await page.locator('#devMode[aria-pressed="true"]').waitFor();
    await page.goto('about:blank');
  }

  optionsUrl() {
    return `chrome-extension://${this.extensionId}/options.html`;
  }

  // The extension's running service worker (a new one after a reload/restart).
  async worker() {
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    for (;;) {
      const live = this.liveWorker;
      if (live && (await live.evaluate(() => globalThis.tabTrim !== undefined).catch(() => false))) {
        return live;
      }
      if (Date.now() > deadline) {
        throw new Error('Tab Trim service worker is not running');
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  // Stop the extension's service worker, as Chrome does after ~30s idle. The
  // next extension event starts a fresh worker; Playwright's existing handle
  // then talks to that new worker.
  async stopWorker() {
    const cdp = await this.context.browser().newBrowserCDPSession();
    try {
      const workerTargets = async () =>
        (await cdp.send('Target.getTargets')).targetInfos.filter(
          (target) => target.type === 'service_worker' && target.url.includes(this.extensionId),
        );
      for (const target of await workerTargets()) {
        await cdp.send('Target.closeTarget', { targetId: target.targetId });
      }
      const deadline = Date.now() + SETTLE_TIMEOUT_MS;
      while ((await workerTargets()).length > 0) {
        if (Date.now() > deadline) {
          throw new Error('service worker did not stop');
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally {
      await cdp.detach();
    }
  }

  async evaluateInWorker(fn, arg) {
    return (await this.worker()).evaluate(fn, arg);
  }

  // Wait until the extension has handled every event received so far, and the
  // browser has finished closing whatever it decided to close.
  async settle() {
    await this.evaluateInWorker(() => globalThis.tabTrim.idle());
    const expected = await this.evaluateInWorker(async () => (await chrome.tabs.query({})).length);
    const deadline = Date.now() + SETTLE_TIMEOUT_MS;
    while (this.context.pages().length !== expected && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  // Start every scenario from one window holding one blank tab and default settings.
  async reset() {
    await this.evaluateInWorker(() => chrome.storage.sync.clear());
    const keep = await this.openWindowAt('about:blank');
    for (const page of this.context.pages()) {
      if (page !== keep) {
        await page.close();
      }
    }
    await this.settle();
    return keep;
  }

  // Open a URL in a brand new window, as with File > New Window and typing it.
  async openWindowAt(url) {
    const anyPage = this.context.pages()[0] ?? (await this.context.newPage());
    const cdp = await this.context.newCDPSession(anyPage);
    try {
      const [page] = await Promise.all([
        this.context.waitForEvent('page'),
        cdp.send('Target.createTarget', { url, newWindow: true }),
      ]);
      await page.waitForLoadState();
      return page;
    } finally {
      await cdp.detach();
    }
  }

  // Click a link that opens in a new tab (target=_blank) on `page`.
  async clickLinkToNewTab(page, href) {
    await page.bringToFront();
    const [opened] = await Promise.all([this.context.waitForEvent('page'), page.click(`a[href="${href}"]`)]);
    await opened.waitForLoadState().catch(() => undefined);
    return opened;
  }

  // Shift-click a link on `page`, which Chrome opens in a new window.
  async shiftClickLink(page, href) {
    await page.bringToFront();
    const [opened] = await Promise.all([
      this.context.waitForEvent('page'),
      page.click(`a[href="${href}"]`, { modifiers: ['Shift'] }),
    ]);
    await opened.waitForLoadState().catch(() => undefined);
    return opened;
  }

  openPages() {
    return this.context.pages().filter((page) => !page.isClosed());
  }

  // Chrome's window id for each open page, read through the DevTools protocol.
  async windowIdOf(page) {
    const cdp = await this.context.newCDPSession(page);
    try {
      const { targetInfo } = await cdp.send('Target.getTargetInfo');
      const { windowId } = await cdp.send('Browser.getWindowForTarget', { targetId: targetInfo.targetId });
      return windowId;
    } finally {
      await cdp.detach();
    }
  }

  async windowCount() {
    const ids = new Set();
    for (const page of this.openPages()) {
      ids.add(await this.windowIdOf(page));
    }
    return ids.size;
  }

  async close() {
    await this.context.close();
    await rm(this.profileDir, { recursive: true, force: true });
  }
}
