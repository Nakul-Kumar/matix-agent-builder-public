import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "src");
const findings = [];

const bannedPhrases = [
  "safe bundle",
  "signed JSON manifest",
  "ready to export",
  "Used to build your agent",
  "gemini-2.5-flash",
  "GPT-5.5",
  "production-grade",
  "License / MIT",
  "Build 0142",
  "0.4.1-preview",
];

const bannedCodePoints = new Map([
  [0x00b7, "middle dot"],
  [0x2013, "en dash"],
  [0x2014, "em dash"],
  [0x2022, "bullet"],
  [0x2026, "ellipsis"],
  [0x2190, "left arrow"],
  [0x2191, "up arrow"],
  [0x2192, "right arrow"],
  [0x2193, "down arrow"],
]);

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(ts|tsx|css)$/.test(entry)) continue;
    const rel = path.relative(root, full);
    const text = readFileSync(full, "utf8");
    for (const phrase of bannedPhrases) {
      if (text.includes(phrase)) {
        findings.push(`${rel} contains banned UI phrase: ${phrase}`);
      }
    }
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const char of line) {
        const code = char.codePointAt(0);
        if (code && bannedCodePoints.has(code)) {
          findings.push(
            `${rel}:${index + 1} contains ${bannedCodePoints.get(code)}`,
          );
        }
      }
    });
  }
}

walk(src);

if (findings.length > 0) {
  console.error("UI copy scan failed:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exit(1);
}

console.log("UI copy scan passed");
