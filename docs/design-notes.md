# Design notes — Aesthetic overhaul v2

Reference apps studied before this overhaul. For each, what was borrowed
and what was deliberately not borrowed.

## Vercel v0 (`https://v0.app`)

- **Borrowed**: the discipline of giving the right-hand canvas real visual
  weight even before generation runs. v0 fills its preview with subtle
  scaffold content, not placeholder buttons.
- **Not borrowed**: the dark glass aesthetic. Our palette is warm-paper /
  olive; that's the project's identity.

## Linear marketing (`https://linear.app`)

- **Borrowed**: a single small accent on one hero word as the entire
  ornament budget — no other decoration competes for attention.
- **Borrowed**: spacing rhythm built on a 4px base, applied so strictly
  that you stop noticing the grid and start noticing the content.
- **Not borrowed**: gradient-heavy section dividers. The editorial serif
  voice we already have does the same job more quietly.

## Stripe Press (`https://press.stripe.com`)

- **Borrowed**: a generous serif (Fraunces here, Compagnon there) carries
  the page; sans-serif body sits supporting it; mono used only for code
  and metrics. No fourth typeface.
- **Borrowed**: paper-grain background — barely visible but stops the
  page from feeling like a screen.
- **Not borrowed**: full-bleed editorial imagery. We don't have a photo
  budget and stock photos would weaken the trust message.

## Anthropic Console (`https://console.anthropic.com`)

- **Borrowed**: side-by-side that snaps cleanly between split and
  stacked, with no awkward middle ground.
- **Borrowed**: small per-platform monogram badge — recognizable at a
  glance, doesn't require an official logo file.
- **Not borrowed**: dense settings panels with many sliders. Our product
  is one prompt → three runtime drafts; the UI shouldn't pretend to be
  bigger than that.

## Cursor (`https://cursor.com`)

- **Borrowed**: motion on loading states is a soft shimmer with a
  caption, not a spinner. Spinners say "wait"; shimmer + caption says
  "we're working, here's what you'll get."
- **Not borrowed**: marketing-grade hero animation. Out of scope for an
  inspectable preview tool.

## Translation into tokens

The above produced these concrete additions to `src/styles/tokens.css`:

- A 12-step spacing scale on a 4px base (`--space-1` … `--space-12`).
- A type scale with explicit line-heights (`--text-xs` … `--text-display`).
- A motion scale with shared easing and durations.
- One focus-ring token (`--focus-ring`) used everywhere.
- A paper-grain background variable used on `--bg-page`.
- A single shared "floating" shadow alongside the existing `subtle`
  and `panel` shadows.

Every component now consumes these tokens; no component hardcodes its
own padding number.
