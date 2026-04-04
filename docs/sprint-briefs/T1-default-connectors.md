# T1: Default Connectors — Internal + MCP

## Objective
Wire up default connectors that appear in the CONNECTORS section of the chat ToolsDropdown. Currently shows "0 connectors active". After this track, 3 internal connectors + 4 MCP connectors should appear by default.

## Architecture

### Key Files
- `frontend/components/chat/ToolsDropdown.tsx` — Combined Skills + Connectors dropdown UI
- `frontend/components/chat/McpConnectorPopup.tsx` — Connector display with status dots
- `frontend/hooks/useMcpConnectors.ts` — State management hook, fetches from `/api/mcp`
- `frontend/types/mcp.ts` — `McpServerId` type union + `McpServerConfig` interface
- `frontend/lib/skills.ts` — SKILLS array with `mcpServers` dependencies
- `backend-hono/src/routes/mcp/index.ts` — Backend MCP config routes, reads `~/.claude/mcp.json`
- `.mcp.json` — Project-level MCP server configs (already has exa, notion, tradingview, framer, close_crm)

### Current State
- Backend MCP route reads from `~/.claude/mcp.json` and project `.mcp.json`
- Known servers registry in backend has metadata for: exa, notion, framer, close-crm, qc-mcp, tradingview, yahoo-finance, unusual-whales, playwright, figma
- Frontend `useMcpConnectors()` fetches from `/api/mcp` and manages toggle state
- Skills auto-activate required MCP connectors (e.g., Brief skill enables exa)

## Requirements

### Internal Connectors (not MCP — these are in-app features routed through Harper chat)
These are NOT MCP servers. They are "internal connectors" that appear in the connectors list but work by injecting context into Harper's prompt or triggering backend endpoints.

1. **RiskFlow** — Cite a catalyst by prompting a search through the DB
   - When active: Harper can search `riskflow_items` table via its `run_command` tool
   - UI: Shows as a connector with category "internal", always-on by default
   - Implementation: Add to the connectors list with `locked: true`, `source: 'internal'`

2. **Aquarium** — Further discussion of most recent Aquarium (MiroShark) simulation run
   - When active: Injects latest Aquarium run summary into Harper's context
   - Backend endpoint exists: GET `/api/miroshark/latest` or similar
   - UI: Internal connector, toggleable

3. **Boardroom** — Initiates plan mode for Desk-wide narrative investigation
   - When active: Harper enters a structured investigation flow:
     1. Gathers detailed non-technical information about the narrative
     2. Launches Desk-wide investigation across agents (Oracle, Feucht, Consul, Herald)
     3. Reviews catalysts discovered during research
     4. Inserts new catalysts into RiskFlow DB
   - This is like `/solvys-orchestrate` but for in-app analyst research
   - UI: Internal connector, toggleable

### MCP Connectors (external MCP servers)
These are real MCP servers. Ensure they appear and can be toggled:

4. **Notion** — Already in `.mcp.json` with API key auth. Should show as active.
5. **Exa** — Already in `.mcp.json`. Should show as active.
6. **Unusual Whales** — Needs MCP server setup. NPM package: `unusual-whales-mcp` or similar. Add to `.mcp.json` and backend known servers registry. Must expose all available data endpoints.
7. **TradingView** — Already in `.mcp.json` as `tradingview-mcp-server`. Should show as active.

## Implementation Plan

### Step 1: Add Internal Connector Type
In `frontend/types/mcp.ts`, extend `McpServerConfig` to support internal connectors:
```typescript
export type ConnectorSource = 'claude' | 'project' | 'internal';
// Add to McpServerConfig: source?: ConnectorSource
```

### Step 2: Register Internal Connectors
In `frontend/hooks/useMcpConnectors.ts` or a new `internalConnectors.ts`, define the 3 internal connectors with their metadata. Merge them into the connector list alongside MCP servers.

### Step 3: Unusual Whales MCP Setup
Research the correct NPM package for Unusual Whales MCP server. Add to `.mcp.json`:
```json
"unusual-whales": {
  "command": "npx",
  "args": ["-y", "unusual-whales-mcp-server"],
  "env": { "UW_API_KEY": "${UW_API_KEY}" }
}
```
Add to backend known servers registry in `backend-hono/src/routes/mcp/index.ts`.

### Step 4: Ensure MCP Connectors Show Active
The backend `/api/mcp` endpoint reads `.mcp.json` and returns server configs. Verify exa, notion, tradingview show as `enabled: true` by default (not in disabled list at `~/.fintheon/mcp-disabled.json`).

### Step 5: Wire Internal Connectors to Harper Context
When an internal connector is active, inject relevant context into Harper's system prompt. This happens in `backend-hono/src/services/harper-handler.ts` in the `harperChat()` function where `buildFeedContext()` is called.

## Constraints
- Never bypass auth (Supabase JWT enforced)
- Backend is launchd-managed (`io.solvys.fintheon-backend`), must `launchctl unload` before restart
- Always `bun run build` (not just tsc) after backend changes
- Add changelog entry to `src/lib/changelog.ts`
- Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6
