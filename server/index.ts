import express, { type Request } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 8787);
const apiBase = (process.env.MATIX_PUBLIC_API_BASE || "").replace(/\/$/, "");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.resolve(root, "dist");
// Keep this allowlist small: public visitors should never discover or proxy
// private cockpit routes through this app.
const allowedPublicRoutes = new Set([
  "/registry-summary",
  "/agent-builder/templates",
  "/agent-builder/preview",
  "/agent-builder/export",
  "/agent-builder/feedback",
]);
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 60);
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
let rateLimitSweeps = 0;

function publicRateLimitKey(req: Request, publicPath: string): string {
  const forwardedFor = req.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwardedFor || req.ip || "unknown";
  return `${ip}:${req.method}:${publicPath}`;
}

function checkPublicRateLimit(req: Request, publicPath: string) {
  const now = Date.now();
  rateLimitSweeps += 1;
  if (rateLimitSweeps % 500 === 0) {
    for (const [key, bucket] of rateBuckets.entries()) {
      if (bucket.resetAt <= now) rateBuckets.delete(key);
    }
  }

  const key = publicRateLimitKey(req, publicPath);
  const existing = rateBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { limited: false, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > RATE_LIMIT_MAX) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { limited: false, retryAfterSeconds: 0 };
}

app.use(express.json({ limit: "32kb" }));
app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    app: "matix-agent-builder-public",
    env: process.env.PUBLIC_APP_ENV || "development",
    upstream_configured: Boolean(apiBase),
  });
});

app.use("/api/public", async (req, res) => {
  if (!apiBase) {
    res.status(503).json({
      error: "public_api_not_configured",
      detail: "Set MATIX_PUBLIC_API_BASE to the deployed /api/public backend.",
    });
    return;
  }
  const publicPath = req.originalUrl.replace(/^\/api\/public/, "").split("?")[0] || "/";
  if (!allowedPublicRoutes.has(publicPath)) {
    res.status(404).json({ error: "public_route_not_available" });
    return;
  }
  const rateLimit = checkPublicRateLimit(req, publicPath);
  if (rateLimit.limited) {
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).json({
      error: "rate_limited",
      detail: "Too many public API requests. Please wait and retry.",
    });
    return;
  }
  // Browser code talks to this same-origin route; this server performs the
  // only outbound hop and deliberately forwards no cookies or provider keys.
  const upstream = `${apiBase}${req.originalUrl.replace(/^\/api\/public/, "")}`;
  try {
    const response = await fetch(upstream, {
      method: req.method,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : JSON.stringify(req.body ?? {}),
      redirect: "manual",
    });
    const text = await response.text();
    res.status(response.status);
    res.setHeader("Cache-Control", response.headers.get("cache-control") || "no-store");
    res.type(response.headers.get("content-type") || "application/json");
    res.send(text);
  } catch {
    res.status(502).json({ error: "public_api_unreachable" });
  }
});

app.use(express.static(dist, { index: false }));
app.get("*splat", (_req, res) => {
  res.sendFile("index.html", { root: dist });
});

app.listen(port, () => {
  console.log(`Matix Agent Builder public server listening on ${port}`);
});
