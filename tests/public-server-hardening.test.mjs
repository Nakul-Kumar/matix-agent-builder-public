import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";

function freePort() {
  return 20_000 + Math.floor(Math.random() * 20_000);
}

function childEnv(overrides) {
  return Object.fromEntries(
    Object.entries({ ...process.env, ...overrides }).filter(
      ([key, value]) => !key.includes("=") && value !== undefined,
    ),
  );
}

async function startServer(env = {}) {
  const port = String(env.PORT || freePort());
  const child = spawn(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "server/index.ts"],
    {
      cwd: process.cwd(),
      env: childEnv({
        NODE_ENV: "production",
        PUBLIC_APP_ENV: "test",
        PORT: port,
        MATIX_PUBLIC_API_BASE: "",
        GEMINI_API_KEY: "",
        ...env,
      }),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const deadline = Date.now() + 10_000;
  while (!output.includes("Matix Agent Builder public server listening")) {
    if (Date.now() > deadline) {
      child.kill("SIGTERM");
      throw new Error(`server did not start:\n${output}`);
    }
    if (child.exitCode !== null) {
      throw new Error(`server exited early:\n${output}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return {
    port,
    get output() {
      return output;
    },
    async stop() {
      child.kill("SIGTERM");
      await Promise.race([
        once(child, "exit"),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    },
  };
}

async function startJsonUpstream(handler) {
  const server = createServer(async (req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    await once(req, "end");
    const payload = handler({ method: req.method, url: req.url, body });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async stop() {
      server.close();
      await Promise.race([
        once(server, "close"),
        new Promise((resolve) => setTimeout(resolve, 2_000)),
      ]);
    },
  };
}

test("production responses hide framework details and carry strict browser policy", async () => {
  const server = await startServer();
  try {
    assert.match(server.output, new RegExp(`127\\.0\\.0\\.1:${server.port}`));
    const response = await fetch(`http://127.0.0.1:${server.port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-powered-by"), null);
    const csp = response.headers.get("content-security-policy") || "";
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(csp, /form-action 'self'/);
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains");
  } finally {
    await server.stop();
  }
});

test("preview responses do not expose internal fallback auth reasons", async () => {
  const internalReason =
    "MATIX_PUBLIC_RERANK_ENABLED and OpenAI/Codex API auth are required. Used AgentRecommendationCoreV2 capability fallback.";
  const upstream = await startJsonUpstream(() => ({
    ok: true,
    prompt_hash: "prompt-hash",
    normalized_prompt: "Build a software engineering agent",
    generated_at: "2026-06-07T00:00:00.000Z",
    model: {
      provider: "openai",
      name: "gpt-5.5",
      status: "deterministic_fallback",
    },
    selection_source: "deterministic_fallback",
    fallback_reason: internalReason,
    intent: {
      model_status: "OpenAI/Codex API auth is missing; used local capability fallback.",
    },
    model_trace_summary: {
      selection_source: "deterministic_fallback",
      intent_model_status: "OpenAI/Codex API auth is missing; used local capability fallback.",
      reranker_reason: internalReason,
    },
    placards: [],
    source_statuses: [],
    source_policy: {
      browser_provider_calls: false,
      secrets_included: false,
      allowed_source_hosts: [],
    },
  }));
  const server = await startServer({ MATIX_PUBLIC_API_BASE: upstream.baseUrl });
  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/api/public/agent-builder/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prompt: "Build a software engineering agent for a Next.js application.",
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.selection_source, "deterministic_fallback");
    assert.equal(body.fallback_reason, undefined);
    assert.equal(body.intent?.model_status, undefined);
    assert.equal(body.model_trace_summary?.reranker_reason, undefined);
    assert.equal(body.model_trace_summary?.intent_model_status, undefined);
    assert.doesNotMatch(
      JSON.stringify(body),
      /MATIX_PUBLIC_RERANK_ENABLED|OpenAI\/Codex API auth|AgentRecommendationCoreV2/,
    );
  } finally {
    await server.stop();
    await upstream.stop();
  }
});

test("production metrics stay hidden without a configured metrics token", async () => {
  const server = await startServer();
  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/api/metrics`);
    assert.equal(response.status, 404);
  } finally {
    await server.stop();
  }
});

test("feedback metadata is bounded before any upstream proxy attempt", async () => {
  const server = await startServer();
  try {
    const response = await fetch(`http://127.0.0.1:${server.port}/api/public/agent-builder/feedback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        feedback: "This preview was useful.",
        rating: 5,
        metadata: {
          a: "1",
          b: "2",
          c: "3",
          d: "4",
          e: "5",
          f: "6",
          g: "7",
          h: "8",
          i: "9",
          j: "10",
          k: "11",
        },
      }),
    });
    assert.equal(response.status, 422);
    assert.deepEqual(await response.json(), {
      error: "invalid_metadata",
      detail: "Feedback metadata is too large or uses unsupported values.",
    });
  } finally {
    await server.stop();
  }
});
