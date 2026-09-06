'use client';
import { useEffect, useState } from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

type Tokens = {
  date: string;
  totalTokens: number | null;
  inputTokens: number | null;
  cacheReadTokens: number | null;
  outputTokens: number | null;
  models: { model: string; inferred: boolean }[];
};
type Activity = {
  host: string;
  status: string;
  categories?: Record<string, number>;
  latestEvent?: string;
};
type Agent = {
  id: string;
  model: string;
  status: string;
  seconds: number | null;
  total: number | null;
  recordedAt: string;
};
type Report = {
  demo?: boolean;
  collectedAt: string;
  activity: Activity[];
  tokens: { host: string; status: string; days?: Tokens[] }[];
  agents: Agent[];
};
const num = (x: number | null | undefined) =>
  x == null ? 'Unknown' : new Intl.NumberFormat('en-US').format(x);
const hours = (x: number) => `${(x / 3600).toFixed(1)} h`;
export default function Home() {
  const [data, setData] = useState<Report | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    fetch('/local/usage.json', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((value) => {
        const v = value as Report;
        if (
          !v ||
          !Array.isArray(v.activity) ||
          !Array.isArray(v.tokens) ||
          !Array.isArray(v.agents)
        )
          throw Error();
        setData(v);
      })
      .catch(() => setError(true));
  }, []);
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">WORKSPACE OBSERVATORY</p>
          <h1>Your work, in view.</h1>
        </div>
        <span className="badge">
          {data?.demo ? 'SYNTHETIC DEMO DATA' : 'Local only · no paid APIs'}
        </span>
      </header>
      <nav aria-label="Dashboard sections">
        <a href="#activity">01 Activity</a>
        <a href="#tokens">02 AI tokens</a>
        <a href="#agents">03 Agent work</a>
      </nav>
      {!data ? (
        <p role="status">
          {error
            ? 'No snapshot is available. Run the local collector, then reload this page.'
            : 'Loading your local snapshot…'}
        </p>
      ) : (
        <>
          <div className="snapshot">
            <p>Collected {new Date(data.collectedAt).toLocaleString()}</p>
            <p>
              Snapshot, not a live quota meter. Reload after collecting new
              records.
            </p>
          </div>
          <section id="activity">
            <div className="section-title">
              <h2>
                <span>01</span> Foreground activity
              </h2>
              <p>Rolling seven days · away time excluded</p>
            </div>
            <div className="grid">
              {data.activity.map((a) => (
                <article key={a.host}>
                  <div className="card-title">
                    <h3>{a.host}</h3>
                    <span className="badge">
                      {a.status === 'ok' ? 'Connected' : 'Unavailable'}
                    </span>
                  </div>
                  {a.status === 'ok' && a.categories ? (
                    <>
                      <div className="metric">
                        {hours(
                          Object.values(a.categories).reduce(
                            (s, n) => s + n,
                            0,
                          ),
                        )}
                      </div>
                      <p className="muted">Recorded foreground-active time</p>
                      {Object.entries(a.categories).map(([k, v]) => (
                        <div className="bar-row" key={k}>
                          <div>
                            <span>{k}</span>
                            <span>{hours(v)}</span>
                          </div>
                          <meter
                            aria-label={k + ' active seconds'}
                            min={0}
                            max={Math.max(1, ...Object.values(a.categories!))}
                            value={v}
                          />
                        </div>
                      ))}
                      <p className="small">
                        Latest window event:{' '}
                        {a.latestEvent
                          ? new Date(a.latestEvent).toLocaleString()
                          : 'Unknown'}
                      </p>
                    </>
                  ) : (
                    <p>
                      Source could not be read. This is missing data, not zero
                      activity.
                    </p>
                  )}
                </article>
              ))}
            </div>
            <p className="note">
              Categories use app identity, never window titles. “Coding”
              includes AI apps. Foreground activity does not prove attention or
              human input; devices may overlap, so these hours are not summed.
            </p>
          </section>
          <section id="tokens">
            <div className="section-title">
              <h2>
                <span>02</span> Recorded AI tokens
              </h2>
              <p>Codex logs · America/New_York</p>
            </div>
            <div className="grid">
              {data.tokens.map((t) => {
                const days = t.days?.slice(-7) || [];
                return (
                  <article key={t.host}>
                    <div className="card-title">
                      <h3>{t.host}</h3>
                      <span className="badge">
                        {t.status === 'ok' ? 'Connected' : 'Unavailable'}
                      </span>
                    </div>
                    <p className="muted">
                      Latest seven recorded dates—not necessarily consecutive
                      days.
                    </p>
                    {t.status === 'ok' ? (
                      days.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead className="right">
                                Total tokens
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {days.map((d) => (
                              <TableRow key={d.date}>
                                <TableCell>{d.date}</TableCell>
                                <TableCell className="right">
                                  {num(d.totalTokens)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <p>
                          No recorded days found; usage elsewhere may still
                          exist.
                        </p>
                      )
                    ) : (
                      <p>Token report unavailable.</p>
                    )}
                    {days.length > 0 && (
                      <details>
                        <summary>Input, cache, output & models</summary>
                        {days.map((d) => (
                          <div className="detail-row" key={d.date}>
                            <strong>{d.date}</strong>
                            <p>
                              Input {num(d.inputTokens)} · Cached{' '}
                              {num(d.cacheReadTokens)} · Output{' '}
                              {num(d.outputTokens)}
                            </p>
                            <p className="small">
                              {d.models
                                .map(
                                  (m) =>
                                    m.model + (m.inferred ? ' (inferred)' : ''),
                                )
                                .join(', ')}
                            </p>
                          </div>
                        ))}
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
            <p className="note">
              Parser-reported totals include cached tokens. Reasoning is part of
              output, not an extra total. No cross-host sum until
              mirrored-session deduplication is verified. Tokens are not
              remaining allowance or money spent.
            </p>
          </section>
          <section id="agents">
            <div className="section-title">
              <h2>
                <span>03</span> Agent work
              </h2>
              <p>Existing Antigravity handoff receipts only</p>
            </div>
            <article>
              {data.agents.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Selected model</TableHead>
                      <TableHead>Run status</TableHead>
                      <TableHead>Call duration</TableHead>
                      <TableHead>Latest reported tokens</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.agents.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.model}</TableCell>
                        <TableCell>
                          <span
                            className={
                              a.status === 'failed' ? 'failed' : 'success'
                            }
                          >
                            {a.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          {a.seconds == null
                            ? 'Unknown'
                            : a.seconds.toFixed(1) + ' s'}
                        </TableCell>
                        <TableCell>{num(a.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p>No handoff receipts found.</p>
              )}
              <p className="note">
                One latest snapshot per conversation; continued calls may have
                cumulative counters. Call duration is not total agent-work time.
                Failed-call token usage is unknown. “Completed” means the client
                returned successfully, not that its answer passed review.
              </p>
            </article>
            <div className="coverage">
              <h3>Not connected yet</h3>
              <p>
                Live subscription limits/reset times · full SSH/tool execution
                history · ongoing local-model usage · iPhone activity · Gemini
                website usage.
              </p>
              <p>
                Missing data stays unknown. No raw prompts, titles, commands or
                credentials are stored in this dashboard.
              </p>
            </div>
          </section>
          <footer>
            Private snapshots stay on this Mac. Existing ActivityWatch stores
            remain on their respective devices.
          </footer>
        </>
      )}
    </main>
  );
}
