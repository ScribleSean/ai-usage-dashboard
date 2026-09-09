# Private pairing maintenance

Pairing setup and repair are still under development. Do not hand-edit identifiers, remove a revocation marker to reconnect, or reset a sequence counter. No permanent pairing is installed by the release build process.

## Disable a local pairing

The native Mac and Windows menus now include **Disconnect paired device…** in source. The confirmation defaults to Cancel or No and explains that the operation affects this installation only. It refuses to start during local collection. If the bundled tool fails, collection is paused for that app session so an automatic refresh does not immediately attempt another exchange. Retry disconnection or quit until the state can be inspected. This pause is not a persistent setting and does not stop another process or device.

These controls have native build and temporary-runtime integration coverage. On Mac, the unpaired-state message, confirmation layout, cancellation without revocation, confirmed revocation and subsequent local collection were verified in an isolated all-sources-disabled preview. Windows interactive confirmation/cancellation and both platforms' failure/retry presentation still need desktop verification. These controls are not in the previously generated release installers yet.

The source CLI supports an explicit local disable operation:

```sh
node scripts/peer-revocation.mjs --runtime /absolute/path/to/private/runtime --revoke
```

Use the runtime of the installation you intend to disable, not the source checkout. On Windows, use an absolute Windows path and quote paths containing spaces. The runtime directory must already exist and pass the private-directory checks. The command reports only a generic status, never comparison salts, device identifiers or snapshots.

For a controlled cutoff, quit both native apps and stop their collector jobs or test processes before running the command separately on each device. An already started exchange may complete; local revocation cannot recall data already sent. This command does not change SSH keys, host access, startup settings or the other device.

The operation creates `private-sync/revoked` without overwriting existing files. Even an empty interrupted marker disables pairing. Repeating the operation is safe for a normal existing marker. Unsafe permissions or linked entries fail closed. The configuration and database remain on disk for explicit recovery. This is not data erasure.

Subsequent collection runs locally without exporting or merging the peer snapshot. An already displayed combined dashboard can remain visible until the next successful collection replaces it. Revocation does not rewrite that display immediately.

## Repair or rotate

An automated repair/rotation workflow is not available yet. Keep the old generation disabled until an explicit authenticated two-device setup can create new comparison credentials and sequence state. Do not delete the old database or marker as a repair shortcut. A future repair must account for both devices, in-flight work, retained private data and interrupted setup before claiming reconnection is complete.

## Verification limits

Synthetic tests cover local revocation, unchanged stored bytes, refusal to initialize over revoked state, malformed configuration, interrupted markers, stale in-memory pairing, exchange refusal and standalone native collection. They do not prove immediate cancellation of an in-flight transfer, remote SSH-access revocation, power-loss durability or a completed native pairing UI.
