# Tab Trim

A Chrome extension that keeps your tabs under control across **every window at once**.

Tab Trim remembers the order in which you last touched each tab: opening it, switching to it, or switching to its window. Switching back to an old tab makes it the most recent again. It applies two limits:

- **Maximum open tabs** (default **20**). Open a 21st tab and Tab Trim closes the tab you used least recently, whichever window it is in.
- **Maximum copies of the same URL** (default **2**). Open a page that is already open twice (the same git status link clicked for the thirtieth time, say) and Tab Trim closes the oldest copy, wherever it is.

If the tab being closed is the only tab in its window, the whole window closes. The tab you just opened is never the one closed.

## Install

Tab Trim is loaded unpacked from a checkout:

```bash
git clone https://github.com/darrenoakey/tab-trim.git ~/src/tab-trim
```

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `extension` folder inside the checkout (`~/src/tab-trim/extension`).

Keep Developer mode on. While the extension is installed this way, it checks its folder once a minute and reloads itself when the files change, so a `git pull` takes effect without touching Chrome.

## Settings

Click the Tab Trim toolbar icon, or open **Details → Extension options** on `chrome://extensions`. You can change both limits there. Settings sync through your Chrome profile.

| Setting | Default | Range |
|---|---|---|
| Maximum open tabs | 20 | 1–1000 |
| Maximum copies of the same URL | 2 | 1–100 |

### What counts

- Tabs in normal browser windows count. Pop-ups, app windows and DevTools do not.
- URLs must match exactly. `…/page`, `…/page#top` and `…/page?a=1` are three different URLs.
- Blank and New Tab pages never count as duplicates.
- The tab limit is checked when a tab opens. The duplicate limit is checked when a tab opens or navigates to a new URL.
- After a browser restart, tabs are ranked by when Chrome last showed them.

## Development

```bash
./run check        # lint, unit tests, real-Chromium integration tests and BDD scenarios
./run unit         # pure policy tests only (instant)
./run bdd          # Gherkin scenarios in tests/bdd/features, driven through the UI
./run deploy       # validate the extension package Chrome loads
```

The browser suites use Playwright's Chromium, because branded Google Chrome no longer accepts command-line extension loading. The first run seeds it into `~/.local/state/tab-trim`.

## License

This project is licensed under [CC BY-NC 4.0](https://darren-static.waft.dev/license) - free to use and modify, but no commercial use without permission.
