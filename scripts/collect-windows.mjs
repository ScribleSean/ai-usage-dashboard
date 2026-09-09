import {spawn,execFile} from 'node:child_process';
import {readFile,writeFile,mkdir,rename,lstat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {cleanActivity,cleanSettings} from './collect-dashboard.mjs';
import {cleanWispr} from './wispr.mjs';
import {previousActivityHistory,retainActivityHistory} from './activity-history.mjs';
import {tokensFromSettings,windowsCollectorConfig} from './windows-snapshot.mjs';

const scripts=path.dirname(fileURLToPath(import.meta.url));
const unavailable=host=>({host,status:'unavailable',checkedAt:new Date().toISOString()});
const disconnected=host=>({host,status:'not-connected'});

function run(file,args,input='') {
  return new Promise((resolve,reject)=>{
    const child=spawn(file,args,{windowsHide:true,stdio:['pipe','pipe','ignore']});
    let output='',done=false;
    const finish=(error)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(output);};
    const stop=()=>{
      if(child.pid && child.exitCode===null)execFile(path.join(process.env.SystemRoot || 'C:/Windows','System32/taskkill.exe'),
        ['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});
    };
    const timer=setTimeout(()=>{stop();finish(Error('Reader timeout'));},60000);
    child.once('error',finish);
    child.stdout.on('data',data=>{output+=data;if(Buffer.byteLength(output)>16_000_000){stop();finish(Error('Reader output limit'));}});
    child.once('close',code=>finish(code===0?null:Error('Reader unavailable')));
    child.stdin.on('error',()=>{});child.stdin.end(input);
  });
}

export async function collectWindows(runtime) {
  if(process.platform!=='win32' || !path.isAbsolute(runtime))throw Error('Native Windows runtime required');
  const config=windowsCollectorConfig(JSON.parse(await readFile(path.join(runtime,'collector.config.json'),'utf8')));
  const folder=path.join(runtime,'public/local');
  await mkdir(folder,{recursive:true});
  if((await lstat(folder)).isSymbolicLink())throw Error('Unsafe runtime directory');
  const startedAt=new Date().toISOString();
  const atomic=async(name,value)=>{const file=path.join(folder,name);await writeFile(file+'.tmp',JSON.stringify(value),{mode:0o600});await rename(file+'.tmp',file);};
  await atomic('collector.json',{state:'running',startedAt,intervalSeconds:300,maxRunSeconds:240});
  const guarded=async(host,action)=>{try{return {...await action(),checkedAt:new Date().toISOString()};}catch{return unavailable(host);}};
  const python=process.env.OBSERVATORY_PYTHON || path.join(process.env.SystemRoot || 'C:/Windows','py.exe');
  const pythonArgs=path.basename(python).toLowerCase()==='py.exe'?['-3','-B','-X','utf8','-']:['-B','-X','utf8','-'];
  const wsl=path.join(process.env.SystemRoot || 'C:/Windows','System32/wsl.exe');
  const settingsScript=await readFile(path.join(scripts,'read-settings.py'),'utf8');
  const [localSettings,ubuntuSettings,windows,wispr]=await Promise.all([guarded('Windows',async()=>{
    if(!config.codex)return disconnected('Windows');
    return cleanSettings(JSON.parse(await run(python,[...pythonArgs,path.join(homedir(),'.codex')],settingsScript)),'Windows');
  }),guarded('Ubuntu',async()=>{
    if(!config.wslDistribution || !config.codex)return disconnected('Ubuntu');
    const prefix=['--distribution',config.wslDistribution,'--exec'];
    const home=(await run(wsl,[...prefix,'/usr/bin/printenv','HOME'])).trim();
    if(!/^\/home\/[A-Za-z0-9_.-]+$/.test(home))throw Error('Unsupported WSL home');
    // Invoking wsl.exe starts the selected installed distro. No terminal is required.
    return cleanSettings(JSON.parse(await run(wsl,[...prefix,'/usr/bin/timeout','55s','python3','-',home+'/.codex'],settingsScript)),'Ubuntu');
  }),guarded('Windows',async()=>{
    if(!config.activity)return disconnected('Windows');
    const powershell=path.join(process.env.SystemRoot || 'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
    const raw=JSON.parse(await run(powershell,['-NoProfile','-NonInteractive','-File',path.join(scripts,'windows-aggregate-activity.ps1')]));
    const {intervals,trackingIntervals,...safe}=cleanActivity(raw,'Windows');
    return safe;
  }),guarded('Windows',async()=>{
    if(!config.wispr)return {...disconnected('Windows'),source:'Wispr Flow'};
    const script="MODE = 'windows'\n"+await readFile(path.join(scripts,'read-wispr.py'),'utf8');
    return cleanWispr(JSON.parse(await run(python,[...pythonArgs,homedir()],script)),'Windows');
  })]);
  const tokenSource=source=>{
    if(source.status!=='ok')return {host:source.host,status:source.status,checkedAt:source.checkedAt};
    try{return {...tokensFromSettings(source,source.host),checkedAt:source.checkedAt};}catch{return unavailable(source.host);}
  };
  let previous=[];
  try{previous=await previousActivityHistory(path.join(folder,'usage.json'));}catch{}
  const collectedAt=new Date().toISOString();
  const data={schema:2,timezone:'America/New_York',collectedAt,
    activity:[disconnected('Mac'),windows],combined:unavailable('Combined'),
    tokens:[disconnected('Mac'),tokenSource(localSettings),tokenSource(ubuntuSettings)],combinedTokens:unavailable('All'),
    settings:[localSettings,ubuntuSettings],combinedSettings:unavailable('All'),
    dictation:[{...wispr,source:'Wispr Flow'}],agents:[],agentSource:disconnected('Local'),
    quota:disconnected('Codex account'),localModel:disconnected('Ubuntu')};
  data.activityHistory=retainActivityHistory(previous,data.activity,collectedAt);
  await atomic('usage.json',data);
  const sources=[...data.activity,...data.tokens,...data.settings,...data.dictation].filter(source=>source.status!=='not-connected');
  const read=sources.filter(source=>source.status==='ok').length;
  await atomic('collector.json',{state:sources.length && read===sources.length?'ok':'partial',startedAt,finishedAt:new Date().toISOString(),
    snapshotAt:collectedAt,intervalSeconds:300,maxRunSeconds:240,sourcesRead:read,sourcesConfigured:sources.length});
  console.log(JSON.stringify({state:read===sources.length?'ok':'partial',sourcesRead:read,sourcesConfigured:sources.length}));
}

if(process.argv[1]===fileURLToPath(import.meta.url))collectWindows(process.env.OBSERVATORY_RUNTIME || '').catch(()=>{console.error('Windows collection unavailable');process.exitCode=1;});
