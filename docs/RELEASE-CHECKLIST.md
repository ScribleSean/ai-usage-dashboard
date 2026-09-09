# Desktop release checklist

Status reviewed September 9, 2026. A passing development-machine test is not a clean-install result. This checklist tracks the requested desktop release, not every future integration in the [roadmap](ROADMAP.md).

## Verified preparation

| Area | Evidence and boundary |
| --- | --- |
| Source and demo | Reviewed source is synced to GitHub and the Windows build checkout. Hosted CI runs tests, TypeScript, the synthetic demo and production build. Public demo records are fictional. |
| Mac app | Self-contained Apple Silicon build, nested signatures, bundled-collector test, WebKit bridge and three window open/close cycles pass. The lifecycle check verifies web-view deallocation, not total helper memory. |
| Mac ZIP | Clean-source candidate `eecc330` passed full-file inventory, privacy checks, signature verification, ZIP extraction and relocated runtime/lifecycle tests. About 60 MiB compressed. Ad hoc signed, not notarized. |
| Mac deployment targets | The app declares macOS 14.0; its eleven bundled runtime binaries declare macOS 11.0. This is binary-header evidence, not a test on macOS 14. |
| Windows package | Clean-source candidate `d3019cf` passed native/runtime checks and all 996 payload hashes. About 224 MiB unpacked. Uses the system WebView2 runtime. |
| Windows installer | An unsigned installer and checksum were prepared. Its isolated test identity passed install, shortcut, payload, overwrite-refusal, linked-directory, uninstall, reinstall and data-preservation checks. The ordinary installer has not been installed or published. |
| Native source reads | Packaged development checks read Mac ActivityWatch, Codex, Wispr and TypeWhisper metadata; Windows checks read local ActivityWatch, Codex, Wispr and optional Ubuntu Codex records. These are one-setup checks with explicit unavailable states. |
| Aggregation | Tests cover overlapping intervals, repeated records, local midnight, daylight saving time, invalid/missing hosts and private-field filtering. Cross-host token overlap blocks combined totals instead of guessing. |
| npm dependencies | September 9 lockfile-only audit reports zero known vulnerabilities. Clean Windows install, tests (121 pass, eight platform skips), TypeScript and both builds pass. Native UI files remain byte-identical. This does not audit bundled runtimes, OS webviews or application logic. See [security scope](../SECURITY.md). |

Binary candidates retain their embedded source revisions even when later source-only changes are synced. Never relabel an older artifact as a newer build. Rebuild and reverify affected binaries before final publication.

## Required release gates still open

- **Private connection:** settle the first-release sync direction, implement the agreed path using the existing authenticated route or optional Tailscale, and test disconnection, reconnection, repeated transfers, overlap handling and revocation. Preserve the working legacy collector until its replacement is verified.
- **Mac DMG:** complete creation, integrity, read-only mount and content checks. A development attempt stalled in macOS authorization. ZIP verification does not satisfy this gate, and system protections must not be disabled.
- **Clean environment:** verify installation and first launch without development dependencies. Exercise the documented supported OS/runtime prerequisites and disclose untested versions.
- **Lifecycle:** verify actual login startup and sleep/wake, idle and collection resource use, and orderly shutdown on both platforms. A short all-sources-disabled Mac baseline was about 69 MiB for the native process only; it does not establish normal collection cost or total WebKit memory.
- **Migration:** exercise the installed app's settings preservation, version update, rollback and uninstall. The Windows isolated test covers same-schema reinstall, not every future migration. Do not overwrite the owner's working installation to claim this gate.
- **Interface:** finish all-view, keyboard, narrow-layout and enlarged-text checks in the native renderers. A rendered view or source-level test is not a full accessibility review.
- **Security review:** npm dependency review is recorded above. Complete the remaining runtime/application review, verify final artifact privacy and integrity, and disclose unsigned/unnotarized warnings. Recheck advisories before publication. Do not call the app vulnerability-free.
- **Publication:** publish versioned artifacts, checksums, changelog and accurate download links only after the applicable gates pass. Keep the README concise and detailed instructions in this folder. Use synthetic data for screenshots or a later demonstration video.

## Later coverage, not claims of this release

Broader providers, other-provider quota, general shell/SSH history, iPhone activity, standalone Linux UI and optional request routing remain roadmap work. They need their own supported sources, privacy boundaries and verification. Token counts are not subscription charges, and a router only observes traffic explicitly sent through it.

See [source coverage](SOURCE-COVERAGE.md), [Mac verification](MAC.md) and [Windows verification](WINDOWS.md) for measurement limits and commands.
