import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {sourceState} from '../native/source-state.mjs';

test('source state catches untracked, staged and unstaged changes but not normalized line endings',()=>{
  const root=mkdtempSync(path.join(tmpdir(),'observatory-source-state-'));
  const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'ignore'});
  const file=path.join(root,'fixture.txt');
  try {
    git('init');git('config','core.autocrlf','true');
    writeFileSync(file,'first\r\n');git('add','fixture.txt');
    git('-c','user.name=Test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','commit','-m','Synthetic fixture');
    assert.equal(sourceState(root).dirty,false);
    writeFileSync(file,'first\n');assert.equal(sourceState(root).dirty,false);
    writeFileSync(file,'changed\n');assert.equal(sourceState(root).dirty,true);
    git('add','fixture.txt');assert.equal(sourceState(root).dirty,true);
    git('-c','user.name=Test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','commit','-m','Changed fixture');
    assert.equal(sourceState(root).dirty,false);
    writeFileSync(path.join(root,'new.txt'),'new');assert.equal(sourceState(root).dirty,true);
  } finally {rmSync(root,{recursive:true,force:true});}
});
