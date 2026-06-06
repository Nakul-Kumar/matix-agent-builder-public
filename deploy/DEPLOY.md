# Self-hosting on an Ubuntu VPS (systemd + Nginx + Let's Encrypt)

This guide deploys the Matix Agent Builder public preview to your own Ubuntu
server, served at **www.matixagents.com** with HTTPS.

The app is a Node/Express server that serves a static Vite build and proxies
`/api/public/*` to your cockpit backend. It listens on `PORT` (default 5000);
Nginx sits in front and terminates TLS.

---

## 0. Prerequisites

- An Ubuntu VPS (20.04 / 22.04 / 24.04) with `sudo` access and a public IP.
- DNS for `matixagents.com` managed at **Hostinger** (see step 7).
- The cockpit backend URL you want the app to call (`MATIX_PUBLIC_API_BASE`).

The current DNS records point `matixagents.com` at `<your-vps-public-ip>` and alias
`www.matixagents.com` to the apex domain. Adjust paths/usernames as needed
below.

---

## 1. Install Node.js 20, Nginx, Certbot

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Nginx + Certbot
sudo apt install -y nginx certbot python3-certbot-nginx git

node -v   # expect v20.x
which npm  # note this path; the systemd unit assumes /usr/bin/npm
```

---

## 2. Create a service user and fetch the code

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin matix
sudo mkdir -p /opt/matix-agent-builder
sudo chown matix:matix /opt/matix-agent-builder

# Clone the repo (or copy your files) into /opt/matix-agent-builder
sudo -u matix git clone https://github.com/Nakul-Kumar/matix-agent-builder-public.git /opt/matix-agent-builder
cd /opt/matix-agent-builder
```

---

## 3. Install dependencies and build

```bash
sudo -u matix npm ci
sudo -u matix npm run build   # produces dist/ (the static frontend)
```

---

## 4. Create the environment file (NOT committed to git)

```bash
sudo tee /etc/matix-agent-builder.env >/dev/null <<'EOF'
# Required: your cockpit's public BFF target
MATIX_PUBLIC_API_BASE=https://your-cockpit-domain.example/api/v1/public

# Optional
PUBLIC_APP_ENV=production
# Optional Gemini API key goes here if you enable refinement.
# GEMINI_MODEL=gemini-3.5-flash
# METRICS_TOKEN=choose-a-long-random-string   # enables /api/metrics in prod
EOF

sudo chmod 600 /etc/matix-agent-builder.env
sudo chown matix:matix /etc/matix-agent-builder.env
```

> `NODE_ENV=production` and `PORT=5000` are set by the systemd unit, so they are
> not needed here. `NODE_ENV=production` is what turns on the HSTS header.

---

## 5. Install and start the systemd service

```bash
sudo cp /opt/matix-agent-builder/deploy/matix-agent-builder.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now matix-agent-builder

systemctl status matix-agent-builder --no-pager
curl -s http://127.0.0.1:5000/api/health   # expect {"ok":true,...}
```

If `ExecStart` fails, run `which npm` and update the path in the unit file, then
`sudo systemctl daemon-reload && sudo systemctl restart matix-agent-builder`.

---

## 6. Configure Nginx

```bash
sudo cp /opt/matix-agent-builder/deploy/nginx-matixagents.conf /etc/nginx/sites-available/matixagents
sudo ln -s /etc/nginx/sites-available/matixagents /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # optional: drop the default site
sudo nginx -t && sudo systemctl reload nginx
```

---

## 7. Point DNS at the VPS (Hostinger)

In **hPanel -> Domains -> matixagents.com -> DNS / Nameservers -> DNS Zone editor**:

| Type  | Name  | Value             | TTL     |
|-------|-------|-------------------|---------|
| A     | `@`   | `<your-vps-public-ip>`     | default |
| CNAME | `www` | `matixagents.com` | default |

Delete any pre-existing `www` CNAME/A record Hostinger created, or it will
conflict. Wait for propagation (usually 15-60 min). Check with:

```bash
dig +short www.matixagents.com
```

---

## 8. Enable HTTPS with Let's Encrypt

Only run this AFTER DNS resolves to your VPS:

```bash
sudo certbot --nginx -d www.matixagents.com -d matixagents.com
```

Certbot adds the 443 server block, installs the certificate, and sets up the
HTTP->HTTPS redirect. Auto-renewal is installed automatically; verify with:

```bash
sudo certbot renew --dry-run
```

Visit **https://www.matixagents.com** - you are live.

---

## Updating after code changes

```bash
cd /opt/matix-agent-builder
sudo -u matix git pull
sudo -u matix npm ci
sudo -u matix npm run build
sudo systemctl restart matix-agent-builder
```

## Useful commands

```bash
sudo systemctl status matix-agent-builder
sudo journalctl -u matix-agent-builder -f   # live app logs
sudo nginx -t && sudo systemctl reload nginx
```
