import express, { type Request } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = Number(process.env.PORT || 8787);
const apiBase = (process.env.MATIX_PUBLIC_API_BASE || "").replace(/\/$/, "");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.resolve(root, "dist");

// Optional Gemini rerank via the official Google Gen AI SDK (Google AI Studio).
// When GEMINI_API_KEY is set, the BFF passes the cockpit's deterministic
// candidates through Gemini and attaches a `refinement` field to the preview
// response. Without the key, the BFF behaves as a pure proxy. Errors fall
// through silently with a `[gemini rerank]` warning on stderr; the client
// always gets a valid response.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const geminiApiKey = process.env.GEMINI_API_KEY || "";
const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

interface PlacardArtifactSummary {
  artifact_ref?: string;
  artifact_kind?: string;
  name?: string;
  description?: string;
  license?: { source?: string; url?: string | null };
  source_links?: Array<{ url?: string }>;
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

interface ExportArtifact {
  artifact_ref?: string;
  artifact_kind?: string;
  name?: string;
  description?: string;
}
interface ExportManifest {
  platform?: string;
  selected_artifacts?: ExportArtifact[];
  file_manifest?: {
    instructions?: string;
    mcp_config?: string;
    skills_root?: string;
  };
  [k: string]: unknown;
}
interface ExportShape {
  ok?: boolean;
  files?: Record<string, string>;
  manifest?: ExportManifest;
}

// Runtime built-in tool docs URLs per platform. The cockpit hardcodes the
// OpenAI URL for every platform; on Claude Code and OpenClaw exports/previews
// that's the wrong source (clicking "Runtime built-in" license should land
// you on the actual platform's tool docs, not OpenAI's). The BFF rewrites
// these on the way through.
const OPENAI_RUNTIME_URL = "https://developers.openai.com/api/docs/guides/tools";
const RUNTIME_DOCS_BY_PLATFORM: Record<string, string> = {
  codex: OPENAI_RUNTIME_URL,
  claude_code: "https://code.claude.com/docs/en/tools-reference",
  openclaw: "https://documentation.openclaw.ai/clawhub/http-api",
};

interface ArtifactWithLinks {
  artifact_kind?: string;
  license?: { source?: string; url?: string | null };
  source_links?: Array<{ url?: string }>;
}

function rewriteRuntimeLinksForPlatform(
  artifact: ArtifactWithLinks,
  platform: string | undefined,
): boolean {
  if (!platform) return false;
  const targetUrl = RUNTIME_DOCS_BY_PLATFORM[platform];
  if (!targetUrl || targetUrl === OPENAI_RUNTIME_URL) return false;
  let changed = false;
  if (
    artifact.license?.source === "runtime" &&
    artifact.license.url === OPENAI_RUNTIME_URL
  ) {
    artifact.license.url = targetUrl;
    changed = true;
  }
  for (const link of artifact.source_links ?? []) {
    if (link.url === OPENAI_RUNTIME_URL) {
      link.url = targetUrl;
      changed = true;
    }
  }
  return changed;
}

async function refineWithGemini(
  prompt: string,
  cockpit: CockpitPreviewShape,
): Promise<Record<string, unknown> | null> {
  if (!gemini) return null;
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
    const result = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: reviewPrompt,
      config: { responseMimeType: "application/json" },
    });
    const text = result.text;
    if (!text) return null;
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return { provider: "google", model: GEMINI_MODEL, ...parsed };
  } catch (err) {
    console.warn(
      "[gemini rerank] refinement failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

// Rewrite the export bundle's primary instructions file (the one
// `manifest.file_manifest.instructions` points to -- AGENTS.md / CLAUDE.md /
// equivalent) so the downstream runtime reads a Gemini-authored brief that
// reflects the user's actual prompt and honestly flags capability gaps.
// Returns null on any failure; caller keeps the cockpit's original file.
async function rewriteInstructionsWithGemini(
  prompt: string,
  platform: string | undefined,
  currentInstructions: string,
  selectedArtifacts: ExportArtifact[],
): Promise<string | null> {
  if (!gemini) return null;
  const renderList = (kind: string): string => {
    const items = selectedArtifacts
      .filter((a) => a.artifact_kind === kind)
      .map((a) => `- ${a.name ?? a.artifact_ref ?? "(unnamed)"}: ${a.description ?? "(no description)"}`);
    return items.length > 0 ? items.join("\n") : "(none)";
  };
  const skills = renderList("skill");
  const mcps = renderList("mcp_server");
  const tools = renderList("native_tool");

  const rewritePrompt = `You are rewriting the primary instructions file that the ${platform ?? "agent"} runtime will read to build an AI agent from this bundle. Your output must be valid markdown only and will REPLACE the current file's content directly. Do not include code fences around the whole output, no preamble, no surrounding commentary.

USER'S STATED GOAL:
"${prompt}"

WHAT THIS BUNDLE PROVIDES (do not invent items not listed; do not remove items that ARE listed):

Skills:
${skills}

MCP servers:
${mcps}

Native tools:
${tools}

CURRENT INSTRUCTIONS FILE (preserve any platform-specific commands, file paths, or runtime hints present here):
---
${currentInstructions}
---

REWRITE TASK:
1. Open with a clear, plain-English statement of what the user actually asked for, paraphrasing their goal honestly.
2. Describe the agent's responsibilities as instructions the runtime should follow.
3. List the available skills, MCP servers, and native tools using the names above; do not invent any.
4. Explicitly call out any obvious capability gap between the user's goal and what the bundle provides, so the downstream runtime knows where to ask the user or request additional artifacts. Be honest -- if the user asked for Linear integration and there's no Linear MCP, say so.
5. Preserve any platform-specific commands, paths, or runtime-readiness notes from the current file (e.g. setup commands, eval pointers, codex login).
6. Use clear markdown headings. Keep it under ~800 words.

Return only the rewritten markdown.`;

  try {
    const result = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: rewritePrompt,
    });
    const text = result.text;
    if (!text) return null;
    // Strip accidental code fences wrapping the entire output.
    return text
      .replace(/^```(?:markdown|md)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
  } catch (err) {
    console.warn(
      "[gemini rewrite] instructions rewrite failed:",
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
      response.ok &&
      req.method === "POST" &&
      publicPath === "/agent-builder/preview" &&
      contentType.includes("application/json")
    ) {
      try {
        const cockpitJson = JSON.parse(text) as CockpitPreviewShape & Record<string, unknown>;
        let mutated = false;
        // Always: rewrite runtime built-in license/source URLs per placard
        // platform (the cockpit hardcodes OpenAI's docs for every platform;
        // Claude Code and OpenClaw placards need their own URLs).
        for (const placard of cockpitJson.placards ?? []) {
          const ps = placard.platform;
          const items: ArtifactWithLinks[] = [
            ...(placard.skills ?? []),
            ...(placard.mcps ?? []),
            ...(placard.tools ?? []),
          ];
          for (const a of items) {
            if (rewriteRuntimeLinksForPlatform(a, ps)) mutated = true;
          }
        }
        // Optional: Gemini refinement (only if a key is configured).
        const promptInput = (req.body as { prompt?: unknown })?.prompt;
        if (gemini && typeof promptInput === "string") {
          const refinement = await refineWithGemini(promptInput, cockpitJson);
          if (refinement) {
            cockpitJson.refinement = refinement;
            mutated = true;
          }
        }
        if (mutated) outText = JSON.stringify(cockpitJson);
      } catch {
        // Non-JSON or unexpected shape; fall through with the original body.
      }
    }
    if (
      response.ok &&
      req.method === "POST" &&
      publicPath === "/agent-builder/export" &&
      contentType.includes("application/json")
    ) {
      try {
        const exportJson = JSON.parse(text) as ExportShape & Record<string, unknown>;
        let mutated = false;
        const platform = exportJson.manifest?.platform;
        // Always: rewrite runtime built-in license URLs based on the export
        // platform, and patch any inline reference in LICENSES.md.
        for (const a of exportJson.manifest?.selected_artifacts ?? []) {
          if (rewriteRuntimeLinksForPlatform(a as ArtifactWithLinks, platform)) {
            mutated = true;
          }
        }
        if (
          mutated &&
          typeof exportJson.files?.["LICENSES.md"] === "string" &&
          platform &&
          RUNTIME_DOCS_BY_PLATFORM[platform] &&
          RUNTIME_DOCS_BY_PLATFORM[platform] !== OPENAI_RUNTIME_URL
        ) {
          exportJson.files["LICENSES.md"] = exportJson.files["LICENSES.md"].replace(
            /https:\/\/developers\.openai\.com\/api\/docs\/guides\/tools/g,
            RUNTIME_DOCS_BY_PLATFORM[platform],
          );
        }
        // Optional: Gemini rewrite of the primary instructions file.
        const promptInput = (req.body as { prompt?: unknown })?.prompt;
        const instructionsPath = exportJson.manifest?.file_manifest?.instructions;
        if (
          gemini &&
          typeof promptInput === "string" &&
          typeof instructionsPath === "string" &&
          exportJson.files &&
          typeof exportJson.files[instructionsPath] === "string"
        ) {
          const rewritten = await rewriteInstructionsWithGemini(
            promptInput,
            platform,
            exportJson.files[instructionsPath],
            exportJson.manifest?.selected_artifacts ?? [],
          );
          if (rewritten) {
            exportJson.files[instructionsPath] = rewritten;
            exportJson.manifest = {
              ...(exportJson.manifest ?? {}),
              gemini_instructions: {
                provider: "google",
                model: GEMINI_MODEL,
                applied_to: instructionsPath,
                generated_at: new Date().toISOString(),
              },
            };
            mutated = true;
          }
        }
        if (mutated) outText = JSON.stringify(exportJson);
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
