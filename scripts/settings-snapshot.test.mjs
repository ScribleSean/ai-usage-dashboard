import test from 'node:test';
import assert from 'node:assert/strict';
import {readSettingsSnapshot} from './settings-snapshot.mjs';
const tokens=n=>({status:'ok',days:[{date:'2026-09-06',totalTokens:n}]});
const detail={profiles:[{totalTokens:10}],tools:[{category:'Shell',count:2}]};

test('settings use the same stable token snapshot',async()=>{
  const result=await readSettingsSnapshot(tokens(10),async()=>tokens(10),async()=>detail);
  assert.equal(result.settings.snapshotStable,true);assert.deepEqual(result.settings.profiles,detail.profiles);
});
test('a changing snapshot retries once then uses the stable newer totals',async()=>{
  let reads=0,details=0;
  const result=await readSettingsSnapshot(tokens(10),async()=>{reads++;return tokens(20);},async()=>{details++;return detail;});
  assert.equal(reads,2);assert.equal(details,2);assert.equal(result.tokens.days[0].totalTokens,20);assert.equal(result.settings.snapshotStable,true);
});
test('ongoing changes withhold detail but preserve tool metadata',async()=>{
  let n=10;
  const result=await readSettingsSnapshot(tokens(n),async()=>tokens(++n),async()=>detail);
  assert.equal(n,12);assert.equal(result.settings.snapshotStable,false);assert.deepEqual(result.settings.profiles,[]);assert.deepEqual(result.settings.tools,detail.tools);
});
test('a failed second token read cannot validate settings',async()=>{
  const result=await readSettingsSnapshot(tokens(10),async()=>({status:'unavailable'}),async()=>detail);
  assert.equal(result.settings.snapshotStable,false);assert.deepEqual(result.settings.profiles,[]);
});
