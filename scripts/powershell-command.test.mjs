import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {powershellCommand} from './powershell-command.mjs';
test('Windows adapter round-trips below the SSH command-line limit',()=>{
  const source=readFileSync(new URL('./windows-aggregate-activity.ps1',import.meta.url),'utf8');
  const command=powershellCommand(source);
  assert.ok(command.length<7900);
  const loader=Buffer.from(command.split(' ').at(-1),'base64').toString('utf16le');
  const payload=loader.match(/FromBase64String\('([^']+)'\)/)[1];
  assert.equal(gunzipSync(Buffer.from(payload,'base64')).toString('utf8'),source);
});
