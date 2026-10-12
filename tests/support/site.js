// A tiny local website for the browser tests. Every page shows its own path and
// links (opening in a new tab) to every page in the catalogue, so tests can
// open tabs the way a person does: by clicking links.

import http from 'node:http';

export const CATALOGUE = Object.freeze([
  '/home',
  '/git/status',
  '/docs',
  '/mail',
  '/news',
  '/wiki',
  ...Array.from({ length: 30 }, (_, index) => `/page/${index + 1}`),
]);

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

function render(path) {
  const links = CATALOGUE.map(
    (target) => `<li><a href="${escapeHtml(target)}" target="_blank">${escapeHtml(target)}</a></li>`,
  ).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(path)}</title></head>
<body><h1>${escapeHtml(path)}</h1><ul>${links}</ul></body></html>`;
}

export async function startSite() {
  const server = http.createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (request.method !== 'GET' || path === '/favicon.ico') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    response.end(render(path));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    url: (path) => `${origin}${path}`,
    pathOf: (url) => (url.startsWith(origin) ? url.slice(origin.length) : url),
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
