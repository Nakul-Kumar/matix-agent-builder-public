# Privacy

Matix Agent Builder is a public preview. This document explains what the
public site handles today so users and contributors can review it before
submitting prompts or feedback.

## What We Collect

- The prompt you submit to build an agent preview.
- The generated preview/export metadata returned by the backend.
- Feedback text, rating, export status, and optional email if you provide it.
- Basic request metadata such as timestamp, route, user agent, and network
  address information used for abuse prevention, rate limiting, debugging, and
  service reliability.

The browser does not receive or store provider keys. Browser code calls only
same-origin public routes.

## How Data Is Used

Prompts are sent to the backend to produce recommendation bundles. Feedback is
used to improve recommendation quality, interface clarity, source coverage,
and export setup instructions.

This public server includes an optional refinement step. When the operator
configures `GEMINI_API_KEY`, the server itself sends your prompt and the
backend-built candidate metadata to Google's Gemini API (Google AI Studio) to
refine recommendations and to rewrite the primary instructions file in exported
bundles. In that configuration your prompt is processed by Google under Google's
terms (https://ai.google.dev/terms). When that key is not configured, the server
is a pure proxy and your prompt is not sent to Google. Separately, the backend
may also apply model/provider processing services to the prompt and candidate
metadata.

TODO(human): confirm a Google AI Studio data processing agreement (DPA) is in
place and have counsel review this notice before any commercial launch.

## Retention

Default retention for raw public prompts and feedback is 30 days. Aggregated
quality metrics may be retained longer when they do not directly identify a
specific visitor. Security or abuse records may be retained longer when needed
to protect the service.

## Sharing

We do not sell prompt or feedback data. Data may be processed by infrastructure
providers, model providers (including Google / Google AI Studio when Gemini
refinement is enabled), logging services, or security services when needed to
operate the public preview.

Recommended skills, tools, MCPs, and source links are informational. Visiting
third-party links is governed by those sites' privacy policies.

## Your Choices

- Do not include secrets, credentials, private customer data, or sensitive
  personal data in prompts or feedback.
- The email field is optional. Leave it blank if you do not want a reply.
- For deletion requests, privacy questions, or correction requests, open a
  GitHub issue without posting sensitive details, or use GitHub Security
  Advisories when the request requires private handling.

This document is a public-preview privacy notice, not legal advice. Have
counsel review it before using this repository for a production service.
