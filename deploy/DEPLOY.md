# Self-hosting on an Ubuntu VPS (systemd + Caddy)

This guide deploys the Matix Agent Builder public preview to an Ubuntu VPS,
served at `matixagents.com` and `www.matixagents.com` with automatic HTTPS.

The app is a Node/Express server that serves the Vite build and proxies only
the allowlisted `/api/public/*` routes to the cockpit backend. By default the
Node server binds to `127.0.0.1`; Caddy is the public edge and reverse proxies
to `127.0.0.1:5000`.

## 0. Prerequisites

- Ubuntu 20.04, 22.04, or 24.04 with `sudo` access and a public IP.
- DNS for `matixagents.com` pointing at the VPS.
- A cockpit public backend URL for `MATIX_PUBLIC_API_BASE`.
- Node.js 20+.

## 1. Install Node.js, Caddy, and Git

```bash
sudo apt update && sudo apt upgrade -y

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs caddy git

node -v
which npm
caddy version
```

## 2. Create a service user and fetch the code

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin matix
sudo mkdir -p /opt/matix-agent-builder
sudo chown matix:matix /opt/matix-agent-builder

sudo -u matix git clone https://github.com/Nakul-Kumar/matix-agent-builder.git /opt/matix-agent-builder
cd /opt/matix-agent-builder
```

## 3. Install dependencies and build

```bash
sudo -u matix npm ci
sudo -u matix npm run build
```

## 4. Create the environment file

Do not commit this file. It contains deployment-specific configuration.

```bash
sudo tee /etc/matix-agent-builder.env >/dev/null <<'EOF'
MATIX_PUBLIC_API_BASE=https://your-cockpit-domain.example/api/v1/public
PUBLIC_APP_ENV=production

# Optional: enables /api/metrics in production when callers send the token.
# METRICS_TOKEN=choose-a-long-random-string

# Optional: enables Gemini refinement in the BFF. Add the Gemini API key here
# only when you intentionally enable that path.
# GEMINI_MODEL=gemini-3.5-flash
EOF

sudo chmod 600 /etc/matix-agent-builder.env
sudo chown matix:matix /etc/matix-agent-builder.env
```

`NODE_ENV=production`, `HOST=127.0.0.1`, and `PORT=5000` are set by the
systemd unit in this repo. The unit also sets the private analytics log path to
`/var/lib/matix-agent-builder/analytics.jsonl`.

## 5. Install and start the systemd service

```bash
sudo cp /opt/matix-agent-builder/deploy/matix-agent-builder.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now matix-agent-builder

systemctl status matix-agent-builder --no-pager
curl -s http://127.0.0.1:5000/api/health
```

Expected health shape:

```json
{"ok":true,"app":"matix-agent-builder","env":"production","upstream_configured":true}
```

If `ExecStart` fails, run `which npm`, update the path in
`deploy/matix-agent-builder.service`, then run:

```bash
sudo systemctl daemon-reload
sudo systemctl restart matix-agent-builder
```

## 6. Configure Caddy

Edit `deploy/Caddyfile` and replace the global email address with an address
you control. Then install, validate, and reload:

```bash
sudo cp /opt/matix-agent-builder/deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy --no-pager | tail -60
```

Caddy handles HTTPS issuance, HTTP-to-HTTPS redirects, and certificate renewal.
If you need a legacy Nginx deploy instead, the older config remains in
`deploy/nginx-matixagents.conf`, but the recommended path is Caddy.

## 7. Point DNS at the VPS

In Hostinger hPanel, set:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | `<your-vps-public-ip>` | default |
| CNAME | `www` | `matixagents.com` | default |

Delete conflicting `www` A/CNAME records before waiting for propagation.

```bash
dig +short matixagents.com
dig +short www.matixagents.com
```

## 8. Verify the live site

```bash
curl -sS -I https://matixagents.com/
curl -sS https://matixagents.com/api/health
curl -sS http://127.0.0.1:5000/api/health
sudo ss -ltnp | grep ':5000'
```

The app listener should be `127.0.0.1:5000`, not a public `0.0.0.0:5000`
socket. Public traffic should enter through ports 80/443 only.

## Updating after code changes

```bash
cd /opt/matix-agent-builder
sudo -u matix git pull --ff-only origin main
sudo -u matix npm ci
sudo -u matix npm run build
sudo systemctl restart matix-agent-builder
curl -sS https://matixagents.com/api/health
```

## Useful commands

```bash
sudo systemctl status matix-agent-builder
sudo journalctl -u matix-agent-builder -f
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo journalctl -u caddy -f
npm run report:analytics -- --since 24h
```
