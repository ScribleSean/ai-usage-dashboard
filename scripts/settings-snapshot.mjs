// Read-only consistency check. Never compare detail against an earlier total.
export async function readSettingsSnapshot(initialTokens, readTokens, readSettings) {
  let before = initialTokens;
  for (let attempt = 0; attempt < 2; attempt++) {
    const settings = await readSettings();
    const after = await readTokens();
    if (before.status === 'ok' && after.status === 'ok' &&
        JSON.stringify(before.days) === JSON.stringify(after.days)) {
      return {tokens: after, settings: {...settings, snapshotStable: true}};
    }
    before = after;
    if (attempt === 1) {
      return {tokens: after, settings: {...settings, profiles: [], snapshotStable: false}};
    }
  }
}
