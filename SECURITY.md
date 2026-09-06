# Security and privacy

This is an early local-only prototype. Do not expose its server to a network or host builds containing personal data. No authentication or multi-user authorization is implemented; local processes with filesystem access remain in the trust boundary.

Use `npm run serve:local`, not a Vite, Vinext or Wrangler development server for ongoing viewing. It serves static assets through Node built-ins, with no framework server functions or image upload/processing paths. The server accepts only loopback requests with an allowlisted Host, rejects cross-site requests, and does not execute commands.

The initial scaffold's React/Vite/esbuild/undici advisories were addressed by explicit dependency updates. As of 2026-09-06, npm audit still reports seven high entries involving image-size, sharp, ws and their framework/build parents. Image parsers and Cloudflare development servers are not used by the supported static server. This narrows exposure but is not a vulnerability-free dependency claim. Review dependency updates before public deployment or accepting untrusted image/build inputs.

Do not include real usage data, config, credentials or transcripts in an issue. Report reproducible concerns with synthetic examples. Raw records belong to their original tools; this dashboard stores a replaceable ignored aggregate snapshot only.
