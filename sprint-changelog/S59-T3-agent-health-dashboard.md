# Sprint Brief: S59-T3 — Agent Health Dashboard + Persona Status UI

## Context

The Apparatus section (`frontend/components/apparatus/`) currently has an `ApparatusMap.tsx` flow map and `MemoryCard.tsx` but no unified agent health dashboard. With S59 activating REFLECT, GEPA, and persona unification across all 5 agents, traders need a single pane of glass showing per-agent health: SOUL load status, REFLECT score, memory count, GEPA optimization runs, and persona identity verification. This track builds that dashboard for desktop and mobile PWA.

## Branch Target

`s59-hermes-native` (shared)

## Design Rules — `/solvys-feels` Mandatory

- **Palette**: BG #050402, Accent #c79f4a (Solvys Gold), Text #f0ead6
- **Materials**: Glassmorphic surfaces (translucent bg + backdrop-blur + thin gold accent border). No Kanban borders, no card grids, no gradients, no emojis, no AI sparkles, no generic shadows.
- **Typography**: System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui`). Tabular numbers for all numeric data.
- **Motion**: Subtle, interruptible, respects `prefers-reduced-motion`.
- **Pattern**: Follow existing diagnostic surface patterns — `frontend/components/diagnostics/` for layout conventions.

## Scope — Included

### Desktop Frontend

- [ ] **NEW**: `frontend/components/apparatus/AgentHealthDashboard.tsx` — main dashboard component. Glassmorphic panel showing all 5 agents in a vertical stack. Each agent row shows:
  - Agent name + role + indicator dot (green = SOUL loaded / yellow = fallback / red = error)
  - SOUL version/load status (last loaded timestamp)
  - REFLECT score (last run date + calibration metric)
  - Memory count (total memories stored for this agent)
  - GEPA status (last optimization run + PRs open)
  - Persona health badge (native_home intact / missing / stale)
- [ ] **NEW**: `frontend/hooks/useAgentHealth.ts` — fetches agent health data from `/api/diagnostics` (GEPA + agent-memory stats). Polls every 60s.
- [ ] **NEW**: `frontend/components/apparatus/AgentHealthRow.tsx` — individual agent row with expandable detail. Click to expand shows: REFLECT findings, recent memories, GEPA optimization candidates.
- [ ] **NEW**: `frontend/components/apparatus/PersonaBadge.tsx` — compact badge showing native_home status. Gold when intact, amber when missing fields, red when not loaded.
- [ ] Update `frontend/components/apparatus/ApparatusMap.tsx` — add Agent Health as a new section/link in the Apparatus flow map.
- [ ] Update `frontend/components/diagnostics/` — add agent health section to the diagnostics route if it surfaces diagnostic data.

### Backend — Health Endpoint Extension

- [ ] Update `backend-hono/src/routes/diagnostics/index.ts` — add agent persona health to diagnostics output. Include per-agent:
  - `soulLoaded`: boolean (SOUL.md loaded successfully?)
  - `soulVersion`: string (schema_version from SOUL)
  - `nativeHomeIntact`: boolean (all native_home fields present?)
  - `reflectScore`: number (last calibration metric, or null)
  - `reflectLastRun`: string (ISO timestamp)
  - `memoryCount`: number (total agent_memory rows)
  - `gepaLastRun`: string (ISO timestamp, or null)
  - `gepaOpenPrs`: number (open PRs in soul-evolution/)
  - `personaHealth`: "green" | "amber" | "red"
- [ ] Add a dedicated GET route: `GET /api/apparatus/agent-health` returning the above per-agent payload

### Mobile PWA

- [ ] **NEW**: `mobile/components/apparatus/AgentHealthDashboard.tsx` — mobile-optimized agent health view. Stacked rows, tap to expand. Same data as desktop, responsive layout.
- [ ] Update mobile navigation to include Apparatus → Agent Health route

## Scope — Excluded (DO NOT TOUCH)

- Backend business logic — T1 and T2 own backend changes
- SOUL.md files — T2 owns persona content
- Harper chat, RiskFlow feed, Sanctum — must not regress
- GEPA runner logic — T2 owns GEPA activation
- `ApparatusFlowMap.tsx` complete restructure — just add a link, don't redesign the whole thing

## Reuse Inventory (existing code to call, not reinvent)

- `loadGepaDiagnostics()` at `backend-hono/src/routes/diagnostics/index.ts:560` — already loads GEPA stats dynamically. Use for the gepa fields in the health endpoint.
- `getMemories()` at `backend-hono/src/services/agent-memory/memory-store.ts` — returns memories for an agent. Use for memory count.
- `loadSoul()` at `backend-hono/src/services/ai/soul/loader.ts:70` — use to verify SOUL load status. If it throws/returns null for an agent, soulLoaded = false.
- `ApparatusMap.tsx` at `frontend/components/apparatus/ApparatusMap.tsx` — existing Apparatus entry point. Add route/link here.
- Existing diagnostic component patterns at `frontend/components/diagnostics/` — follow their layout conventions.
- `MemoryCard.tsx` at `frontend/components/apparatus/MemoryCard.tsx` — may be repurposed or referenced for visual consistency.

## Known Issues to Preserve

- Diagnostics endpoint is large (~800 lines). Be surgical — add the agent health section without refactoring the whole file.
- Mobile PWA shares Tailwind config with desktop — don't add mobile-specific breakpoints that break desktop.
- The Apparatus currently shows agent flow maps and commandments. Agent Health is a new section, not a replacement.
- GEPA diagnostics in the diagnostics endpoint is a dynamic import (`import("../services/gepa/runner.js")`) — handle the case where GEPA is not enabled gracefully.

## Implementation Steps

1. **Backend: extend diagnostics**. Add agent health section to `routes/diagnostics/index.ts`. For each of the 5 agents, compute: soulLoaded, soulVersion, nativeHomeIntact, reflectScore, reflectLastRun, memoryCount, gepaLastRun, gepaOpenPrs, personaHealth.
2. **Backend: add dedicated route**. Create `GET /api/apparatus/agent-health` in a new route file `backend-hono/src/routes/apparatus/agent-health.ts`. Register in the main route index.
3. **Frontend: useAgentHealth hook**. Fetch from `/api/apparatus/agent-health`. 60s polling. Return typed `AgentHealthData[]`.
4. **Frontend: AgentHealthRow component**. Glassmorphic row with agent name, role, status dot, key metrics inline. Expandable detail panel on click.
5. **Frontend: PersonaBadge component**. Compact gold/amber/red badge showing native_home status.
6. **Frontend: AgentHealthDashboard**. Compose rows + badges. Follow existing Apparatus visual conventions (translucent bg + backdrop-blur + thin gold border).
7. **Frontend: wire into ApparatusMap**. Add "Agent Health" entry point.
8. **Mobile: AgentHealthDashboard**. Same data, mobile layout. Stacked rows, no horizontal scrolling.
9. **Mobile: wire navigation**. Add Apparatus → Agent Health route.

## Acceptance Criteria

- [ ] `GET /api/apparatus/agent-health` returns health data for all 5 agents
- [ ] Desktop AgentHealthDashboard renders with all 5 agents, status dots, metrics
- [ ] Clicking an agent row expands to show REFLECT findings and recent memories
- [ ] PersonaBadge shows gold/green when native_home is intact
- [ ] Mobile PWA shows agent health at responsive breakpoints
- [ ] No visual regressions on Apparatus or Diagnostics pages
- [ ] `/solvys-feels` rules met: no gradients, no emojis, no Kanban borders, no AI sparkles
- [ ] Frontend builds clean: `rm -rf dist && npx vite build`
- [ ] Frontend type-checks: `npx tsc --noEmit --project frontend/tsconfig.json`
- [ ] Mobile builds clean: `cd mobile && rm -rf dist && npx vite build`

## Validation Commands

```bash
# Backend typecheck
cd backend-hono && npx tsc --noEmit

# Backend build
cd backend-hono && bun run build

# Restart backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Test agent health endpoint
sleep 2 && curl -s http://localhost:8080/api/apparatus/agent-health | head -c 500

# Desktop frontend typecheck + build
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Mobile typecheck + build
npx tsc --noEmit --project mobile/tsconfig.json
cd mobile && rm -rf dist && npx vite build
```

## Commit Format

```
[v6.0.15] feat: S59-T3 agent health dashboard with per-agent SOUL/memory/GEPA status
```
