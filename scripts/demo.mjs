import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export function demoData() {
  return {
    demo: true,
    schema: 1,
    collectedAt: new Date().toISOString(),
    activity: [
      {
        host: 'Mac',
        status: 'ok',
        categories: { Coding: 7200, Terminal: 1800, Browser: 3600, Other: 900 },
      },
      { host: 'Windows', status: 'unavailable' },
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
