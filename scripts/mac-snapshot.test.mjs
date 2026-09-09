import test from 'node:test';
import assert from 'node:assert/strict';
import {macCollectorConfig,macSnapshot} from './mac-snapshot.mjs';
import {macActivity,cleanActivity} from './collect-dashboard.mjs';
import {hostname} from 'node:os';
const at='2026-09-09T04:00:00Z';
const settings={profiles:[{date:'2026-09-08',model:'gpt-6-astra',effort:'medium',speed:'standard',inputTokens:5,
  cacheReadTokens:2,cacheCreationTokens:0,outputTokens:3,reasoningOutputTokens:1,totalTokens:10,prompt:'PRIVATE'}],
  tools:[{date:'2026-09-08',category:'Shell',tool:'exec_command',namespace:'functions',count:2,arguments:'PRIVATE'}]};

test('Mac local settings accept only explicit source booleans, without remote command settings',()=>{
  assert.deepEqual(macCollectorConfig({}),{activity:true,codex:true,wispr:false,typewhisper:false});
  for(const value of [null,[],{wispr:'yes'},{windowsHost:'private-host'},{python:'/arbitrary/program'}])assert.throws(()=>macCollectorConfig(value));
});
test('disabled local sources are never invoked and missing peers are unavailable',async()=>{
  let calls=0;
  const fail=()=>{calls++;throw Error('A disabled reader ran');};
  const {data,status}=await macSnapshot({activity:false,codex:false,wispr:false,typewhisper:false},{activity:fail,codex:fail,wispr:fail,typewhisper:fail},[],at);
  assert.equal(status.sourcesConfigured,0);assert.equal(status.state,'partial');
  assert.equal(calls,0);
  assert.equal(data.combinedTokens.status,'unavailable');assert.equal(data.combined.status,'unavailable');
  assert.equal(data.tokens[1].status,'not-connected');assert.equal(data.tokens[2].status,'not-connected');
});
test('Mac local reports are sanitized and token/settings views share one read',async()=>{
  let reads=0;
  const {data,status}=await macSnapshot({wispr:true,typewhisper:true},{
    activity:async()=>({start:'2026-09-08T12:00:00Z',end:at,intervals:[{start:'2026-09-08T13:00:00Z',end:'2026-09-08T13:01:00Z',category:'Editors',app:'VS Code',title:'PRIVATE'}]}),
    codex:async()=>{reads++;return settings;},
    wispr:async()=>({status:'ok',days:[{date:'2026-09-08',transcriptions:1,words:10,audioSeconds:2,wordRecords:1,audioRecords:1,engines:[],transcript:'PRIVATE'}]}),
    typewhisper:async()=>({status:'not-found',privatePath:'PRIVATE'}),
  },[],at);
  assert.equal(reads,1);assert.equal(data.tokens[0].days[0].totalTokens,10);
  assert.equal(data.settings[0].tools[0].namespace,'functions');
  assert.equal(data.dictation[0].source,'Wispr Flow');assert.equal(data.dictation[1].status,'not-found');
  assert.equal(status.state,'partial');assert.ok(!JSON.stringify(data).includes('PRIVATE'));
  assert.equal(data.activity[0].intervals,undefined);
});
test('failed reads do not publish error text or invent successful token totals',async()=>{
  const {data}=await macSnapshot({wispr:true},{activity:async()=>{throw Error('PRIVATE');},codex:async()=>({...settings,profiles:[{...settings.profiles[0],totalTokens:999}]}),wispr:async()=>{throw Error('PRIVATE');}},[],at);
  assert.equal(data.activity[0].status,'unavailable');assert.equal(data.tokens[0].status,'unavailable');
  assert.equal(data.dictation[0].status,'unavailable');assert.ok(!JSON.stringify(data).includes('PRIVATE'));
});

test('local ActivityWatch reader exposes ISO intervals for exactly one normalization',async()=>{
  const prior=globalThis.fetch;
  const timestamp=new Date(Date.now()-120000).toISOString();
  globalThis.fetch=async(url,options)=>({ok:true,json:async()=>
    url.endsWith('/buckets/')?{w:{id:'fixture-window',hostname:hostname(),type:'currentwindow'},a:{id:'fixture-afk',hostname:hostname(),type:'afkstatus'}}:
    options?.method==='POST'?[[{timestamp,duration:30,data:{app:'Code.exe',title:'PRIVATE'}}]]:[{timestamp}]});
  try {
    const raw=await macActivity({raw:true});
    assert.equal(typeof raw.intervals[0].start,'string');
    assert.equal(cleanActivity(raw,'Mac').status,'ok');
    assert.equal(typeof (await macActivity()).intervals[0].start,'number');
    assert.ok(!JSON.stringify(raw).includes('PRIVATE'));
  } finally {globalThis.fetch=prior;}
});
