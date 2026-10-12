#!/usr/bin/env node
// Prove the extension folder is a complete, loadable package: the manifest
// parses and names files that exist, every packaged file is present, and every
// script compiles as an ES module. Prints the package fingerprint the running
// extension compares against to decide when to reload itself.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import { PACKAGE_FILES, packageFingerprint } from '../extension/lib/fingerprint.js';

const EXTENSION_DIR = fileURLToPath(new URL('../extension/', import.meta.url));
const read = (name) => readFile(path.join(EXTENSION_DIR, name));

function fail(message) {
  console.error(`invalid extension package: ${message}`);
  process.exit(1);
}

const manifest = JSON.parse(await read('manifest.json').then(String));
if (manifest.manifest_version !== 3) {
  fail('manifest_version must be 3');
}
const referenced = [
  manifest.background?.service_worker,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons ?? {}),
  ...Object.values(manifest.action?.default_icon ?? {}),
].filter(Boolean);
for (const name of referenced) {
  if (!PACKAGE_FILES.includes(name)) {
    fail(`manifest references ${name}, which is not in PACKAGE_FILES`);
  }
}
for (const name of PACKAGE_FILES) {
  await read(name).catch(() => fail(`missing ${name}`));
  if (name.endsWith('.js')) {
    try {
      execFileSync(process.execPath, ['--check', path.join(EXTENSION_DIR, name)], { stdio: 'pipe' });
    } catch (error) {
      fail(`${name} does not compile: ${String(error.stderr).trim()}`);
    }
  }
}

console.log(`extension package OK: ${manifest.name} ${manifest.version}, fingerprint ${(await packageFingerprint(read)).slice(0, 12)}`);
