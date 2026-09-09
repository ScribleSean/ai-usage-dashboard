import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nsisLiteral,payloadLists} from '../native/windows/generate-installer.mjs';

test('installer values escape NSIS expansion and reject line injection',()=>{
  assert.equal(nsisLiteral('C:\\Build $name\\"quoted"'),'C:\\Build $$name\\$\\"quoted$\\"');
  assert.throws(()=>nsisLiteral('value\nFile other'));
  assert.throws(()=>nsisLiteral('value\0other'));
});
test('payload commands name individual files and remove deepest empty folders first',()=>{
  const lists=payloadLists({files:[{path:'Runtime/python/tzdata/file.txt'},{path:'LICENSE'}]},'C:/candidate');
  assert.ok(lists.install.includes('"/oname=file.txt"'));
  assert.ok(lists.uninstall.includes('Delete "$INSTDIR\\Runtime\\python\\tzdata\\file.txt"'));
  assert.ok(lists.uninstall.includes('Delete "$INSTDIR\\package-manifest.json"'));
  assert.equal(lists.directories.split('\n')[0],'RMDir "$INSTDIR\\Runtime\\python\\tzdata"');
  assert.ok(!/\/r\b|\*/i.test(lists.uninstall+lists.directories));
  assert.ok(lists.checks.includes('Call un.NoLinkedPath'));
  assert.throws(()=>payloadLists({files:[{path:'Uninstall.exe'}]},'C:/candidate'));
});
test('installer is per-user, source startup is opt-in and uninstall has ownership gates',()=>{
  const script=readFileSync(new URL('../native/windows/installer.nsi',import.meta.url),'utf8');
  assert.match(script,/RequestExecutionLevel user/);
  assert.match(script,/StrCmp \$INSTDIR \$1 0 wrong_owner/);
  assert.match(script,/ReadINIStr \$0 .* "Revision"/);
  assert.match(script,/EnumRegValue \$0 HKCU/);
  assert.doesNotMatch(script,/RMDir\s+\/r\b|Delete\s+.*\*|WriteReg\w+ HKLM|Reboot\b/);
  assert.doesNotMatch(script,/WriteReg\w+ .*CurrentVersion\\Run"/);
  assert.match(script,/ReadRegStr .*CurrentVersion\\Run"/);
  assert.match(script,/Call un\.CheckRunning/);
  assert.match(script,/Saved collection data/);
});
