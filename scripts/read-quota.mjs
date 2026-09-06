import { spawn } from 'node:child_process';

export function cleanQuota(result) {
  const windows = [];
  const buckets = result.rateLimitsByLimitId || (result.rateLimits ? {default:result.rateLimits} : {});
  for (const [id, bucket] of Object.entries(buckets)) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) continue;
    for (const name of ['primary','secondary']) {
      const w = bucket?.[name];
      if (!w || typeof w.usedPercent !== 'number' || !Number.isFinite(w.usedPercent) || w.usedPercent < 0 || w.usedPercent > 100) continue;
      windows.push({bucket:id, window:name, remainingPercent:100-w.usedPercent,
        durationMinutes:Number.isInteger(w.windowDurationMins) && w.windowDurationMins > 0 ? w.windowDurationMins : null,
        resetsAt:Number.isSafeInteger(w.resetsAt) && w.resetsAt > 0 && w.resetsAt < 8640000000000 ? new Date(w.resetsAt * 1000).toISOString() : null});
    }
  }
  return {status:windows.length ? 'ok' : 'unavailable', checkedAt:new Date().toISOString(), provider:'Codex', windows};
}

export function readQuota(executable) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['app-server'], {stdio:['pipe','pipe','ignore']});
    let buffer = '', done = false;
    const finish = (error, value) => {
      if (done) return;
      done = true; clearTimeout(timer); child.kill();
      if (error) reject(error); else resolve(value);
    };
    const timer = setTimeout(() => finish(Error('Quota read timed out')), 15000);
    const send = value => child.stdin.write(JSON.stringify(value)+'\n');
    child.on('error', () => finish(Error('Quota client unavailable')));
    child.on('exit', () => { if (!done) finish(Error('Quota client closed')); });
    child.stdin.on('error', () => finish(Error('Quota client closed')));
    child.stdout.on('data', bytes => {
      buffer += bytes;
      if (buffer.length > 1_000_000) return finish(Error('Quota response too large'));
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0,end); buffer = buffer.slice(end+1);
        let row; try { row = JSON.parse(line); } catch { continue; }
        if (row.id === 1) {
          if (row.error) return finish(Error('Quota handshake failed'));
          send({method:'initialized'});
          send({id:2,method:'account/rateLimits/read',params:{}});
        } else if (row.id === 2) {
          if (row.error) return finish(Error('Quota unavailable'));
          try { finish(null,cleanQuota(row.result)); } catch { finish(Error('Invalid quota response')); }
        }
      }
    });
    send({id:1,method:'initialize',params:{clientInfo:{name:'usage_dashboard',version:'0.1.0'}}});
  });
}
