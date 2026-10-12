// One real browser and one test website for the whole run. Every scenario's
// root step resets the browser to a single blank window with default settings.

import { readFile, writeFile } from 'node:fs/promises';

import { AfterAll, After, Before, BeforeAll, setDefaultTimeout, setWorldConstructor, World } from '@cucumber/cucumber';

import { launchBrowser } from '../../support/browser.js';
import { startSite } from '../../support/site.js';

setDefaultTimeout(20_000);

const PERF_FILE = new URL('../perf.json', import.meta.url);
const HISTORY_LENGTH = 10;

const shared = { browser: null, site: null, timings: {}, started: 0 };

class TabTrimWorld extends World {
  get browser() {
    return shared.browser;
  }

  get site() {
    return shared.site;
  }
}
setWorldConstructor(TabTrimWorld);

BeforeAll(async () => {
  shared.started = Date.now();
  shared.site = await startSite();
  shared.browser = await launchBrowser();
});

AfterAll(async () => {
  await shared.browser?.close();
  await shared.site?.close();
  await recordPerformance();
});

Before(function ({ pickle }) {
  this.scenarioStarted = Date.now();
  this.scenarioKey = `${pickle.uri.split('/').pop()}::${pickle.name}`;
  // Pages opened during the scenario, per path, oldest first.
  this.opened = new Map();
});

After(function ({ result }) {
  if (result?.status === 'PASSED') {
    shared.timings[this.scenarioKey] = Date.now() - this.scenarioStarted;
  }
});

async function recordPerformance() {
  if (Object.keys(shared.timings).length === 0) {
    return;
  }
  let perf = { scenarios: {} };
  try {
    perf = JSON.parse(await readFile(PERF_FILE, 'utf8'));
  } catch {
    // First run: start a fresh file.
  }
  for (const [key, duration] of Object.entries(shared.timings)) {
    const history = [...(perf.scenarios?.[key]?.history ?? []), duration].slice(-HISTORY_LENGTH);
    perf.scenarios[key] = { duration_ms: duration, history };
  }
  const sorted = Object.fromEntries(Object.entries(perf.scenarios).sort(([a], [b]) => a.localeCompare(b)));
  const out = { last_run: new Date().toISOString(), total_duration_ms: Date.now() - shared.started, scenarios: sorted };
  await writeFile(PERF_FILE, `${JSON.stringify(out, null, 2)}\n`);
}
