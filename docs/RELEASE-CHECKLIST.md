# Portfolio release checklist

The next release should be easy to try without personal accounts and clear about what its data means. Keep the existing Material 3 Expressive design and local execution model.

## Verified foundation

- Synthetic demo with no required AI account.
- Separate activity, token, agent and source views.
- Private configuration and generated data excluded from Git.
- Collector tests for invalid metrics, private fields and repeated counters.
- Device selectors own their result panels.
- Copy regression test for the no-em-dash rule.
- Seven local-server checks pass for successful reads, request restrictions and security headers. These checks do not constitute a complete security audit.

## Remaining release gates

The September 6 activity update adds overlap-safe combined time, daily hourly buckets and separate AI-app/editor categories. Synthetic tests cover duplicates, overlapping categories, clipping, local midnight and fall daylight saving time. Four observed data sources refreshed successfully. Native Windows token logs remain explicitly disconnected.

## Pending data coverage

- Connect native Windows token records after checking available logs and avoiding mirrored-session double counting.
- Add Google and Anthropic API-equivalent estimates only after receipt token semantics and exact model mappings are verified. The current comparison covers selected OpenAI models, not all usage.
- Import new local-helper and external-agent receipts through a reusable configured adapter. Preserve historical failures even when a later check succeeds.
- Track quota/reset data only through a supported source. Do not infer remaining allowance from tokens.
- Keep SSH/tool history, iPhone activity and Gemini website activity on the roadmap. These do not block a usable first dashboard release.

## Release checks

1. Browser interaction checks for all views, device selection, keyboard focus, narrow layouts and enlarged text. Source-level tests do not establish browser accessibility.
2. Reproduce the README demo from a clean checkout without touching the owner's snapshot.
3. Extend local-server checks as new endpoints or capabilities are added.
4. Review remaining dependency advisories and document actual exposure. Do not call the app vulnerability-free.
5. Enable hosted CI through an appropriately authorized GitHub login. The example workflow is not active CI.
6. Add a screenshot using synthetic data only after the interface checks pass.

Do not publish a hosted copy containing personal data. Quota coverage, broader agent receipts and command history are later data-adapter work, not claims of this release.
