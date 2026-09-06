import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanQuota} from './read-quota.mjs';
test('quota adapter preserves separate buckets and drops account and credit details', () => {
  const result=cleanQuota({accountId:'PRIVATE',credits:{secret:'PRIVATE'},rateLimitsByLimitId:{codex:{primary:{usedPercent:25,windowDurationMins:300,resetsAt:1800000000}},spark:{secondary:{usedPercent:80,windowDurationMins:10080}}}});
  assert.equal(result.windows.length,2); assert.equal(result.windows[0].remainingPercent,75);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});
test('invalid quota values stay unavailable', () => {
  assert.equal(cleanQuota({rateLimits:{primary:{usedPercent:'25'}}}).status,'unavailable');
  assert.equal(cleanQuota({rateLimits:{primary:{usedPercent:101}}}).windows.length,0);
});
