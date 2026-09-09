import test from 'node:test';
import assert from 'node:assert/strict';
import {selectPeerRevision} from './peer-revision.mjs';
const now=Date.parse('2026-09-09T13:00:00.000Z');
const expected={pairId:'a'.repeat(64),deviceId:'b'.repeat(64),comparisonId:'c'.repeat(64),host:'Windows'};
const record=(sequence=1,collectedAt='2026-09-09T12:59:00.000Z')=>({version:1,...expected,digest:'d'.repeat(64),sequence,collectedAt});

test('new revisions replace snapshots while identical retries are idempotent',()=>{
  const first=selectPeerRevision(null,record(),expected,now);
  assert.equal(first.action,'replace');assert.equal(first.status,'fresh');
  assert.equal(selectPeerRevision(first.revision,record(),expected,now).reason,'duplicate');
  assert.equal(selectPeerRevision(first.revision,record(2),expected,now).action,'replace');
});
test('reordered delivery never replaces a newer revision',()=>{
  const result=selectPeerRevision(record(3),record(2),expected,now);
  assert.equal(result.action,'keep');assert.equal(result.reason,'older');assert.equal(result.revision.sequence,3);
});
test('stale snapshots remain identifiable without being called fresh',()=>{
  const old=record(1,'2026-09-08T12:00:00.000Z');
  assert.equal(selectPeerRevision(null,old,expected,now).status,'stale');
  assert.equal(selectPeerRevision(old,old,expected,now).status,'stale');
});
test('revoked pairing, another device and another salt generation are rejected',()=>{
  for(const key of ['pairId','deviceId','comparisonId'])
    assert.throws(()=>selectPeerRevision(null,{...record(),[key]:'e'.repeat(64)},expected,now));
  assert.throws(()=>selectPeerRevision(null,{...record(),host:'Mac'},expected,now));
  assert.throws(()=>selectPeerRevision(record(),record(),{...expected,pairId:'f'.repeat(64)},now));
});
test('conflicts, future timestamps, clock regressions and corrupt watermarks fail closed',()=>{
  for(const patch of [{digest:'e'.repeat(64)},{collectedAt:'2026-09-09T12:58:00.000Z'}])
    assert.throws(()=>selectPeerRevision(record(),{...record(),...patch},expected,now));
  assert.throws(()=>selectPeerRevision(record(),record(2,'2026-09-09T12:58:00.000Z'),expected,now));
  assert.throws(()=>selectPeerRevision(null,record(1,'2026-09-09T13:06:00.000Z'),expected,now));
  assert.throws(()=>selectPeerRevision({},record(),expected,now));
});
test('metadata cannot carry private fields or malformed revision values',()=>{
  for(const patch of [{prompt:'PRIVATE'},{sequence:0},{sequence:1.5},{sequence:Number.MAX_SAFE_INTEGER+1},
    {digest:'not-a-hash'},{collectedAt:'2026-09-09'},{collectedAt:'2026-02-30T12:00:00.000Z'}])
    assert.throws(()=>selectPeerRevision(null,{...record(),...patch},expected,now));
  assert.throws(()=>selectPeerRevision(null,record(),expected,NaN));
});
