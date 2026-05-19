# Matix Agent Builder Public

Public-safe Agent Builder demo and export site for showing how one prompt can become three agent runtime blueprints: Codex, Claude Code, and OpenClaw.

This repo is intentionally separate from the authenticated cockpit. The public site is allowed to preview and export safe example files; it is not allowed to register agents, launch runtimes, read private cockpit rows, or hold provider credentials in browser code.

## What It Does

- Accepts a public prompt.
- Calls same-origin `/api/public/*` endpoints only.
- Renders backend-approved placards for Codex, Claude Code, and OpenClaw.
- Shows skills, MCPs, tools, source links, scores, warnings, and generated file trees.
- Exports a safe JSON bundle with example files and placeholder env names.
- Collects bottom-of-page feedback without invoking an LLM.

## Security Boundary

- Browser calls only same-origin `/api/public/*`.
- Browser never calls Gemini, OpenAI, Anthropic, Postgres, MCP servers, or private cockpit `/api/backend/*`.
- No provider API keys are allowed in browser code.
- Do not create `VITE_GEMINI_API_KEY`, `VITE_OPENAI_API_KEY`, or `VITE_ANTHROPIC_API_KEY`.
- The public server proxies only an allowlisted set of public endpoints.
- Exports are examples only and must never include real `.env`, auth files, JWTs, database URLs, MCP credentials, or launch roots.

## Replit Setup

Use a separate Replit project for this repo. Keep it separate from the authenticated cockpit project.

Run:

```bash
npm install
npm run dev
```

Set `MATIX_PUBLIC_API_BASE` in Replit Secrets or environment to the deployed public API base:

```text
https://your-cockpit-domain.example/api/v1/public
```

For the current Matix cockpit VPS test backend, use:

```text
https://cockpit.76.13.118.9.sslip.io/api/v1/public
```

`MATIX_PUBLIC_API_BASE` is not a model-provider secret. Still, do not put Gemini/OpenAI/Anthropic keys in this repo or in `VITE_*` variables.

## Local Commands

```bash
npm run typecheck
npm run build
npm run scan:secrets
```

## Documentation

- [API.md](./API.md) explains the public API contract.
- [SECURITY.md](./SECURITY.md) explains the public prompt-box security model.
- [FILE_INDEX.md](./FILE_INDEX.md) indexes every tracked file and folder.
