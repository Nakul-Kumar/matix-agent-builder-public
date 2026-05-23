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
production-grade hosted agent platform. Do not claim Gemini calibration or live
GPT-5.5 reranking unless the live response shows that selection source.

## Clone And Run

```bash
git clone https://github.com/Nakul-Kumar/matix-agent-builder-public.git
cd matix-agent-builder-public
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

The repo's `.replit` workflow already runs `npm run build && tsx server/index.ts`
when you press Run, so the deployed page works out of the box. If you prefer to
run it manually from the Replit shell:

```bash
npm install
npm run build
npm run start
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

## Local Commands

```bash
npm run typecheck
npm run build
npm run scan:copy
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
- `npm run scan:copy` passes.
- `npm run scan:secrets` passes.
- `npm run scan:assets` passes after build.
- `npm run check:release` passes.
- `npm audit --omit=dev` reports no production vulnerabilities.
- Live preview/export smoke passes against the deployed public backend.
- Footer links to Privacy, Terms, Security, and GitHub resolve.

## Documentation

- [API.md](./API.md) explains the public API contract.
- [SECURITY.md](./SECURITY.md) explains the public prompt-box security model.
- [PRIVACY.md](./PRIVACY.md) explains prompt, feedback, retention, and model
  processing handling.
- [TERMS.md](./TERMS.md) explains public-preview disclaimers and user
  responsibilities.
- [CONTRIBUTING.md](./CONTRIBUTING.md) explains contribution checks.
- [FILE_INDEX.md](./FILE_INDEX.md) indexes every tracked file and folder.
- [LICENSE](./LICENSE) is Apache-2.0.
