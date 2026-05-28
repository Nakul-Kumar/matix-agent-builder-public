import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function rel(file) {
  return path.join(root, file);
}

function read(file) {
  return readFileSync(rel(file), "utf8");
}

function requireFile(file) {
  if (!existsSync(rel(file))) {
    failures.push(`${file} is missing`);
    return "";
  }
  return read(file);
}

function requireIncludes(file, text, label = text) {
  const body = requireFile(file);
  if (body && !body.includes(text)) {
    failures.push(`${file} must mention ${label}`);
  }
}

function requireAny(file, needles, label) {
  const body = requireFile(file);
  if (body && !needles.some((needle) => body.includes(needle))) {
    failures.push(`${file} must mention ${label}`);
  }
}

const requiredRootFiles = [
  "LICENSE",
  "NOTICE",
  "PRIVACY.md",
  "TERMS.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "README.md",
  "API.md",
  "FILE_INDEX.md",
];

for (const file of requiredRootFiles) {
  requireFile(file);
}

requireIncludes("LICENSE", "Apache License");
requireIncludes("LICENSE", "Version 2.0");
requireIncludes("README.md", "Apache-2.0");
requireIncludes("README.md", "public preview");
requireIncludes("README.md", "MATIX_PUBLIC_API_BASE");
requireIncludes("README.md", "npm run check:release");
requireIncludes("README.md", "render-only UI/BFF");

for (const field of [
  "license",
  "score_breakdown",
  "why_selected",
  "setup_hint",
  "credential_status",
  "warnings",
  "calibration",
]) {
  requireIncludes("API.md", field);
}

for (const topic of [
  "prompt",
  "feedback",
  "optional email",
  "backend",
  "model/provider processing",
  "30 days",
  "deletion",
]) {
  requireIncludes("PRIVACY.md", topic);
}

for (const topic of [
  "public preview",
  "no warranty",
  "legal, medical, financial",
  "not endorsements",
  "review licenses",
  "credentials",
]) {
  requireIncludes("TERMS.md", topic);
}

requireAny("SECURITY.md", ["security@matix.dev", "GitHub Security Advisories"], "a vulnerability reporting channel");
requireIncludes("SECURITY.md", "rate limiting");

const app = [
  requireFile("src/App.tsx"),
  requireFile("src/components/AppShell.tsx"),
  requireFile("src/components/FeedbackForm.tsx"),
  requireFile("src/data/publicBuilderContent.ts"),
].join("\n");
for (const label of ["Privacy", "Terms", "Security", "GitHub"]) {
  if (app && !app.includes(label)) {
    failures.push(`public UI must link ${label}`);
  }
}
if (app && !app.includes("feedback may be stored")) {
  failures.push("public UI feedback copy must reference privacy handling");
}

const server = requireFile("server/index.ts");
if (server && (!server.includes("RATE_LIMIT_WINDOW_MS") || !server.includes("429"))) {
  failures.push("server/index.ts must include public API rate limiting");
}

requireFile(".github/workflows/public-release.yml");

const pkg = JSON.parse(requireFile("package.json") || "{}");
for (const scriptName of ["check:release", "scan:assets", "smoke:live"]) {
  if (!pkg.scripts?.[scriptName]) {
    failures.push(`package.json must define npm run ${scriptName}`);
  }
}

if (failures.length) {
  console.error("release readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("release readiness check passed");
