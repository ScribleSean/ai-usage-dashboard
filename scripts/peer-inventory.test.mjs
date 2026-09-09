import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePeerInventory,combinePeerTokens} from './peer-inventory.mjs';

const comparisonId='a'.repeat(64), hosts=['Mac','Windows'];
const counts={inputTokens:10,cacheReadTokens:0,cacheCreationTokens:0,outputTokens:2,reasoningOutputTokens:0,totalTokens:12};
const sources=()=>hosts.map(host=>({host,status:'ok',days:[{date:'2026-09-09',...counts,models:[{model:'unknown',inferred:true,...counts}]}]}));
const evidence=()=>hosts.map((host,i)=>({version:1,comparisonId,host,status:'ok',keys:[String(i).repeat(64)],parents:[]}));

test('same-generation disjoint peer inventories permit totals without exporting evidence',()=>{
  const result=combinePeerTokens(sources(),evidence(),comparisonId,hosts);
  assert.equal(result.status,'ok');assert.equal(result.days[0].totalTokens,24);
  for(const secret of [comparisonId,'0'.repeat(64),'1'.repeat(64),'comparisonId','parents'])
    assert.ok(!JSON.stringify(result).includes(secret));
});

test('salt rotation or mismatched generations cannot falsely establish disjointness',()=>{
  const rows=evidence();rows[1].comparisonId='b'.repeat(64);
  assert.equal(combinePeerTokens(sources(),rows,comparisonId,hosts).status,'unverified');
  assert.equal(combinePeerTokens(sources(),evidence(),'b'.repeat(64),hosts).status,'unverified');
});

test('raw metadata, wrong identity, oversized evidence and malformed hashes are rejected',()=>{
  for(const patch of [{prompt:'PRIVATE'},{salt:'PRIVATE'},{host:'Ubuntu'},{version:2},
    {keys:['raw-session-id']},{parents:['PRIVATE']},{keys:Array(40001).fill('0'.repeat(64))}])
    assert.throws(()=>validatePeerInventory({...evidence()[0],...patch},'Mac',comparisonId));
  assert.throws(()=>validatePeerInventory(null,'Mac',comparisonId));
});

test('missing, duplicate and incomplete evidence withholds totals',()=>{
  assert.equal(combinePeerTokens(sources(),[],comparisonId,hosts).status,'unverified');
  assert.equal(combinePeerTokens(sources(),[evidence()[0],evidence()[0]],comparisonId,hosts).status,'unverified');
  const rows=evidence();rows[1].status='incomplete';
  assert.equal(combinePeerTokens(sources(),rows,comparisonId,hosts).status,'unverified');
});

test('shared sessions and cross-host parents still block combined totals',()=>{
  const shared=evidence();shared[1].keys=shared[0].keys;
  assert.equal(combinePeerTokens(sources(),shared,comparisonId,hosts).status,'overlap');
  const parent=evidence();parent[1].parents=parent[0].keys;
  assert.equal(combinePeerTokens(sources(),parent,comparisonId,hosts).status,'overlap');
  const duplicate=evidence()[0];duplicate.keys.push(duplicate.keys[0]);
  assert.equal(validatePeerInventory(duplicate,'Mac',comparisonId).keys.length,1);
});
