import assert from 'node:assert/strict';
import { test } from 'node:test';

import { DEFAULT_SETTINGS, normalizeSettings, parseSetting } from '../../extension/lib/settings.js';

test('defaults are 20 tabs and 2 copies of a URL', () => {
  assert.deepEqual(DEFAULT_SETTINGS, { maxTabs: 20, maxDuplicates: 2 });
});

test('parseSetting accepts whole numbers in range', () => {
  assert.deepEqual(parseSetting('maxTabs', ' 35 '), { value: 35 });
  assert.deepEqual(parseSetting('maxDuplicates', '1'), { value: 1 });
});

test('parseSetting rejects junk, zero, fractions and out-of-range values', () => {
  for (const text of ['', 'abc', '0', '2.5', '-3', '1e3', '1001']) {
    const parsed = parseSetting('maxTabs', text);
    assert.equal(parsed.value, undefined, text);
    assert.equal(parsed.error, 'Maximum open tabs must be a whole number from 1 to 1000.');
  }
  assert.match(parseSetting('maxDuplicates', '101').error, /from 1 to 100/);
});

test('parseSetting refuses unknown settings', () => {
  assert.throws(() => parseSetting('nope', '1'), /unknown setting/);
});

test('normalizeSettings fills gaps and replaces corrupt values with defaults', () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings({ maxTabs: 50 }), { maxTabs: 50, maxDuplicates: 2 });
  assert.deepEqual(normalizeSettings({ maxTabs: '50', maxDuplicates: 0 }), DEFAULT_SETTINGS);
});
