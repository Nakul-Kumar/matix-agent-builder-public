import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const findings = [];
// Substrings that should never appear in the public client bundle.
// Provider brand names (OPENAI/GEMINI/ANTHROPIC) used to be in this list as
// a proxy for "API config leaked into the bundle"; they were removed because
// the UI legitimately renders model labels like "GEMINI / GEMINI-2.5-FLASH"
// or "OpenAI / Codex CLI". Real leaks are still caught more precisely by the
// key-shape patterns and the URL/route checks below.
const forbidden = [
  "api.google",
  "openai.com/v1",
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "/api/backend",
  "https://cockpit",
  "registry.modelcontextprotocol",
  "mcpmarket",
  "pulsemcp",
];

// Loose substrings like "sk-" or "AIza" false-positive on CSS tokens
// such as `mask-image`. Match the full key shape instead. The env-var
// assignment patterns catch real KEY=value pairs while leaving bare
// references like `process.env.GEMINI_API_KEY` alone.
const forbiddenPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bAIza[A-Za-z0-9_-]{20,}/,
  /\bGEMINI_API_KEY\s*[=:]\s*\S/,
  /\bOPENAI_API_KEY\s*[=:]\s*\S/,
  /\bANTHROPIC_API_KEY\s*[=:]\s*\S/,
  /\bOPENROUTER_API_KEY\s*[=:]\s*\S/,
];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(js|css|html|json|map)$/.test(entry)) continue;
    const text = readFileSync(full, "utf8");
    for (const needle of forbidden) {
      if (text.includes(needle)) {
        findings.push(`${path.relative(root, full)} contains ${needle}`);
      }
    }
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(text)) {
        findings.push(`${path.relative(root, full)} matches ${pattern}`);
      }
    }
  }
}

if (!existsSync(dist)) {
  console.error("dist is missing; run npm run build first");
  process.exit(1);
}

walk(dist);

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("built asset scan passed");
