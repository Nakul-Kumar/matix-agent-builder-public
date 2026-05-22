import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const forbidden = [
  "GEMINI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "VITE_GEMINI_API_KEY",
  "VITE_OPENAI_API_KEY",
  "VITE_ANTHROPIC_API_KEY",
  "DATABASE_URL",
  "cockpit_jwt",
];

// Loose substrings like "sk-" or "AIza" false-positive on CSS tokens
// such as `mask-image`. Match the full key shape instead.
const forbiddenPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bAIza[A-Za-z0-9_-]{20,}/,
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
