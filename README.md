# Matix Agent Builder Public

Public-safe Agent Builder demo and export site for showing how one prompt can
become three agent runtime blueprints: Codex, Claude Code, and OpenClaw.

This repository is an Apache-2.0 public preview. It is intentionally separate
from the authenticated cockpit. The public site is allowed to preview and
export safe example files; it is not allowed to register agents, launch
runtimes, read private cockpit rows, or hold provider credentials in browser
code.

Important scope: this repo is a render-only UI/BFF. Recommendation logic,
source search, scoring, license metadata, credential status, model routing, and
exports are served by the public backend unless you implement your own
compatible API.

## What It Does

- Accepts a public prompt.
- Calls same-origin `/api/public/*` endpoints only.
- Renders backend-approved placards for Codex, Claude Code, and OpenClaw.
- Shows skills, MCPs, tools, source links, scores, license labels, warnings,
  setup hints, and generated file trees.
- Exports a safe JSON bundle with example files and placeholder env names.
- Collects bottom-of-page feedback without invoking a model from the browser.

Current public wording should stay precise: this is a public preview, not a
production-grade hosted agent platform. The result screen shows both the
backend-reported model target and the actual selection source. If the backend
returns `selection_source: deterministic_fallback`, that is the actual serving
mode for that prompt even when a model target is shown.

## Clone And Run

```bash
git clone https://github.com/Nakul-Kumar/matix-agent-builder.git
cd matix-agent-builder
npm ci
```

Local development uses two processes: the public BFF (Express) and the Vite
dev server with HMR. Vite proxies `/api` to the BFF as configured in
`vite.config.ts`.

```bash
# Terminal 1 - public BFF on port 8787 (restarts on server file changes)
npm run dev

# Terminal 2 - Vite dev server on port 5173 (HMR; proxies /api to the BFF)
npm run dev:web

# Open http://localhost:5173
```

For a single-process production-like check, build once and serve the bundle
from the BFF:

```bash
npm run build
npm run start
# Open http://localhost:8787
```

Set `MATIX_PUBLIC_API_BASE` in your environment to the deployed public API
base:

```text
https://your-cockpit-domain.example/api/v1/public
```

For a compatible backend, the public server expects routes documented in
`API.md`. If you are self-hosting only this repository, you must provide that
backend contract yourself.

## Replit Setup

Use a separate Replit project for this repo. Keep it separate from the
authenticated cockpit project.

The repo's `.replit` workflow already sets `HOST=0.0.0.0` and `PORT=5000`
when you press Run, so the deployed page works out of the box. If you prefer
to run it manually from the Replit shell:

```bash
npm install
npm run build
HOST=0.0.0.0 PORT=5000 npm run start
```

Set `MATIX_PUBLIC_API_BASE` in Replit Secrets or environment. This value is a
public backend base URL, not a model-provider secret. Do not put provider keys
in this repo or in browser-exposed variables.

## Security Boundary

- Browser calls only same-origin `/api/public/*`.
- Browser never calls Gemini, OpenAI, Anthropic, Postgres, MCP servers, or
  private cockpit routes.
- No provider API keys are allowed in browser code.
- The public server proxies only an allowlisted set of public endpoints.
- Exports are examples only and must never include real env files, auth files,
  JWTs, database URLs, MCP credentials, or launch roots.
- The public server applies lightweight rate limiting to the public API proxy.
- The production server defaults to `HOST=127.0.0.1`; put Caddy/Nginx in front
  and do not expose raw port `5000`.
- Production responses disable Express framework disclosure and include CSP,
  HSTS, frame, MIME, referrer, and permissions-policy headers.

## Data, Models, And Limits

- Browser storage: no intentional local storage, session storage, IndexedDB, or
  cookies.
- BFF storage: only in-memory rate-limit buckets and request metrics.
- Upstream storage: the compatible backend may store public prompt hashes, raw
  prompts, recommendation events/items, feedback, and optional contact email.
- Prompt/body limits: the BFF accepts JSON bodies up to `32kb`; preview/export
  prompts must pass local agent-request validation.
- Feedback metadata limit: at most 10 primitive metadata keys, 64-character
  keys, and 256-character stringified values.
- Rate limits: the in-app limiter defaults to 60 requests per 60 seconds per
  route/method/client key. Production should also use edge/backend quotas.
- Model disclosure: the UI displays the backend model target, backend model
  status, actual selection source, and fallback reason when present.

See [docs/data-inventory.md](./docs/data-inventory.md) for the database/source
breakdown and the data-engineering gates.

## Credits And Source Attribution

Matix Agent Builder recommends and exports metadata about public skills, MCP
servers, tools, and templates. The original creators keep their licenses and
copyrights; Matix surfaces links, summaries, and example wiring so users can
review the source before use.

Public sources currently credited or surfaced by the compatible backend include:

- [skills.sh](https://www.skills.sh/)
- [LLMBase skills](https://llmbase.ai/skills/)
- [PulseMCP](https://www.pulsemcp.com/servers)
- [MCP Market](https://mcpmarket.com/)
- [mcpservers.org](https://mcpservers.org/)
- [Agent Skills](https://agentskills.io/)
- [GitHub MCP Server](https://github.com/github/github-mcp-server)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Context7](https://github.com/upstash/context7)

Selected artifacts should keep their `source_links` and license labels in the
preview and export bundle. These links are attribution and review pointers, not
endorsements by the upstream projects.

## License Status

This repository's own code and documentation are licensed under Apache-2.0 via
[LICENSE](./LICENSE). Upstream skills, MCP servers, tools, templates, and docs
linked from recommendations keep their own licenses; verify those licenses
before copying, redistributing, or deploying generated bundles.

## Local Commands

```bash
npm run typecheck
npm test
npm run build
npm run scan:secrets
npm run scan:assets
npm run check:release
npm audit --omit=dev
```

Optional live backend smoke:

```bash
npm run smoke:live
```

## Public Release Checklist

- `npm run build` passes.
- `npm test` passes.
- `npm run scan:secrets` passes.
- `npm run scan:assets` passes after build.
- `npm run check:release` passes.
- `npm audit --omit=dev` reports no production vulnerabilities.
- Live preview/export smoke passes against the deployed public backend.
- Footer links to Privacy, Terms, Security, and GitHub resolve.
- Apache-2.0 applies to this repo only; selected upstream artifacts keep their
  own licenses and source links.
- Edge/backend quotas and retention jobs are configured for the upstream public
  backend before any production/commercial claim.

## Documentation

- [API.md](./API.md) explains the public API contract.
- [SECURITY.md](./SECURITY.md) explains the public prompt-box security model.
- [PRIVACY.md](./PRIVACY.md) explains prompt, feedback, retention, and model
  processing handling.
- [docs/data-inventory.md](./docs/data-inventory.md) lists browser/BFF/backend
  data stores, source directories, and data-engineering gates.
- [TERMS.md](./TERMS.md) explains public-preview disclaimers and user
  responsibilities.
- [CONTRIBUTING.md](./CONTRIBUTING.md) explains contribution checks.
- [FILE_INDEX.md](./FILE_INDEX.md) indexes every tracked file and folder.
- [deploy/DEPLOY.md](./deploy/DEPLOY.md) is a self-hosting guide (Ubuntu +
  systemd + Caddy); the systemd unit, Caddyfile, and legacy Nginx config live
  in `deploy/`.
- [docs/](./docs/) holds design notes and the UX audit.
- [LICENSE](./LICENSE) is Apache-2.0.
