# AI usage dashboard

A dashboard for tracking app activity and AI usage across a Mac and a Windows PC. It reads existing records from ActivityWatch, Codex and a small set of Antigravity agent runs.

The app runs on your computer. It does not send usage records to a hosted service or make model requests.

## What you can see

| View | Records |
| --- | --- |
| Activity | Time spent in broad app categories on Mac and Windows, excluding away time |
| Tokens | Daily Codex token counts from Mac and Ubuntu, including cached input |
| Agents | The latest saved result from each recorded Antigravity conversation |
| Sources | Which sources were read and which measurements are still missing |

Choose a device within each view. Counts from different computers stay separate because their records may overlap.

This is an early prototype tested on one Mac, Windows and WSL setup. It does not yet track live subscription limits, every terminal command, iPhone activity or Gemini website usage. The Antigravity adapter currently reads four named receipt files from one configured directory.

## Try the demo

You need Node.js 22.13 or later.

```sh
git clone https://github.com/ScribleSean/ai-usage-dashboard.git
cd ai-usage-dashboard
npm ci
npm run demo
npm run build
npm run serve:local
```

Open [localhost:5601](http://127.0.0.1:5601). The demo uses made-up records and labels them as sample data. It refuses to overwrite an existing snapshot. You do not need an AI account, ActivityWatch or an SSH connection to try it.

## Connect your own records

The current collector runs on macOS. It expects ActivityWatch on the Mac and Windows PC, ccusage on the Mac and Ubuntu, and working SSH aliases for Windows and Ubuntu.

Copy `local.config.example.json` to `local.config.json`. Set the executable paths, SSH aliases and receipt directory for your machines. Keep credentials in your existing SSH and provider settings.

```sh
npm run collect
```

The collector replaces the dashboard snapshot. Choose **Reload snapshot** in the app to display it. You do not need to rebuild after collecting new records.

Collection runs only when you ask for it. To stop the dashboard, press Ctrl-C in its terminal. ActivityWatch continues recording independently.

## How to read the numbers

ActivityWatch records foreground windows and away time. The dashboard groups active window time by app category. This does not measure attention or reliably distinguish human input from computer automation.

Codex counts come from ccusage reports. Cached tokens are included in the reported total, and reasoning tokens are part of output. These counts cannot tell you how much subscription allowance remains or how much money you spent.

Antigravity receipts may contain cumulative conversation counters. The dashboard keeps the newest snapshot for each conversation instead of adding them together. A failed call shows unknown token usage. A returned response does not establish that its answer was correct.

Dates in token reports use America/New_York. The history shows the latest seven recorded dates, which may have gaps. Activity uses a rolling seven-day window.

## Data and security

Window titles remain in ActivityWatch on their original machines. Windows reduces activity to broad categories before sending it over SSH. The dashboard stores aggregate counts in `public/local/usage.json`. It does not store raw titles, prompts, commands or credentials.

Git excludes personal configuration, snapshots and generated builds. A generated build may contain a copy of your snapshot, so do not upload it. Deleting the snapshot clears the dashboard without deleting the original tool records.

Use `npm run serve:local` for viewing. It serves static files on the loopback address and does not run framework server functions. It has no authentication or multi-user support. Read [SECURITY.md](SECURITY.md) for dependency advisories and deployment limits.

## Development

```sh
npm run test:collectors
npx tsc --noEmit
npm run build
```

Collector tests use synthetic records to check filtering, invalid values and repeated conversation counters. The interface uses React and Vinext with a static export. The local server uses Node's built-in HTTP module.

Hosted CI is not enabled. [ci/check.yml.example](ci/check.yml.example) contains a GitHub Actions workflow that a repository owner can enable with an authorized login.

The design draws on [lnkiai/m3e-canvas](https://github.com/lnkiai/m3e-canvas), including its Material 3 Expressive navigation, connected controls and tonal surfaces. [Design notes](docs/DESIGN.md) explain how those ideas apply here.

## Contributing

Reproducible bugs, adapter improvements and accessibility fixes are welcome. Use synthetic examples in issues and pull requests. Do not attach personal usage records, transcripts or account details.

The project uses the [MIT license](LICENSE). See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for dependency attribution.
