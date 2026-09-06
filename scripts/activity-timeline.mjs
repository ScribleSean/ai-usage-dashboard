export const categories = ['AI apps', 'Editors', 'Terminal', 'Browser', 'Other'];
export const timezone = 'America/New_York';
const clock = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
});
function slot(t) {
  const p = Object.fromEntries(clock.formatToParts(t).map(p => [p.type, p.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
export function cleanIntervals(rows, start, end) {
  if (!Array.isArray(rows) || rows.length > 200000) throw Error('Invalid intervals');
  const lo = Date.parse(start), hi = Date.parse(end);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo || hi - lo > 7 * 86400000 + 1000) throw Error('Invalid window');
  return rows.map(r => {
    const a = Date.parse(r.start), b = Date.parse(r.end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b < a || !categories.includes(r.category)) throw Error('Invalid interval');
    return { start: Math.max(lo, a), end: Math.min(hi, b), category: r.category };
  }).filter(r => r.end > r.start);
}

// Sweep interval boundaries instead of adding device totals. Concurrent categories
// remain explicitly mixed rather than guessing which device held attention.
export function summarize(rows, start, end) {
  const days = new Map();
  const day = date => {
    if (!days.has(date)) days.set(date, { date, seconds: 0, hours: Array(24).fill(0), categories: {} });
    return days.get(date);
  };
  for (let t = Date.parse(start); t < Date.parse(end); t += 3600000) day(slot(t).date);
  const events = [];
  rows.forEach((r, id) => { events.push([r.start, id, r.category], [r.end, id, null]); });
  events.sort((a, b) => a[0] - b[0]);
  const active = new Map();
  let previous = events[0]?.[0];
  for (let i = 0; i < events.length;) {
    const t = events[i][0];
    if (active.size && t > previous) {
      const labels = new Set(active.values());
      const category = labels.size === 1 ? [...labels][0] : 'Mixed activity';
      // Split on minute boundaries to honor local midnight and DST transitions.
      for (let cursor = previous; cursor < t;) {
        const next = Math.min(t, (Math.floor(cursor / 60000) + 1) * 60000);
        const s = slot(cursor), d = day(s.date), seconds = (next - cursor) / 1000;
        d.seconds += seconds;
        d.hours[s.hour] += seconds;
        d.categories[category] = (d.categories[category] || 0) + seconds;
        cursor = next;
      }
    }
    while (i < events.length && events[i][0] === t) {
      const [, id, label] = events[i++];
      if (label === null) active.delete(id); else active.set(id, label);
    }
    previous = t;
  }
  const totals = {};
  for (const d of days.values()) for (const [k, v] of Object.entries(d.categories)) totals[k] = (totals[k] || 0) + v;
  return { categories: totals, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)) };
}
