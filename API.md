# Public API Contract

The browser calls same-origin routes only. The public server forwards those
requests to `MATIX_PUBLIC_API_BASE` after checking an allowlist and rate limit.
JSON request bodies are capped at `32kb`.

`MATIX_PUBLIC_API_BASE` should point at a compatible versioned public backend,
for example:

```text
https://your-cockpit-domain.example/api/v1/public
```

## Routes

### `GET /api/health`

Local public server health check.

Returns:

```json
{
  "ok": true,
  "app": "matix-agent-builder",
  "env": "development",
  "upstream_configured": true
}
```

### `GET /api/metrics`

Lightweight per-instance operational metrics. In production this route returns
`404` unless `METRICS_TOKEN` is configured and the caller sends a matching
`Authorization: Bearer <token>` or `X-Metrics-Token` value.

Metrics are in-memory only and reset on restart.

### `GET /api/public/registry-summary`

Public-safe registry summary. Used for top-level proof and cache warmup.

### `GET /api/public/agent-builder/templates`

Returns public-safe runtime template summaries for Codex, Claude Code, and
OpenClaw.

### `POST /api/public/agent-builder/preview`

Creates a public-safe preview from a prompt.

Request:

```json
{
  "prompt": "Build a software engineer agent for a Next.js app"
}
```

Local BFF validation rejects preview prompts that are not strings, are shorter
than 12 characters, or do not look like agent/assistant/automation/build
requests.

Response includes:

- `prompt_hash`
- `normalized_prompt`
- `generated_at`
- `model.provider`, `model.name`, and `model.status`
- `selection_source`, which is the actual serving/source mode for the prompt
- `calibration` with teacher/student model policy when provided
- `source_statuses`
- `source_policy`
- three runtime `placards`

Each selected artifact in `skills`, `mcps`, and `tools` should include:

- `artifact_ref`
- `artifact_kind`
- `name`
- `description`
- `source_links`
- `license` with `name`, `url`, `source`, and `confidence`
- `score_breakdown`
- `why_selected`
- `setup_hint`
- `credential_status`
- `warnings`

The response must never include provider keys, database URLs, JWTs, private
cockpit IDs, launch roots, or real credential values.

### `POST /api/public/agent-builder/export`

Returns a safe example export for one platform.

Request:

```json
{
  "prompt": "Build a software engineer agent for a Next.js app",
  "platform": "codex"
}
```

Export prompts use the same local BFF prompt validation as preview prompts.

Exports should include, when supported by the backend:

- `START_HERE.md`
- runtime instructions such as `AGENTS.md` or `CLAUDE.md`
- runtime config examples such as `config.toml` or `.mcp.example.json`
- generated `skills/*/SKILL.md` files
- `context/objective.json`
- `context/source-links.json`
- `manifest.json`
- `LICENSES.md`

Exports must use placeholders only and should explain optional credentials,
manual review, and license obligations.

#### Optional Gemini rewrite of the primary instructions file

When the BFF has `GEMINI_API_KEY` configured, the export response's primary
instructions file (the one `manifest.file_manifest.instructions` points at --
`codex-home/AGENTS.md` for Codex, etc.) is rewritten by Gemini to reflect
the user's actual prompt, name the artifacts that are actually present in
the bundle, and flag obvious capability gaps. When this happens, the
manifest gains a `gemini_instructions` provenance object:

```json
{
  "manifest": {
    "gemini_instructions": {
      "provider": "google",
      "model": "gemini-3.5-flash",
      "applied_to": "codex-home/AGENTS.md",
      "generated_at": "2026-05-23T03:30:00.000Z"
    }
  }
}
```

If the rewrite fails for any reason (no key configured, Gemini error,
non-JSON-shaped export body), the field is absent and the cockpit's
original instructions file is returned untouched.

### `POST /api/public/agent-builder/feedback`

Stores public feedback.

Request:

```json
{
  "prompt_hash": "abc123",
  "rating": 5,
  "feedback": "The Codex placard was useful.",
  "platform": "codex",
  "did_export": true,
  "metadata": {
    "page": "results"
  }
}
```

Feedback does not call a model from the browser.

Feedback metadata is optional and must be a JSON object with at most 10
primitive string/number/boolean fields. Keys are limited to 64 characters and
stringified values to 256 characters. Invalid metadata returns `422`.

## Allowlist

The server currently forwards only:

- `/registry-summary`
- `/agent-builder/templates`
- `/agent-builder/preview`
- `/agent-builder/export`
- `/agent-builder/feedback`

Any other `/api/public/*` path returns `404`.

## Rate Limiting

The public BFF applies lightweight in-memory rate limiting per route, HTTP
method, and client network key. Configure with:

- `RATE_LIMIT_WINDOW_MS` (default `60000`)
- `RATE_LIMIT_MAX` (default `60`)

When a client exceeds the limit, the BFF returns `429` with `Retry-After`.
Production should still enforce edge/backend quotas because the in-app limiter
is per instance and resets on restart.
