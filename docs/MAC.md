# Mac development preview

The existing Apple Silicon app uses a SwiftUI menu-bar panel and a system WebKit dashboard. Its current installed-preview workflow still uses external Node/Python installations and the legacy collector configuration. Self-contained runtime packaging and integration of the new local collector into the app are pending.

## Independent local collector

`scripts/collect-mac.mjs` collects this Mac's ActivityWatch activity, saved Codex token/settings records, and optional Wispr Flow or TypeWhisper statistics. It does not call SSH, inspect Windows/Ubuntu records, or publish combined cross-device totals. ActivityWatch must already be running locally. The Python readers use only the standard library.

Prepare a separate private runtime directory outside the checkout. Put `collector.config.json` there:

```json
{
  "activity": true,
  "codex": true,
  "wispr": false,
  "typewhisper": false
}
```

Only these boolean source settings are accepted. Dictation sources are opt-in. Run one collection with absolute paths to the runtime directory, Node, Python and collector script:

```sh
python3 scripts/run-collector.py \
  --runtime /absolute/private/runtime \
  --collector /absolute/checkout/scripts/collect-mac.mjs \
  --node /absolute/path/to/node \
  --python /absolute/path/to/python3
```

This is a one-shot command, not a new background service. The POSIX runner serializes collection and stops its own child process group on timeout or termination. The script can stay inside a read-only application bundle while writable settings, snapshots and lock files remain in the private runtime directory. It does not copy private records into the bundle or checkout.

Snapshots include only the existing allowlisted usage fields. Raw prompts, tool arguments, window titles, transcripts and audio do not enter the output. Remote devices remain disconnected, and combined totals remain unavailable until private sync and deduplication are implemented. Read failures are unavailable, not fabricated zeroes.

## Verified scope

The local collector was tested in an isolated directory on the development Mac. ActivityWatch, saved Codex usage, Wispr and TypeWhisper all returned valid metadata. The snapshot passed the private-field shape check. Regression tests cover disabled readers, output filtering, shared token/settings reads, invalid counters, and ActivityWatch interval normalization. POSIX runner tests cover failure, timeout, overlapping runs and separation of bundle code from writable state.

These checks did not modify the installed app, its login registration, its existing settings or its legacy cross-device collector. They do not yet establish a self-contained Mac release, clean-machine compatibility, or an installed-app migration. Do not replace the working collector until the app's packaged runtimes, configuration flow and optional device sync have been verified.
