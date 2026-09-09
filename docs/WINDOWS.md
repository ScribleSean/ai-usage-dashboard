# Windows development preview

The native Windows tray app collects on Windows without a running Mac or open terminal. The current preview uses .NET Windows Forms and the installed Microsoft Edge WebView2 Runtime. Dashboard files are served inside WebView2, with no HTTP server or network listener.

This is a development preview. A per-user installer is implemented and tested, but no public binary release is available yet. Windows x64 is the tested build target. Other Windows architectures are not verified.

## Build on Windows

Use a Windows-local checkout, .NET 10 SDK, Python 3 with the `py` launcher and PowerShell. From the checkout root:

```powershell
.\native\windows\build.ps1
```

Pass `-Dotnet C:\path\to\dotnet.exe` for a private SDK installation. The script downloads a pinned Node 22 archive from nodejs.org, checks its SHA-256 digest and keeps the runtime and npm cache under `%LOCALAPPDATA%\WorkspaceObservatoryBuild\cache`. It does not replace the system Node installation. Dependencies and compiled output stay in the Windows checkout.

The icon is committed as a small generated asset. Its source is the canonical [telescope mark](../public/brand/telescope.svg). Regenerating that asset currently uses the Mac icon tool, but ordinary Windows builds do not require a Mac.

The build runs native snapshot and startup-contract tests plus the JavaScript and reader test suite. Six POSIX runner tests explicitly skip on Windows because the Windows app uses its native collector, not the `flock` and process-group runner. This does not prove the UI works on a signed-in desktop. Run the executable from `native\windows\bin\Release\net10.0-windows` to inspect the tray and dashboard.

## Prepare a package candidate

```powershell
.\native\windows\package.ps1
```

This runs the development build and publishes a fresh candidate under `native\windows\release\candidate-ID\Workspace Observatory`. It bundles Node, Python, timezone data and .NET, so the packaged app does not require separate installations of those runtimes. Microsoft Edge WebView2 Runtime remains a system prerequisite.

Runtime archives have pinned download URLs and SHA-256 digests. The package includes dependency notices and a file-hash manifest. Packaging rejects known private data filenames, linked entries, debug symbols, Python bytecode-cache directories and detected build-machine paths. The manifest records the source revision and whether the checkout had uncommitted changes. A dirty candidate is not a versioned release.

Recheck an existing candidate without replacing its manifest:

```powershell
node .\native\windows\verify-manifest.mjs 'C:\absolute\path\Workspace Observatory'
```

This rejects modified, additional or missing payload files, invalid Windows paths, linked entries and dirty-source manifests. For development candidates only, add `--allow-dirty`; file verification still applies. The manifest is an integrity inventory, not a publisher signature or a substitute for the package privacy inspection.

Installer-tool preparation uses the pinned NSIS archive in `native/windows/installer-tool.json`. Its SHA-256 was computed after matching the official release listing's SHA-1 over an HTTPS download. It is not a vendor-published SHA-256. The compiler stays in the Windows build cache and is not installed system-wide.

`-SkipWebBuild` is an explicit development shortcut for packaging-only changes after a successful dashboard build. Do not use it for final release verification. Windows downloads, dependency caches and output stay on the Windows machine.

The tested candidate is about 224 MiB unpacked, including its private runtimes. This is a disk-size measurement, not a memory or CPU claim. Candidates are unsigned and may trigger Windows security warnings.

## Build and test the installer

From a clean checkout matching the package manifest's source revision:

```powershell
.\native\windows\installer.ps1 -PackageDirectory 'C:\absolute\path\Workspace Observatory'
```

This verifies the existing package and builds a per-user NSIS installer with a SHA-256 sidecar. The printed executable lives in a separate `artifacts` directory with its build metadata and NSIS license. Only that artifact directory is intended for distribution. The parent compiler-work directory contains generated build paths and must not be published. Warnings are compilation failures. The installer and package source revisions must match and both must be clean.

For isolated development verification, add `-TestIdentity`, then pass the printed executable path to:

```powershell
.\native\windows\test-installer.ps1 -InstallerPath 'C:\absolute\path\TEST-setup.exe'
```

The integration test accepts only the test identity and refuses pre-existing test registrations or folders. On the development Windows machine it verified installation, every payload hash, the Start menu shortcut, native self-tests, refusal to overwrite an existing install, running-app refusal, rejection of linked payload directories, uninstall, and reinstall. It also verified preservation of saved data, unrelated files and registration values, and another startup owner. Its temporary installation was removed afterward. These are one-machine checks, not proof of clean-machine compatibility.

## Install, remove, update or roll back

The installer uses `%LOCALAPPDATA%\Programs\Workspace Observatory` and adds a Start menu shortcut plus the current user's uninstall registration. It requires no administrator privileges. Source collection and login startup stay opt-in. It does not install ActivityWatch, WSL or WebView2, and it does not change system runtimes.

Quit the app through its tray menu before removing it in Windows Settings. Uninstall deletes only the package's recorded files and this installation's registrations. Saved settings and snapshots under `%LOCALAPPDATA%\Workspace Observatory` remain. Unrelated files keep their folders from being removed; linked install directories are refused.

There is no automatic updater. To update, uninstall the current version and install the new one. To return to an earlier compatible build, uninstall and reinstall that earlier build. Re-enable login startup afterward if wanted. Keep a private backup of saved data before changing versions. The current test covers reinstalling the same schema, not compatibility with future data migrations. If unrelated files keep an old install folder in place, move that folder aside before reinstalling rather than deleting its contents.

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

Remaining work includes final clean-source release artifact checks, clean-environment checks, login and sleep/wake testing, CPU and memory measurements, independent Mac collection and private device sync. Do not publish local snapshots or build caches as release artifacts.
