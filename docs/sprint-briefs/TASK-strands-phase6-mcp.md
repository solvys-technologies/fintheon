# Task Brief: Strands Phase 6 — MCP Integration

**Date:** 2026-04-05
**Scope:** Wire existing MCP servers through Strands native McpClient so Harper's agent auto-discovers MCP tools.
**Estimated files:** 3
**Repo root:** `~/Documents/Codebases/fintheon`
**Working directory:** `~/Documents/Codebases/fintheon/backend-hono`

## Prerequisites

- The Strands SDK is already installed at `@strands-agents/sdk@1.0.0-rc.2` in `backend-hono/`.
- The Strands agent layer lives at `backend-hono/src/services/strands/` with: `provider.ts`, `agent-factory.ts`, `harper-tools.ts`, `stream-adapter.ts`, `pipeline.ts`, `agents/harper.ts`, `skills/`.
- VProxy (localhost:8317) provides Claude models via OpenAI-compatible API.
- Build command: `cd ~/Documents/Codebases/fintheon/backend-hono && bun run build`
- Read `~/Documents/Codebases/fintheon/CLAUDE.md` for project rules (changelog protocol, version branching).

## Context

Phases 1-5 of the Strands migration are complete. Harper-Opus has 15 tools (6 core + 9 solvys skills) and a Graph-based pipeline. The existing `.mcp.json` defines 5 MCP servers (tradingview, exa, notion, unusual-whales, framer) but they're not yet connected to the Strands agents. Strands has native `McpClient` support — pass clients to the Agent constructor and tools are auto-discovered.

## Files to Read First

- `~/Documents/Codebases/fintheon/backend-hono/src/services/strands/agent-factory.ts` — How agents are created, where tools are passed
- `~/Documents/Codebases/fintheon/backend-hono/src/services/strands/agents/harper.ts` — Harper agent creation, currently gets core tools + solvys tools
- `~/Documents/Codebases/fintheon/.mcp.json` — The 5 MCP server configs (stdio + url transports)
- `~/Documents/Codebases/fintheon/backend-hono/node_modules/@strands-agents/sdk/dist/src/tools/mcp-tool.d.ts` — McpClient types
- `~/Documents/Codebases/fintheon/frontend/lib/skills.ts` — Skill→MCP server mapping (for reference only)
- `~/Documents/Codebases/fintheon/CLAUDE.md` — Project rules (changelog protocol, version branching)

## What to Build/Change

### 1. MCP Loader

- **Path:** `backend-hono/src/services/strands/mcp-loader.ts`
- **Action:** Create
- **Spec:**
  - Read `.mcp.json` from project root
  - For each server with `"command"` transport: create `McpClient` with `StdioClientTransport`
  - For URL-based servers (framer): create `McpClient` with appropriate HTTP/SSE transport
  - Export `loadMcpClients(): Promise<McpClient[]>` that returns connected clients
  - Export `disconnectAll(): Promise<void>` for cleanup
  - Handle missing env vars gracefully (skip that server, log warning)
  - Peer dep needed: `bun add @modelcontextprotocol/sdk` in backend-hono
- **Max lines:** 120

### 2. Wire MCP into Harper Agent

- **Path:** `backend-hono/src/services/strands/agents/harper.ts`
- **Action:** Modify
- **Spec:**
  - Import `loadMcpClients` from mcp-loader
  - In `createHarperAgent()`, load MCP clients and add to tools array alongside core tools and solvys tools
  - MCP clients go into the `tools` array — Strands treats them as tool providers
  - Add cleanup on stream cancel (disconnect MCP clients)
- **Max lines:** stays under 100

### 3. Export from barrel

- **Path:** `backend-hono/src/services/strands/index.ts`
- **Action:** Modify
- **Spec:** Add `export { loadMcpClients, disconnectAll } from './mcp-loader.js'`

## Key Rules

- Strands `McpClient` constructor takes `{ transport: Transport }` — import `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`
- The `.mcp.json` env vars use `${VAR}` syntax — resolve from `process.env` before passing
- Framer uses `"type": "url"` transport — check Strands docs for HTTP-based MCP transport
- `McpClient` is passed in the `tools` array just like regular tools — no special handling

## DO NOT

- Touch any files outside `backend-hono/src/services/strands/`
- Modify `.mcp.json`
- Change any frontend code
- Remove or modify the existing Vercel AI SDK code (that's Phase 8)

## Verification

```bash
cd ~/Documents/Codebases/fintheon/backend-hono && bun add @modelcontextprotocol/sdk
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v scripts/
bun run build
# Smoke test: create Harper agent, ask it to search via Exa
bun run src/services/strands/tool-test.ts
```

## Changelog Entry

```typescript
{
  date: '2026-04-05T__:__:00',
  agent: 'claude-code',
  summary: 'Strands Phase 6: Wire MCP servers (exa, notion, tradingview, unusual-whales, framer) through native McpClient into Harper agent. Tools auto-discovered from .mcp.json.',
  files: ['backend-hono/src/services/strands/mcp-loader.ts', 'backend-hono/src/services/strands/agents/harper.ts', 'backend-hono/src/services/strands/index.ts']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
