import test from 'node:test';
import assert from 'node:assert/strict';
import {execPython} from './test-python.mjs';
import {cleanDictation,summarizeDictation} from './typewhisper.mjs';

const row = {date:'2026-09-08',transcriptions:2,words:12,audioSeconds:7,engines:[{engine:'Apple Speech',transcriptions:2}]};
test('dictation output is allowlisted and unavailable is not zero',()=>{
  const safe=cleanDictation({status:'ok',secret:'PRIVATE',days:[{...row,transcript:'PRIVATE'}]},'Mac');
  assert.ok(!JSON.stringify(safe).includes('PRIVATE'));
  assert.equal(summarizeDictation({status:'unavailable'}),null);
  assert.equal(summarizeDictation(safe,'2026-09-09'),null);
  assert.equal(summarizeDictation(safe).words,12);
  assert.deepEqual(cleanDictation({status:'ambiguous',days:[row]},'Windows'),{host:'Windows',status:'ambiguous'});
});
test('dictation rejects invalid counts, dates, duplicate dates and custom model names',()=>{
  for (const change of [{transcriptions:-1},{words:null},{audioSeconds:Infinity},{date:'2026-02-31'},{engines:[{engine:'PRIVATE',transcriptions:2}]}]) {
    assert.throws(()=>cleanDictation({status:'ok',days:[{...row,...change}]},'Mac'));
  }
  assert.throws(()=>cleanDictation({status:'ok',days:[row,row]},'Mac'));
});
test('source readers query aggregates only and handle both platform formats',()=>{
  const code=`import importlib.util,json,tempfile,pathlib,sqlite3,os
spec=importlib.util.spec_from_file_location('reader','scripts/read-typewhisper.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
 root=pathlib.Path(tmp).resolve()
 mac=root/'stats.store'
 with sqlite3.connect(mac) as db:
  db.execute('CREATE TABLE ZUSAGESTATISTICSDAY (ZDAY REAL,ZTRANSCRIPTIONCOUNT INTEGER,ZTOTALWORDS INTEGER,ZTOTALDURATIONSECONDS REAL,ZMODELCOUNTSJSON TEXT)')
  db.execute('INSERT INTO ZUSAGESTATISTICSDAY VALUES (?,?,?,?,?)',(810518400,2,12,7,json.dumps({'Apple Speech||PRIVATE_ALIAS':2})))
  db.execute('CREATE TABLE PRIVATE_HISTORY (TRANSCRIPT TEXT)')
  db.execute("INSERT INTO PRIVATE_HISTORY VALUES ('PRIVATE_TRANSCRIPT')")
 db.close()
 mac_result=m.read_mac(mac)
 win=root/'stats.json'
 win.write_text(json.dumps({'version':1,'days':[{'day':'2026-09-08T00:00:00','transcriptionCount':2,'totalWords':12,'totalDurationSeconds':7,'modelCounts':{'sherpa-onnx'+chr(31)+'PRIVATE_ALIAS':2},'appCounts':{'PRIVATE_APP':2}}]}))
 win_result=m.read_windows(win)
 link=root/'link.json';link.symlink_to(win)
 try: m.read_windows(link);raise AssertionError('symlink accepted')
 except ValueError: pass
 assert m.report('mac',root)=={'status':'not-found'}
 for relative in ['AppData/Local/Packages/TypeWhisper.TypeWhisper_51tqb5623pxja/LocalCache/Local/TypeWhisper-UserData/Data/usage-statistics.json','AppData/Local/TypeWhisper-UserData/Data/usage-statistics.json']:
  candidate=root/relative;candidate.parent.mkdir(parents=True,exist_ok=True);candidate.write_text(win.read_text())
 assert m.report('windows',root)=={'status':'ambiguous'}
 print(json.dumps([mac_result,win_result]))`;
  const text=execPython(['-c',code],{env:{...process.env,TZ:'UTC'}}).toString();
  assert.ok(!text.includes('PRIVATE'));
  const [mac,win]=JSON.parse(text);
  assert.equal(mac[0].words,12);
  assert.equal(win[0].engines[0].engine,'Parakeet / sherpa-onnx');
});
