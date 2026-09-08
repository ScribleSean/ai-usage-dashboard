import { estimate } from './api-estimate.mjs';

const FIELDS = [
  'inputTokens',
  'cacheReadTokens',
  'cacheCreationTokens',
  'outputTokens',
  'reasoningOutputTokens',
  'totalTokens',
];

const PROFILE_FIELDS = [
  'inputTokens',
  'cacheReadTokens',
  'cacheCreationTokens',
  'outputTokens',
  'totalTokens',
];

const VALID_DATE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_PERIODS = new Set(['day', 'week', 'all']);

const isValidDate = (value) => {
  if (typeof value !== 'string' || !VALID_DATE.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
};

const shiftDate = (date, days) => {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const addCounter = (acc, key, value) => {
  if (!acc[key].known) return;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    acc[key].known = false;
    acc[key].sum = null;
    return;
  }
  acc[key].sum += value;
};

const toCounterBucket = () =>
  Object.fromEntries(FIELDS.map((field) => [field, { known: true, sum: 0 }]));

const count = field => field.known ? field.sum : null;
const emitCounts = bucket => ({
  inputTokens: count(bucket.inputTokens),
  cacheReadTokens: count(bucket.cacheReadTokens),
  cacheCreationTokens: count(bucket.cacheCreationTokens),
  outputTokens: count(bucket.outputTokens),
  reasoningOutputTokens: count(bucket.reasoningOutputTokens),
  totalTokens: count(bucket.totalTokens),
});

const rowModels = (row) => {
  if (!Array.isArray(row.models)) throw new Error('Invalid token rows');
  return row.models.map((model) => {
    if (!model || typeof model !== 'object') throw new Error('Invalid token rows');
    return {
      model: typeof model.model === 'string' ? model.model : 'unknown',
      inferred: Boolean(model.inferred),
      ...Object.fromEntries(FIELDS.map((field) => [field, typeof model[field] === 'number' && Number.isFinite(model[field]) && model[field] >= 0 ? model[field] : null])),
    };
  });
};

const rowTotals = (row) => {
  if (!row || typeof row !== 'object') throw new Error('Invalid token rows');
  if (!isValidDate(row.date)) throw new Error('Invalid token rows');
  return {
    date: row.date,
    ...Object.fromEntries(FIELDS.map((field) => [field, typeof row[field] === 'number' && Number.isFinite(row[field]) && row[field] >= 0 ? row[field] : null])),
    models: rowModels(row),
  };
};

function aggregateTokenRows(rows) {
  const ordered = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const totals = toCounterBucket();
  const models = new Map();

  for (const row of ordered) {
    const normalized = rowTotals(row);
    for (const field of FIELDS) addCounter(totals, field, normalized[field]);

    for (const model of normalized.models) {
      const key = model.model + ':' + String(model.inferred);
      const bucket = models.get(key) || {
        model: model.model,
        inferred: model.inferred,
        counts: toCounterBucket(),
      };
      for (const field of FIELDS) addCounter(bucket.counts, field, model[field]);
      models.set(key, bucket);
    }
  }

  const aggregatedModels = [...models.values()]
    .map((entry) => {
      const counts = emitCounts(entry.counts);
      return {
        model: entry.model,
        inferred: entry.inferred,
        ...counts,
        apiEstimate: estimate([{ ...counts, model: entry.model, inferred: entry.inferred }]),
      };
    })
    .sort((a, b) =>
      a.model.localeCompare(b.model) || Number(a.inferred) - Number(b.inferred),
    );

  const totalsCounts = emitCounts(totals);
  return {
    date: ordered[0].date,
    startDate: ordered[0].date,
    endDate: ordered.at(-1).date,
    recordedDays: ordered.length,
    ...totalsCounts,
    models: aggregatedModels,
    apiEstimate: estimate(aggregatedModels),
  };
}

export function aggregateTokenDays(rows) {
  if (!Array.isArray(rows) || !rows.length) return undefined;
  return aggregateTokenRows(rows);
}

export function selectTokenDays(rows, period, anchorDate) {
  if (!VALID_PERIODS.has(period)) throw new Error('Invalid period');
  if (!isValidDate(anchorDate)) throw new Error('Invalid anchor date');
  if (!Array.isArray(rows)) throw new Error('Invalid token rows');
  if (rows.some(row=>!row || !isValidDate(row.date))) throw new Error('Invalid token rows');
  if (!rows.length) return undefined;

  const sorted = [...rows].sort((a, b) => {
    if (!isValidDate(a.date) || !isValidDate(b.date)) throw new Error('Invalid token rows');
    return a.date.localeCompare(b.date);
  });
  const periodStart =
    period === 'day'
      ? anchorDate
      : period === 'week'
        ? shiftDate(anchorDate, -6)
        : sorted[0].date;
  const periodEnd =
    period === 'all' ? sorted.at(-1).date : anchorDate;

  const selected = sorted.filter(
    (row) => row.date >= periodStart && row.date <= periodEnd,
  );
  if (!selected.length) return undefined;

  const aggregated = aggregateTokenRows(selected);
  if (period === 'all') return aggregated;

  return {
    ...aggregated,
    date: periodStart,
    startDate: periodStart,
    endDate: periodEnd,
    recordedDays: aggregated.recordedDays,
  };
}

export function aggregateProfiles(rows) {
  if (!Array.isArray(rows)) return [];
  const totals = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const model = typeof row.model === 'string' ? row.model : 'unknown';
    const effort = typeof row.effort === 'string' ? row.effort : 'unknown';
    const speed = typeof row.speed === 'string' ? row.speed : 'unknown';
    const key = model + ':' + effort + ':' + speed;
    const bucket =
      totals.get(key) || { model, effort, speed, ...Object.fromEntries(PROFILE_FIELDS.map((field) => [field, 0])) };
    for (const field of PROFILE_FIELDS) {
      const value = row[field];
      if (bucket[field] === null) continue;
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
        bucket[field] += value;
      else bucket[field] = null;
    }
    totals.set(key, bucket);
  }
  return [...totals.values()].sort((a, b) =>
    a.model.localeCompare(b.model) || a.effort.localeCompare(b.effort) || a.speed.localeCompare(b.speed),
  );
}
