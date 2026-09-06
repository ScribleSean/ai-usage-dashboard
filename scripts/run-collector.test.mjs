import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const reader=path.resolve('scripts/run-collector.py');
const code=`import importlib.util,sys\ns=importlib.util.spec_from_file_location('runner',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nprint(m.run_collection(sys.argv[2],sys.argv[3],300,float(sys.argv[4])))`;
const success=`require('fs').writeFileSync('public/local/usage.json',JSON.stringify({collectedAt:new Date().toISOString(),activity:[{status:'ok'}],tokens:[],settings:[]}));`;
async function fixture(t,script) {
  const root=await mkdtemp(path.join(tmpdir(),'dashboard-runner-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'scripts'));
  await writeFile(path.join(root,'scripts/collect-dashboard.mjs'),`import {createRequire} from 'node:module';const require=createRequire(import.meta.url);${script}`);
  return root;
}
const run=(root,timeout=5)=>execFileSync('python3',['-c',code,reader,root,process.execPath,String(timeout)],{encoding:'utf8'}).trim();
const status=root=>readFile(path.join(root,'public/local/collector.json'),'utf8').then(JSON.parse);

test('runner publishes only safe status metadata after a successful collection',async t=>{
  const root=await fixture(t,`console.log('PRIVATE OUTPUT');console.error('SECRET');${success}`);
  assert.equal(run(root),'ok');const s=await status(root);
  assert.equal(s.intervalSeconds,300);assert.equal(s.sourcesRead,1);assert.equal(s.state,'ok');
  assert.ok(!JSON.stringify(s).includes('PRIVATE'));assert.ok(!JSON.stringify(s).includes('SECRET'));assert.ok(!JSON.stringify(s).includes(root));
});
test('failure preserves the preceding snapshot and records no error text',async t=>{
  const root=await fixture(t,`throw Error('SECRET')`);
  await mkdir(path.join(root,'public/local'),{recursive:true});
  await writeFile(path.join(root,'public/local/usage.json'),'previous snapshot');
  assert.equal(run(root),'failed');assert.equal(await readFile(path.join(root,'public/local/usage.json'),'utf8'),'previous snapshot');
  assert.equal((await status(root)).state,'failed');
});
test('a timed-out reader is stopped and the operating-system lock is released',async t=>{
  const root=await fixture(t,`setInterval(()=>{},1000);`);
  assert.equal(run(root,0.1),'failed');
  await writeFile(path.join(root,'scripts/collect-dashboard.mjs'),`import {createRequire} from 'node:module';const require=createRequire(import.meta.url);${success}`);
  assert.equal(run(root),'ok');
});
test('overlapping collection is skipped without replacing running status',async t=>{
  const root=await fixture(t,`setTimeout(()=>{${success}},800);`);
  const child=spawn('python3',['-c',code,reader,root,process.execPath,'5']);
  const finished=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',resolve);});
  t.after(()=>{if(child.exitCode===null)child.kill();});
  for(let i=0;i<100;i++) {
    if(await status(root).then(s=>s.state==='running').catch(()=>false))break;
    await new Promise(r=>setTimeout(r,10));
  }
  assert.equal((await status(root)).state,'running');assert.equal(run(root),'busy');assert.equal((await status(root)).state,'running');
  assert.equal(await finished,0);assert.equal((await status(root)).state,'ok');
});
