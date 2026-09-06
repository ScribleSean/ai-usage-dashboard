# Login startup on macOS

The dashboard server and an optional private SSH tunnel can run as per-user LaunchAgents. `scripts/login-jobs.mjs` creates property-list strings from an absolute repository path, a stable Node executable path, and the viewing computer's SSH alias. Generated machine-specific files belong outside Git.

Install the two generated files in `~/Library/LaunchAgents/` and load them with `launchctl bootstrap gui/$(id -u) PATH_TO_PLIST`. Their labels are `io.ai-usage-dashboard.server` and `io.ai-usage-dashboard.tunnel`. Both use KeepAlive with a 30-second restart throttle. The tunnel uses noninteractive authentication and connection keepalives, so a disconnected host can be retried without model calls.

The server and remote listener stay on `127.0.0.1:5601`. No public network listener, billing change, or automatic data collection is added. The existing snapshot is served until the collector is run again.

The hosting Mac must be awake and logged in. After a reboot, login is required. This is not an always-on hosted service. The Windows SSH server and private network connection must also be available. Browser theme preferences remain separate on each device.

Inspect jobs with `launchctl list io.ai-usage-dashboard.server` and `launchctl list io.ai-usage-dashboard.tunnel`. To disable either job, run `launchctl bootout gui/$(id -u)/LABEL`. Move its exact property-list file out of `~/Library/LaunchAgents/` to prevent it loading at the next login. Do not remove unrelated startup jobs.

If the repository moves or the Node installation changes, regenerate the affected property list and reload that job. A port already occupied by another process is an error, not permission to stop an unrelated application.
