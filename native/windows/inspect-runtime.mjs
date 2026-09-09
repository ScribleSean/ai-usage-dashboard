import {readFileSync} from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
if(!root || !path.isAbsolute(root))throw Error('Absolute private runtime required');
const data=JSON.parse(readFileSync(path.join(root,'public/local/usage.json'),'utf8'));
const forbidden=new Set(['prompt','transcript','recording','windowTitle','title','arguments','credentials','apiKey']);
function check(value) {
  if(!value || typeof value!=='object')return;
  for(const [key,item] of Object.entries(value)) {
    if(forbidden.has(key))throw Error('Forbidden field in snapshot');
    check(item);
  }
}
check(data);
console.log(JSON.stringify({schema:data.schema,collectedAt:data.collectedAt,
  sources:['activity','tokens','settings','dictation'].flatMap(kind=>(data[kind]||[]).map(source=>({
    kind,host:source.host,status:source.status,days:source.days?.length,
    profiles:source.profiles?.length,tools:source.tools?.length}))),
  privacyShape:'passed',combined:data.combinedTokens?.status}));
