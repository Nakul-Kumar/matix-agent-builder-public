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

When model reranking is enabled, a prompt and backend-built candidate metadata
may be processed by model/provider processing services. The public UI does not
call those services directly; processing is owned by the backend.

## Retention

Default retention for raw public prompts and feedback is 30 days. Aggregated
quality metrics may be retained longer when they do not directly identify a
specific visitor. Security or abuse records may be retained longer when needed
to protect the service.

## Sharing

We do not sell prompt or feedback data. Data may be processed by infrastructure
providers, model providers, logging services, or security services when needed
to operate the public preview.

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
