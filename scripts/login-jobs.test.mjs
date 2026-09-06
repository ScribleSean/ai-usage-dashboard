import test from 'node:test';
import assert from 'node:assert/strict';
import { loginJobs } from './login-jobs.mjs';
test('login jobs keep the tunnel private and retry without interactive authentication', () => {
  const jobs = loginJobs({root:'/tmp/dashboard',node:'/opt/node',windowsHost:'windows-example'});
  assert.equal(Object.keys(jobs).length, 2);
  const tunnel = jobs['io.ai-usage-dashboard.tunnel'];
  for (const text of ['127.0.0.1:5601:127.0.0.1:5601', 'BatchMode=yes', 'ExitOnForwardFailure=yes', '<key>KeepAlive</key><true/>']) assert.ok(tunnel.includes(text));
  assert.ok(!tunnel.includes('0.0.0.0'));
});
test('login jobs reject unsafe aliases and escape path XML', () => {
  assert.throws(() => loginJobs({root:'/tmp/x',node:'/bin/node',windowsHost:'host;bad'}));
  assert.throws(() => loginJobs({root:'relative',node:'/bin/node',windowsHost:'host'}));
  assert.ok(loginJobs({root:'/tmp/a&b',node:'/bin/node',windowsHost:'host'})['io.ai-usage-dashboard.server'].includes('a&amp;b'));
});
test('optional collector runs every five minutes without a KeepAlive retry loop',()=>{
  const args={root:'/tmp/dashboard',node:'/opt/node',python:'/usr/bin/python3',windowsHost:'windows-example',collectionIntervalSeconds:300};
  const jobs=loginJobs(args),collector=jobs['io.ai-usage-dashboard.collector'];
  assert.equal(Object.keys(jobs).length,3);
  for(const value of ['<key>StartInterval</key><integer>300</integer>','<key>RunAtLoad</key><true/>','run-collector.py','--interval']) assert.ok(collector.includes(value));
  assert.ok(!collector.includes('KeepAlive'));
  assert.throws(()=>loginJobs({...args,collectionIntervalSeconds:5}));
  assert.throws(()=>loginJobs({...args,python:'relative'}));
});
