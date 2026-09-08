import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const code = `import importlib.util,json,sys,datetime as dt
spec=importlib.util.spec_from_file_location('reader','scripts/read-settings.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
print(json.dumps(m.summarize(json.load(sys.stdin),dt.datetime(2026,1,1,tzinfo=dt.timezone.utc))))`;
const settings=(effort,speed)=>({timestamp:'2026-09-06T12:00:00Z',type:'event_msg',payload:{type:'thread_settings_applied',thread_settings:{model:'gpt-6-astra',reasoning_effort:effort,service_tier:speed,cwd:'PRIVATE'}}});
const usage=n=>({timestamp:'2026-09-06T12:01:00Z',type:'event_msg',payload:{type:'token_count',info:{total_token_usage:{input_tokens:n,cached_input_tokens:n/2,cache_write_input_tokens:0,output_tokens:n/10,reasoning_output_tokens:n/20,total_tokens:n+n/10}}}});
test('settings split cumulative increments and preserve exclusive token categories',()=>{
  const output=execFileSync('python3',['-c',code],{input:JSON.stringify([settings('ultra','priority'),usage(100),usage(100),settings('medium','default'),usage(200)])}).toString();
  const [rows]=JSON.parse(output);
  assert.equal(rows.length,2);assert.equal(rows[0].speed,'fast');assert.equal(rows[1].effort,'medium');
  assert.equal(rows[0].totalTokens,110);assert.equal(rows[1].totalTokens,110);assert.equal(rows[0].inputTokens,50);
  assert.ok(!output.includes('PRIVATE'));
});
test('unknown settings are not guessed and tool arguments never leave reader',()=>{
  const call={timestamp:'2026-09-06T12:00:00Z',type:'response_item',payload:{type:'function_call',name:'exec_command',call_id:'private-id',arguments:'SECRET'}};
  const output=execFileSync('python3',['-c',code],{input:JSON.stringify([usage(100),call,call])}).toString();
  const [rows,tools]=JSON.parse(output);assert.equal(rows[0].effort,'unknown');assert.equal(rows[0].speed,'unknown');
  assert.equal(tools[0].count,1);assert.equal(tools[0].category,'Shell');assert.ok(!output.includes('SECRET'));assert.ok(!output.includes('private-id'));
});

test('exact tool identities preserve case and namespace without reading arguments',()=>{
  const call=(name,namespace,id,timestamp='2026-09-06T12:00:00Z')=>({timestamp,type:'response_item',payload:{type:'function_call',name,namespace,call_id:id,arguments:'PRIVATE_ARGUMENTS'}});
  const output=execFileSync('python3',['-c',code],{input:JSON.stringify([
    call('ToolName','one','a'),call('ToolName','two','b'),call('toolname','one','c'),call('ToolName','one','a'),
    call('functions.exec',undefined,'d'),call('PRIVATE NAME','BAD NAMESPACE','e'),call('x'.repeat(201),null,'f'),
    call('old_tool','one','g','2025-12-01T12:00:00Z')
  ])}).toString();
  const [,rows]=JSON.parse(output);
  assert.equal(rows.length,5);
  assert.equal(rows.find(r=>r.tool==='ToolName'&&r.namespace==='one').count,1);
  assert.equal(rows.find(r=>r.tool==='ToolName'&&r.namespace==='two').count,1);
  assert.equal(rows.find(r=>r.tool==='toolname').count,1);
  assert.equal(rows.find(r=>r.tool==='functions.exec').namespace,'');
  assert.equal(rows.find(r=>r.tool==='Unknown tool').count,2);
  for(const secret of ['PRIVATE','BAD NAMESPACE','old_tool','x'.repeat(201)]) assert.ok(!output.includes(secret));
});

test('last request usage survives a cumulative reset without counting repeated reports',()=>{
  const first=usage(100),reset=usage(20);
  reset.payload.info.last_token_usage=usage(50).payload.info.total_token_usage;
  const [rows]=JSON.parse(execFileSync('python3',['-c',code],{input:JSON.stringify([settings('high','standard'),first,reset,reset])}));
  assert.equal(rows[0].totalTokens,165);
  assert.equal(rows[0].speed,'standard');
});

test('selected model changes do not relabel usage from the preceding turn',()=>{
  const context=model=>({timestamp:'2026-09-06T12:00:00Z',type:'turn_context',payload:{model,effort:'high'}});
  const selected=settings('ultra','priority');
  const [rows]=JSON.parse(execFileSync('python3',['-c',code],{input:JSON.stringify([
    context('gpt-5.6-sol'),usage(100),selected,usage(200),context('gpt-6-astra'),usage(300)
  ])}));
  assert.equal(rows.filter(r=>r.model==='gpt-5.6-sol').reduce((n,r)=>n+r.totalTokens,0),220);
  const astra=rows.find(r=>r.model==='gpt-6-astra');
  assert.equal(astra.totalTokens,110);assert.equal(astra.speed,'fast');assert.equal(astra.effort,'high');
});

test('inventory keys are salted and exclude raw session metadata',()=>{
  const inventoryCode=code.slice(0,code.indexOf('print(json.dumps'))+`\npayload=json.load(sys.stdin)\na=m.inventory_metadata(payload,'salt-one'); b=m.inventory_metadata(payload,'salt-two')\nprint(json.dumps([a,b]))`;
  const output=execFileSync('python3',['-c',inventoryCode],{input:JSON.stringify({type:'session_meta',payload:{id:'PRIVATE-ID',parent_thread_id:'PRIVATE-PARENT',cwd:'PRIVATE-PATH',base_instructions:'SECRET'}})}).toString();
  const [a,b]=JSON.parse(output);
  assert.match(a.keys[0],/^[a-f0-9]{64}$/);assert.notEqual(a.keys[0],b.keys[0]);assert.equal(a.parents.length,1);
  assert.ok(!output.includes('PRIVATE'));assert.ok(!output.includes('SECRET'));
});
