// Static files only: no RSC, server functions, Vite dev endpoints or remote APIs.
import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(root, 'dist/client');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (
    !['127.0.0.1:5601', 'localhost:5601'].includes(req.headers.host) ||
    req.headers['sec-fetch-site'] === 'cross-site'
  ) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405);
    return res.end();
  }
  try {
    const url = new URL(req.url, 'http://localhost:5601');
    let file;
    if (url.pathname === '/local/usage.json')
      file = path.join(root, 'public/local/usage.json');
    else {
      const requested = decodeURIComponent(url.pathname);
      file = await realpath(
        path.join(assets, requested === '/' ? 'index.html' : requested),
      );
      if (!file.startsWith(assets + path.sep)) throw Error();
    }
    const mime = types[path.extname(file)];
    if (!mime) throw Error();
    const data = await readFile(file);
    res.setHeader('Content-Type', mime);
    res.writeHead(200);
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
server.listen(5601, '127.0.0.1', () =>
  console.log('Local dashboard: http://127.0.0.1:5601'),
);
