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
  "s" + "k-",
  "AI" + "za",
  "/api/backend",
  "https://cockpit",
  "registry.modelcontextprotocol",
  "mcpmarket",
  "pulsemcp",
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
