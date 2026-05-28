#!/usr/bin/env node
/**
 * Matix Agent Builder MCP server.
 *
 * Exposes the public agent-builder backend as Model Context Protocol tools so
 * any MCP-aware client (Claude Code, Cursor, ChatGPT desktop, etc.) can ask
 * for agent blueprints and safe example bundles by name.
 *
 * Transport: stdio. The server forwards each call to MATIX_PUBLIC_API_BASE.
 * No provider keys live here.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = (process.env.MATIX_PUBLIC_API_BASE || "").replace(/\/$/, "");

const SERVER_NAME = "matix-agent-builder";
const SERVER_VERSION = "0.1.0";

type ToolContent = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

async function callApi(
  pathname: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<unknown> {
  if (!API_BASE) {
    throw new Error("Set MATIX_PUBLIC_API_BASE to a compatible /api/v1/public backend");
  }
  const url = `${API_BASE}${pathname}`;
  const response = await fetch(url, {
    method: init.method,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Matix backend returned non-JSON (HTTP ${response.status}): ${text.slice(0, 200)}`,
    );
  }
  if (!response.ok) {
    const detail =
      typeof parsed === "object" && parsed !== null && "detail" in parsed
        ? (parsed as { detail: unknown }).detail
        : parsed;
    const detailText =
      typeof detail === "string" ? detail : JSON.stringify(detail);
    throw new Error(`Matix backend ${response.status}: ${detailText}`);
  }
  return parsed;
}

function asJsonContent(value: unknown): ToolContent {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

function asError(err: unknown): ToolContent {
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

interface PlacardArtifactSummary {
  artifact_ref?: string;
  name?: string;
  description?: string;
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

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

/**
 * Ask the calling client's LLM (via MCP sampling) to review the deterministic
 * recommendations. Works in clients that support sampling (Claude Code, Cursor).
 * Returns null if the client can't sample, so the caller still gets the raw
 * deterministic response.
 */
async function refineViaSampling(
  prompt: string,
  cockpit: unknown,
): Promise<Record<string, unknown> | null> {
  try {
    const placards = (cockpit as CockpitPreviewShape)?.placards ?? [];
    const candidates = placards.map((p) => ({
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
    const result = await server.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Review these agent-builder recommendations.

User goal: "${prompt}"

Deterministic candidates per platform:
${JSON.stringify(candidates, null, 2)}

Return strict JSON only (no markdown, no preamble, no trailing text):
{
  "fit": "good"|"partial"|"poor",
  "summary": "one or two sentences",
  "top_refs": [up to 5 artifact_ref strings, ordered],
  "drop_refs": [{"ref": "...", "reason": "..."}],
  "missing_capabilities": [short capability strings]
}`,
          },
        },
      ],
      maxTokens: 800,
    });
    const content = result.content;
    if (content?.type === "text") {
      try {
        const parsed = JSON.parse(content.text) as Record<string, unknown>;
        return { provider: "sampling", model: result.model ?? "client", ...parsed };
      } catch {
        return {
          provider: "sampling",
          model: result.model ?? "client",
          review_text: content.text,
        };
      }
    }
    return null;
  } catch (err) {
    console.error(
      "[mcp sampling] refinement failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

server.registerTool(
  "build_agent_preview",
  {
    title: "Build agent preview",
    description:
      "Generate a public-safe agent blueprint preview from a natural-language " +
      "description. Returns three runtime placards (Codex, Claude Code, OpenClaw) " +
      "with recommended skills, MCPs, tools, source links, scores, license labels, " +
      "credential status, and setup hints. Backend selection behavior is " +
      "deployment-specific and is reflected in the returned metadata.",
    inputSchema: {
      prompt: z
        .string()
        .min(12, "Prompt must be at least 12 characters")
        .describe(
          "Natural-language description of the agent you want to build. " +
            "Example: 'Build a customer support agent that reads Notion docs and files Linear bugs.'",
        ),
      refine: z
        .boolean()
        .optional()
        .describe(
          "If true, after fetching the deterministic preview the MCP server " +
            "uses MCP sampling to ask the calling client's LLM to review and " +
            "refine the candidates. The refinement is attached to the response " +
            "under `refinement`. Requires a sampling-capable MCP client " +
            "(Claude Code, Cursor). Default false.",
        ),
    },
  },
  async ({ prompt, refine }) => {
    try {
      const result = await callApi("/agent-builder/preview", {
        method: "POST",
        body: { prompt },
      });
      if (!refine) {
        return asJsonContent(result);
      }
      const refinement = await refineViaSampling(prompt, result);
      if (refinement) {
        return asJsonContent({ ...(result as object), refinement });
      }
      return asJsonContent({
        ...(result as object),
        refinement_error:
          "MCP sampling unavailable on this client (or it returned an unparseable response). The deterministic preview above is unchanged.",
      });
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "export_agent_bundle",
  {
    title: "Export agent bundle",
    description:
      "Generate a safe example export bundle for one runtime platform. Returns " +
      "a file tree (START_HERE.md, AGENTS.md or CLAUDE.md, per-skill SKILL.md, " +
      "manifest.json, LICENSES.md, etc.) using placeholders only — no real " +
      "credentials, launch roots, or provider keys are included.",
    inputSchema: {
      prompt: z
        .string()
        .min(12, "Prompt must be at least 12 characters")
        .describe("Natural-language description of the agent you want to build."),
      platform: z
        .enum(["codex", "claude_code", "openclaw"])
        .describe(
          "Target runtime platform: 'codex' (OpenAI Codex CLI), " +
            "'claude_code' (Anthropic Claude Code), or 'openclaw' (open source / OpenClaw).",
        ),
    },
  },
  async ({ prompt, platform }) => {
    try {
      const result = await callApi("/agent-builder/export", {
        method: "POST",
        body: { prompt, platform },
      });
      return asJsonContent(result);
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "list_runtimes",
  {
    title: "List supported runtimes",
    description:
      "List the runtime templates the public backend currently supports " +
      "(Codex, Claude Code, OpenClaw). Useful for clients that want to discover " +
      "available platforms before calling export_agent_bundle.",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await callApi("/agent-builder/templates", { method: "GET" });
      return asJsonContent(result);
    } catch (err) {
      return asError(err);
    }
  },
);

server.registerTool(
  "registry_summary",
  {
    title: "Registry summary",
    description:
      "Get a summary of every skill currently in the public registry with its " +
      "scoring metadata. Useful for browsing the catalog without submitting a prompt.",
    inputSchema: {},
  },
  async () => {
    try {
      const result = await callApi("/registry-summary", { method: "GET" });
      return asJsonContent(result);
    } catch (err) {
      return asError(err);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stderr only — stdout is reserved for the JSON-RPC stream.
console.error(
  `[${SERVER_NAME}] listening on stdio (API base: ${API_BASE || "not configured"})`,
);
