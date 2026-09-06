# Source coverage

The dashboard reads several kinds of records. A successful read means that adapter returned data, not that every activity or model call has been captured. Per-source check times measure the read, not the latest user activity. Snapshot ages update while the page is open. A stale snapshot is not presented as a current read.

| Source | What it measures | Important limit |
| --- | --- | --- |
| ActivityWatch | Foreground app intervals intersected with non-away intervals | Foreground time does not prove typing, focus or model execution |
| Codex daily reports | Tokens by recorded day and model | Aliases may be inferred, and hosts may contain mirrored sessions |
| Codex settings metadata | Token counter increments associated with recorded reasoning effort and service tier | Unreconciled counters are withheld, with missing coverage stated explicitly |
| Codex tool metadata | Allowlisted categories of saved tool-call requests | Not an execution-success report, duration measure or full SSH history |
| Codex limits | Read-only account quota windows and reset timestamps | On-demand snapshot, not continuous polling or other providers' limits |
| Local model receipts | Saved benchmark call counts, output tokens, latency and GPU measurements | Not general local-model history or proof the runtime is currently running |

## Foreground app detail

Recognized app names map to a fixed public list before transfer. Unknown applications become Other app. Raw window titles and arbitrary executable names stay on their source device. ChatGPT and Codex can share one desktop process label, so the dashboard keeps that label combined. Different concurrent app categories are presented as Device overlap and counted once.

## Reasoning, speed and price

The settings reader inspects recent session and archive logs on their owning machine. It keeps only model IDs, recorded effort, service tier, token counts and tool-call categories. It never exports prompts, command arguments, working directories or raw session IDs. Duplicate session files select the largest saved copy. It uses the latest request counters when cumulative usage changes, with cumulative deltas as a fallback. Unchanged cumulative counters are not counted twice. A model selection does not relabel an earlier turn. Both `standard` and `default` are recognized as Standard speed.

The collector brackets each settings read with daily token reports. If those totals change, it retries once. Continued changes withhold settings detail while preserving tool metadata. This prevents active usage from creating a false accounting mismatch. The request-counter rule was checked against the installed daily reader using local aggregate comparisons and synthetic reset fixtures. The upstream [Codex parser](https://github.com/ccusage/ccusage/blob/main/rust/adapters/codex/src/parser.rs) documents the same preference for request counters over cumulative differences.

Before showing a settings breakdown, every token-category subtotal must fit the corresponding daily model report. A mismatch withholds that breakdown. Missing labels stay Unknown, and inferred model aliases are not used for price estimates.

## All-host tokens

All combines Mac, Ubuntu and native Windows daily Codex reports. It includes a by-host contribution breakdown, combined model rows and the same standard API comparison. Saved external-agent review receipts and local benchmark measurements are not added to these totals.

Before aggregation, every host must return a successful token report and complete session-metadata inventory. Each collection generates a fresh random salt. Source machines turn session and parent identifiers into HMAC comparison keys. These temporary keys exist only during collection and are discarded before the snapshot is written. Only the verification result and overlap counts are saved.

Shared identifiers, cross-host parent relationships or a shared parent block the combined total. Unavailable sources and incomplete inventories also block it. The dashboard does not guess which duplicate to keep. This checks cross-host overlap, not the completeness or correctness of every underlying provider record. Per-host settings must reconcile before they contribute to combined settings.

## Weekly activity timeline

Week shows seven dated rows and 24 hour cells per row. Color intensity represents recorded active minutes in that hour, while the row end shows the day's total. Selecting a row opens its day view. Empty cells can mean idle time or missing history, not proof of inactivity. Days outside the collected window are marked separately. Repeated daylight-saving hours share a cell, while the recorded duration remains unchanged.

Model rows show a standard short-context API comparison and its share of the priced subtotal, not a share of the subscription bill. Expanded settings rows can apply the published Fast-mode rates where the tier was recorded. Reasoning tokens remain part of output. Long-context pricing, tools, regional adjustments and unreported cache writes are excluded. Rates were checked against [OpenAI pricing](https://developers.openai.com/api/docs/pricing) on September 6, 2026.

## Account limits

The optional quota reader starts a short-lived local Codex app-server process, initializes it and calls only `account/rateLimits/read`. It exits after a response or a bounded timeout. It uses the existing authenticated client, never reads credentials into the dashboard, never launches a task, and never redeems resets or requests credits. Account IDs and credit details are discarded. See the [official protocol](https://learn.chatgpt.com/docs/app-server).

## Gaps requiring a separate approach

- iPhone activity is not a plug-in source for this web dashboard. Apple's [DeviceActivityReport](https://developer.apple.com/documentation/deviceactivity/deviceactivityreport) runs inside a privacy-preserving extension sandbox that restricts exporting sensitive activity. Do not bypass that boundary. A user-supplied summary is a possible future input, not an installed feature.
- Google documents [Gemini data export](https://support.google.com/gemini/answer/16920332?hl=en), including activity and conversations. That does not establish a token-billing report. No export or transcript import has been requested here. A future metadata-only importer needs an inspected sample and explicit scope.
- General SSH commands outside saved Codex logs remain untracked. Broad shell-history capture is deliberately not enabled.
- Other providers' remaining allowance requires a verified provider-specific interface. Codex quota is not a substitute for Gemini or Claude limits.
