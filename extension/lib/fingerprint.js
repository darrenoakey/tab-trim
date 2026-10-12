// Self-update support for an unpacked install. Chrome serves an unpacked
// extension's files straight from disk, so hashing them tells the background
// worker whether the checkout it was loaded from has changed since it started.

// Every file in the extension package. A unit test keeps this list in sync with
// the directory so a new file can never escape the fingerprint.
export const PACKAGE_FILES = Object.freeze([
  'background.js',
  'icons/icon128.png',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'lib/fingerprint.js',
  'lib/policy.js',
  'lib/recency.js',
  'lib/settings.js',
  'manifest.json',
  'options.css',
  'options.html',
  'options.js',
]);

const MISSING = new TextEncoder().encode('\u0000missing\u0000');

function concat(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

// readFile(path) resolves to the file's bytes (ArrayBuffer or Uint8Array) or
// rejects when the file does not exist. A missing file still contributes to the
// hash so deleting a file is detected as a change.
export async function packageFingerprint(readFile) {
  const encoder = new TextEncoder();
  const chunks = [];
  for (const path of PACKAGE_FILES) {
    let bytes;
    try {
      bytes = new Uint8Array(await readFile(path));
    } catch {
      bytes = MISSING;
    }
    chunks.push(encoder.encode(`${path}\u0000${bytes.length}\u0000`), bytes);
  }
  return hex(await crypto.subtle.digest('SHA-256', concat(chunks)));
}
