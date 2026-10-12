// Settings page: edit the limits stored in chrome.storage.sync.

import { DEFAULT_SETTINGS, SETTINGS, normalizeSettings, parseSetting } from './lib/settings.js';

const form = document.getElementById('settings');
const status = document.getElementById('status');
const summary = document.getElementById('summary');
const inputs = Object.fromEntries(Object.keys(SETTINGS).map((key) => [key, document.getElementById(key)]));

function showStatus(message, kind) {
  status.textContent = message;
  status.className = kind;
}

function fill(settings) {
  for (const [key, input] of Object.entries(inputs)) {
    input.value = String(settings[key]);
    input.removeAttribute('aria-invalid');
  }
}

async function refreshSummary() {
  const [tabs, windows] = await Promise.all([
    chrome.tabs.query({ windowType: 'normal' }),
    chrome.windows.getAll({ windowTypes: ['normal'] }),
  ]);
  const settings = normalizeSettings(await chrome.storage.sync.get(null));
  const tabWord = tabs.length === 1 ? 'tab' : 'tabs';
  const windowWord = windows.length === 1 ? 'window' : 'windows';
  summary.textContent = `${tabs.length} ${tabWord} open across ${windows.length} ${windowWord} (limit ${settings.maxTabs}).`;
}

async function save(event) {
  event.preventDefault();
  const values = {};
  const errors = [];
  for (const [key, input] of Object.entries(inputs)) {
    const parsed = parseSetting(key, input.value);
    if (parsed.error) {
      input.setAttribute('aria-invalid', 'true');
      errors.push(parsed.error);
    } else {
      input.removeAttribute('aria-invalid');
      values[key] = parsed.value;
    }
  }
  if (errors.length > 0) {
    showStatus(errors.join(' '), 'error');
    return;
  }
  await chrome.storage.sync.set(values);
  fill(values);
  showStatus('Saved.', 'ok');
  await refreshSummary();
}

async function restoreDefaults() {
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
  fill(DEFAULT_SETTINGS);
  showStatus('Defaults restored.', 'ok');
  await refreshSummary();
}

form.addEventListener('submit', save);
document.getElementById('reset').addEventListener('click', restoreDefaults);
chrome.tabs.onCreated.addListener(refreshSummary);
chrome.tabs.onRemoved.addListener(refreshSummary);

fill(normalizeSettings(await chrome.storage.sync.get(null)));
await refreshSummary();
document.body.dataset.ready = 'true';
