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
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  models: { model: string; inferred: boolean }[];
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
  const [data, setData] = useState<Report | null>(null),
    [error, setError] = useState(false),
    [loading, setLoading] = useState(true);
  const [view, setView] = useState('activity'),
    [host, setHost] = useState('Combined'),
    [selectedDate, setSelectedDate] = useState(''),
    [tokenHost, setTokenHost] = useState('Mac'),
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
  const shownCategories = dailyActivity?.categories || (current?.days ? undefined : current?.categories);
  const seconds = sum(shownCategories),
    clock = time(seconds);
  const tokenSource = data?.tokens.find((t) => t.host === tokenHost),
    days = tokenSource?.days?.slice(-7) || [],
    latest = days.at(-1);
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
            {data?.demo ? 'Synthetic demo' : 'On this computer'}
          </span>
          <Button
            variant="ghost"
            className="reload"
            onClick={() => void load()}
            disabled={loading}
            title="Reload the saved snapshot. To collect new records, run npm run collect."
          >
            <RefreshCw size={18} />
            <span>{loading ? 'Loading' : 'Reload snapshot'}</span>
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
                  <label className="day-picker">Day · New York
                    <Input type="date" aria-label="Activity date" value={activeDate}
                      min={current?.days?.[0]?.date} max={current?.days?.at(-1)?.date}
                      onChange={e => setSelectedDate(e.target.value)} />
                  </label>
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
                        <span>
                          {a.host === 'Mac' ? (
                            <Laptop size={18} />
                          ) : (
                            <Monitor size={18} />
                          )}
                        </span>
                        {a.host}
                        <span className="device-time">
                          {a.status === 'ok'
                            ? (sum(a.days?.find(d => d.date === activeDate)?.categories || (a.days ? {} : a.categories)) / 3600).toFixed(1) + 'h'
                            : 'Unknown'}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                <TabsContent value={host}>
                {dailyActivity && <section className="daily-timeline" aria-label="Recorded activity by hour">
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
                      <p>{dailyActivity ? `Recorded on ${activeDate}` : 'Across the recorded seven-day window'}</p>
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
                        Latest recorded day · {latest?.date}
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
                        <h2>Daily history</h2>
                        <span>7 latest recorded dates</span>
                      </div>
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
                              <TableCell>{d.date}</TableCell>
                              <TableCell className="align-right">
                                {fmt(d.totalTokens)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
                    . Totals are reported by ccusage; cached tokens can
                    dominate. Records from different hosts are not added
                    together until mirrored-session deduplication is verified.
                    These are the latest recorded dates, which may have gaps. No
                    dollar estimate or live quota is inferred.
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
            <span>Your usage records stay on this computer.</span>
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
