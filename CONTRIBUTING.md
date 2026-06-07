# Contributing

Thanks for helping improve Matix Agent Builder Public. This repo is the
render-only UI/BFF for public previews and safe exports.

## Local Setup

```bash
npm ci

# Terminal 1 - public BFF on port 8787
npm run dev

# Terminal 2 - Vite dev server on port 5173 (HMR; proxies /api to the BFF)
npm run dev:web
```

Set `MATIX_PUBLIC_API_BASE` to a compatible public backend. The frontend and
public server should not implement recommendation scoring, source search, or
model calls.

## Development Rules

- Keep browser calls same-origin through `/api/public/*`.
- Do not add provider keys, connector tokens, database credentials, auth
  files, private launch roots, or real customer data.
- Do not add model-provider calls, marketplace calls, or source-directory calls
  in browser code.
- Keep recommendations, score math, license detection, and credential status in
  the backend contract.
- Update `FILE_INDEX.md`, `API.md`, and release checks when adding public
  files or changing the response shape.

## Checks

Run these before opening a pull request:

```bash
npm run typecheck
npm test
npm run build
npm run scan:secrets
npm run scan:assets
npm run check:release
npm audit --omit=dev
```

Use `npm run smoke:live` only when you intentionally want to test against the
live public backend.

## Pull Requests

Please include:

- What changed.
- Which checks passed.
- Any API fields or backend expectations affected.
- Screenshots for UI changes when practical.

By contributing, you agree that your contribution is submitted under the
Apache-2.0 license used by this repository.
