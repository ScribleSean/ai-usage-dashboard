import {combineTokens} from './combine-tokens.mjs';

const hex=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
const hosts=['Mac','Windows','Ubuntu'];
const fields=['version','comparisonId','host','status','keys','parents'];

// Private peer evidence only. comparisonId identifies a shared salt generation,
// not the salt itself. Neither comparison keys nor the salt belong in usage.json.
export function validatePeerInventory(value,expectedHost,comparisonId) {
  if(!hosts.includes(expectedHost) || !hex(comparisonId) || !value ||
    typeof value!=='object' || Array.isArray(value) ||
    Object.keys(value).length!==fields.length || Object.keys(value).some(key=>!fields.includes(key)) ||
    value.version!==1 || value.host!==expectedHost || value.comparisonId!==comparisonId ||
    !['ok','incomplete'].includes(value.status))throw Error('Invalid peer comparison evidence');
  for(const key of ['keys','parents'])if(!Array.isArray(value[key]) || value[key].length>40000 ||
    value[key].some(item=>!hex(item)))throw Error('Invalid peer comparison evidence');
  return {status:value.status,keys:[...new Set(value.keys)].sort(),parents:[...new Set(value.parents)].sort()};
}

export function combinePeerTokens(sources,evidence,comparisonId,expectedHosts) {
  // The configured host set is supplied by pairing, never by received evidence.
  if(!Array.isArray(expectedHosts) || !Array.isArray(evidence) || evidence.length!==expectedHosts.length)
    return {host:'All',status:'unverified'};
  const inventories={};
  try {
    for(const host of expectedHosts) {
      const matches=evidence.filter(row=>row?.host===host);
      if(matches.length!==1)throw Error('Missing peer evidence');
      inventories[host]=validatePeerInventory(matches[0],host,comparisonId);
    }
  } catch {return {host:'All',status:'unverified'};}
  return combineTokens(sources,inventories,expectedHosts);
}
