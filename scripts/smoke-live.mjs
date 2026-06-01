function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!process.env.MATIX_PUBLIC_API_BASE) {
  fail(
    "MATIX_PUBLIC_API_BASE is not set. Set it to the deployed public backend " +
      "base, e.g. https://your-cockpit-domain.example/api/v1/public",
  );
}
const apiBase = process.env.MATIX_PUBLIC_API_BASE.replace(/\/$/, "");

function canonical(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function post(path, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    fail(`${path} returned non-JSON response: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    fail(`${path} returned HTTP ${response.status}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

function inspectPreview(preview) {
  if (preview.model?.provider !== "openai") fail("preview model provider is not openai");
  if (preview.model?.name !== "gpt-5.5") fail("preview model name is not gpt-5.5");
  if (preview.source_policy?.browser_provider_calls !== false) fail("browser provider calls must be false");
  if (preview.source_policy?.secrets_included !== false) fail("secrets included must be false");
  if (!Array.isArray(preview.source_statuses) || preview.source_statuses.length < 4) {
    fail("source statuses are missing or too sparse");
  }

  const codex = preview.placards?.find((placard) => placard.platform === "codex");
  if (!codex) fail("codex placard missing");

  const artifacts = [...(codex.skills || []), ...(codex.mcps || []), ...(codex.tools || [])];
  if (artifacts.length < 10) fail(`codex bundle too small: ${artifacts.length}`);

  const seen = new Set();
  for (const artifact of artifacts) {
    const key = canonical(artifact.artifact_ref || artifact.name);
    if (seen.has(key)) fail(`duplicate artifact in codex bundle: ${artifact.name}`);
    seen.add(key);

    if (!artifact.license?.name) fail(`missing license on ${artifact.name}`);
    if (!artifact.score_breakdown || Object.keys(artifact.score_breakdown).length === 0) {
      fail(`missing score breakdown on ${artifact.name}`);
    }
    if (!artifact.why_selected) fail(`missing why_selected on ${artifact.name}`);
    if (!artifact.setup_hint) fail(`missing setup_hint on ${artifact.name}`);
    if (!artifact.credential_status) fail(`missing credential_status on ${artifact.name}`);
  }

  const blocked = artifacts
    .map((artifact) => canonical(`${artifact.artifact_ref} ${artifact.name}`))
    .filter((name) => name.includes("canvas-design") || name.includes("webapp-testing") || name.includes("aso"));
  if (blocked.length) fail(`research bundle contains off-topic artifacts: ${blocked.join(", ")}`);
}

function inspectExport(payload) {
  const files = payload.files || payload.bundle?.files || payload.export?.files || {};
  const names = Array.isArray(files) ? files.map((file) => file.path || file.name) : Object.keys(files);
  for (const required of ["START_HERE.md", "LICENSES.md", "manifest.json"]) {
    if (!names.includes(required)) {
      fail(`export missing ${required}`);
    }
  }
  if (payload.source_policy?.secrets_included === true || payload.secrets_included === true) {
    fail("export says secrets are included");
  }
}

const prompt = "Build a research agent";
const preview = await post("/agent-builder/preview", { prompt });
inspectPreview(preview);

const exported = await post("/agent-builder/export", { prompt, platform: "codex" });
inspectExport(exported);

console.log(
  `live smoke passed: ${preview.placards?.length || 0} placards, ${preview.source_statuses?.length || 0} source statuses`,
);
