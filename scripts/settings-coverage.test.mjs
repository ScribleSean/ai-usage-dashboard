import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsCoverage} from './settings-coverage.mjs';
const model={inputTokens:10,cacheReadTokens:20,cacheCreationTokens:0,outputTokens:5,totalTokens:35};
test('settings coverage only accepts matching or bounded partial counters',()=>{
  assert.equal(settingsCoverage(model,[model]).status,'matched');
  assert.equal(settingsCoverage({...model,totalTokens:40},[model]).status,'partial');
  assert.equal(settingsCoverage(model,[{...model,inputTokens:11,totalTokens:36}]).status,'unreconciled');
  assert.equal(settingsCoverage({...model,inferred:true},[model]).status,'missing');
});
