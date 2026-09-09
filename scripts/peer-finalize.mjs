import {mergePeerPayloads} from './peer-payload.mjs';
import {sshPeerExchange} from './peer-transport.mjs';

// A sync failure must not replace a valid standalone dashboard with an error.
export async function finalizePeerCollection(runtime,result,pairing,previous=[],now=Date.now()) {
  if(!pairing || result.peer?.status!=='ready')return result;
  try {
    const {publishLocalPayload,readPeerState,acceptPeerState}=await import('./peer-store.mjs');
    const local=await publishLocalPayload(runtime,result.peer.payload,pairing.local,now);
    let transport='not-configured';
    if(pairing.transport && process.platform==='darwin') {
      try {
        const incoming=await sshPeerExchange(pairing.transport,local);
        await acceptPeerState(runtime,incoming,pairing.peer,Date.now());
        transport='ok';
      } catch {transport='unavailable';}
    }
    const peer=await readPeerState(runtime,pairing.peer,now);
    if(peer)result.data=mergePeerPayloads(local.payload,peer.payload,pairing.local,pairing.peer,previous,now);
    result.peer={status:peer?'merged':'waiting',sequence:local.revision.sequence,transport};
  } catch {result.peer={status:'unavailable'};}
  return result;
}
