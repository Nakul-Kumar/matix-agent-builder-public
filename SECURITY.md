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
- does not know model-provider keys

Provider keys belong only in the deployed backend that implements
`/api/public/agent-builder/preview`.

## Public API Abuse Protection

The public BFF includes per-route rate limiting with configurable window and
request count. This is a first-line public-preview control, not a substitute
for upstream CDN, WAF, bot filtering, backend quotas, or provider-side spend
limits.

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
