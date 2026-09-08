import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoData} from './demo.mjs';
import {selectTokenDays} from './token-periods.mjs';
test('demo is deterministic and covers every delivered view without live reads',()=>{
  const d=demoData();
  assert.deepEqual(d,demoData());
  assert.equal(d.demo,true);
  assert.equal(d.combinedTokens.status,'ok');
  assert.equal(d.activityHistory[0].days.length,14);
  assert.equal(d.activity[0].days.length,7);
  assert.ok(d.agents.some(r=>r.status==='failed'&&r.total===null));
  assert.ok(d.settings.every(r=>r.tools.every(t=>t.tool&&t.namespace)));
  for(const row of d.tokens) {
    assert.equal(selectTokenDays(row.days,'all','2026-09-08').totalTokens,row.days.reduce((n,r)=>n+r.totalTokens,0));
    assert.ok(row.days.every(r=>r.totalTokens===r.models.reduce((n,m)=>n+m.totalTokens,0)));
  }
  const history=d.activityHistory.find(r=>r.host==='Mac').days;
  assert.equal(history.find(r=>r.date==='2026-09-02').trackedSeconds,0);
  assert.ok(history.find(r=>r.date==='2026-09-03').trackedSeconds>0);
  assert.equal(history.find(r=>r.date==='2026-09-03').seconds,0);
  assert.ok(!JSON.stringify(d).includes('/Users/'));
  assert.ok(!JSON.stringify(d).includes('/home/'));
});
