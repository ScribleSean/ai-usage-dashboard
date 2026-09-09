<div align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="Workspace Observatory telescope">
  <h1>Workspace Observatory</h1>
  <p><strong>Your screen time. Your AI usage. One clear view.</strong></p>
  <p>A local-first workspace monitor for people who build with AI.</p>
  <p>
    <a href="https://scriblesean.github.io/workspace-observatory/">Explore the demo</a>
    &nbsp; · &nbsp;
    <a href="docs/GUIDE.md">Get started</a>
    &nbsp; · &nbsp;
    <a href="docs/ROADMAP.md">Roadmap</a>
  </p>
  <p>Native Mac app · Private by default · Open source</p>
</div>

## See where your workspace goes

Observatory brings foreground activity, reported AI tokens, tool activity and dictation statistics into a single dashboard. Stay in the flow with a compact telescope menu-bar panel, then open the full view when you want the details.

| View | What it brings into focus |
| --- | --- |
| **Screen time** | Active app time, daily and weekly timelines, and overlap-aware Mac and Windows totals. |
| **AI usage** | Codex tokens by model and day, cached input, and separately reported quota windows where available. |
| **Workflows** | Recorded tool identities, agent receipts and local-model benchmark results, with explicit coverage. |
| **Dictation** | Wispr Flow audio duration and word counts. Retained TypeWhisper statistics stay separate. |

Missing data stays missing. Estimates stay labeled. Token counts are not subscription bills, and app activity is not a productivity score.

## Built to stay out of the way

- **Native Mac menu bar.** SwiftUI panel, system WebKit detail window, launch at login and automatic refresh. No manually started web server or bundled Chromium engine.
- **Your data stays yours.** No required hosted account. The dashboard retains allowlisted usage metadata, not prompts, transcripts, recordings or credentials.
- **One view across your setup.** The Mac collector can read configured Windows and Ubuntu sources over SSH. A Windows tray preview now collects locally. Optional device sync is still planned.
- **Inspectable by design.** Source health, freshness, tests and measurement limits are part of the product, not hidden behind a total.

## Try it

**[Open the interactive demo](https://scriblesean.github.io/workspace-observatory/)** to explore fictional records without connecting any accounts or devices.

The project is an early preview tested on one Mac, Windows and WSL setup. The Mac app currently builds from source. **Public installers are being prepared, not yet available.**

| Platform | Current status |
| --- | --- |
| macOS, Apple Silicon | Native app implemented. Source build and locally signed installation. |
| Windows x64 | Native tray preview with local collection and WebView2 dashboard. [Source build](docs/WINDOWS.md). Installer pending. |
| Ubuntu / WSL | Configured token and workflow sources. Standalone desktop app planned. |

Read the [setup and development guide](docs/GUIDE.md) or check the [integration coverage](docs/SOURCE-COVERAGE.md) before connecting your records.

## Go deeper

[Setup & development](docs/GUIDE.md) · [Source coverage](docs/SOURCE-COVERAGE.md) · [Startup](docs/STARTUP.md) · [Security](SECURITY.md) · [Brand](docs/BRAND.md) · [Roadmap](docs/ROADMAP.md)

Contributions are welcome, especially reproducible bugs, tested adapters and accessibility improvements. Use synthetic examples. Never attach private usage records or account details.

[MIT license](LICENSE) · [Third-party acknowledgments](THIRD-PARTY-NOTICES.md)
