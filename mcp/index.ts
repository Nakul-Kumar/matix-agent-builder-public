#!/usr/bin/env node
/**
 * Matix Agent Builder MCP server.
 *
 * Exposes the public agent-builder backend as Model Context Protocol tools so
 * any MCP-aware client (Claude Code, Cursor, ChatGPT desktop, etc.) can ask
 * for agent blueprints and safe example bundles by name.
 *
 * Transport: stdio. The server forwards each call to MATIX_PUBLIC_API_BASE,
 * which defaults to the publicly hosted cockpit. No provider keys live here.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const DEFAULT_API_BASE = "https://cockpit.76.13.118.9.sslip.io/api/v1/public";

const API_BASE = (process.env.MATIX_PUBLIC_API_BASE || DEFAULT_API_BASE).replace(
  /\/$/,
  "",
);

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

const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

server.registerTool(
  "build_agent_preview",
  {
    title: "Build agent preview",
    description:
      "Generate a public-safe agent blueprint preview from a natural-language " +
      "description. Returns three runtime placards (Codex, Claude Code, OpenClaw) " +
      "with recommended skills, MCPs, tools, source links, scores, license labels, " +
      "credential status, and setup hints. Backed by the Matix cockpit; outputs " +
      "are deterministic-fallback today and gain calibrated model reranking once " +
      "the upstream provider key is configured.",
    inputSchema: {
      prompt: z
        .string()
        .min(12, "Prompt must be at least 12 characters")
        .describe(
          "Natural-language description of the agent you want to build. " +
            "Example: 'Build a customer support agent that reads Notion docs and files Linear bugs.'",
        ),
    },
  },
  async ({ prompt }) => {
    try {
      const result = await callApi("/agent-builder/preview", {
        method: "POST",
        body: { prompt },
      });
      return asJsonContent(result);
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
      "trust score. Useful for browsing the catalog without submitting a prompt.",
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
  `[${SERVER_NAME}] listening on stdio (API base: ${API_BASE})`,
);
