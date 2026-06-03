---
name: Domain & DNS
description: Custom domain and registrar facts for the Matix Agent Builder public deployment.
---

- Primary custom domain: **matixagents.com** (user wants **www.matixagents.com** linked; recommend linking apex too).
- Registrar / DNS host: **Hostinger** (manage DNS in hPanel - Domains - DNS / Nameservers - DNS Zone editor).
- Production deployment: Replit Autoscale, live at https://matix-agent-builder-public.replit.app (public).

**How to apply:** Custom domains are added in Replit Deployments - Settings - Custom domains, which then emits the A/TXT (apex) or CNAME/TXT (www) records to enter in Hostinger's DNS zone. Main agent cannot add domains or edit DNS programmatically; the user does this in the Replit UI + Hostinger dashboard.
