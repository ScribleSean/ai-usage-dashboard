# Native interface verification

Development-machine checks on September 9, 2026. These results are not a full accessibility review or a clean-install result.

## Mac candidate `7d3b2cc`

The checks used an isolated `--preview --show` launch with collection sources disabled. The installed application and its collector were not replaced. The shared web assets were built on Windows and packaged into the Mac candidate.

| Check | Observed result |
| --- | --- |
| Vertical view rail | Up/Down moves keyboard focus; Enter activates the focused view. Activity to Tokens and back was verified in WebKit. |
| Horizontal device tabs | Right and Enter moved from Combined to Mac after the orientation fix. |
| Focus indication | Keyboard focus has a visible outline. This is a spot check, not an exhaustive focus-order audit. |
| Inactive panels | Returning from Tokens to Activity no longer leaves the inactive Tokens panel drawn underneath. Verified by scrolling and inspecting the rendered window. |
| Empty states | Activity, Tokens, Agents, Dictation and Sources expose named views and unavailable-state text, rather than invented usage totals. |
| Minimum window | All five empty-data views were inspected at the configured 800-by-550-point minimum. Visible controls and text fit the width; longer content requires vertical scrolling. This does not establish populated-table or enlarged-text behavior. |
| Build checks | Windows tests passed (121 pass, eight platform skips), with TypeScript and both UI builds passing. Mac signature, self-test, bundled-collector, WebKit and three-cycle window-lifecycle checks passed. |

The tab wrapper previously styled a vertical rail without forwarding its orientation to the underlying component. It now forwards that property. The Mac renderer smoke test checks the actual desktop tablist's `aria-orientation`, after allowing React to mount. Inactive panels are explicitly hidden while the tab component finishes its unmount transition.

## Selection follow-up, candidate `4731c97`

The visual rail highlight remained on Activity after switching views in the earlier preview, including with direct clicks and after raising the window. Tab-selection color transitions are now disabled, so selection feedback does not depend on animation progress. In the rebuilt Mac preview, Sources and Tokens highlighted correctly, and the horizontal Mac token tab matched its selected accessibility state. Right and Enter activation also remained functional.

The same check exposed Windows-specific disconnected-source text in the Mac token view. The message is now source-neutral and was verified in the native Mac preview. Both UI builds and the Mac signature, self-test, bundled-collector, WebKit and window-lifecycle checks passed for this candidate. These fixes do not change collection settings or install a new version over the working app.

## Still open

- Check populated synthetic records, expanded details, complete keyboard focus order, both themes and 200% text enlargement.
- Repeat the interaction and layout checks in Windows WebView2. A Windows web build does not prove Windows-native interaction behavior.
- Verify the final packaged release, not only this development candidate. Existing ZIP and installer artifacts retain their earlier revisions and do not contain these UI fixes.

See the [release checklist](RELEASE-CHECKLIST.md) for the remaining installation, lifecycle, security and publication gates.
