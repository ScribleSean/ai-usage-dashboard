# Usage tracking references

Reviewed September 6, 2026. These projects informed the data presentation. They are not all installed integrations.

| Project | Role | What we reuse |
| --- | --- | --- |
| [ccusage](https://github.com/ccusage/ccusage) | Reads local coding-agent records | Existing parser, daily JSON reports and per-model breakdowns |
| [Langfuse](https://langfuse.com/docs/observability/features/token-and-cost-tracking) | Captures model-call traces and costs | Separate reported and inferred data, typed usage fields and explicit price assumptions |
| [LiteLLM](https://docs.litellm.ai/docs/proxy/cost_tracking) | Tracks gateway calls | Model/source breakdowns and an explicit boundary around observed calls |
| [OpenLIT](https://github.com/openlit/openlit) | Runtime instrumentation | A future option for applications we control, not reconstructing old desktop logs |
| [tokentap](https://github.com/jmuncor/tokentap) | Interception proxy | Live usage presentation is relevant, but prompt capture and changed routing are outside this dashboard's scope |

## Applied now

The Tokens view shows model counts and shares for a selected host and recorded day. Expand a row for token categories and its supported API-equivalent scenario. Inferred labels remain visible but are not priced. Unknown cost is not zero cost. Counts already normalized by a parser must not have cached input subtracted again.

The API comparison is hypothetical, not an invoice or subscription savings claim. Rate sources and check dates are visible. Current coverage does not include every provider or model.

## Next accounting work

Verify additional provider token semantics and preserve unassigned totals. Add per-request context and service tiers before claiming billing accuracy. Keep prompts and tool content private. Only add runtime instrumentation when calls actually pass through it.
