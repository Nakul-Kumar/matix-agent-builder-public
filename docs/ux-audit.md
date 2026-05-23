# UX audit — May 2026

Walked the public preview as a first-time visitor on the running app at
`http://localhost:5000/`. One screenshot + note per state.

## States observed

| State | Trigger | Felt-off |
|---|---|---|
| Empty home | Page load with backend ready | Right "Preview canvas" panel shows four pill labels (`Prompt` / `Preview` / `Inspect` / `Download JSON`) that look interactive. First-time users try to click them. |
| Typing | Focus textarea, type chars | Char counter `0/1000` is fine; the `Cmd/Ctrl + Enter` hint is a sibling of the disabled CTA but visually competes with it. |
| Empty hint | Focus textarea then blur with no text | "Write a sentence about the agent you want." is readable but the typographic style is identical to the trustNote, so the call-to-action quality is lost. |
| Validation rejection | Submit "make me a sandwich" | Rejection card uses warm cream (`#fff8f4`) but the badge contrast is weak (`rgba(163,59,47,0.28)` border on the same cream). |
| Loading | Click Preview agent with a valid prompt | Three plain gray bars stack with no motion. No caption telling the user what's happening. |
| Success | Preview returns 3 placards | Layout works. Runtime tabs lack a platform mark, so they read as identical generic buttons until you read the names. |
| Inspect | Click "View JSON" inside a runtime tab | Opens a JSON blob in a new tab — works, but no in-product hint that the JSON is also downloadable. |
| Download example JSON | Click "Download example JSON" | Browser saves `matix-agent-codex.example.json`. Works; no visible confirmation in the UI after save. |
| Feedback submit | Type feedback, click Send | Form posts and swaps to "Thanks. We got your note." — clean. |
| Backend unreachable | Health check failure | Banner shows but the topbar status pill also flips to warn — slight redundancy, not a regression. |
| Backend not configured | `MATIX_PUBLIC_API_BASE` empty | Same as above; copy is helpful. |

## Verdict

The bones are right. The two highest-impact fixes are (1) replacing the
fake-pill empty state with content that looks like content, and (2) lifting
the runtime tabs from generic buttons to recognizable per-platform cards.
Everything else is polish: focus rings, vertical rhythm, motion on the
loading state, and one ornament that signals craft on the hero.

## Lighthouse

Lighthouse CLI is not installed in the workspace and the
`@lhci/cli`-style audits require a headless Chromium. Skipped programmatic
score. Manual review against [WCAG 2.1 AA color-contrast](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
checks pass for all text on `--bg-page` / `--bg-surface` after the token
refinement in this task; runtime tabs were already keyboard-navigable
(Task #13 may still want explicit treatment for the per-tab export controls).
