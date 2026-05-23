import express, { type Request } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 8787);
const apiBase = (process.env.MATIX_PUBLIC_API_BASE || "").replace(/\/$/, "");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.resolve(root, "dist");

// Optional OpenRouter rerank. When OPENROUTER_API_KEY is set, the BFF passes
// the cockpit's deterministic candidates through the configured OpenRouter
// model (default: google/gemini-3.5-flash) and attaches a `refinement` field
// to the preview response. Without the key, the BFF behaves as a pure proxy
// (no behaviour change). OpenRouter exposes an OpenAI-compatible chat
// completions endpoint, so we make a plain HTTPS POST -- no SDK needed.
const OPENROUTER_BASE = (
  process.env.OPENROUTER_BASE || "https://openrouter.ai/api/v1"
).replace(/\/$/, "");
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "google/gemini-3.5-flash";
const openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
const openRouterEnabled = openRouterApiKey.length > 0;

interface PlacardArtifactSummary {
  artifact_ref?: string;
  name?: string;
  description?: string;
}
interface PlacardSummary {
  platform?: string;
  skills?: PlacardArtifactSummary[];
  mcps?: PlacardArtifactSummary[];
  tools?: PlacardArtifactSummary[];
}
interface CockpitPreviewShape {
  placards?: PlacardSummary[];
}

interface OpenRouterChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string; code?: number | string };
}

async function refineWithOpenRouter(
  prompt: string,
  cockpit: CockpitPreviewShape,
): Promise<Record<string, unknown> | null> {
  if (!openRouterEnabled) return null;
  const candidates = (cockpit.placards ?? []).map((p) => ({
    platform: p.platform,
    skills: (p.skills ?? []).map((a) => ({
      ref: a.artifact_ref,
      name: a.name,
      description: a.description,
    })),
    mcps: (p.mcps ?? []).map((a) => ({
      ref: a.artifact_ref,
      name: a.name,
      description: a.description,
    })),
    tools: (p.tools ?? []).map((a) => ({
      ref: a.artifact_ref,
      name: a.name,
      description: a.description,
    })),
  }));
  const reviewPrompt = `You are reviewing agent-builder recommendations.

User goal: "${prompt}"

Deterministic recommender produced these candidates:
${JSON.stringify(candidates, null, 2)}

As a senior practitioner, decide which artifacts genuinely fit the user's goal and which are generic/off-topic. Return strict JSON only (no markdown, no preamble, no trailing text) with this shape:
{
  "fit": "good" | "partial" | "poor",
  "summary": "one or two sentences explaining overall fit",
  "top_refs": [up to 5 most-relevant artifact_ref strings, ordered],
  "drop_refs": [{"ref": "...", "reason": "..."}],
  "missing_capabilities": [short capability strings the bundle is missing]
}`;
  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        // Optional attribution headers; OpenRouter uses these for analytics
        // and for ranking on its public app leaderboard.
        "HTTP-Referer":
          "https://github.com/Nakul-Kumar/matix-agent-builder-public",
        "X-Title": "Matix Agent Builder",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: "user", content: reviewPrompt }],
        response_format: { type: "json_object" },
      }),
    });
    const data = (await response.json()) as OpenRouterChatResponse;
    if (!response.ok) {
      const errMsg = data.error?.message || `HTTP ${response.status}`;
      console.warn(`[openrouter rerank] ${errMsg}`);
      return null;
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return { provider: "openrouter", model: OPENROUTER_MODEL, ...parsed };
  } catch (err) {
    console.warn(
      "[openrouter rerank] refinement failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
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
  // Use req.ip rather than the raw X-Forwarded-For. With `trust proxy` set,
  // req.ip is the client IP attested by the trusted proxy; the leftmost XFF
  // entry is client-supplied and trivially spoofable to rotate rate buckets.
  const ip = req.ip || "unknown";
  return `${ip}:${req.method}:${publicPath}`;
}

const AGENT_KEYWORDS = [
  "agent", "assistant", "bot", "automation", "workflow",
  "helper", "tool", "build", "create", "make", "design",
  "generate", "ai", "llm", "chatbot", "copilot",
];

const PROMPT_VALIDATED_PATHS = new Set([
  "/agent-builder/preview",
  "/agent-builder/export",
]);

function validatePromptInput(value: unknown): string | null {
  if (typeof value !== "string") return "Prompt must be a string.";
  const trimmed = value.trim();
  if (trimmed.length < 12) {
    return "Prompt is too short. Describe the agent in at least 12 characters.";
  }
  const lower = trimmed.toLowerCase();
  if (!AGENT_KEYWORDS.some((w) => lower.includes(w))) {
    return "Prompt does not look like an agent description. Include words like 'agent', 'assistant', 'automation', or 'build/create'.";
  }
  return null;
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
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "script-src 'self'",
      "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
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
  const publicPath = req.originalUrl.replace(/^\/api\/public/, "").split("?")[0] || "/";
  if (!allowedPublicRoutes.has(publicPath)) {
    res.status(404).json({ error: "public_route_not_available" });
    return;
  }
  if (req.method === "POST" && PROMPT_VALIDATED_PATHS.has(publicPath)) {
    const promptError = validatePromptInput((req.body as { prompt?: unknown })?.prompt);
    if (promptError) {
      res.status(422).json({ error: "invalid_prompt", detail: promptError });
      return;
    }
  }
  if (!apiBase) {
    res.status(503).json({
      error: "public_api_not_configured",
      detail: "Set MATIX_PUBLIC_API_BASE to the deployed /api/public backend.",
    });
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
    let outText = text;
    // Optionally refine the /agent-builder/preview response via OpenRouter.
    const contentType = response.headers.get("content-type") || "application/json";
    if (
      openRouterEnabled &&
      response.ok &&
      req.method === "POST" &&
      publicPath === "/agent-builder/preview" &&
      contentType.includes("application/json")
    ) {
      try {
        const cockpitJson = JSON.parse(text) as CockpitPreviewShape & Record<string, unknown>;
        const promptInput = (req.body as { prompt?: unknown })?.prompt;
        if (typeof promptInput === "string") {
          const refinement = await refineWithOpenRouter(promptInput, cockpitJson);
          if (refinement) {
            cockpitJson.refinement = refinement;
            outText = JSON.stringify(cockpitJson);
          }
        }
      } catch {
        // Non-JSON or unexpected shape; fall through with the original body.
      }
    }
    res.status(response.status);
    res.setHeader("Cache-Control", response.headers.get("cache-control") || "no-store");
    res.type(contentType);
    res.send(outText);
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
