export function freshness(timestamp, now=Date.now(), staleAfterSeconds=600) {
  const value=typeof timestamp==='string'?Date.parse(timestamp):NaN;
  if (!Number.isFinite(value) || !Number.isFinite(now) || value>now+60000)
    return {state:'unknown',label:'Time unknown',ageSeconds:null};
  const seconds=Math.max(0,Math.floor((now-value)/1000));
  const label=seconds<60?'just now':seconds<3600?`${Math.floor(seconds/60)}m ago`:seconds<86400?`${Math.floor(seconds/3600)}h ago`:`${Math.floor(seconds/86400)}d ago`;
  return {state:seconds>staleAfterSeconds?'stale':'recent',label,ageSeconds:seconds};
}
