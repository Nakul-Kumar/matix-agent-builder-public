import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
// Always-suspect substrings. Empty by default; we use regexes below so that
// bare env-var references in source (e.g. `process.env.GEMINI_API_KEY`) do
// not false-positive while still catching real `KEY=value` assignments.
const forbidden = [];

// Forbidden patterns:
//  - Real key shapes (sk-... and AIza... -- substring forms would
//    false-positive on `mask-image`, BEM modifiers, etc.).
//  - Env-var assignments. The `\s*[=:]\s*\S` tail requires an actual value
//    after the env-var name, so legitimate references like
//    `process.env.GEMINI_API_KEY` are not flagged, but `GEMINI_API_KEY=...`
//    or `"GEMINI_API_KEY": "AIza..."` still are.
const forbiddenPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bAIza[A-Za-z0-9_-]{20,}/,
  /\bGEMINI_API_KEY\s*[=:]\s*\S/,
  /\bOPENAI_API_KEY\s*[=:]\s*\S/,
  /\bANTHROPIC_API_KEY\s*[=:]\s*\S/,
  /\bOPENROUTER_API_KEY\s*[=:]\s*\S/,
  /\bVITE_GEMINI_API_KEY\s*[=:]\s*\S/,
  /\bVITE_OPENAI_API_KEY\s*[=:]\s*\S/,
  /\bVITE_ANTHROPIC_API_KEY\s*[=:]\s*\S/,
  /\bDATABASE_URL\s*[=:]\s*\S/,
  /\bcockpit_jwt\s*[=:]\s*\S/,
];

const ignored = new Set(["node_modules", "dist", "dist-server", ".git", ".local", ".cache", ".agents"]);
const findings = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (ignored.has(entry)) continue;
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|jsx|json|md|css|html|example)$/.test(entry)) {
      if (full.endsWith("scan-secrets.mjs") || full.endsWith(".env.example") || full.endsWith("README.md")) continue;
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
}

walk(root);

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log("secret scan passed");
