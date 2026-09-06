// Run against the existing preview without collecting or printing personal data.
import http from 'node:http';
import assert from 'node:assert/strict';

function request(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port: 5601, path, method,
      headers: { Host: '127.0.0.1:5601', ...headers } }, res => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('Local server timed out')));
    req.on('error', reject);
    req.end();
  });
}

const cases = [
  ['home', '/', 'GET', {}, 200],
  ['head', '/', 'HEAD', {}, 200],
  ['private config', '/local.config.json', 'GET', {}, 404],
  ['private collector lock', '/.runtime/collector.lock', 'GET', {}, 404],
  ['collector writes forbidden', '/local/collector.json', 'POST', {}, 405],
  ['collector cross-site request', '/local/collector.json', 'GET', {'Sec-Fetch-Site':'cross-site'}, 403],
  ['foreign host', '/', 'GET', { Host: 'untrusted.example' }, 403],
  ['cross-site request', '/', 'GET', { 'Sec-Fetch-Site': 'cross-site' }, 403],
  ['write request', '/', 'POST', {}, 405],
  ['encoded traversal', '/%2e%2e%2flocal.config.json', 'GET', {}, 404],
];
for (const [name, path, method, headers, expected] of cases) {
  const result = await request(path, method, headers);
  assert.equal(result.status, expected, name);
  assert.equal(result.headers['cache-control'], 'no-store', name);
  assert.equal(result.headers['x-content-type-options'], 'nosniff', name);
  assert.equal(result.headers['x-frame-options'], 'DENY', name);
  console.log('PASS ' + name);
}
