import test from 'node:test';
import assert from 'node:assert/strict';
import {freshness} from './freshness.mjs';
const now=Date.parse('2026-09-06T12:00:00Z');
test('freshness distinguishes recent, stale and unknown timestamps',()=>{
  assert.deepEqual(freshness('2026-09-06T11:59:30Z',now),{state:'recent',label:'just now',ageSeconds:30});
  assert.equal(freshness('2026-09-06T11:55:00Z',now).label,'5m ago');
  assert.equal(freshness('2026-09-06T11:49:59Z',now).state,'stale');
  assert.equal(freshness('2026-09-05T11:00:00Z',now).label,'1d ago');
  assert.equal(freshness('2026-09-06T12:10:00Z',now).state,'unknown');
  assert.equal(freshness(undefined,now).state,'unknown');
});
