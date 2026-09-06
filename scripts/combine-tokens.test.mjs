import test from 'node:test';
import assert from 'node:assert/strict';
import {combineTokens,combineSettings,verifyHostInventory} from './combine-tokens.mjs';
const counts={inputTokens:10,cacheReadTokens:20,cacheCreationTokens:0,outputTokens:5,reasoningOutputTokens:2,totalTokens:35};
const model={model:'gpt-6-astra',inferred:false,...counts};
const sources=()=>['Mac','Ubuntu','Windows'].map(host=>({host,status:'ok',days:[{date:'2026-09-06',...counts,models:[{...model}]}]}));
const inventories=()=>Object.fromEntries(['Mac','Ubuntu','Windows'].map((host,i)=>[host,{status:'ok',keys:[String(i).repeat(64)],parents:[]}]));

test('All adds disjoint hosts by date and model with linear API comparisons',()=>{
  const report=combineTokens(sources(),inventories());
  assert.equal(report.status,'ok');assert.equal(report.days[0].totalTokens,105);assert.equal(report.days[0].models.length,1);
  assert.equal(report.days[0].models[0].inputTokens,30);assert.ok(Math.abs(report.days[0].apiEstimate.usd-0.00111)<1e-10);
  assert.ok(!JSON.stringify(report).includes('0'.repeat(64)));
});
test('shared sessions, cross-host parents and incomplete inventories block All totals',()=>{
  const shared=inventories();shared.Windows.keys=shared.Mac.keys;
  assert.equal(combineTokens(sources(),shared).status,'overlap');assert.equal(combineTokens(sources(),shared).days,undefined);
  const parent=inventories();parent.Ubuntu.parents=parent.Mac.keys;
  assert.equal(verifyHostInventory(sources(),parent).status,'overlap');
  const siblings=inventories();siblings.Ubuntu.parents=['a'.repeat(64)];siblings.Windows.parents=['a'.repeat(64)];
  assert.equal(verifyHostInventory(sources(),siblings).status,'overlap');
  const incomplete=inventories();incomplete.Mac.status='incomplete';
  assert.equal(combineTokens(sources(),incomplete).status,'unverified');
  const empty=inventories();empty.Mac.keys=[];
  assert.equal(combineTokens(sources(),empty).status,'unverified');
  assert.equal(combineTokens(sources().slice(0,2),inventories()).status,'unavailable');
});
test('unknown counts and inconsistent per-model sums never become zero',()=>{
  const a=sources();a[0].days[0].inputTokens=null;
  assert.equal(combineTokens(a,inventories()).status,'inconsistent');
  const b=sources();b[0].days[0].models[0].totalTokens=36;
  assert.equal(combineTokens(b,inventories()).status,'inconsistent');
});
test('inferred and recorded versions of a label retain separate pricing coverage',()=>{
  const a=sources();a[0].days[0].models[0].inferred=true;
  const day=combineTokens(a,inventories()).days[0];
  assert.equal(day.models.length,2);assert.equal(day.apiEstimate.coveredTokens,70);assert.equal(day.apiEstimate.excluded,1);
});
test('combined settings only include individually reconciled host detail',()=>{
  const a=sources(), rows=a.map(s=>({host:s.host,status:'ok',profiles:[{date:'2026-09-06',...model,effort:'high',speed:'standard'}]}));
  rows[0].profiles[0].inputTokens=100;
  const report=combineSettings(a,rows);
  assert.equal(report.profiles.length,1);assert.equal(report.profiles[0].totalTokens,70);
});
