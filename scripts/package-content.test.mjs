import test from 'node:test';
import assert from 'node:assert/strict';
import {forbiddenPackageName,containsBuildPath} from '../native/windows/package-content.mjs';

test('package guard rejects private data, cache and debug names without depending on case',()=>{
  for(const name of ['usage.json','Usage.JSON','COLLECTOR.CONFIG.JSON','.env.local','capture.sqlite','session.JSONL','app.PDB','__pycache__','WebViewCache'])assert.equal(forbiddenPackageName(name),true,name);
  for(const name of ['LICENSE.txt','node.exe','python313.zip','package-manifest.json'])assert.equal(forbiddenPackageName(name),false,name);
});
test('package guard detects plain, escaped, UTF-16 and case-varied build paths',()=>{
  const root='C:\\Users\\SyntheticBuilder';
  for(const value of [root,root.toUpperCase(),root.replaceAll('\\','/'),JSON.stringify(root).slice(1,-1)]) {
    assert.equal(containsBuildPath(Buffer.from(`prefix ${value} suffix`),[root]),true);
    assert.equal(containsBuildPath(Buffer.from(`prefix ${value} suffix`,'utf16le'),[root]),true);
  }
  assert.equal(containsBuildPath(Buffer.from('Public product files only'),[root]),false);
  assert.equal(containsBuildPath(Buffer.from('Public product files only'),[undefined,'']),false);
});
