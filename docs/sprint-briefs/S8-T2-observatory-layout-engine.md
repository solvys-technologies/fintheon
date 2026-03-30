# S8-T2: Observatory Layout Engine + Canvas Command Palette

**Sprint**: S8 — The Mega Sprint
**Track**: T2 (after T1)
**Branch**: `v.8.28.1`

## Context
The Observatory map currently uses a flat 6-column grid layout inside dashed-border narrative groups. This track replaces it entirely with a force-directed cloud simulation where 10 narrative threads are large hub nodes and catalyst cards orbit around them. Also builds the unified bottom bar (static toolkit + expandable command-palette chat for Claude CLI interaction).

## Files to Read First
- `frontend/components/narrative/NarrativeForceCanvas.tsx` (494 lines) — current grid layout in `layoutNodes()`, React Flow setup, node types
- `frontend/lib/narrative-force-layout.ts` (63 lines) — `FORCE_CONFIG`, `ZOOM_THRESHOLDS`, `CATEGORY_CENTERS`, `severityRadius()`
- `frontend/lib/narrative-types.ts` (215 lines) — CatalystCard, NarrativeCategory types
- `frontend/components/narrative/NarrativeFloatingToolbar.tsx` (159 lines) — current toolbar tools
- `frontend/components/narrative/NarrativeFlow.tsx` (174 lines) — wrapper, state management
- `frontend/components/narrative/CatalystCard.tsx` (223 lines) — card rendering

## Files to Create
1. `frontend/components/narrative/NarrativeHubNode.tsx` (<150 lines) — Large hub node for each narrative thread
2. `frontend/components/narrative/NarrativeSummaryCard.tsx` (<150 lines) — Collapsed summary at zoom-out
3. `frontend/components/narrative/NarrativeCanvasChat.tsx` (<200 lines) — Ephemeral command palette chat

## Files to Modify
- `frontend/components/narrative/NarrativeForceCanvas.tsx` — Replace `layoutNodes()` with d3-force simulation, register new node types, add drag physics
- `frontend/lib/narrative-force-layout.ts` — Update force config, may need new parameters
- `frontend/components/narrative/NarrativeFloatingToolbar.tsx` — Refactor into unified bottom bar
- `frontend/components/narrative/NarrativeFlow.tsx` — Wire new components, zoom state tracking

## Implementation

### 1. Force-Directed Layout (replace `layoutNodes()`)
Replace the grid layout entirely with d3-force simulation:

```
forceCenter → Trump Presidency as gravitational center (most connections)
forceLink → shared events between narratives = attraction
forceManyBody → repulsion to prevent overlap (charge: -120 from FORCE_CONFIG)
forceCollide → minimum spacing between clusters
```

**Cluster proximity rules:**
- Rate Cuts + Price Stability cluster (shared monetary policy events)
- Middle East + Trade War cluster (shared geopolitical events)
- Trump Presidency central (connects to everything)

**Simulation lifecycle:**
1. On mount: create d3-force simulation with all nodes
2. Nodes drift into position over 2-3s (alpha decay: 0.015)
3. After settle: CSS breathing animation takes over (no more JS computation)
4. On data change: `simulation.alpha(0.3).restart()`

**Spring physics on drag (/overdrive):**
- Drag a node → `simulation.alpha(0.3).restart()`
- Neighbors follow with spring tension
- Release → overshoot + settle with d3's velocity decay (0.3)

### 2. NarrativeHubNode Component
Large, prominent node for each of the 10 narrative threads:
- Thread name in `var(--font-heading)`, 16px semi-bold
- Event count badge
- Colored indicator dot (from `NARRATIVE_THREADS[].color`)
- Size: ~180x100px (significantly larger than catalyst cards)
- Subtle glow matching thread color at low opacity
- Register as `narrativeHub` node type in React Flow

### 3. Zoom State Machine
Use existing `ZOOM_THRESHOLDS`:
- **fullCard** (zoom > 0.7): Full catalyst cards with details + narrative hubs
- **miniCard** (0.3-0.7): Compact cards (title + severity badge) + hubs
- **bubble** (0.15-0.3): NarrativeSummaryCard per thread (name, count, top 3 events)
- **dot** (zoom < 0.15): Minimal dot per thread with label

Track current zoom level via `onMove` callback → swap node types dynamically.

### 4. NarrativeSummaryCard Component
Renders at bubble zoom level:
- Narrative thread name (heading)
- Event count badge
- Top 3 most recent event titles as preview list
- Color indicator from thread color
- **Single click**: Expand inline to show top 5 events
- **Double-click**: `reactFlowInstance.fitView({ nodes: [nodesInThisNarrative] })` to auto-zoom

### 5. Unified Bottom Bar
**Toolbar section** (static, always visible):
- All existing tools: Select (V), Hand (Space), Multi-select (M), Highlight (H)
- Actions: Add, Import, Heatmap, Filter
- Zoom controls (Figma-style dropdown from T1)
- No changes to tool behavior

**Chat input section** (expandable, above toolbar):
- Mini one-line input when collapsed: placeholder "Ask Harper-Opus..."
- Persona indicator (green dot + agent name)
- Pulsing icon (replaces Think Harder — icon only pulses, no bg/border)
- **Expand**: Click input or start typing → grows upward
- **Ephemeral response**: Claude responds → popup appears above toolbar → auto-hides after 8s → closeable (slides down into input bar). No conversation history on canvas.
- Same Claude CLI session as sidebar Ask Harp

**Card interaction:**
- `+` icon on catalyst cards → click sends card data to chat input as preview chip
- Drag-and-drop card into input → shows preview chip → user types context alongside
- Claude processes card context + user prompt → can modify card, connect to narrative, etc.

### 6. Breathing Motion
After force simulation settles:
- Node entrance: staggered fade-in + scale 0.8→1.0, 50ms delay between nodes (CSS)
- Hub nodes: subtle scale pulse 1.0→1.01→1.0 over 6s (CSS)
- Catalyst cards: gentle position drift (not JS — CSS transform with slight random offsets)

## Key Rules
- **NarrativeForceCanvas stays as one file** — do not split it
- Use existing `NARRATIVE_THREADS` constant (10 threads, lines 170-181)
- Use existing `THREAD_COLOR_MAP` for hub node colors
- All cards must keep their existing data shape (`CatalystCard` type)
- d3-force runs client-side only (no server computation)
- `npm install d3-force @types/d3-force` if not already present

## Verification
1. `bun run build` — clean
2. NarrativeFlow shows 10 narrative hub nodes as large prominent bubbles
3. Catalyst cards orbit around their narrative hubs
4. Force simulation settles in 2-3 seconds
5. Dragging a node causes spring physics on neighbors
6. Zoom out → summary cards appear at bubble threshold
7. Single-click summary → inline preview. Double-click → auto-zoom.
8. Bottom bar: toolkit always visible, chat input expandable
9. Type in chat → ephemeral response popup → auto-hides

## Changelog Entry
```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S8-T2: Force-directed Observatory layout, narrative hub nodes, zoom state machine, unified bottom bar with command palette chat', files: ['frontend/components/narrative/NarrativeForceCanvas.tsx', 'frontend/components/narrative/NarrativeHubNode.tsx', 'frontend/components/narrative/NarrativeSummaryCard.tsx', 'frontend/components/narrative/NarrativeCanvasChat.tsx', 'frontend/components/narrative/NarrativeFloatingToolbar.tsx', 'frontend/lib/narrative-force-layout.ts'] }
```

## DO NOT
- Do NOT fix bugs (T1 handles that)
- Do NOT redesign rope/edge visuals (T3 owns ropes)
- Do NOT change card visual design (T4 owns anti-default design)
- Do NOT touch Aquarium/Sanctum (T4 owns that)
- Do NOT rename MiroFish (T5 owns that)
