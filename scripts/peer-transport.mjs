import {execFile} from 'node:child_process';
import path from 'node:path';

const fields=['kind','hostAlias','remoteNode','remoteScript','remoteRuntime'];
function windowsPath(value) {
  return typeof value==='string' && value.length<=1024 && /^[A-Za-z]:[\\/]/.test(value) &&
    !/[\x00-\x1f\x7f]/.test(value) && !value.split(/[\\/]/).some(part=>part==='..' || part==='.') &&
    !value.slice(2).includes(':');
}
export function validatePeerTransport(value) {
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).length!==fields.length ||
    Object.keys(value).some(key=>!fields.includes(key)) || value.kind!=='ssh-windows' ||
    typeof value.hostAlias!=='string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value.hostAlias) ||
    !['remoteNode','remoteScript','remoteRuntime'].every(key=>windowsPath(value[key])) ||
    path.win32.basename(value.remoteNode).toLowerCase()!=='node.exe' ||
    path.win32.basename(value.remoteScript)!=='peer-exchange.mjs')throw Error('Invalid private SSH transport');
  return Object.fromEntries(fields.map(key=>[key,value[key]]));
}

function runSSH(args,input) {
  return new Promise((resolve,reject)=>{
    const child=execFile('/usr/bin/ssh',args,{timeout:30000,killSignal:'SIGKILL',maxBuffer:17_000_000},(error,stdout)=>{
      if(error)reject(Error('Private SSH exchange unavailable'));else resolve(stdout);
    });
    child.stdin.on('error',()=>{});child.stdin.end(input);
  });
}

// Only the Mac initiates transport. Windows receives through its existing SSH
// account and updates its dashboard on its next independent collection cycle.
export async function sshPeerExchange(transport,record,invoke=runSSH) {
  const safe=validatePeerTransport(transport);
  const quote=value=>"'"+value.replaceAll("'","''")+"'";
  const command=`& ${quote(safe.remoteNode)} ${quote(safe.remoteScript)} ${quote(safe.remoteRuntime)}; exit $LASTEXITCODE`;
  const encoded=Buffer.from(command,'utf16le').toString('base64');
  const args=['-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','PasswordAuthentication=no',
    '-o','KbdInteractiveAuthentication=no','-o','ConnectTimeout=8',safe.hostAlias,
    `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`];
  const input=JSON.stringify({version:1,record});
  if(Buffer.byteLength(input)>17_000_000)throw Error('Private SSH request limit');
  const output=await invoke(args,input);
  if(typeof output!=='string' || Buffer.byteLength(output)>17_000_000)throw Error('Private SSH response limit');
  const response=JSON.parse(output);
  if(!response || typeof response!=='object' || Array.isArray(response) || response.version!==1 ||
    Object.keys(response).length!==2 || !Object.hasOwn(response,'record'))throw Error('Invalid private SSH response');
  return response.record; // The caller must validate and commit against saved peer identity.
}
