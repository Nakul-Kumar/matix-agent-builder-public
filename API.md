# Public API Contract

The browser calls same-origin routes only. The public server forwards those requests to `MATIX_PUBLIC_API_BASE` after checking an allowlist.

## Routes

### `GET /api/health`

Local public server health check.

Returns:

```json
{
  "ok": true,
  "app": "matix-agent-builder-public",
  "env": "development",
  "upstream_configured": true
}
```

### `GET /api/public/registry-summary`

Public-safe registry summary. Used for top-level proof and cache warmup.

### `GET /api/public/agent-builder/templates`

Returns public-safe runtime template summaries for Codex, Claude Code, and OpenClaw.

### `POST /api/public/agent-builder/preview`

Creates a public-safe preview from a prompt.

Request:

```json
{
  "prompt": "Build a software engineer agent for a Next.js app"
}
```

Response includes:

- prompt hash
- model status
- three runtime placards
- source policy
- safe source links

The response must never include provider keys, DB URLs, JWTs, private cockpit IDs, launch roots, or real credential values.

### `POST /api/public/agent-builder/export`

Returns a safe example export for one platform.

Request:

```json
{
  "prompt": "Build a software engineer agent for a Next.js app",
  "platform": "codex"
}
```

Export files may include:

- `README.md`
- `AGENTS.md`
- `config.example.toml`
- `.mcp.example.json`
- `manifest.json`

Exports must use placeholders only.

### `POST /api/public/agent-builder/feedback`

Stores public feedback.

Request:

```json
{
  "prompt_hash": "abc123",
  "rating": 5,
  "feedback": "The Codex placard was useful.",
  "platform": "codex",
  "did_export": true
}
```

Feedback does not call an LLM by default.

## Allowlist

The server currently forwards only:

- `/registry-summary`
- `/agent-builder/templates`
- `/agent-builder/preview`
- `/agent-builder/export`
- `/agent-builder/feedback`

Any other `/api/public/*` path returns `404`.
