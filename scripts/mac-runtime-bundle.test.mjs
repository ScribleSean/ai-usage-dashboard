import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectRuntime} from '../native/mac/runtime-bundle.mjs';
import {execPython} from './test-python.mjs';
import {fileURLToPath} from 'node:url';

test('Python runtime packaging and license guards pass on the current build host',()=>{
  execPython([fileURLToPath(new URL('../native/mac/test_prepare_runtime.py',import.meta.url))],{stdio:'pipe',timeout:15000});
});

function fixture(run) {
  const root=mkdtempSync(path.join(tmpdir(),'observatory-runtime-fixture-'));
  const assets={fixture:true},manifest={schema:1,assets,files:{},symlinks:{}};
  for(const name of ['node/bin/node','node/LICENSE','python/bin/python3.13','python/licenses/LICENSE.cpython.txt']) {
    const file=path.join(root,name),data=Buffer.from('fixture-'+name);
    mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,data);
    manifest.files[name]=createHash('sha256').update(data).digest('hex');
  }
  const save=()=>writeFileSync(path.join(root,'runtime-manifest.json'),JSON.stringify(manifest));
  save();
  try{run({root,assets,manifest,save});}finally{rmSync(root,{recursive:true,force:true});}
}

test('runtime manifest accepts the exact payload and rejects changed, extra, or missing files',()=>{
  fixture(({root,assets})=>{
    assert.deepEqual(inspectRuntime(root,assets),[]);
    const file=path.join(root,'node/LICENSE'),original=readFileSync(file);
    writeFileSync(file,'changed');assert.throws(()=>inspectRuntime(root,assets),/mismatch/);
    writeFileSync(file,original);
    const extra=path.join(root,'unexpected');writeFileSync(extra,'extra');
    assert.throws(()=>inspectRuntime(root,assets),/mismatch/);rmSync(extra);
    rmSync(file);assert.throws(()=>inspectRuntime(root,assets),/missing/);
  });
});

test('runtime manifest refuses stale provenance and generated caches',()=>{
  fixture(({root,assets,manifest,save})=>{
    assert.throws(()=>inspectRuntime(root,{different:true}),/provenance/);
    delete manifest.schema;save();assert.throws(()=>inspectRuntime(root,assets),/schema/);
    manifest.schema=1;save();mkdirSync(path.join(root,'__pycache__'));
    assert.throws(()=>inspectRuntime(root,assets),/cache/);
  });
});

test('runtime symlinks must match the manifest and remain inside the payload', {skip:process.platform==='win32'},()=>{
  fixture(({root,assets,manifest,save})=>{
    const link=path.join(root,'python/bin/python3');
    symlinkSync('python3.13',link);
    assert.throws(()=>inspectRuntime(root,assets),/symlink mismatch/);
    manifest.symlinks['python/bin/python3']='python3.13';save();
    assert.deepEqual(inspectRuntime(root,assets),[]);
    rmSync(link);assert.throws(()=>inspectRuntime(root,assets),/missing symlinks/);
    symlinkSync(process.execPath,link);assert.throws(()=>inspectRuntime(root,assets),/Escaping/);
  });
});
