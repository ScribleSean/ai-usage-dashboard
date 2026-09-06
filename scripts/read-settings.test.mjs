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
