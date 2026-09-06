import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const exec = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fields = [
  'inputTokens',
  'cacheReadTokens',
  'cacheCreationTokens',
  'outputTokens',
  'reasoningOutputTokens',
  'totalTokens',
];
export function numeric(x) {
  return typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : null;
}
export function category(app) {
  if (
    /codex|chatgpt|code\.exe|visual studio|cursor|antigravity|idea|pycharm/i.test(
      app,
    )
  )
    return 'Coding';
  if (/terminal|powershell|cmd\.exe|conhost|wezterm|ubuntu|iterm/i.test(app))
    return 'Terminal';
  if (/chrome|firefox|msedge|brave|safari/i.test(app)) return 'Browser';
  return 'Other';
}
export function cleanTokens(raw, host) {
  if (!Array.isArray(raw.daily)) throw Error('Unsupported report');
  const days = raw.daily
    .map((d) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) throw Error('Invalid date');
      const models = Object.entries(d.models || {}).map(([model, m]) => ({
        model: /^[a-zA-Z0-9._:/-]{1,100}$/.test(model) ? model : 'unknown',
        ...Object.fromEntries(fields.map((k) => [k, numeric(m[k])])),
        inferred: m.isFallback === true,
      }));
      return {
        date: d.date,
        ...Object.fromEntries(fields.map((k) => [k, numeric(d[k])])),
        models,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  return { host, status: 'ok', days };
}
export function cleanActivity(raw, host) {
  const categories = Object.fromEntries(
    ['Coding', 'Terminal', 'Browser', 'Other'].map((k) => [
      k,
      numeric(raw.categories?.[k]),
    ]),
  );
  if (
    Object.values(categories).some((x) => x === null) ||
    Object.values(categories).reduce((a, b) => a + b, 0) > 7 * 86400 + 1
  )
    throw Error('Invalid activity');
  const stamp = (x) =>
    typeof x === 'string' && Number.isFinite(Date.parse(x))
      ? new Date(x).toISOString()
      : null;
  return {
    host,
    status: 'ok',
    start: stamp(raw.start),
    end: stamp(raw.end),
    latestEvent: stamp(raw.latestEvent),
    categories,
  };
}
async function command(file, args) {
  const { stdout } = await exec(file, args, {
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}
async function api(suffix, body) {
  const r = await fetch('http://127.0.0.1:5600/api/0' + suffix, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw Error('ActivityWatch unavailable');
  return r.json();
}
async function macActivity() {
  const buckets = Object.values(await api('/buckets/'));
  const choose = (t) => {
    const rows = buckets.filter((x) => x.type === t);
    if (rows.length !== 1) throw Error('Ambiguous collectors');
    return rows[0].id;
  };
  const w = choose('currentwindow'),
    a = choose('afkstatus'),
    end = new Date(),
    start = new Date(end - 7 * 86400000);
  const q = `w = query_bucket(${JSON.stringify(w)}); a = query_bucket(${JSON.stringify(a)}); a = filter_keyvals(a, "status", ["not-afk"]); w = filter_period_intersect(w, a); RETURN = merge_events_by_keys(w, ["app"]);`;
  const [events] = await api('/query/', {
    query: [q],
    timeperiods: [`${start.toISOString()}/${end.toISOString()}`],
  });
  const categories = { Coding: 0, Terminal: 0, Browser: 0, Other: 0 };
  for (const e of events) {
    if (numeric(e.duration) === null) throw Error('Invalid duration');
    categories[category(String(e.data?.app))] += e.duration;
  }
  const latest = await api(`/buckets/${encodeURIComponent(w)}/events?limit=1`);
  return cleanActivity(
    {
      categories,
      start: start.toISOString(),
      end: end.toISOString(),
      latestEvent: latest[0]?.timestamp,
    },
    'Mac',
  );
}
export function cleanReceipts(rows) {
  // A continued conversation may report cumulative counters. Keep its newest snapshot only.
  const latest = new Map();
  for (const { value: v, modified } of rows) {
    if (typeof v.conversationId !== 'string') continue;
    const prior = latest.get(v.conversationId);
    if (!prior || modified > prior.modified)
      latest.set(v.conversationId, { value: v, modified });
  }
  return [...latest.values()].map(({ value: v, modified }, i) => ({
    id: `review-${i + 1}`,
    model: /^[a-zA-Z0-9._-]{1,100}$/.test(v.requestedModel)
      ? v.requestedModel
      : 'unknown',
    status: v.status === 'SUCCESS' ? 'completed' : 'failed',
    seconds: numeric(v.elapsedSeconds),
    recordedAt: new Date(modified).toISOString(),
    // Error snapshots often contain zeros that are not reliable usage accounting.
    input: v.status === 'SUCCESS' ? numeric(v.usage?.input_tokens) : null,
    output: v.status === 'SUCCESS' ? numeric(v.usage?.output_tokens) : null,
    cache: v.status === 'SUCCESS' ? numeric(v.usage?.cache_read_tokens) : null,
    total: v.status === 'SUCCESS' ? numeric(v.usage?.total_tokens) : null,
  }));
}
async function guarded(host, fn) {
  try {
    return await fn();
  } catch {
    return { host, status: 'unavailable' };
  }
}
export async function collect() {
  const config = JSON.parse(
    await readFile(path.join(root, 'local.config.json'), 'utf8'),
  );
  for (const key of ['macCcusage', 'ubuntuCcusage'])
    if (!/^\/[a-zA-Z0-9_./-]+$/.test(config[key]))
      throw Error('Invalid configured executable');
  for (const key of ['windowsHost', 'ubuntuHost'])
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(config[key]))
      throw Error('Invalid SSH alias');
  if (
    typeof config.receiptDirectory !== 'string' ||
    !path.isAbsolute(config.receiptDirectory)
  )
    throw Error('Invalid receipt directory');
  const ps = await readFile(
    path.join(root, 'scripts/windows-aggregate-activity.ps1'),
    'utf8',
  );
  const [mac, windows, macTokens, wslTokens] = await Promise.all([
    guarded('Mac', macActivity),
    guarded('Windows', async () =>
      cleanActivity(
        await command('ssh', [
          '-oBatchMode=yes',
          '-oConnectTimeout=8',
          config.windowsHost,
          'powershell.exe -NoProfile -NonInteractive -EncodedCommand ' +
            Buffer.from(ps, 'utf16le').toString('base64'),
        ]),
        'Windows',
      ),
    ),
    guarded('Mac', async () =>
      cleanTokens(
        await command(config.macCcusage, [
          'codex',
          'daily',
          '--offline',
          '--no-cost',
          '--timezone',
          'America/New_York',
          '--json',
        ]),
        'Mac',
      ),
    ),
    guarded('Ubuntu', async () =>
      cleanTokens(
        await command('ssh', [
          '-oBatchMode=yes',
          '-oConnectTimeout=8',
          config.ubuntuHost,
          config.ubuntuCcusage +
            ' codex daily --offline --no-cost --timezone America/New_York --json',
        ]),
        'Ubuntu',
      ),
    ),
  ]);
  const rows = [];
  for (const name of ['run', 'followup', 'safety', 'runtime']) {
    const f = path.join(config.receiptDirectory, name + '.usage.json');
    try {
      rows.push({
        value: JSON.parse(await readFile(f, 'utf8')),
        modified: (await stat(f)).mtimeMs,
      });
    } catch {}
  }
  const data = {
    schema: 1,
    collectedAt: new Date().toISOString(),
    timezone: 'America/New_York',
    activity: [mac, windows],
    tokens: [macTokens, wslTokens],
    agents: cleanReceipts(rows),
    quota: { status: 'not-connected' },
  };
  const folder = path.join(root, 'public/local');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const target = path.join(folder, 'usage.json');
  await writeFile(target + '.tmp', JSON.stringify(data), { mode: 0o600 });
  await rename(target + '.tmp', target);
  console.log(
    JSON.stringify({
      collectedAt: data.collectedAt,
      sources: [...data.activity, ...data.tokens].map((x) => ({
        host: x.host,
        status: x.status,
      })),
      agentSnapshots: data.agents.length,
    }),
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await collect();
