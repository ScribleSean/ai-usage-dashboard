import test from 'node:test';
import assert from 'node:assert/strict';
import {combineActivity} from './combine-activity.mjs';

const stamp=hour=>Date.parse(`2026-09-09T${String(hour).padStart(2,'0')}:00:00Z`);
const interval=(start,end,category='Editors')=>({start:stamp(start),end:stamp(end),category,app:'VS Code'});
const source=(host,intervals=[],extra={})=>({host,status:'ok',start:new Date(stamp(10)).toISOString(),
  end:new Date(stamp(16)).toISOString(),intervals,...extra});
const seconds=result=>result.days.reduce((sum,day)=>sum+day.seconds,0);

test('combined devices union overlapping spans and disclose mixed categories',()=>{
  const result=combineActivity([source('Mac',[interval(10,12)]),source('Windows',[interval(11,13,'Browser')])]);
  assert.equal(result.status,'ok');
  assert.equal(seconds(result),3*3600);
  assert.equal(result.categories['Mixed activity'],3600);
  assert.equal(result.categories.Editors,3600);
  assert.equal(result.categories.Browser,3600);
});

test('duplicate records and repeated combination never accumulate totals',()=>{
  const row=interval(10,12);
  const inputs=[source('Mac',[row,row]),source('Windows',[row,row])];
  const first=combineActivity(inputs);
  assert.equal(seconds(first),2*3600);
  assert.deepEqual(combineActivity(inputs),first);
  assert.deepEqual(combineActivity([...inputs].reverse()),first);
  assert.equal(inputs[0].intervals.length,2);
});

test('only the shared report window contributes, while disjoint windows are unavailable',()=>{
  const mac=source('Mac',[interval(10,14)]);
  const windows=source('Windows',[interval(13,16)],{start:new Date(stamp(12)).toISOString()});
  const result=combineActivity([mac,windows]);
  assert.equal(result.start,new Date(stamp(12)).toISOString());
  assert.equal(seconds(result),4*3600);
  assert.equal(combineActivity([mac,{...windows,start:new Date(stamp(16)).toISOString(),
    end:new Date(stamp(17)).toISOString()}]).status,'unavailable');
});

test('missing, duplicate or wrong hosts and malformed intervals cannot become a zero total',()=>{
  const mac=source('Mac'),windows=source('Windows');
  for(const values of [null,[],[mac],[mac,mac],[mac,source('Ubuntu')],
    [mac,{...windows,status:'unavailable'}],[mac,{...windows,start:'bad'}],
    [mac,{...windows,intervals:undefined}],[mac,{...windows,intervals:[{...interval(10,11),end:NaN}]}],
    [mac,{...windows,intervals:[interval(12,11)]}],[mac,{...windows,intervals:[interval(10,11,'private')]}]]) {
    assert.deepEqual(combineActivity(values),{host:'Combined',status:'unavailable'});
  }
  const empty=combineActivity([mac,windows]);
  assert.equal(empty.status,'ok');
  assert.equal(seconds(empty),0);
});

test('tracking coverage requires both devices and does not add duplicate observed spans',()=>{
  const mac=source('Mac',[],{trackingIntervals:[interval(10,12),interval(10,12)]});
  const windows=source('Windows',[],{trackingIntervals:[interval(11,13)]});
  const complete=combineActivity([mac,windows]);
  assert.equal(complete.days[0].trackedSeconds,3*3600);
  assert.equal(seconds(complete),0);
  assert.equal(combineActivity([mac,source('Windows')]).days[0].trackedSeconds,undefined);
});

test('private fields and unknown app names never enter a combined summary',()=>{
  const row={...interval(10,11),app:'PRIVATE_APP',title:'PRIVATE_TITLE',path:'PRIVATE_PATH'};
  const result=combineActivity([source('Mac',[row],{private:'PRIVATE_HOST'}),source('Windows')]);
  assert.equal(result.status,'ok');
  assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  assert.equal(result.days[0].apps.Editors['Unknown app'],3600);
  assert.equal(result.intervals,undefined);
});
