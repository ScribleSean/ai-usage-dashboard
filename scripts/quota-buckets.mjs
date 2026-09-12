// Retired allowance identifiers are excluded from new reads and saved history.
// Token accounting is separate and must not discard historical model usage.
export const visibleQuotaBucket=value=>typeof value==='string' &&
  !['codex_bengalfox','codex_spark','spark'].includes(value.toLowerCase());
