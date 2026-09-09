import {cleanActivity,cleanSettings} from './collect-dashboard.mjs';
import {tokensFromSettings} from './windows-snapshot.mjs';
import {cleanDictation} from './typewhisper.mjs';
import {cleanWispr} from './wispr.mjs';
import {retainActivityHistory} from './activity-history.mjs';

export function macCollectorConfig(raw) {
  const keys=['activity','codex','wispr','typewhisper'];
  if(!raw || typeof raw!=='object' || Array.isArray(raw) ||
    Object.keys(raw).some(key=>!keys.includes(key) || typeof raw[key]!=='boolean'))throw Error('Invalid local Mac source settings');
  return {activity:raw.activity!==false,codex:raw.codex!==false,wispr:raw.wispr===true,typewhisper:raw.typewhisper===true};
}

export async function macSnapshot(rawConfig,readers,previous=[],at=new Date().toISOString()) {
  const config=macCollectorConfig(rawConfig);
  if(!Number.isFinite(Date.parse(at)))throw Error('Invalid collection time');
  const disconnected=host=>({host,status:'not-connected'});
  const unavailable=host=>({host,status:'unavailable',checkedAt:at});
  const read=async(key,clean)=>{
    if(!config[key])return disconnected('Mac');
    try{return {...clean(await readers[key]()),checkedAt:at};}catch{return unavailable('Mac');}
  };
  const [activity,settings,wispr,typewhisper]=await Promise.all([
    read('activity',raw=>{const {intervals,trackingIntervals,...safe}=cleanActivity(raw,'Mac');return safe;}),
    read('codex',raw=>{const safe=cleanSettings(raw,'Mac');tokensFromSettings(safe,'Mac');return safe;}),
    read('wispr',raw=>cleanWispr(raw,'Mac')),
    read('typewhisper',raw=>cleanDictation(raw,'Mac')),
  ]);
  let tokens=settings.status==='ok'?null:{host:'Mac',status:settings.status,checkedAt:at};
  if(!tokens)try{tokens={...tokensFromSettings(settings,'Mac'),checkedAt:at};}catch{tokens=unavailable('Mac');}
  const data={schema:2,timezone:'America/New_York',collectedAt:at,
    activity:[activity,disconnected('Windows')],combined:unavailable('Combined'),
    tokens:[tokens,disconnected('Windows'),disconnected('Ubuntu')],combinedTokens:unavailable('All'),
    settings:[settings],combinedSettings:unavailable('All'),
    dictation:[{...wispr,source:'Wispr Flow'},{...typewhisper,source:'TypeWhisper'}],
    agents:[],agentSource:disconnected('Local'),quota:disconnected('Codex account'),localModel:disconnected('Ubuntu')};
  data.activityHistory=retainActivityHistory(previous,data.activity,at);
  const sources=[...data.activity,...data.tokens,...data.settings,...data.dictation].filter(source=>source.status!=='not-connected');
  const sourcesRead=sources.filter(source=>source.status==='ok').length;
  return {data,status:{state:sources.length && sourcesRead===sources.length?'ok':'partial',sourcesRead,sourcesConfigured:sources.length}};
}
