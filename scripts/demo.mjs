import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { cleanIntervals, summarize } from './activity-timeline.mjs';
export function demoData() {
  const start = '2026-09-05T04:00:00Z', end = '2026-09-06T04:00:00Z';
  const intervals = cleanIntervals([
    {start:'2026-09-05T13:00:00Z',end:'2026-09-05T14:00:00Z',category:'AI apps'},
    {start:'2026-09-05T14:00:00Z',end:'2026-09-05T16:00:00Z',category:'Editors'},
    {start:'2026-09-05T17:00:00Z',end:'2026-09-05T17:30:00Z',category:'Browser'},
  ],start,end);
  const windows = cleanIntervals([{start:'2026-09-05T15:00:00Z',end:'2026-09-05T16:30:00Z',category:'Terminal'}],start,end);
  return {
    demo: true,
    schema: 2,
    combined: {host:'Combined',status:'ok',start,end,...summarize([...intervals,...windows],start,end)},
    collectedAt: new Date().toISOString(),
    activity: [
      {
        host: 'Mac',
        status: 'ok',
        start,end,...summarize(intervals,start,end),
      },
      { host: 'Windows', status: 'ok', start,end,...summarize(windows,start,end) },
    ],
    tokens: [
      {
        host: 'Mac',
        status: 'ok',
        days: [
          {
            date: '2026-01-01',
            totalTokens: 10000,
            inputTokens: 2000,
            cacheReadTokens: 7000,
            outputTokens: 1000,
            models: [{ model: 'example-model', inferred: false }],
          },
        ],
      },
      { host: 'Ubuntu', status: 'ok', days: [] },
      { host: 'Windows', status: 'not-connected' },
    ],
    agents: [
      {
        id: 'demo',
        model: 'example-reviewer',
        status: 'completed',
        seconds: 12,
        total: 1000,
        recordedAt: new Date().toISOString(),
      },
    ],
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = fileURLToPath(new URL('../public/local/', import.meta.url));
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(path.join(dir, 'usage.json'), JSON.stringify(demoData()), {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(
    'Synthetic demo written. An existing snapshot is never overwritten.',
  );
}
