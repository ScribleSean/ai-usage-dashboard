// Standard short-context USD per million tokens, checked 2026-09-06.
// Comparison scenarios, not subscription charges or billing records.
export const rates = {
  'gpt-6-astra': [10, 1, 12.5, 50],
  'gpt-5.6-sol': [4, 0.4, 5, 20],
  'gpt-5.6-terra': [2, 0.2, 2.5, 12],
  'gpt-5.6-luna': [0.2, 0.02, 0.25, 1.2],
};
export function estimate(models) {
  let usd = 0, coveredTokens = 0, excluded = 0;
  for (const m of models) {
    const r = rates[m.model];
    const counts = [m.inputTokens, m.cacheReadTokens, m.cacheCreationTokens, m.outputTokens];
    if (!r || m.inferred || typeof m.totalTokens !== 'number' || !Number.isFinite(m.totalTokens) || m.totalTokens < 0 || counts.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0) ||
      Math.abs(counts.reduce((a,b) => a+b,0) - m.totalTokens) > 1) { excluded++; continue; }
    usd += counts.reduce((total,n,i) => total+n*r[i],0) / 1e6;
    coveredTokens += m.totalTokens;
  }
  return { usd: coveredTokens ? usd : null, coveredTokens, excluded, checked: '2026-09-06' };
}
