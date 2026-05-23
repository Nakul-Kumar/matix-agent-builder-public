# Matix Agent Builder — MCP Server

A Model Context Protocol server that wraps the public Matix agent-builder
backend so any MCP-aware client (Claude Code, Cursor, ChatGPT desktop, etc.)
can ask for agent blueprints and safe example bundles by name.

The server is a thin stdio shim. It forwards each tool call to
`MATIX_PUBLIC_API_BASE` (defaults to the publicly hosted cockpit) and returns
the response. No provider keys live in this process.

## Tools

| Tool | Description |
|---|---|
| `build_agent_preview` | Generate a 3-platform agent blueprint preview from a prompt. Optional `refine: true` parameter uses MCP sampling to ask the calling client's LLM to review/filter the candidates and attach a `refinement` field. |
| `export_agent_bundle` | Generate a safe example export bundle for one platform (`codex`, `claude_code`, or `openclaw`). |
| `list_runtimes` | List the runtime templates the public backend supports. |
| `registry_summary` | Get a summary of skills in the public registry with trust scores. |

All tools return JSON serialized as a single text block.

### Sampling-based refinement (optional)

Calling `build_agent_preview` with `refine: true` triggers an extra step: the MCP server asks the calling client's LLM (via the MCP **sampling** primitive) to review the deterministic candidates and return strict JSON with `fit`, `summary`, `top_refs`, `drop_refs`, and `missing_capabilities`. The refinement is attached under `refinement` on the response.

This requires an MCP client that supports sampling (Claude Code, Cursor). On clients that don't, the original deterministic preview is returned with a `refinement_error` explaining why.

## Run it

The server runs over stdio. Clone, install once, and the MCP-aware client
spawns the server on demand.

```bash
git clone https://github.com/Nakul-Kumar/matix-agent-builder-public.git
cd matix-agent-builder-public
npm ci
npm run mcp     # or:  npx tsx mcp/index.ts
```

You should see this on stderr:

```
[matix-agent-builder] listening on stdio (API base: https://cockpit.76.13.118.9.sslip.io/api/v1/public)
```

Stdout is reserved for the JSON-RPC stream. The server stays attached to the
parent process; the MCP client handles lifecycle.

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `MATIX_PUBLIC_API_BASE` | the public test cockpit URL | The `/api/v1/public` base the tools forward to. |

## Wire it into Claude Code

Add to `~/.claude/mcp_servers.json` (or your project-local equivalent):

```json
{
  "mcpServers": {
    "matix-agent-builder": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/matix-agent-builder-public/mcp/index.ts"
      ],
      "env": {
        "MATIX_PUBLIC_API_BASE": "https://cockpit.76.13.118.9.sslip.io/api/v1/public"
      }
    }
  }
}
```

Then from Claude Code:

> "Use the matix-agent-builder MCP to draft a research agent that summarises arXiv papers."

Claude will call `build_agent_preview` with that prompt.

## Wire it into Cursor

Add to Cursor's MCP settings (`File → Preferences → Cursor Settings → MCP`):

```json
{
  "matix-agent-builder": {
    "command": "npx",
    "args": [
      "tsx",
      "/absolute/path/to/matix-agent-builder-public/mcp/index.ts"
    ]
  }
}
```

## Inspect the server during development

The official MCP inspector gives you a UI for invoking each tool:

```bash
npx @modelcontextprotocol/inspector npx tsx mcp/index.ts
```

## Notes

- The cockpit currently runs a deterministic capability-matching fallback
  because the OpenAI provider key is not yet configured upstream. Tool
  responses are well-formed but the recommendation model is not live.
- The MCP server is a thin shim — it forwards calls directly to the
  configured `MATIX_PUBLIC_API_BASE` without re-validating the prompt.
  If you want the same prompt validation as the web UI's BFF (greetings
  and off-topic prompts rejected with HTTP 422), point
  `MATIX_PUBLIC_API_BASE` at a local instance of `server/index.ts`
  instead of the cockpit URL.
- `submit_feedback` is intentionally not exposed as an MCP tool —
  feedback belongs to the public web UI flow, not automated agent traffic.
