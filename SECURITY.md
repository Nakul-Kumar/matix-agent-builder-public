# Security Notes

## Reporting

Report vulnerabilities through GitHub Security Advisories when available. Do
not post secrets, exploit details, or private data in public issues.

## Public Prompt Box

The browser must never call a model provider directly. The secure pattern is:

```text
Browser -> same-origin public server -> deployed public backend -> validated JSON -> browser
```

The frontend renders backend-approved JSON only.

## Secret Rules

Never add these to browser code, browser-exposed variables, generated exports,
or committed files:

- Gemini API keys
- OpenAI API keys
- Anthropic API keys
- database URLs
- JWTs
- cockpit cookies
- Codex auth files
- Claude auth files
- MCP credentials
- connector credentials
- private launch roots

Vite exposes browser-prefixed variables to the client bundle, so provider
secrets must never use that path.

## Public Server

`server/index.ts` is a small backend-for-frontend. It:

- serves `/api/health`
- forwards only allowlisted `/api/public/*` paths
- applies lightweight rate limiting to public API calls
- adds security headers
- never forwards cookies or private cockpit auth
- holds no provider keys by default

The only optional exception is `GEMINI_API_KEY`: when the operator sets it, the
server uses Google's Gemini API to refine previews and rewrite exported
instructions. That key is read only inside the server process and is never
exposed to the browser or written into exports. All other provider keys (OpenAI,
Anthropic, database URLs, cockpit auth) belong only in the deployed backend that
implements `/api/public/agent-builder/preview`.

## Public API Abuse Protection

The public BFF includes per-route rate limiting with configurable window and
request count. This is a first-line public-preview control, not a substitute
for upstream CDN, WAF, bot filtering, backend quotas, or provider-side spend
limits.

Deployment note: the in-process limiter stores counters in memory per instance.
On a multi-instance / autoscale deployment it does NOT coordinate across
instances (the effective limit is roughly the configured limit times the
instance count, and counters reset on cold start). Production must enforce limits
at the edge (CDN/WAF) and/or via backend quotas; treat the in-app limiter as
defense-in-depth only.

## Exports

Exports are starter examples only. They may include example files and
placeholder env names, but must not include real credentials or executable
launch instructions against private infrastructure.

## Verification

Before publishing:

```bash
npm run typecheck
npm run build
npm run scan:secrets
npm run scan:assets
npm run check:release
npm audit --omit=dev
```

Run `npm run smoke:live` when intentionally validating the deployed public
backend preview/export path.
