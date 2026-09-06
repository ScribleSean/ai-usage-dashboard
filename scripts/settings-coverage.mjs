// Never force detailed counters to match a different accounting snapshot.
export function settingsCoverage(model, rows) {
  const fields=['inputTokens','cacheReadTokens','cacheCreationTokens','outputTokens','totalTokens'];
  const total=key=>rows.reduce((sum,row)=>sum+(typeof row[key]==='number'?row[key]:NaN),0);
  if (!rows.length || model.inferred) return {status:'missing', rows:[], knownTokens:0};
  if (fields.some(key=>typeof model[key]!=='number' || !Number.isFinite(total(key)) || total(key)>model[key]))
    return {status:'unreconciled',rows:[],knownTokens:0};
  const knownTokens=total('totalTokens');
  return {status:knownTokens===model.totalTokens?'matched':'partial',rows,knownTokens};
}
