# Login startup on macOS

The dashboard server and an optional private SSH tunnel can run as per-user LaunchAgents. `scripts/login-jobs.mjs` creates property-list strings from an absolute repository path, a stable Node executable path, and the viewing computer's SSH alias. Generated machine-specific files belong outside Git.

Install the two generated files in `~/Library/LaunchAgents/` and load them with `launchctl bootstrap gui/$(id -u) PATH_TO_PLIST`. Their labels are `io.ai-usage-dashboard.server` and `io.ai-usage-dashboard.tunnel`. Both use KeepAlive with a 30-second restart throttle. The tunnel uses noninteractive authentication and connection keepalives, so a disconnected host can be retried without model calls.

The server and remote listener stay on `127.0.0.1:5601`. No public network listener or billing change is added. These two jobs only serve the existing snapshot.

Once the login jobs are installed, open `http://127.0.0.1:5601/#tokens` in either the Mac browser or the viewing Windows browser. The Windows address reaches the Mac through the private SSH tunnel. Starting Codex is not required and does not itself start these services. They belong to the logged-in Mac session and retry after connectivity returns. Ubuntu supplies configured source data through its existing SSH connection, but the Windows tunnel does not create an Ubuntu localhost listener.

Links from other apps may navigate to the root dashboard document, including its hash-based views. Cross-site fetches, frames and direct navigation to the private JSON routes remain blocked. Hostname checks are unchanged. A Forbidden response should be diagnosed from the request type rather than fixed by removing all cross-site protection or binding the server to the network.

## Optional automatic collection

Pass `python` as an absolute Python 3 executable path and `collectionIntervalSeconds: 300` to `loginJobs` to generate a third job, `io.ai-usage-dashboard.collector`. It runs on login and at five-minute intervals. Install and bootstrap its property list in the same way. It uses `StartInterval`, not a KeepAlive retry loop. Do not enable a second scheduler for the same collector.

The job runs `scripts/run-collector.py`, which also backs `npm run collect`. An operating-system file lock prevents manual and scheduled runs from overlapping. A busy attempt exits without replacing the active run's status. The lock releases when its process exits, including after a crash. The lock file may remain on disk and does not need to be removed.

Each run is limited to four minutes. A timed-out run stops only its own child process group. Source readers retain their shorter timeouts. The runner discards command output and publishes only status, timestamps and source counts in `public/local/collector.json`. It never starts model tasks. A failed attempt before snapshot publication leaves the previous snapshot intact.

The page checks the saved snapshot and status every 30 seconds while visible. It does not collect through the web server. A snapshot older than ten minutes is marked stale. Each source shows its last check time, which is different from the time of its latest activity or model call.

The hosting Mac must be awake and logged in. After a reboot, login is required. This is not an always-on hosted service. The Windows SSH server and private network connection must also be available. Browser theme preferences remain separate on each device.

Inspect jobs with `launchctl list io.ai-usage-dashboard.server`, `launchctl list io.ai-usage-dashboard.tunnel`, or `launchctl list io.ai-usage-dashboard.collector`. To disable one job, run `launchctl bootout gui/$(id -u)/LABEL`. Move its exact property-list file out of `~/Library/LaunchAgents/` to prevent it loading at the next login. Do not remove unrelated startup jobs.

If the repository moves or the Node installation changes, regenerate the affected property list and reload that job. A port already occupied by another process is an error, not permission to stop an unrelated application.
