import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validPackagePath,verifyManifest} from '../native/windows/verify-manifest.mjs';

function fixture(fn) {
  const root=mkdtempSync(path.join(tmpdir(),'observatory-manifest-test-'));
  const bytes=Buffer.from('synthetic test bytes');
  const manifest={schema:1,platform:'win-x64',sourceRevision:'a'.repeat(40),sourceDirty:false,totalBytes:bytes.length,
    files:[{path:'example.txt',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]};
  const save=()=>writeFileSync(path.join(root,'package-manifest.json'),JSON.stringify(manifest));
  writeFileSync(path.join(root,'example.txt'),bytes); save();
  try{fn(root,manifest,save);}finally{rmSync(root,{recursive:true,force:true});}
}
test('literal Windows package names reject traversal, script syntax and private files',()=>{
  for(const value of ['../file','C:/file','dir\\file','a/$INSTDIR','a/"quote','a/*','a/CON.txt','a/nul','a/end.','a/end ','a:stream','a/usage.json','a/.env','a/__pycache__/x','a/node_modules/x','a/../x','/root',''])
    assert.equal(validPackagePath(value),false,value);
  for(const value of ['Web/assets/index-AB_12.js','Runtime/python/tzdata/zoneinfo/Etc/GMT-12','Licenses/Node-LICENSE.txt'])
    assert.equal(validPackagePath(value),true,value);
});
test('verified manifest is read without being replaced',()=>fixture((root,manifest)=>assert.deepEqual(verifyManifest(root),manifest)));
test('dirty source requires an explicit development option',()=>fixture((root,manifest,save)=>{
  manifest.sourceDirty=true;save();assert.throws(()=>verifyManifest(root));assert.equal(verifyManifest(root,{allowDirty:true}).sourceDirty,true);
}));
test('changed, missing and additional payload files fail',()=>{
  fixture(root=>{writeFileSync(path.join(root,'example.txt'),'different test bytes');assert.throws(()=>verifyManifest(root));});
  fixture(root=>{rmSync(path.join(root,'example.txt'));assert.throws(()=>verifyManifest(root));});
  fixture(root=>{writeFileSync(path.join(root,'extra.txt'),'extra');assert.throws(()=>verifyManifest(root));});
});
test('duplicate paths, wrong totals and unsafe paths fail',()=>{
  fixture((root,manifest,save)=>{manifest.files.push({...manifest.files[0],path:'EXAMPLE.txt'});manifest.totalBytes*=2;save();assert.throws(()=>verifyManifest(root));});
  fixture((root,manifest,save)=>{manifest.totalBytes++;save();assert.throws(()=>verifyManifest(root));});
  fixture((root,manifest,save)=>{manifest.files[0].path='../example.txt';save();assert.throws(()=>verifyManifest(root));});
});
test('directory links are not followed',()=>fixture(root=>{
  // Junctions do not need Windows developer mode or administrator privileges.
  symlinkSync(root,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>verifyManifest(root));
}));
