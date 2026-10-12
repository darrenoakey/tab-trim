# Tab Trim — notes for agents

Chrome MV3 extension (plain ES modules, no build step). `extension/` is the whole
package; Chrome loads it unpacked from the canonical checkout `~/src/tab-trim/extension`.

## Layout

- `extension/lib/policy.js` — pure closing rules (`planClosures`). All limit logic lives here.
- `extension/lib/recency.js` — pure recency bookkeeping (touch / forget / reconcile).
- `extension/lib/settings.js` — limits, defaults, validation (shared by worker and options page).
- `extension/lib/fingerprint.js` — package hash for self-reload. `PACKAGE_FILES` must list
  every file in `extension/` (a unit test enforces this).
- `extension/background.js` — event wiring; `globalThis.tabTrim` is the test-hook surface.
- `tests/unit` (node:test, pure), `tests/integration` (real headless Chromium),
  `tests/bdd` (Cucumber + Playwright through the UI; `perf.json` committed).

## Gotchas

- **Run browser suites detached.** `./run check`, `./run integration` and `./run bdd` launch real
  Chromium. Run them with `nohup … > log 2>&1 &` and poll the log; a hung browser held inline will
  blow the agent turn limit. A full `npx playwright install chromium` download takes minutes, so
  `./run` seeds Chromium by APFS clone from `~/Library/Caches/ms-playwright` instead. If neither
  exists, run that download detached and sleep. Playwright is pinned to 1.61.0 (chromium-1228);
  bumping it changes the revision.
- Cucumber 13 refuses Node 25; Cucumber is pinned to 12.9.0.
- Headless Chromium **disables** an unpacked extension that calls `chrome.runtime.reload()` unless
  `chrome://extensions` Developer mode is on (disable reason 1<<24). The test helper flips the real
  `#devMode` toggle. The user's Chrome needs Developer mode on for self-reload too.
- Headless Chromium never fires `windows.onFocusChanged` when focus moves between existing windows.
  Integration tests deliver it through `tabTrim.windowFocused(id)`. BDD scenarios are written so that
  they do not depend on cross-window focus.
- Stop the extension's service worker with browser-CDP `Target.closeTarget`.
  `ServiceWorker.stopAllWorkers` does not stop it. Playwright's existing worker handle follows the
  restarted worker; calling it while the worker is stopped waits rather than failing.
- Web pages cannot `fetch()` `chrome-extension://` files (no web_accessible_resources); read them from
  the worker.
- Branded Google Chrome (137+) ignores `--load-extension`, so tests use Playwright Chromium.
- Python launcher: `/usr/bin/python3` is 3.9 here; greenline needs ≥3.11, so run it via
  `python3.14 ~/local/ci-lab-greenline/greenline`.
