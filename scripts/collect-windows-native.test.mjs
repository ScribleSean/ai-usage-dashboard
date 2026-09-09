import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

test('native Windows entry point preserves standalone collection without peer configuration',
  {skip:process.platform!=='win32'},async t=>{
    const runtime=await mkdtemp(path.join(tmpdir(),'observatory-windows-peer-test-'));
    t.after(()=>rm(runtime,{recursive:true,force:true}));
    await writeFile(path.join(runtime,'collector.config.json'),JSON.stringify({activity:false,codex:false,wispr:false,wslDistribution:null}));
    const output=execFileSync(process.execPath,[fileURLToPath(new URL('./collect-windows.mjs',import.meta.url))],
      {env:{...process.env,OBSERVATORY_RUNTIME:runtime},encoding:'utf8',timeout:20000});
    assert.deepEqual(JSON.parse(output),{state:'partial',sourcesRead:0,sourcesConfigured:0});
    const data=JSON.parse(await readFile(path.join(runtime,'public/local/usage.json'),'utf8'));
    assert.equal(data.schema,2);assert.ok(data.tokens.every(source=>source.status==='not-connected'));
    assert.ok(data.activity.every(source=>source.status==='not-connected'));
    assert.equal(data.combinedTokens.status,'unavailable');
    assert.deepEqual((await readdir(runtime)).sort(),['collector.config.json','public']);
    const status=JSON.parse(await readFile(path.join(runtime,'public/local/collector.json'),'utf8'));
    assert.equal(status.state,'partial');assert.equal(status.snapshotAt,data.collectedAt);
  });
