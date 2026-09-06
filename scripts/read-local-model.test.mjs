import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('local receipt reader exports measurements but not messages, prompts or fingerprints',()=>{
  const code=`import importlib.util,json,pathlib,tempfile
spec=importlib.util.spec_from_file_location('reader','scripts/read-local-model.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as folder:
 root=pathlib.Path(folder);(root/'run').mkdir()
 (root/'run'/'one.metrics.json').write_text(json.dumps({'status':'complete','prompt_sha256':'SECRET','end_to_end_s':2,'final':{'model':'test-model','message':{'content':'SECRET'},'prompt_eval_count':12,'eval_count':8}}))
 print(json.dumps(m.collect(folder)))`;
  const output=execFileSync('python3',['-c',code]).toString();
  const data=JSON.parse(output);assert.equal(data.records.length,1);assert.equal(data.records[0].output,8);assert.equal(data.records[0].seconds,2);assert.ok(!output.includes('SECRET'));assert.equal(data.records[0].cached,null);
});
