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

## Configure sources

Choose **Configure local collection** from the telescope tray menu. ActivityWatch must already be installed and running for screen time. Saved native Windows Codex records are read locally. Ubuntu collection is optional and starts the installed `Ubuntu` WSL distribution in the background during collection. Windows collection does not require WSL. Wispr Flow statistics are separately opt-in.

The current collector requires a working Python 3 installation with timezone data and a Node installation. Portable runtime bundling is a remaining release gate. Local settings and snapshots live under `%LOCALAPPDATA%\Workspace Observatory`, outside the source checkout. Collection runs every five minutes while the configured app is running.

Only allowlisted metadata enters snapshots. Prompts, tool arguments, window titles, transcripts and recordings are excluded. Unsupported or disconnected sources remain unavailable. Combined cross-device token totals are not published by this collector until private sync and deduplication are implemented.

## Login startup

**Register start at login** adds or removes only this installation's entry in the current user's Windows Run key. No administrator privileges or Windows service is needed. The checked menu state means the entry matches this installation. Windows Settings, Task Manager or organizational policy may separately disable startup, so a checked entry does not prove launch occurred.

Disable registration before moving or removing the app folder. Another installation's entry is not silently replaced. Actual logout/login and reboot behavior still need release testing. See Microsoft's [Run-key documentation](https://learn.microsoft.com/en-us/windows/win32/setupapi/run-and-runonce-registry-keys) for platform behavior.

## Verification and remaining gates

On the development Windows machine, the native build and snapshot tests pass. A signed-in desktop smoke test loaded the React dashboard and fetched the local snapshot through WebView2. Native Windows activity, saved Codex usage, Wispr statistics and optional Ubuntu Codex usage were collected successfully. These checks cover one configured machine, not clean-install compatibility or a full visual and accessibility review.

Remaining work includes bundled runtime licensing and packaging, an installer and uninstall flow, signed-release status, login and sleep/wake testing, resource measurements, independent Mac collection and private device sync. Do not publish local snapshots or build caches as release artifacts.
