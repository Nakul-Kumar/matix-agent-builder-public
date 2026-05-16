# Security Notes

## Public Prompt Box

The browser must never call a model provider directly. The secure pattern is:

```text
Browser -> same-origin public server -> deployed public backend -> optional cheap model -> validated JSON -> browser
```

The frontend renders backend-approved JSON only.

## Secret Rules

Never add these to browser code, `VITE_*` variables, generated exports, or committed files:

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

Vite exposes `VITE_*` values to the browser bundle, so provider secrets must never use that prefix.

## Public Server

`server/index.ts` is a small backend-for-frontend. It:

- serves `/api/health`
- forwards only allowlisted `/api/public/*` paths
- adds security headers
- never forwards cookies or private cockpit auth
- does not know model-provider keys

Provider keys belong only in the deployed backend that implements `/api/public/agent-builder/preview`.

## Exports

Exports are starter examples only. They may include `*.example.*` files and placeholder env names, but must not include real credentials or executable launch instructions against private infrastructure.

## Verification

Before publishing:

```bash
npm run typecheck
npm run build
npm run scan:secrets
```

Then inspect the built assets for accidental private strings if the API contract changes.
