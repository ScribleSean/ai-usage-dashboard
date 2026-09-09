import test from 'node:test';
import assert from 'node:assert/strict';
import {execPython} from './test-python.mjs';
import {cleanWispr,summarizeWispr} from './wispr.mjs';

test('Wispr reads numeric metadata only, groups timezone boundaries and preserves coverage',()=>{
  const code=`import importlib.util,json,tempfile,pathlib,sqlite3
spec=importlib.util.spec_from_file_location('reader','scripts/read-wispr.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
 root=pathlib.Path(tmp)
 for mode,relative in [('mac','Library/Application Support/Wispr Flow/flow.sqlite'),('windows','AppData/Roaming/Wispr Flow/flow.sqlite')]:
  p=root/relative;p.parent.mkdir(parents=True)
  with sqlite3.connect(p) as db:
   db.execute('CREATE TABLE History (timestamp TEXT,duration FLOAT,numWords INTEGER,transcript TEXT,audio BLOB)')
   db.executemany('INSERT INTO History VALUES (?,?,?,?,?)', [('2026-09-09 01:00:00.000 +00:00',60,10,'PRIVATE',b'PRIVATE'),('2026-09-09T03:00:00+00:00',None,None,'PRIVATE',b'PRIVATE'),('2026-09-09T05:00:00+00:00',0,0,'PRIVATE',b'PRIVATE')])
  db.close()
  result=m.report(root,mode)
  assert result['days'][0]['date']=='2026-09-08'
  assert result['days'][0]['transcriptions']==2
  assert result['days'][0]['audioRecords']==1
  assert result['days'][1]['audioRecords']==1
  print(json.dumps(result))
`;
  const output=execPython(['-c',code],{encoding:'utf8'});
  assert.ok(!output.includes('PRIVATE'));
  for (const line of output.trim().split('\n')) {
    const safe=cleanWispr(JSON.parse(line),'Mac');
    assert.equal(summarizeWispr(safe).audioSeconds,60);
    assert.equal(summarizeWispr(safe).audioRecords,2);
    assert.equal(summarizeWispr(safe,'2026-09-09').words,0);
  }
});

test('Wispr sanitizes fields and rejects bad coverage',()=>{
  const day={date:'2026-09-08',transcriptions:2,words:5,audioSeconds:10,wordRecords:1,audioRecords:1,engines:[],transcript:'PRIVATE'};
  assert.ok(!JSON.stringify(cleanWispr({status:'ok',days:[day]},'Windows')).includes('PRIVATE'));
  for (const change of [{audioRecords:3},{wordRecords:-1},{audioRecords:null},{wordRecords:0}]) {
    assert.throws(()=>cleanWispr({status:'ok',days:[{...day,...change}]},'Mac'));
  }
  assert.equal(summarizeWispr(cleanWispr({status:'not-found'},'Mac')),null);
  assert.equal(summarizeWispr(cleanWispr({status:'ok',days:[]},'Mac')),null);
});
