'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Layers3,
  Workflow,
  Database,
  RefreshCw,
  Monitor,
  Laptop,
  ArrowUpRight,
  Check,
  CircleHelp,
  Terminal,
  Globe,
  Code2,
  Shapes,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

type Tokens = {
  apiEstimate?: { usd: number | null; coveredTokens: number; excluded: number; checked: string };
  date: string;
  totalTokens: number | null;
  inputTokens: number | null;
  cacheReadTokens: number | null;
  outputTokens: number | null;
  models: { model: string; inferred: boolean; inputTokens?: number | null; cacheReadTokens?: number | null; cacheCreationTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null; apiEstimate?: { usd: number | null } }[];
};
type ActivityRow = {
  host: string;
  status: string;
  categories?: Record<string, number>;
  latestEvent?: string;
  start?: string;
  end?: string;
  days?: { date: string; seconds: number; hours: number[]; categories: Record<string, number> }[];
};
type Agent = {
  failure?: string | null;
  id: string;
  model: string;
  status: string;
  seconds: number | null;
  total: number | null;
  recordedAt: string;
};
type Report = {
  combined?: ActivityRow;
  demo?: boolean;
  collectedAt: string;
  activity: ActivityRow[];
  tokens: { host: string; status: string; days?: Tokens[] }[];
  agents: Agent[];
};
const fmt = (n: number | null | undefined) =>
  n == null ? 'Unknown' : new Intl.NumberFormat('en-US').format(n);
const compact = (n: number) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
const time = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  return { hours: Math.floor(minutes / 60), minutes: minutes % 60 };
};
const shiftDate = (date: string, days: number) => {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const dateLabel = (date: string) => date ? new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {month:'short',day:'numeric',timeZone:'UTC'}) : 'No records';
const sum = (c: Record<string, number> | undefined) =>
  Object.values(c || {}).reduce((s, n) => s + n, 0);
const icons: Record<string, typeof Activity> = {
  'AI apps': Workflow,
  Editors: Code2,
  'Mixed activity': Layers3,
  Coding: Code2,
  Terminal,
  Browser: Globe,
  Other: Shapes,
};
const views = [
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'tokens', label: 'Tokens', icon: Layers3 },
  { id: 'agents', label: 'Agents', icon: Workflow },
  { id: 'sources', label: 'Sources', icon: Database },
];
function State({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty-state">
      <CircleHelp size={28} />
      <p>{children}</p>
    </div>
  );
}
export default function Home() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      let saved: string | null = null;
      try { saved = localStorage.getItem('usage-theme'); } catch {}
      const next = saved === 'dark' || (saved !== 'light' && query.matches);
      document.documentElement.dataset.theme = next ? 'dark' : 'light';
      setDark(next);
    };
    sync();
    query.addEventListener('change', sync);
    window.addEventListener('storage', sync);
    return () => { query.removeEventListener('change', sync); window.removeEventListener('storage', sync); };
  }, []);
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    try { localStorage.setItem('usage-theme', next ? 'dark' : 'light'); } catch {}
  };
  const [data, setData] = useState<Report | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true);
  const [view, setView] = useState('activity'),
    [host, setHost] = useState('Combined'),
    [selectedDate, setSelectedDate] = useState(''),
    [period, setPeriod] = useState('day'),
    [tokenHost, setTokenHost] = useState('Mac'),
    [tokenDate, setTokenDate] = useState(''),
    [mobile, setMobile] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch('/local/usage.json', { cache: 'no-store' });
      if (!r.ok) throw Error();
      const v = (await r.json()) as Report;
      if (
        !v ||
        !Array.isArray(v.activity) ||
        !Array.isArray(v.tokens) ||
        !Array.isArray(v.agents)
      )
        throw Error();
      setData(v);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    const hash = location.hash.slice(1);
    if (views.some((v) => v.id === hash)) setView(hash);
    const q = matchMedia('(max-width: 700px)');
    setMobile(q.matches);
    const changed = () => setMobile(q.matches);
    q.addEventListener('change', changed);
    return () => q.removeEventListener('change', changed);
  }, [load]);
  const activitySources = data ? [...(data.combined ? [data.combined] : []), ...data.activity] : [];
  const current = activitySources.find((a) => a.host === host) || activitySources[0];
  const activeDate = selectedDate || current?.days?.at(-1)?.date || '';
  const dailyActivity = current?.days?.find(d => d.date === activeDate);
  const weekDays = activeDate ? Array.from({length:7},(_,i) => {
    const date = shiftDate(activeDate, i-6);
    return {date, record:current?.days?.find(d => d.date === date)};
  }) : [];
  const weeklyCategories: Record<string, number> = {};
  weekDays.forEach(({record}) => Object.entries(record?.categories || {}).forEach(([k,v]) => {weeklyCategories[k] = (weeklyCategories[k] || 0) + v;}));
  const shownCategories = period === 'week' && current?.days ? weeklyCategories : dailyActivity?.categories || (current?.days ? undefined : current?.categories);
  const earliest = current?.days?.[0]?.date, newest = current?.days?.at(-1)?.date;
  const previousDate = activeDate ? shiftDate(activeDate,period === 'week' ? -7 : -1) : '';
  const nextDate = activeDate ? shiftDate(activeDate,period === 'week' ? 7 : 1) : '';
  const seconds = sum(shownCategories),
    clock = time(seconds);
  const tokenSource = data?.tokens.find((t) => t.host === tokenHost),
    days = tokenSource?.days?.slice(-7) || [],
    latest = days.find(d => d.date === tokenDate) || days.at(-1);
  const sourceCount = data
    ? [...data.activity, ...data.tokens].filter((x) => x.status === 'ok').length
    : 0;
  const sourceTotal = data ? data.activity.length + data.tokens.length : 0;
  return (
    <div className="app-shell">
      <header className="app-bar">
        <div className="wordmark">
          <span className="brand-mark" aria-hidden="true">
            u
          </span>
          <span>
            Usage<span className="wordmark-detail"> / workspace</span>
          </span>
        </div>
        <div className="app-actions">
          <span className="local-label">
            <i />
            {data?.demo ? 'Synthetic demo' : 'Private dashboard'}
          </span>
          <Button
            variant="ghost"
            className="reload"
            aria-label={loading ? 'Loading snapshot' : 'Reload snapshot'}
            onClick={() => void load()}
            disabled={loading}
            title="Reload the saved snapshot. To collect new records, run npm run collect."
          >
            <RefreshCw size={18} />
            <span>{loading ? 'Loading' : 'Reload snapshot'}</span>
          </Button>
          <Button variant="ghost" className="theme-toggle" onClick={toggleTheme}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </Button>
        </div>
      </header>
      <Tabs
        value={view}
        onValueChange={(v) => {
          if (typeof v === 'string') {
            setView(v);
            history.replaceState(null, '', '#' + v);
          }
        }}
        orientation={mobile ? 'horizontal' : 'vertical'}
        className="workspace-tabs"
      >
        <TabsList className="nav-rail" aria-label="Usage views">
          {views.map((v) => (
            <TabsTrigger className="rail-item" key={v.id} value={v.id}>
              <span className="rail-icon">
                <v.icon size={23} />
              </span>
              <span>{v.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <main className="workspace-body">
          <div className="context-line">
            <span>WORKSPACE USAGE</span>
            <span>
              {data
                ? 'Snapshot · ' +
                  new Date(data.collectedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Waiting for snapshot'}
            </span>
          </div>
          {error && (
            <p className="error-banner" role="alert">
              Could not reload.{' '}
              {data
                ? 'Showing the previous snapshot.'
                : 'Run npm run collect, then reload.'}
            </p>
          )}
          {!data ? (
            <State>
              {loading
                ? 'Reading your local snapshot…'
                : 'No snapshot available yet.'}
            </State>
          ) : (
            <>
              <TabsContent value="activity" className="view-panel">
                <div className="view-heading">
                  <div>
                    <h1>Activity</h1>
                    <p>Recorded app activity, with away time removed.</p>
                  </div>
                  <div className="period-controls">
                    <ToggleGroup value={[period]} onValueChange={v => v[0] && setPeriod(v[0])} aria-label="Activity period" className="period-switch">
                      <ToggleGroupItem value="day">Day</ToggleGroupItem>
                      <ToggleGroupItem value="week">Week</ToggleGroupItem>
                    </ToggleGroup>
                    <div className="date-navigation">
                      <Button variant="ghost" aria-label={`Previous ${period}`} disabled={!earliest || previousDate < earliest} onClick={() => setSelectedDate(previousDate)}><ChevronLeft size={18}/></Button>
                      <span aria-live="polite">{period === 'week' && activeDate ? `${dateLabel(shiftDate(activeDate,-6))} to ${dateLabel(activeDate)}` : dateLabel(activeDate)}</span>
                      <Button variant="ghost" aria-label={`Next ${period}`} disabled={!newest || nextDate > newest} onClick={() => setSelectedDate(nextDate)}><ChevronRight size={18}/></Button>
                    </div>
                    <small>New York time</small>
                  </div>
                </div>
                <Tabs
                  value={host}
                  onValueChange={(v) => typeof v === 'string' && setHost(v)}
                  className="host-tabs"
                >
                  <TabsList
                    className="connected-buttons"
                    aria-label="Activity device"
                  >
                    {activitySources.map((a) => (
                      <TabsTrigger value={a.host} key={a.host}>
                        <span className="device-icon">
                          {a.host === 'Mac' ? (
                            <Laptop size={18} />
                          ) : (
                            <Monitor size={18} />
                          )}
                        </span>
                        <span className="device-name">{a.host}</span>
                        <span className="device-time">
                          {period === 'day' && a.status === 'ok'
                            ? (sum(a.days?.find(d => d.date === activeDate)?.categories || (a.days ? {} : a.categories)) / 3600).toFixed(1) + 'h'
                            : period === 'week' && a.status === 'ok' ? '7 days' : 'Unknown'}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                <TabsContent value={host}>
                {period === 'week' && <section className="weekly-timeline" aria-label="Recorded activity over seven days">
                  {weekDays.map(({date,record}) => <Button key={date} variant="ghost" className="week-day" aria-label={`${date}: ${record ? Math.round(record.seconds / 60) + ' recorded minutes' : 'outside collected window'}. Open day.`} disabled={!record} onClick={() => {setSelectedDate(date);setPeriod('day');}}>
                    <span className="week-bar-space"><span className="week-bar" style={{height:record?.seconds ? `${Math.max(4, record.seconds / Math.max(1,...weekDays.map(d => d.record?.seconds || 0)) * 100)}%` : '3px'}}/></span>
                    <strong>{new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{weekday:'short',timeZone:'UTC'})}</strong>
                    <small>{record ? `${(record.seconds/3600).toFixed(1)}h` : 'Unknown'}</small>
                  </Button>)}
                </section>}
                {period === 'day' && dailyActivity && <section className="daily-timeline" aria-label="Recorded activity by hour">
                  <div className="hour-track">{dailyActivity.hours.map((n, hour) => <span key={hour}
                    style={{ opacity: n ? 0.25 + 0.75 * Math.min(1, n / 3600) : 0.08 }}
                    title={`${hour}:00, ${Math.round(n / 60)} minutes recorded`} />)}</div>
                  <div className="hour-labels"><span>12 AM</span><span>6 AM</span><span>Noon</span><span>6 PM</span><span>12 AM</span></div>
                  <p>Recorded active minutes per hour. Gaps can mean idle time or missing records.</p>
                </section>}
                {current?.status === 'ok' && shownCategories ? (
                  <div className="activity-layout">
                    <section className="time-surface">
                      <div className="surface-label">
                        <Activity size={19} />
                        <span>{current.host === 'Combined' ? 'Across both devices' : `Active on ${current.host}`}</span>
                      </div>
                      <div className="big-time">
                        {clock.hours}
                        <span>h</span> {clock.minutes}
                        <span>m</span>
                      </div>
                      <p>{period === 'week' ? 'Recorded in this seven-day window. Coverage may be partial.' : dailyActivity ? `Recorded on ${activeDate}` : 'Across the recorded seven-day window'}</p>
                      <div
                        className="segmented-track"
                        aria-label="Activity category proportions"
                      >
                        {Object.entries(shownCategories)
                          .filter(([, v]) => v > 0)
                          .map(([k, v]) => (
                            <span
                              key={k}
                              className={'segment ' + k.toLowerCase().replaceAll(' ', '-')}
                              style={{ flex: v }}
                              title={k + ': ' + Math.round(v / 60) + ' min'}
                            />
                          ))}
                      </div>
                      <div className="surface-bottom">
                        <span>Foreground ≠ focus</span>
                        <span>{current.host === 'Combined' ? 'Overlap counted once' : 'One device'}</span>
                      </div>
                    </section>
                    <section
                      className="category-surface"
                      aria-label="Time by app category"
                    >
                      {Object.entries(shownCategories)
                        .sort((a, b) => b[1] - a[1])
                        .map(([k, v]) => {
                          const Icon = icons[k] || Shapes;
                          return (
                            <div className="category-row" key={k}>
                              <span
                                className={'category-icon ' + k.toLowerCase().replaceAll(' ', '-')}
                              >
                                <Icon size={21} />
                              </span>
                              <div className="category-name">
                                <strong>{k}</strong>
                                <span>
                                  {seconds
                                    ? Math.round((v / seconds) * 100)
                                    : 0}
                                  % of recorded activity
                                </span>
                              </div>
                              <span className="category-value">
                                {time(v).hours}
                                <small>h</small> {time(v).minutes}
                                <small>m</small>
                              </span>
                            </div>
                          );
                        })}
                    </section>
                  </div>
                ) : (
                  <State>
                    This device’s activity source is unavailable. Its activity is unknown, not zero.
                  </State>
                )}
                </TabsContent>
                </Tabs>
                <div className="lower-strip">
                  <div>
                    <span className="status-dot" />
                    <strong>{sourceCount}/{sourceTotal} sources read</strong>
                    <span>Collector snapshot</span>
                  </div>
                  <p>
                    App categories only. Window titles stay on their devices.
                  </p>
                </div>
                <details className="method-note">
                  <summary>How this is measured</summary>
                  <p>
                    ActivityWatch window intervals are intersected with non-AFK
                    intervals. AI apps and editors are separate categories. Editor time can include AI-assisted work. Foreground time does not
                    prove attention or distinguish automation from human input.
                    The combined view counts simultaneous activity once. Different categories at the same time are labeled mixed activity.
                    Missing collector history is not proof of inactivity. On daylight saving transitions, repeated clock hours share a chart cell.
                  </p>
                  <p>
                    Latest window event began:{' '}
                    {current?.latestEvent
                      ? new Date(current.latestEvent).toLocaleString()
                      : 'unknown'}
                    . Snapshot time is the last collection, not a guarantee that
                    collectors are currently running.
                  </p>
                </details>
              </TabsContent>
              <TabsContent value="tokens" className="view-panel">
                <div className="view-heading">
                  <div>
                    <h1>Tokens</h1>
                    <p>Model workload, not hours worked. Activity shows recorded computer time.</p>
                  </div>
                  <span className="period-chip">America/New_York</span>
                </div>
                <Tabs
                  value={tokenHost}
                  onValueChange={(v) =>
                    typeof v === 'string' && setTokenHost(v)
                  }
                  className="host-tabs"
                >
                  <TabsList
                    className="connected-buttons"
                    aria-label="Token source"
                  >
                    {data.tokens.map((t) => (
                      <TabsTrigger key={t.host} value={t.host}>
                        {t.host === 'Mac' ? (
                          <Laptop size={18} />
                        ) : (
                          <Terminal size={18} />
                        )}{' '}
                        {t.host}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                <TabsContent value={tokenHost}>
                {tokenSource?.status === 'ok' && days.length ? (
                  <div className="token-layout">
                    <section className="token-summary">
                      <span className="surface-label">
                        Selected day · {latest?.date}
                      </span>
                      <div className="token-number">
                        {latest?.totalTokens == null
                          ? 'Unknown'
                          : compact(latest.totalTokens)}
                      </div>
                      <p>Total recorded tokens</p>
                      <div className="token-parts">
                        <div>
                          <span>Input</span>
                          <strong>{fmt(latest?.inputTokens)}</strong>
                        </div>
                        <div>
                          <span>Cached</span>
                          <strong>{fmt(latest?.cacheReadTokens)}</strong>
                        </div>
                        <div>
                          <span>Output</span>
                          <strong>{fmt(latest?.outputTokens)}</strong>
                        </div>
                      </div>
                      <p className="small-note">
                        Reasoning is included in output.
                      </p>
                      <details className="estimate-note">
                        <summary>API comparison: {latest?.apiEstimate?.usd == null ? 'Unknown' : `$${latest.apiEstimate.usd.toFixed(2)}`} {latest?.apiEstimate?.excluded ? '(partial)' : ''}</summary>
                        <p>Hypothetical standard, short-context token price, not your bill. Covers {fmt(latest?.apiEstimate?.coveredTokens)} tokens. Inferred models and unsupported rates are excluded.</p>
                        <p>Long-context rates, Fast mode, tool fees and unreported cache writes are not estimated. Rates checked {latest?.apiEstimate?.checked || 'not yet'} against <a href="https://developers.openai.com/api/docs/pricing" target="_blank" rel="noreferrer">OpenAI pricing</a>.</p>
                      </details>
                    </section>
                    <section className="table-surface">
                      <div className="table-heading">
                        <h2>By model</h2>
                        <span>{latest?.date}</span>
                      </div>
                      <div className="model-breakdown">
                        {[...(latest?.models || [])].sort((a,b) => (b.totalTokens || 0) - (a.totalTokens || 0)).map(m => (
                          <details className="model-detail" key={m.model}>
                            <summary>
                              <span className="model-label">{m.model.replace(/^gpt-/,'GPT ').replace(/-(astra|terra|sol|luna)$/i, (_, name: string) => ' ' + name[0].toUpperCase() + name.slice(1))}{m.inferred && <small>Inferred label</small>}</span>
                              <span className="model-amount" title={`${fmt(m.totalTokens)} tokens`}>{m.totalTokens == null ? 'Unknown' : compact(m.totalTokens)}<small>{m.totalTokens != null && latest?.totalTokens ? `${(m.totalTokens / latest.totalTokens * 100).toFixed(1)}% of tokens` : 'Share unknown'}</small></span>
                              <span className="model-share" aria-hidden="true"><span style={{width: `${Math.min(100, Math.max(0, (m.totalTokens || 0) / (latest?.totalTokens || 1) * 100))}%`}} /></span>
                              <ChevronRight className="model-expand" size={16} aria-hidden="true" />
                            </summary>
                            <p className="model-id">{m.model} · {fmt(m.totalTokens)} tokens</p>
                            <dl className="model-counts">
                              <div><dt>Uncached input</dt><dd>{fmt(m.inputTokens)}</dd></div>
                              <div><dt>Cached input</dt><dd>{fmt(m.cacheReadTokens)}</dd></div>
                              <div><dt>Cache writes</dt><dd>{fmt(m.cacheCreationTokens)}</dd></div>
                              <div><dt>Output</dt><dd>{fmt(m.outputTokens)}</dd></div>
                            </dl>
                            <p className="model-estimate">API comparison: {m.apiEstimate?.usd == null ? 'Unknown' : `$${m.apiEstimate.usd.toFixed(2)}`}<span>Not actual spend. Standard short-context scenario.</span></p>
                          </details>
                        ))}
                        {!latest?.models.length && <p>No model breakdown in this report.</p>}
                      </div>
                      <details className="model-history">
                        <summary>Choose another recorded day</summary>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="align-right">
                              Total tokens
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...days].reverse().map((d) => (
                            <TableRow key={d.date}>
                              <TableCell><Button variant="ghost" aria-pressed={latest?.date === d.date} onClick={() => setTokenDate(d.date)}>{d.date}</Button></TableCell>
                              <TableCell className="align-right">
                                {fmt(d.totalTokens)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </details>
                    </section>
                  </div>
                ) : (
                  <State>
                    {tokenSource?.status === 'ok'
                      ? 'No recorded days found for this source.'
                      : tokenSource?.status === 'not-connected' ? 'Native Windows token logs are not connected yet. Ubuntu covers WSL only, not the Windows app.' : 'This token source is unavailable.'}
                  </State>
                )}
                </TabsContent>
                </Tabs>
                <details className="method-note">
                  <summary>Models & counting rules</summary>
                  <p>
                    Latest day:{' '}
                    {latest?.models
                      .map((m) => m.model + (m.inferred ? ' (inferred)' : ''))
                      .join(', ') || 'No model records'}
                    . Totals are reported by ccusage. Cached tokens can
                    dominate. Records from different hosts are not added
                    together until mirrored-session deduplication is verified.
                    These are the latest recorded dates, which may have gaps. API comparisons are hypothetical and partial, not actual spending or remaining quota.
                  </p>
                </details>
              </TabsContent>
              <TabsContent value="agents" className="view-panel">
                <div className="view-heading">
                  <div>
                    <h1>Agent work</h1>
                    <p>Agent requests and their recorded results.</p>
                  </div>
                  <span className="source-caption">Saved review runs</span>
                </div>
                <section className="agent-list">
                  {data.agents.map((a) => (
                    <article className="agent-row" key={a.id}>
                      <span
                        className={
                          'agent-icon ' + (a.status === 'failed' ? 'warn' : '')
                        }
                      >
                        <Workflow size={23} />
                      </span>
                      <div className="agent-identity">
                        <h2>{a.model}</h2>
                        <p>
                          {new Date(a.recordedAt).toLocaleDateString()} · latest
                          conversation snapshot
                        </p>
                        {a.failure && <p>{a.failure}</p>}
                      </div>
                      <div className="agent-metric">
                        <strong>
                          {a.seconds?.toFixed(1) ?? 'Unknown'}
                          <small> s</small>
                        </strong>
                        <span>Latest call</span>
                      </div>
                      <div className="agent-metric">
                        <strong>
                          {a.total == null ? 'Unknown' : compact(a.total)}
                        </strong>
                        <span>Reported tokens</span>
                      </div>
                      <span
                        className={
                          'run-state ' + (a.status === 'failed' ? 'warn' : '')
                        }
                      >
                        {a.status === 'failed' ? 'Failed' : 'Returned'}
                      </span>
                    </article>
                  ))}
                </section>
                {!data.agents.length && (
                  <State>No handoff receipts found.</State>
                )}
                <div className="quiet-note">
                  <CircleHelp size={18} />
                  <p>
                    A returned response is not a review pass. Failed-call token
                    usage is unknown.
                  </p>
                </div>
                <details className="method-note">
                  <summary>What these records cover</summary>
                  <p>
                    These are existing Antigravity review receipts, not every agent or
                    terminal command. One newest snapshot per conversation
                    avoids adding cumulative counters twice. Duration is the
                    latest call, not total conversation time. The selected model
                    name is a request record, not independent proof of the
                    serving model.
                  </p>
                </details>
              </TabsContent>
              <TabsContent value="sources" className="view-panel">
                <div className="view-heading">
                  <div>
                    <h1>Sources</h1>
                    <p>See which sources are connected and what is still missing.</p>
                  </div>
                  <span className="period-chip">{sourceCount}/{sourceTotal} read</span>
                </div>
                <div className="source-grid">
                  {[
                    ...data.activity.map((a) => ({
                      ...a,
                      kind: 'ActivityWatch',
                    })),
                    ...data.tokens.map((t) => ({ ...t, kind: 'Codex logs' })),
                  ].map((s) => (
                    <div className="source-row" key={s.host + s.kind}>
                      <span className="source-icon">
                        <Database size={20} />
                      </span>
                      <div>
                        <h2>{s.host}</h2>
                        <p>{s.kind}</p>
                      </div>
                      <span
                        className={
                          'run-state ' + (s.status === 'ok' ? '' : 'warn')
                        }
                      >
                        {s.status === 'ok' ? (
                          <>
                            <Check size={15} /> Read
                          </>
                        ) : (
                          'Unavailable'
                        )}
                      </span>
                    </div>
                  ))}
                </div>
                <section className="coverage-panel">
                  <h2>Not connected yet</h2>
                  <div className="coverage-tags">
                    {[
                      'Live limits & resets',
                      'SSH / tool history',
                      'Local model receipts',
                      'iPhone activity',
                      'Gemini web usage',
                    ].map((x) => (
                      <span key={x}>{x}</span>
                    ))}
                  </div>
                  <p>
                    Missing data stays unknown. No extra models or paid APIs run
                    to refresh this view.
                  </p>
                </section>
                <details className="method-note">
                  <summary>Refresh & privacy</summary>
                  <p>
                    Run <code>npm run collect</code> in this application, then
                    choose Reload snapshot. Refreshing is on demand; no
                    scheduler is installed. Personal config and data are
                    excluded from the public repo. Raw titles, prompts, commands
                    and credentials are never stored here.
                  </p>
                </details>
              </TabsContent>
            </>
          )}
          <footer>
            <span>Saved records stay on the dashboard host.</span>
            <a
              href="https://github.com/ScribleSean/ai-usage-dashboard"
              target="_blank"
              rel="noreferrer"
            >
              Source <ArrowUpRight size={15} />
            </a>
          </footer>
        </main>
      </Tabs>
    </div>
  );
}
