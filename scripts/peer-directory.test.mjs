import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,rm,mkdir,chmod,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {privateSyncDirectory} from './peer-directory.mjs';

async function fixture(t) {
  const runtime=await realpath(await mkdtemp(path.join(tmpdir(),'observatory-private-acl-')));
  t.after(()=>rm(runtime,{recursive:true,force:true}));return runtime;
}
function grantEveryone(file) {
  const executable=path.join(process.env.SystemRoot || 'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
  const literal="'"+file.replaceAll("'","''")+"'";
  const input=`$ErrorActionPreference='Stop'; $file=${literal}; $acl=Get-Acl -LiteralPath $file;
    $sid=New-Object Security.Principal.SecurityIdentifier('S-1-1-0');
    $rule=New-Object Security.AccessControl.FileSystemAccessRule($sid,'Read','Allow');
    $acl.AddAccessRule($rule); Set-Acl -LiteralPath $file -AclObject $acl;`;
  execFileSync(executable,['-NoProfile','-NonInteractive','-Command','-'],{input,encoding:'utf8',timeout:15000});
}
test('private directory is created with verified permissions and can be reused',async t=>{
  const runtime=await fixture(t),directory=await privateSyncDirectory(runtime,true);
  assert.equal(directory,path.join(runtime,'private-sync'));
  await writeFile(path.join(directory,'pairing.json'),'{}',{mode:0o600});
  assert.equal(await privateSyncDirectory(runtime),directory);
});
test('an existing broadly accessible directory is rejected, not silently repaired',async t=>{
  const runtime=await fixture(t),directory=path.join(runtime,'private-sync');
  if(process.platform==='win32') {await privateSyncDirectory(runtime,true);grantEveryone(directory);}
  else {await mkdir(directory);await chmod(directory,0o755);}
  await assert.rejects(privateSyncDirectory(runtime,true));
  await assert.rejects(privateSyncDirectory(runtime,false));
});
test('Windows file-level broad grants are rejected despite a private parent',
  {skip:process.platform!=='win32'},async t=>{
    const runtime=await fixture(t),directory=await privateSyncDirectory(runtime,true);
    const file=path.join(directory,'pairing.json');await writeFile(file,'{}');grantEveryone(file);
    await assert.rejects(privateSyncDirectory(runtime));
  });
