import test from 'node:test';
import assert from 'node:assert/strict';
import { estimate } from './api-estimate.mjs';
const model = { model:'gpt-6-astra',inputTokens:1000000,cacheReadTokens:1000000,cacheCreationTokens:0,outputTokens:1000000,totalTokens:3000000,inferred:false };
test('scenario keeps uncached, cached and output rates separate', () => assert.equal(estimate([model]).usd,61));
test('unknown and inferred models stay excluded', () => {
  assert.equal(estimate([{...model,inferred:true}]).usd,null);
  assert.equal(estimate([{...model,model:'unknown'}]).excluded,1);
});
test('inconsistent totals cannot be estimated', () => assert.equal(estimate([{...model,totalTokens:2}]).usd,null));
