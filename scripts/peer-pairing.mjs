import {randomBytes} from 'node:crypto';
import {open,lstat,readdir,unlink} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
import path from 'node:path';
import {privateSyncDirectory} from './peer-directory.mjs';
import {preparePeerCollection} from './peer-collection.mjs';
import {validatePeerTransport} from './peer-transport.mjs';
import {assertPeerNotRevoked} from './peer-revocation.mjs';

const exact=(value,keys)=>value && typeof value==='object' && !Array.isArray(value) &&
  Object.keys(value).length===keys.length && Object.keys(value).every(key=>keys.includes(key));
const hosts=host=>host==='Mac'?['Mac']:['Windows'];
export function validatePairing(value) {
  if(!(exact(value,['version','local','peer']) || exact(value,['version','local','peer','transport'])) || value.version!==1 ||
    !exact(value.peer,['pairId','deviceId','comparisonId','host','codexHosts']))throw Error('Invalid private pairing');
  const local=value.local,peer=value.peer;
  const configured=source=>source.host==='Windows' && source.codexHosts?.length===2?['Windows','Ubuntu']:hosts(source.host);
  const safe=preparePeerCollection(local,local?.host,configured(local));
  const remote=preparePeerCollection({...peer,comparisonSalt:local.comparisonSalt},peer.host,configured(peer));
  if(local.host===peer.host || local.deviceId===peer.deviceId || local.pairId!==peer.pairId ||
    local.comparisonId!==peer.comparisonId)throw Error('Mismatched private pairing');
  const result={version:1,local:{...safe.config,comparisonSalt:local.comparisonSalt},peer:remote.config};
  if(Object.hasOwn(value,'transport')) {
    if(local.host!=='Mac' || peer.host!=='Windows')throw Error('Unsupported transport direction');
    result.transport=validatePeerTransport(value.transport);
  }
  return result;
}

// Returns private configuration in memory only. Delivery requires authenticated
// transport and explicit device setup. Never print this return value to logs.
export function createPairingConfigurations(includeUbuntu=false) {
  if(typeof includeUbuntu!=='boolean')throw Error('Explicit Ubuntu configuration required');
  const id=()=>randomBytes(32).toString('hex');
  const shared={pairId:id(),comparisonId:id()},comparisonSalt=id();
  const mac={...shared,deviceId:id(),host:'Mac',codexHosts:['Mac']};
  const windows={...shared,deviceId:id(),host:'Windows',codexHosts:includeUbuntu?['Windows','Ubuntu']:['Windows']};
  return {Mac:validatePairing({version:1,local:{...mac,comparisonSalt},peer:windows}),
    Windows:validatePairing({version:1,local:{...windows,comparisonSalt},peer:mac})};
}

export async function initializePairing(runtime,value) {
  const safe=validatePairing(value),bytes=JSON.stringify(safe);
  if(Buffer.byteLength(bytes)>4096)throw Error('Private pairing size limit');
  const directory=await privateSyncDirectory(runtime,true);
  if((await readdir(directory)).length)throw Error('Private state already exists; explicit repair or rotation required');
  const file=await open(path.join(directory,'pairing.json'),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);
  try {await file.writeFile(bytes);await file.sync();}finally{await file.close();}
  // Check the resulting inherited Windows ACL before any collector uses it.
  await privateSyncDirectory(runtime);
}

async function readPairingFile(runtime,filename) {
  let directory;
  try {directory=await privateSyncDirectory(runtime);}catch(error){if(error.code==='ENOENT')return null;throw error;}
  await assertPeerNotRevoked(directory);
  const name=path.join(directory,filename);
  let before;
  try {before=await lstat(name);}catch(error){if(error.code==='ENOENT')return null;throw error;}
  if(!before.isFile() || before.isSymbolicLink() || before.nlink!==1 || before.size>4096 ||
    (process.platform!=='win32' && (before.mode&0o077)))throw Error('Unsafe private pairing file');
  const file=await open(name,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  try {
    const opened=await file.stat();
    if(opened.dev!==before.dev || opened.ino!==before.ino || opened.size!==before.size)throw Error('Changing private pairing file');
    const bytes=Buffer.alloc(4097),{bytesRead}=await file.read(bytes,0,bytes.length,0);
    const after=await file.stat();
    if(bytesRead!==before.size || after.size!==before.size || after.mtimeMs!==before.mtimeMs)throw Error('Changing private pairing file');
    return validatePairing(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,bytesRead))));
  } finally {await file.close();}
}

export const readPairing=runtime=>readPairingFile(runtime,'pairing.json');
export const readPendingPairing=runtime=>readPairingFile(runtime,'setup.pending.json');

async function writeSetupFile(directory,name,value) {
  const bytes=JSON.stringify(validatePairing(value));
  if(Buffer.byteLength(bytes)>4096)throw Error('Private pairing size limit');
  const file=await open(path.join(directory,name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);
  try {await file.writeFile(bytes);await file.sync();}finally{await file.close();}
}

// Pending state is not consumed by collectors. A failed remote acknowledgement
// leaves the same generation available for an explicit retry.
export async function preparePendingPairing(runtime,value) {
  const safe=validatePairing(value);
  if(safe.local.host!=='Mac' || !safe.transport)throw Error('Mac setup transport required');
  const directory=await privateSyncDirectory(runtime,true);
  await assertPeerNotRevoked(directory);
  if((await readdir(directory)).length)throw Error('Existing private state requires resume or repair');
  await writeSetupFile(directory,'setup.pending.json',safe);
  await privateSyncDirectory(runtime);
  return safe;
}

// Only call after the authenticated peer acknowledged this exact generation.
// Exclusive creation prevents overwriting an active or partially written file.
// A corrupt partial file needs explicit repair; it is never silently replaced.
export async function activatePendingPairing(runtime,expected) {
  const safe=validatePairing(expected),directory=await privateSyncDirectory(runtime);
  await assertPeerNotRevoked(directory);
  let active=await readPairing(runtime),pending=await readPendingPairing(runtime);
  if(active && !isDeepStrictEqual(active,safe))throw Error('Conflicting active pairing');
  if(pending && !isDeepStrictEqual(pending,safe))throw Error('Conflicting pending pairing');
  if(!active) {
    if(!pending || (await readdir(directory)).some(name=>name!=='setup.pending.json'))
      throw Error('Pending pairing unavailable or private state needs repair');
    try {await writeSetupFile(directory,'pairing.json',safe);}
    catch(error) {if(error.code!=='EEXIST')throw error;}
    active=await readPairing(runtime);
    if(!isDeepStrictEqual(active,safe))throw Error('Pairing activation could not be verified');
  }
  await assertPeerNotRevoked(directory);
  pending=await readPendingPairing(runtime);
  if(pending) {
    if(!isDeepStrictEqual(pending,safe))throw Error('Pending pairing changed');
    await unlink(path.join(directory,'setup.pending.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
  }
  return active;
}
