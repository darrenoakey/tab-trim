import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { PACKAGE_FILES, packageFingerprint } from '../../extension/lib/fingerprint.js';

const EXTENSION_DIR = fileURLToPath(new URL('../../extension/', import.meta.url));

async function listFiles(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await listFiles(path.join(dir, entry.name), relative)));
    } else {
      out.push(relative);
    }
  }
  return out;
}

test('PACKAGE_FILES lists exactly the files in the extension directory', async () => {
  const actual = (await listFiles(EXTENSION_DIR)).sort();
  assert.deepEqual([...PACKAGE_FILES].sort(), actual);
});

test('the fingerprint changes when any file changes, appears or disappears', async () => {
  const files = new Map(PACKAGE_FILES.map((name) => [name, new TextEncoder().encode(name)]));
  const read = async (name) => {
    if (!files.has(name)) {
      throw new Error('missing');
    }
    return files.get(name);
  };
  const original = await packageFingerprint(read);
  assert.match(original, /^[0-9a-f]{64}$/);
  assert.equal(await packageFingerprint(read), original);

  files.set('options.js', new TextEncoder().encode('changed'));
  const edited = await packageFingerprint(read);
  assert.notEqual(edited, original);

  files.delete('options.js');
  const deleted = await packageFingerprint(read);
  assert.notEqual(deleted, edited);
  assert.notEqual(deleted, original);
});

test('the real package has a stable fingerprint', async () => {
  const read = (name) => readFile(path.join(EXTENSION_DIR, name));
  assert.equal(await packageFingerprint(read), await packageFingerprint(read));
});
