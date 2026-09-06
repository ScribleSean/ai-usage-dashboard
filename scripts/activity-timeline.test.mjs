import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanIntervals, summarize } from './activity-timeline.mjs';
const start = '2026-09-06T04:00:00Z', end = '2026-09-07T04:00:00Z';
const row = (a, b, category = 'AI apps') => ({ start: `2026-09-06T${a}:00Z`, end: `2026-09-06T${b}:00Z`, category, title: 'private' });
test('overlap counts once with explicit mixed categories', () => {
  const rows = cleanIntervals([row('12:00','13:00'), row('12:30','13:30','Editors')], start, end);
  assert.ok(!JSON.stringify(rows).includes('private'));
  const r = summarize(rows, start, end);
  assert.equal(r.days[0].seconds, 5400);
  assert.equal(r.categories['Mixed activity'], 1800);
  assert.equal(r.days[0].hours.reduce((a,b) => a+b), 5400);
});
test('duplicate intervals do not inflate time', () => {
  const r = summarize(cleanIntervals([row('12:00','13:00'),row('12:00','13:00')], start, end), start, end);
  assert.equal(r.days[0].seconds, 3600);
});
test('clipping, invalid categories and empty recorded days', () => {
  assert.throws(() => cleanIntervals([row('12:00','13:00','private-app')], start, end));
  assert.throws(() => cleanIntervals([row('13:00','12:00')], start, end));
  assert.equal(summarize([], start, end).days[0].seconds, 0);
  assert.equal(cleanIntervals([row('03:00','05:00')], start, end)[0].start, Date.parse(start));
});
test('midnight splits across local dates', () => {
  const r = summarize(cleanIntervals([row('03:30','04:30')], '2026-09-05T04:00:00Z', end), '2026-09-05T04:00:00Z', end);
  assert.equal(r.days.find(d => d.date === '2026-09-05').seconds, 1800);
  assert.equal(r.days.find(d => d.date === '2026-09-06').seconds, 1800);
});
test('fall DST repeated hour preserves exact duration', () => {
  const lo = '2026-11-01T04:00:00Z', hi = '2026-11-02T05:00:00Z';
  const r = summarize(cleanIntervals([{start:'2026-11-01T05:00:00Z',end:'2026-11-01T07:00:00Z',category:'Editors'}],lo,hi),lo,hi);
  assert.equal(r.days[0].seconds,7200);
  assert.equal(r.days[0].hours[1],7200);
});
