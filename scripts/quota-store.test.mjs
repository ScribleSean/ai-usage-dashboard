import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,stat,symlink,writeFile,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readQuotaState,updateQuotaState} from './quota-store.mjs';
const now=Date.parse('2026-09-09T12:00:00Z'),scope='a'.repeat(64);
const observation={status:'ok',checkedAt:new Date(now).toISOString(),windows:[{bucket:'codex',window:'primary',remainingPercent:75}]};
async function fixture(action) {const runtime=await realpath(await mkdtemp(path.join(tmpdir(),'observatory-quota-')));try{await action(runtime);}finally{await rm(runtime,{recursive:true,force:true});}}
test('quota store survives reopen with private permissions and persisted retry deadline',async()=>fixture(async runtime=>{
  const initial=await readQuotaState(runtime,now);
  const result=await updateQuotaState(runtime,{revision:initial.revision,scope,observation,nextAttemptAt:now+300000},now);
  const reopened=await readQuotaState(runtime,now+1000);
  assert.equal(reopened.salt,initial.salt);assert.equal(reopened.revision,result.revision);
  assert.equal(reopened.history.status,'stale');assert.equal(reopened.history.samples.length,1);
  assert.equal(reopened.nextAttemptAt,now+300000);
  if(process.platform!=='win32')assert.equal((await stat(path.join(runtime,'private-quota/state.sqlite'))).mode&0o077,0);
}));
test('quota store rejects late writes after disabling and does not resurrect readings',async()=>fixture(async runtime=>{
  const initial=await readQuotaState(runtime,now);
  const first=await updateQuotaState(runtime,{revision:initial.revision,scope,observation},now);
  await updateQuotaState(runtime,{revision:first.revision,enabled:false},now);
  await assert.rejects(updateQuotaState(runtime,{revision:first.revision,scope,observation},now),/superseded/);
  const final=await readQuotaState(runtime,now);
  assert.equal(final.history.status,'not-connected');assert.deepEqual(final.history.samples,[]);
}));
test('quota store refuses symlinked state without modifying its target',{skip:process.platform==='win32'},async()=>fixture(async runtime=>{
  const directory=path.join(runtime,'private-quota');await mkdir(directory,{mode:0o700});
  const target=path.join(runtime,'sentinel');await writeFile(target,'preserve');
  await symlink(target,path.join(directory,'state.sqlite'));
  await assert.rejects(readQuotaState(runtime,now));assert.equal(await readFile(target,'utf8'),'preserve');
}));
