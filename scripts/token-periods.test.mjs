import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateProfiles,
  aggregateTokenDays,
  selectTokenDays,
} from './token-periods.mjs';
import { estimate } from './api-estimate.mjs';

const baseDay = (date, values, models) => ({
  date,
  inputTokens: values.inputTokens,
  cacheReadTokens: values.cacheReadTokens,
  cacheCreationTokens: values.cacheCreationTokens,
  outputTokens: values.outputTokens,
  reasoningOutputTokens: values.reasoningOutputTokens,
  totalTokens: values.totalTokens,
  models,
});

const makeModel = (
  model,
  inferred,
  values,
) => ({
  model,
  inferred,
  inputTokens: values.inputTokens,
  cacheReadTokens: values.cacheReadTokens,
  cacheCreationTokens: values.cacheCreationTokens,
  outputTokens: values.outputTokens,
  reasoningOutputTokens: values.reasoningOutputTokens,
  totalTokens: values.totalTokens,
});

const known = {
  inputTokens: 100000,
  cacheReadTokens: 50000,
  cacheCreationTokens: 20000,
  outputTokens: 70000,
  reasoningOutputTokens: 15000,
  totalTokens: 240000,
};

const gptModel = makeModel('gpt-6-astra', false, known);

const row = baseDay('2026-09-06', known, [gptModel]);
const earlier = baseDay('2026-09-04', { ...known, totalTokens: 120000 }, [
  makeModel('gpt-6-astra', false, { ...known, totalTokens: 120000, outputTokens: 50000 }),
]);

const inferredRow = baseDay('2026-09-06', {
  ...known,
  totalTokens: 120000,
}, [
  makeModel('gpt-6-astra', true, {
    ...known,
    totalTokens: 120000,
    inputTokens: 50000,
    outputTokens: 70000,
  }),
]);

test('aggregateTokenDays returns undefined for empty source', () => {
  assert.equal(aggregateTokenDays([]), undefined);
});

test('selectTokenDays accepts day scope and keeps counters stable', () => {
  const rows = [
    row,
    baseDay('2026-09-05', { ...known, totalTokens: 120000 }, [
      makeModel('gpt-5.6-sol', false, {
        ...known,
        totalTokens: 120000,
        cacheReadTokens: 10000,
      }),
    ]),
  ];
  const day = selectTokenDays(rows, 'day', '2026-09-06');
  assert.equal(day.date, '2026-09-06');
  assert.equal(day.startDate, '2026-09-06');
  assert.equal(day.endDate, '2026-09-06');
  assert.equal(day.recordedDays, 1);
  assert.equal(day.totalTokens, 240000);
  assert.equal(day.models.length, 1);
  assert.equal(day.models[0].model, 'gpt-6-astra');
  assert.equal(day.apiEstimate.coveredTokens, row.totalTokens);
});

test('selectTokenDays week scope uses the last seven calendar days and tolerates gaps', () => {
  const rows = [
    baseDay('2026-09-01', { ...known, totalTokens: 10000 }, [
      makeModel('gpt-6-astra', false, { ...known, totalTokens: 10000, outputTokens: 12000 }),
    ]),
    baseDay('2026-09-03', { ...known, totalTokens: 12000 }, [
      makeModel('gpt-6-astra', false, { ...known, totalTokens: 12000, outputTokens: 14000 }),
    ]),
    baseDay('2026-09-06', { ...known, totalTokens: 14000 }, [
      makeModel('gpt-6-astra', false, { ...known, totalTokens: 14000, outputTokens: 16000 }),
    ]),
  ];
  const week = selectTokenDays(rows, 'week', '2026-09-06');
  assert.equal(week.startDate, '2026-08-31');
  assert.equal(week.endDate, '2026-09-06');
  assert.equal(week.recordedDays, 3);
  assert.equal(week.models.length, 1);
  assert.equal(week.totalTokens, 10000 + 12000 + 14000);
  assert.equal(week.totalTokens, week.models[0].totalTokens);
});

test('selectTokenDays all scope sorts without mutating input rows', () => {
  const source = [
    baseDay('2026-09-06', { ...known, totalTokens: 300000 }, [
      makeModel('gpt-6-astra', false, { ...known, totalTokens: 300000 }),
    ]),
    baseDay('2026-09-04', { ...known, totalTokens: 200000 }, [
      makeModel('gpt-6-astra', false, { ...known, totalTokens: 200000 }),
    ]),
  ];
  const baseline = JSON.parse(JSON.stringify(source));
  const all = selectTokenDays(source, 'all', '2026-09-06');
  assert.equal(all.date, '2026-09-04');
  assert.equal(all.startDate, '2026-09-04');
  assert.equal(all.endDate, '2026-09-06');
  assert.equal(all.recordedDays, 2);
  assert.deepEqual(source, baseline);
});

test('aggregateTokenDays keeps model labels and inferred values distinct', () => {
  const combined = aggregateTokenDays([row, inferredRow]);
  assert.equal(combined.models.length, 2);
  const recorded = combined.models.map((r) => r.inferred).sort();
  assert.deepEqual(recorded, [false, true]);
  const inferred = combined.models.find((r) => r.inferred);
  assert.equal(inferred.model, 'gpt-6-astra');
  assert.equal(inferred.totalTokens, 120000);
});

test('nulls are preserved and never turned into zero', () => {
  const partial = baseDay(
    '2026-09-06',
    {
      inputTokens: null,
      cacheReadTokens: 2,
      cacheCreationTokens: null,
      outputTokens: 3,
      reasoningOutputTokens: null,
      totalTokens: null,
    },
    [
      {
        model: 'gpt-6-astra',
        inferred: false,
        inputTokens: null,
        cacheReadTokens: 2,
        cacheCreationTokens: null,
        outputTokens: 3,
        reasoningOutputTokens: null,
        totalTokens: null,
      },
    ],
  );
  const rowWithNull = aggregateTokenDays([partial]);
  assert.equal(rowWithNull.inputTokens, null);
  assert.equal(rowWithNull.cacheReadTokens, 2);
  assert.equal(rowWithNull.totalTokens, null);
  assert.equal(rowWithNull.models[0].model, 'gpt-6-astra');
  assert.equal(rowWithNull.models[0].inputTokens, null);
  assert.equal(rowWithNull.models[0].cacheCreationTokens, null);
});

test('token counters and API comparison preserve known totals and prices', () => {
  const priced = [
    baseDay('2026-09-05', { ...known, totalTokens: 190000 }, [
      makeModel('gpt-6-astra', false, {
        ...known,
        totalTokens: 190000,
        cacheReadTokens: 0,
      }),
    ]),
    baseDay('2026-09-06', {
      ...known,
      totalTokens: 300000,
      cacheReadTokens: 0,
      inputTokens: 200000,
      outputTokens: 80000,
    }, [
      makeModel('gpt-6-astra', false, {
        ...known,
        totalTokens: 300000,
        cacheReadTokens: 0,
        inputTokens: 200000,
        outputTokens: 80000,
      }),
    ]),
  ];
  const aggregated = aggregateTokenDays(priced);
  assert.equal(aggregated.inputTokens, 300000);
  assert.equal(aggregated.cacheReadTokens, 50000);
  assert.equal(aggregated.outputTokens, 150000);
  assert.equal(aggregated.totalTokens, 490000);
  assert.equal(aggregated.apiEstimate.coveredTokens, 490000);
  assert.equal(aggregated.apiEstimate.usd, estimate([aggregated.models[0]]).usd);
  assert.equal(aggregated.models[0].apiEstimate.usd, estimate([aggregated.models[0]]).usd);
});

test('invalid period or date inputs throw', () => {
  assert.throws(() => selectTokenDays([row], 'month', '2026-09-06'));
  assert.throws(() => selectTokenDays([row], 'day', '2026-13-40'));
  assert.throws(() => selectTokenDays([row], 'week', '09-06-2026'));
  assert.throws(() => selectTokenDays([row], 'day', '2026-02-30'));
  assert.throws(() => selectTokenDays([], 'month', '2026-09-06'));
  assert.throws(() => selectTokenDays([{...row,date:'bad'}], 'all', '2026-09-06'));
});

test('aggregateProfiles groups by model, effort and speed across rows', () => {
  const profiles = [
    { model: 'gpt-6-astra', effort: 'high', speed: 'fast', inputTokens: 10, cacheReadTokens: 20, cacheCreationTokens: 3, outputTokens: 30, totalTokens: 63 },
    { model: 'gpt-6-astra', effort: 'high', speed: 'fast', inputTokens: 5, cacheReadTokens: 10, cacheCreationTokens: 2, outputTokens: 15, totalTokens: 32 },
    { model: 'gpt-6-astra', effort: 'low', speed: 'fast', inputTokens: 7, cacheReadTokens: 1, cacheCreationTokens: 1, outputTokens: 10, totalTokens: 19 },
  ];
  const grouped = aggregateProfiles(profiles);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.find(p => p.effort === 'high').totalTokens, 95);
  assert.equal(grouped.find(p => p.effort === 'low').totalTokens, 19);
  assert.equal(grouped[0].model, 'gpt-6-astra');
});

test('aggregateProfiles does not mutate input rows', () => {
  const profiles = [
    {
      model: 'gpt-6-astra',
      effort: 'high',
      speed: 'standard',
      inputTokens: 10,
      cacheReadTokens: 20,
      cacheCreationTokens: 3,
      outputTokens: 30,
      totalTokens: 63,
      date: '2026-09-06',
    },
  ];
  const baseline = JSON.parse(JSON.stringify(profiles));
  aggregateProfiles(profiles);
  assert.deepEqual(profiles, baseline);
});
