import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const findings = [];
const forbidden = [
  "OPEN" + "AI",
  "GEM" + "INI",
  "ANTH" + "ROPIC",
  "api.google",
  "/api/backend",
  "https://cockpit",
  "registry.modelcontextprotocol",
  "mcpmarket",
  "pulsemcp",
];

// Loose substrings like "sk-" or "AIza" false-positive on CSS tokens
// such as `mask-image`. Match the full key shape instead.
const forbiddenPatterns = [
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bAIza[A-Za-z0-9_-]{20,}/,
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
