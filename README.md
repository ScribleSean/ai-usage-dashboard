# AI Usage Dashboard

Open-source, local-only observability for a Mac/Windows/Ubuntu AI workspace. Public code; private data. No access to the author's personal context repository is needed.

**Status: early working prototype.** Tested on one Mac/Windows/WSL setup. Not a universal quota meter, productivity score or production analytics service. Responsive layout and keyboard-native controls are implemented; formal accessibility and browser-interaction testing remain future work.

## Try without accounts

Run `npm ci`, `npm run demo`, `npm run build`, then `npm run serve:local`. The demo is visibly labeled synthetic and refuses to overwrite personal data. No model, ActivityWatch or SSH connection is needed.

## Run

Requires Node 22.13+, existing ActivityWatch on Mac/Windows, existing ccusage on Mac/Ubuntu, and working SSH aliases. No model calls or paid APIs.

1. `npm ci` (for a fresh checkout).
2. Create ignored `local.config.json` from the example using your installed executables and SSH aliases. Do not put credentials in it.
3. `npm run collect` refreshes sanitized source snapshots, with bounded network/SSH calls.
4. `npm run build` exports the static interface.
5. `npm run serve:local` opens the loopback-only server at http://127.0.0.1:5601. Open that URL on the Mac.

To refresh later, run `npm run collect` and reload the page. No rebuild is needed for fresh data. Ask the coordinating agent to do this remotely if preferred. Collection is on demand, not scheduled. Stop the dashboard with Ctrl-C in its terminal; ActivityWatch continues independently.

## Three distinct views

- Foreground activity: rolling seven days of window time intersected with non-AFK intervals. Broad app categories only; no cross-device sum or claim of attention/human input.
- AI tokens: Mac and Ubuntu Codex daily reports, latest seven recorded dates, with cache/input/output breakdowns and inferred model labels. No cross-host sum until mirrored session deduplication is proven. No price estimates or quota inference.
- Agent work: fixed, existing Antigravity receipts; one newest snapshot per conversation, failure usage unknown. Duration is the latest call, not cumulative conversation time. Successful execution does not imply verified answer quality.

Live limits/reset times, all CLI/tool history, ongoing local-model receipts, Gemini web usage and iPhone activity remain unconnected. Missing sources show unavailable, never fabricated zeroes. Receipt coverage is the named review experiment, not all Google use.

## Privacy and delivery boundary

Raw ActivityWatch stores stay on their owning machines. Windows aggregates before SSH transfer. The Mac saves only allowlisted metrics to ignored `public/local/usage.json` with private file permissions. No prompts, raw commands, window titles, credentials, personal paths or raw app names enter snapshots. Existing tool transcripts are not exported. Local config, data and generated output are excluded from Git. The latest snapshot replaces the previous snapshot; deleting that file clears dashboard data without deleting source history.

Do not upload a personal generated build: it can contain a copied private snapshot. Public source is separate from private runtime data. `.openai/hosting.json` is an inert scaffold manifest with no registered project. The approved delivery is local only. Other devices can view through existing Mac Remote control; localhost on another device does not mean this Mac.

The pinned Sites starter audit currently reports dependency advisories. Do not expose its development server, RSC/server-function endpoints, or use it as a public deployment. The supported dashboard server is `serve-local.mjs`: Node built-ins, static GET/HEAD only, loopback binding, Host/cross-site checks, no directory listing, no command execution, no CORS, no-store responses. This containment is not a claim that the dependency tree is vulnerability-free; review/update dependencies before broader distribution.

## Verification

Local checks are implemented; hosted CI is not enabled. `ci/check.yml.example` is an inactive GitHub Actions template. The initial publishing login lacks workflow scope, so no broader authentication was requested. A repository owner can enable it later with an appropriately authorized login.

`npm run test:collectors`, `npx tsc --noEmit`, `npm run build`. Synthetic tests cover allowlisting, invalid metrics, missing data and cumulative receipt deduplication. Non-browser HTTP checks cover root/data serving, cross-site/Host rejection, unsupported methods and traversal. Browser interaction/visual QA has not been performed.

Source: [ActivityWatch query documentation](https://docs.activitywatch.net/en/latest/examples/working-with-data.html). The installed 0.13.2 parser requires intermediate assignments rather than the nested calls used in some examples.
