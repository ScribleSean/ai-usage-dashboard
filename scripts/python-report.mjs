import { spawn } from 'node:child_process';
export function pythonReport(host, script, folder) {
  if (!/^\/[a-zA-Z0-9_./-]+$/.test(folder) || (host && !/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(host))) throw Error('Invalid report location');
  return new Promise((resolve,reject) => {
    const child = host ? spawn('/usr/bin/ssh',['-T','-oBatchMode=yes','-oConnectTimeout=8',host,'python3 - '+folder],{stdio:['pipe','pipe','ignore']}) : spawn('python3',['-',folder],{stdio:['pipe','pipe','ignore']});
    let output='', settled=false;
    const finish = (error,value) => { if(settled)return;settled=true;clearTimeout(timer);if(error){child.kill();reject(error);}else resolve(value); };
    const timer=setTimeout(()=>finish(Error('Report timed out')),60000);
    child.on('error',()=>finish(Error('Reader unavailable')));
    child.stdin.on('error',()=>finish(Error('Reader closed')));
    child.stdout.on('data',b=>{output+=b;if(output.length>8*1024*1024)finish(Error('Report too large'));});
    child.on('close',code=>{if(code)return finish(Error('Reader failed'));try{finish(null,JSON.parse(output));}catch{finish(Error('Invalid report'));}});
    child.stdin.end(script);
  });
}
