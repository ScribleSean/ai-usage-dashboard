import test from 'node:test';
import assert from 'node:assert/strict';
import {needsWindowsSetup} from './setup-state.mjs';

test('first-run instructions require explicit Windows configuration metadata', () => {
  assert.equal(needsWindowsSetup({version:1,platform:'windows',configured:false}), true);
  for (const value of [null, undefined, {}, {version:1,platform:'windows',configured:true},
    {version:1,platform:'windows',configured:'false'}, {version:2,platform:'windows',configured:false},
    {version:1,platform:'mac',configured:false}]) assert.equal(needsWindowsSetup(value), false);
});
