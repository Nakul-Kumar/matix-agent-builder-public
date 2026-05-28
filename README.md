# Matix Agent Builder Public

Public-safe Agent Builder demo and export site for showing how one prompt can
become three agent runtime blueprints: Codex, Claude Code, and OpenClaw.

This repository is an Apache-2.0 public preview. It is intentionally separate
from the authenticated cockpit. The public site is allowed to preview and
export safe example files; it is not allowed to register agents, launch
runtimes, read private cockpit rows, or hold provider credentials in browser
code.

## Project Goal

Matix is exploring a narrow control problem: before teams let AI agents touch
repositories, credentials, budgets, or production workflows, they need a
reviewable layer that can describe what an agent will do, which runtime it
fits, what tools it needs, what risks are visible, and which parts still need
human approval.

This repo is the inspectable public edge of that thesis. It takes a plain
English agent request, renders backend-approved runtime blueprints, and exports
example bundles with placeholder configuration. The startup angle is not
"agents that run everything." It is trust before execution: make the plan,
sources, warnings, and setup surface visible before any private runtime is
allowed to act.

Important scope: this repo is a render-only UI/BFF plus MCP shim.
Recommendation logic, source search, scoring metadata, license metadata,
credential status, model routing, and export content are served by the public
backend unless you implement your own compatible API.

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

## What Lives Outside This Repo

The public repo does not contain the private cockpit, registry database,
protected recommendation pipeline, source crawlers, agent launch system, or
credential store. Those systems are deliberately kept behind a public API
contract. This separation is the point: the browser can inspect and export
public-safe examples, while private runtime and credential decisions stay
server-side.

For reviewers: judge this repository as a public product surface, API contract,
security boundary, and packaging layer. Do not read it as proof that the full
Matix platform is open sourced or production complete.

## Research Angle

This preview is a small experiment in agent governance UX:

- Can a user understand why a runtime was recommended before accepting it?
- Can source links, license notes, credential status, and warnings be shown in
  the same flow as the generated files?
- Can public export bundles stay useful while never including real secrets,
  launch roots, auth files, or private cockpit rows?
- Can the browser remain a safe display surface while model/provider work stays
  behind a same-origin BFF?

The current implementation is intentionally conservative. It favors explicit
metadata, placeholder configuration, route allowlists, and release scans over
fully automated agent launch.

## Honest Limitations

- This repo does not launch, register, schedule, or operate agents.
- Exported bundles are examples, not secure-by-default deployment packages.
- Recommendation quality depends on the backend configured through
  `MATIX_PUBLIC_API_BASE`.
- Hosted demo status can change; durable docs should describe the contract, not
  one temporary provider configuration.
- Security scans here are lightweight repo gates, not a formal third-party
  audit.

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
# Terminal 1 — public BFF on port 8787 (restarts on server file changes)
npm run dev

# Terminal 2 — Vite dev server on port 5173 (HMR; proxies /api to the BFF)
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

Set `MATIX_PUBLIC_API_BASE` in your environment to a compatible public API
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
