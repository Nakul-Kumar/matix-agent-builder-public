# Data Inventory

This repository is the public UI and backend-for-frontend (BFF). It does not
own the authenticated cockpit database, but the current hosted deployment calls
a compatible AgentForge cockpit backend. This inventory separates what this
repo handles from what the upstream backend stores.

## Browser

- Storage: no intentional `localStorage`, `sessionStorage`, `indexedDB`, or
  cookie writes.
- Network: same-origin calls only, under `/api/*`.
- Secrets: no provider keys, database URLs, JWTs, cockpit cookies, MCP
  credentials, or connector credentials in browser code.
- User-submitted fields: prompt text, optional feedback text, optional email,
  rating, selected platform, and export status.

## Public BFF (`server/index.ts`)

- Durable storage: none.
- Durable analytics log when enabled:
  - Default production path:
    `/var/lib/matix-agent-builder/analytics.jsonl`.
  - Override path: `MATIX_ANALYTICS_LOG`.
  - Disable: `MATIX_ANALYTICS_ENABLED=false`.
  - Format: one JSON object per line.
- In-memory data:
  - `rateBuckets`: per-instance public API rate counters.
  - `routeMetrics`: per-instance request/latency counters for `/api/metrics`.
- Request body limit: `32kb` JSON.
- Forwarded headers: only `content-type` and `accept`.
- Forwarded paths: only the public allowlist in `allowedPublicRoutes`.
- Provider calls:
  - Default: no model provider call from this BFF.
  - Optional: if `GEMINI_API_KEY` is set, the BFF may send the prompt and
    backend candidate metadata to Google Gemini for preview refinement/export
    instruction rewriting.
- Local validation:
  - Preview/export prompts must be strings, at least 12 characters, and look
    like agent-building requests.
  - Feedback metadata is limited to 10 primitive keys, key length 64, value
    stringified length 256.
- Analytics events:
  - Server action events: `registry_summary`, `preview`, `export`, `feedback`.
  - Client click events: `preview_click`, `export_click`, `inspect_click`,
    `feedback_submit_click`, `example_prompt_click`, `runtime_tab_click`.
  - Prompt text is capped at 1000 characters.
  - Feedback text is capped at 2000 characters.
  - Contact email is stored when submitted.
  - Client IP and user agent are stored only as SHA-256 hashes truncated to 32
    hex characters.

## Upstream catalog tables used by the current AgentForge backend

The current compatible backend reads public-safe recommendation/catalog data
from:

- `af.skills`: indexed skills and skill metadata.
- `af.agent_template_sources`: runtime template/source records.
- `af.command_sources`: native command/tool source records.

These tables drive public placards, score breakdowns, source links, template
metadata, license labels, and setup hints. They are not stored in this repo.

## Upstream public event tables used by the current AgentForge backend

The current hosted backend creates and writes these public tables:

- `public_agent_builder_events`: preview/export events, prompt hash, raw prompt,
  selected platform, model JSON, objective tags, selected templates, artifact
  refs, source policy, optional IP/user-agent hashes, and metadata.
- `public_agent_builder_recommendation_runs`: recommendation run record,
  normalized prompt, target platforms, model JSON, formula version, source
  policy, and metadata.
- `public_agent_builder_recommendation_items`: selected artifact rows per run,
  including platform, section, position, artifact IDs/refs, scores, source
  links, and source snapshots.
- `public_feedback`: feedback message, rating, optional contact email, selected
  platform, moderation status, and metadata.

Data-engineering note: this public repo cannot enforce retention on those
tables. The compatible backend or database operator must enforce deletion or
partition expiry for raw prompts, feedback messages, and optional contact email.
Do not promise production retention until that backend job is verified.

## Public source directories and credits

The backend may surface public metadata and source links from these directories
and repositories. The original authors retain their licenses and copyrights:

- [skills.sh](https://www.skills.sh/)
- [LLMBase skills](https://llmbase.ai/skills/)
- [PulseMCP](https://www.pulsemcp.com/servers)
- [MCP Market](https://mcpmarket.com/)
- [mcpservers.org](https://mcpservers.org/)
- [Agent Skills](https://agentskills.io/)
- [GitHub MCP Server](https://github.com/github/github-mcp-server)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Context7](https://github.com/upstash/context7)

Every public response/export should preserve `source_links` and license labels
for selected artifacts. Treat those links as attribution and review pointers,
not as endorsement by the upstream projects.

## Model disclosure

The UI displays both the backend-reported model target and the actual selection
source returned by the backend. In the current public deployment, if the backend
reports `selection_source: deterministic_fallback`, that is the actual
selection mode even when the model target field names an intended provider or
calibration target.

## Fixes and gates before public publishing

Fixed in this repo:

- Production listener defaults to `127.0.0.1`; Replit explicitly opts into
  `HOST=0.0.0.0`.
- Express framework header is disabled.
- CSP includes `object-src 'none'`, `base-uri 'self'`, and `form-action 'self'`.
- Feedback metadata is bounded before any upstream proxy attempt.
- Tests cover production headers, private metrics default, and feedback metadata
  rejection.
- Private BFF analytics JSONL supports one-command operator reports via
  `npm run report:analytics -- --since 24h`.

Required operational gates:

- Keep Caddy/Nginx as the public edge; do not expose raw port `5000`.
- Keep provider keys out of browser-visible variables.
- Configure edge/backend quotas for production traffic; the BFF limiter is
  per-instance defense-in-depth.
- Verify cockpit/backend retention for public prompt and feedback tables before
  making legal/commercial retention claims.
