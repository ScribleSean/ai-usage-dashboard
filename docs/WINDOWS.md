# Windows development preview

The native Windows tray app collects on Windows without a running Mac or open terminal. The current preview uses .NET Windows Forms and the installed Microsoft Edge WebView2 Runtime. Dashboard files are served inside WebView2, with no HTTP server or network listener.

This is a source-build preview, not a finished installer. Windows x64 is the tested build target. Other Windows architectures are not verified.

## Build on Windows

Use a Windows-local checkout, .NET 10 SDK, Python 3 with the `py` launcher and PowerShell. From the checkout root:

```powershell
.\native\windows\build.ps1
```

Pass `-Dotnet C:\path\to\dotnet.exe` for a private SDK installation. The script downloads a pinned Node 22 archive from nodejs.org, checks its SHA-256 digest and keeps the runtime and npm cache under `%LOCALAPPDATA%\WorkspaceObservatoryBuild\cache`. It does not replace the system Node installation. Dependencies and compiled output stay in the Windows checkout.

The icon is committed as a small generated asset. Its source is the canonical [telescope mark](../public/brand/telescope.svg). Regenerating that asset currently uses the Mac icon tool, but ordinary Windows builds do not require a Mac.

The build runs native snapshot and startup-contract tests, plus Windows collector-contract tests. It does not prove the UI works on a signed-in desktop. Run the executable from `native\windows\bin\Release\net10.0-windows` to inspect the tray and dashboard.

## Prepare a package candidate

```powershell
.\native\windows\package.ps1
```

This runs the development build and publishes a fresh candidate under `native\windows\release\candidate-ID\Workspace Observatory`. It bundles Node, Python, timezone data and .NET, so the packaged app does not require separate installations of those runtimes. Microsoft Edge WebView2 Runtime remains a system prerequisite.

Runtime archives have pinned download URLs and SHA-256 digests. The package includes dependency notices and a file-hash manifest. Packaging rejects known private data filenames, linked entries, debug symbols, Python bytecode-cache directories and detected build-machine paths. The manifest records the source revision and whether the checkout had uncommitted changes. A dirty candidate is not a versioned release.

`-SkipWebBuild` is an explicit development shortcut for packaging-only changes after a successful dashboard build. Do not use it for final release verification. Windows downloads, dependency caches and output stay on the Windows machine.

The tested candidate is about 224 MiB unpacked, including its private runtimes. This is a disk-size measurement, not a memory or CPU claim. Candidates are unsigned and may trigger Windows security warnings. A public installer is not yet available.

## Configure sources

Choose **Configure local collection** from the telescope tray menu. ActivityWatch must already be installed and running for screen time. Saved native Windows Codex records are read locally. Ubuntu collection is optional and starts the installed `Ubuntu` WSL distribution in the background during collection. Windows collection does not require WSL. Wispr Flow statistics are separately opt-in.

The plain development executable requires a working Python 3 installation with timezone data and a Node installation. Package candidates use their bundled copies instead. Local settings and snapshots live under `%LOCALAPPDATA%\Workspace Observatory`, outside the source checkout. Collection runs every five minutes while the configured app is running.

Only allowlisted metadata enters snapshots. Prompts, tool arguments, window titles, transcripts and recordings are excluded. Unsupported or disconnected sources remain unavailable. Combined cross-device token totals are not published by this collector until private sync and deduplication are implemented.

## Login startup

**Register start at login** adds or removes only this installation's entry in the current user's Windows Run key. No administrator privileges or Windows service is needed. The checked menu state means the entry matches this installation. Windows Settings, Task Manager or organizational policy may separately disable startup, so a checked entry does not prove launch occurred.

Disable registration before moving or removing the app folder. Another installation's entry is not silently replaced. Actual logout/login and reboot behavior still need release testing. See Microsoft's [Run-key documentation](https://learn.microsoft.com/en-us/windows/win32/setupapi/run-and-runonce-registry-keys) for platform behavior.

## Verification and remaining gates

On the development Windows machine, the native build and snapshot tests pass. The packaged app collected native Windows activity, saved Codex usage, Wispr statistics and optional Ubuntu Codex usage using its bundled runtimes. A signed-in desktop smoke test loaded the packaged React dashboard with fictional records and fetched its local snapshot through WebView2. The Activity view was visually inspected at the tested window size. These checks cover one configured machine, not clean-install compatibility or a full visual and accessibility review.

For a synthetic desktop test, prepare a new private test directory with `node native/windows/prepare-demo-runtime.mjs ABSOLUTE_NEW_DIRECTORY`. Run the packaged executable with `--test-web ABSOLUTE_NEW_DIRECTORY` from the signed-in desktop. The test captures only the WebView and only for a snapshot marked as synthetic. It does not capture other windows or the desktop. The result and WebView cache belong in that test directory, never in a release package.

Remaining work includes an installer and uninstall flow, versioned release checksums, clean-environment checks, login and sleep/wake testing, CPU and memory measurements, independent Mac collection and private device sync. Do not publish local snapshots or build caches as release artifacts.
