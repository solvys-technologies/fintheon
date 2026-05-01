# Sprint Brief: S56 — Arbitrum Chamber Settings & Health Panel (single-agent)

## Intent

The Arbitrum chamber's 5 seats all run the same model (`deepseek-reasoner`) at the same temperature (0.6) with near-identical inline system prompts. Divergence comes only from the persona name string — not enough to prevent groupthink. TP needs a developer-facing settings and health panel inside the chamber view that (a) surfaces chamber health diagnostics at a glance, (b) lets TP edit each seat's system prompt with copy-paste, (c) assigns per-seat context sources via checkbox, and (d) selects a per-seat RiskFlow category filter. All gated behind the existing developer password. No runtime changes to the deliberation engine beyond appending the stored override prompt to each seat's system instructions.

## Branch Target

`S56-arbitrum-settings-health-panel`

## Scope — Included

- [ ] **Health endpoint**: `GET /api/arbitrum/health` — returns API reachability, context injection status, last confidence per seat, last verdict metadata
- [ ] **Seat overrides endpoints**: `GET /api/arbitrum/seats/overrides` (public read) + `PUT /api/arbitrum/seats/overrides` (JWT-gated write) — backed by Supabase `arbitrum_seat_overrides` table
- [ ] **Engine integration**: `buildSeatSystemPrompt()` in `seats.ts` appends `seat_override_prompt` from overrides when present
- [ ] **Gear icon** in top-right corner of `ArbitrumChamber` — click opens `ArbitrumSettingsPanel` as an overlay inside the chamber viewport
- [ ] **Admin password modal** — reuses `DevPasswordGate` component, centered in-chamber, triggers on first settings open per session
- [ ] **Health expandable chevron rows** — three rows: Context Injection, API Status, Last Confidence Reading — each expands with sub-status indicators
- [ ] **Edit Agent Instructions CTA** — button at bottom of health panel, transitions to the seat editor view
- [ ] **Per-seat prompt editor** — textarea per seat (Harper/Oracle/Feucht/Consul/Herald), prefilled with current system prompt, copy-paste ready
- [ ] **Source citation checklist** — scrollable list of context source toggles (Econ Prints, Commentary Transcripts, RiskFlow Feed, IV Simulation, Cross-Seat Drafts) per seat, checkboxes
- [ ] **RiskFlow category dropdown** — per-seat dropdown filtering which RiskFlow categories the seat sees during deliberation (geopolitical, monetary-policy, earnings-corporate, market-structure, political, black-swan, all)
- [ ] **Save / Reset buttons** — save writes to Supabase via PUT endpoint (JWT-gated), reset clears overrides back to factory defaults

## Scope — Excluded (OUT OF BOUNDS)

- Changing the model, provider, temperature, or weight of any seat (those stay in the hardcoded `ARBITRUM_SEATS` array)
- Modifying the MoA (Mixture-of-Agents) 2-layer architecture
- Adding new AI providers or routing paths
- Changing the Chamber round logic or facilitator synthesis
- Any changes to the mobile PWA or Electron desktop surfaces
- Live RiskFlow feed injection into the seat editor (the dropdown selector is a filter, not a live feed viewer)
- Changing the developer password or auth mechanism

## Known Issues to Preserve

- `ARBITRUM_SEATS` array in `seats.ts:24-80` is `as const` — keep it immutable; overrides are additive
- `deepseek-reasoner` is the only active model path; OpenRouter is explicitly blocked for Arbitrum seats (`adapters.ts:153-157`)
- The compartment is rendered inside `Sanctum.tsx:267-273` as a grid cell — the overlay must respect the chamber container boundary, not the full Sanctum viewport
- `useArbitrumLatest()` polls every 60s; the settings panel should not trigger extra polls
- Recent changelog entries at `src/lib/changelog.ts` lines ~720-750 (S54/S55 RiskFlow operator control, econ live race) — do not revert

## Design Pass

### Layout / Interaction

**Chamber top-right gear icon:**

```
[ Arbitrum Chamber   ·   Round 1 of 3          ]  [⚙]
```

- Gear icon: 14px line icon, `--fintheon-accent` at 50% opacity, hover → 85%
- Click → opens settings panel overlay

**Overlay behavior:**

- Panel slides in from the right edge of the chamber container (not the Sanctum)
- Width: 100% of chamber on narrow, 420px on wider viewports
- Frosted-glass surface: `rgba(10, 9, 5, 0.85)` background, `backdrop-filter: blur(18px) saturate(1.08)`, `border: 1px solid rgba(199, 159, 74, 0.14)`
- Z-index above chamber content, below nothing else in the Sanctum page
- Close button (X) in top-right corner
- Press Escape to close (keyboard listener mounted when panel open)

**States:**

| State                       | What renders                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------- |
| Closed                      | Gear icon only in top-right of chamber header                                      |
| Opening — not authenticated | DevPasswordGate modal centered in-chamber                                          |
| Opening — authenticated     | Settings panel slides in                                                           |
| Loading health data         | Compact [LOADING...] text in panel header                                          |
| Health loaded               | Expandable chevron rows + CTA button                                               |
| Editing instructions        | Per-seat editor view (replaces health view in panel)                               |
| Saving                      | Inline [SAVING...] status, then [SAVED]                                            |
| Error on save               | Inline [ERROR: reason] status                                                      |
| Resetting                   | Confirmation text "Reset all seat overrides to factory defaults?" + Confirm/Cancel |

**Expandable chevron rows:**

```
┌─────────────────────────────────────────────────────┐
│ ▼ Context Injection ........................... [✓] │
│   ┌─────────────────────────────────────────────┐   │
│   │ Econ Prints       ● active  (7 prints, 5d)  │   │
│   │ Commentary        ● active  (3 transcripts) │   │
│   │ IV Simulation     ○ absent                  │   │
│   └─────────────────────────────────────────────┘   │
│ ▶ API Status ..................................     │
│ ▶ Last Confidence Reading .....................     │
└─────────────────────────────────────────────────────┘
```

- Chevron: `▶` (collapsed) / `▼` (expanded), monospace 10px
- Row click anywhere (not just chevron) toggles expand
- Sub-indicators: `●` active (accent color), `○` absent (muted 40%), `◐` degraded (warning color)
- Each sub-indicator row shows: status icon + label + detail text

**Agent Instruction Editor (panel interior):**

```
┌─────────────────────────────────────────────────────┐
│ Agent Instructions                        [✕ close] │
│                                                     │
│ Seat: Harper (Lead Analyst)                         │
│ ┌───────────────────────────────────────────────┐   │
│ │ System Prompt                                   │
│ │ ┌─────────────────────────────────────────┐    │
│ │ │ You are the "Lead Analyst" seat of the   │    │
│ │ │ Arbitrum deliberation chamber...         │    │
│ │ │                                         │    │
│ │ │ [editable, monospace 11px, min-h 160px] │    │
│ │ └─────────────────────────────────────────┘    │
│ └───────────────────────────────────────────────┘   │
│                                                     │
│ Context Sources                                     │
│ ☑ Econ Prints       ☑ Commentary Transcripts       │
│ ☑ RiskFlow Feed     ☐ IV Simulation               │
│ ☑ Cross-Seat Drafts                                │
│                                                     │
│ RiskFlow Category Filter                            │
│ ┌─────────────────────────────────────────────┐     │
│ │ All Categories                    ▾         │     │
│ │ ─────────────────────────────────────       │     │
│ │ ● All Categories                            │     │
│ │   Geopolitical                              │     │
│ │   Monetary Policy                           │     │
│ │   Earnings / Corporate                      │     │
│ │   Market Structure                          │     │
│ │   Political                                 │     │
│ │   Black Swan                                │     │
│ └─────────────────────────────────────────────┘     │
│                                                     │
│ Seat Tabs: [Harper] [Oracle] [Feucht] [Consul] ...  │
│                                                     │
│ [ Reset to Factory ]         [ Save All Changes ]    │
└─────────────────────────────────────────────────────┘
```

- Seat tabs: horizontal row, selected seat has accent bottom border 1px
- Prompt textarea: monospace JetBrains Mono 11px, dark transparent bg, accent border on focus
- Source checkboxes: 10px monospace labels, accent color check
- Category dropdown: custom select matching Solvys input style
- Save/Reset: secondary button style

### API / Service Shape

**`GET /api/arbitrum/health`** (public, no auth)

```json
{
  "timestamp": "2026-04-30T...",
  "api_status": {
    "deepseek_reachable": true,
    "deepseek_api_key_set": true,
    "last_latency_ms": 3421,
    "last_error": null
  },
  "context_injection": {
    "econ_context_loaded": true,
    "econ_prints_count": 7,
    "commentary_loaded": true,
    "commentary_entries_count": 3,
    "iv_simulation_present": false,
    "riskflow_feed_injected": false
  },
  "last_confidence": {
    "verdict_id": "abc-123",
    "created_at": "2026-04-30T...",
    "seats": [
      { "id": "lead", "displayName": "Harper", "confidence": 0.72 },
      { "id": "forecaster", "displayName": "Oracle", "confidence": 0.68 },
      { "id": "risk", "displayName": "Feucht", "confidence": 0.55 },
      { "id": "quant", "displayName": "Consul", "confidence": 0.61 },
      { "id": "bear", "displayName": "Herald", "confidence": 0.59 }
    ],
    "chamber_confidence": 0.63
  },
  "chamber_state": "idle" // "idle" | "running" | "degraded"
}
```

**`GET /api/arbitrum/seats/overrides`** (public read)

```json
{
  "overrides": [
    {
      "seat_id": "lead",
      "seat_prompt": "You are the Lead Analyst... (full current prompt + any override)",
      "override_prompt": "Additionally, you must... (the override portion only)",
      "context_sources": [
        "econ_prints",
        "commentary",
        "riskflow_feed",
        "cross_seat_drafts"
      ],
      "category_filter": "all",
      "has_override": false,
      "updated_at": null
    }
    // ... 5 seats
  ]
}
```

**`PUT /api/arbitrum/seats/overrides`** (JWT-gated — `authMiddleware` + `requireAuth` + `requireSuperadmin`)

Request:

```json
{
  "overrides": [
    {
      "seat_id": "lead",
      "override_prompt": "Additionally, you must prioritize earnings data over macro trends. When in doubt, take the contrarian view.",
      "context_sources": [
        "econ_prints",
        "commentary",
        "riskflow_feed",
        "cross_seat_drafts"
      ],
      "category_filter": "earnings-corporate"
    }
    // partial — only seats with changes
  ]
}
```

Response:

```json
{ "ok": true, "updated": 3 }
```

**Seat override storage** — Supabase table `arbitrum_seat_overrides`:

```sql
CREATE TABLE IF NOT EXISTS public.arbitrum_seat_overrides (
  seat_id TEXT PRIMARY KEY,
  override_prompt TEXT DEFAULT '',
  context_sources TEXT[] DEFAULT '{}',
  category_filter TEXT DEFAULT 'all',
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: authenticated users can read; only admin role can insert/update/delete
```

### Engine Integration (seats.ts)

In `buildSeatSystemPrompt()`, after the base prompt, append the override if present:

```typescript
async function buildSeatSystemPrompt(
  seat: ArbitrumSeatConfig,
): Promise<string> {
  let prompt = `You are the "${seat.role}" seat...`;

  // Append seat override if it exists
  const override = await loadSeatOverride(seat.id);
  if (override && override.override_prompt.trim().length > 0) {
    prompt += `\n\n## Seat-Specific Instructions (Override)\n${override.override_prompt}`;
  }

  // Append context source availability (so seat knows what it has)
  if (override?.context_sources?.length) {
    prompt += `\n\n## Available Context Sources\n${override.context_sources.join(", ")}`;
  }

  // Append category filter instruction
  if (override?.category_filter && override.category_filter !== "all") {
    prompt += `\n\n## Category Focus\nPrioritize analysis through the lens of: ${override.category_filter}`;
  }

  return prompt;
}
```

### Data / Agent Shape

- **Supabase table**: `arbitrum_seat_overrides` (new)
- **RLS**: Read — authenticated users; Write — admin role only
- **Agent**: No specific agent — this is a tool surface for TP, not a deliberation output
- **Prompt shape**: The override prompt is appended verbatim after the base seat system prompt. No LLM interpretation or rewriting.
- **Fallback**: When `arbitrum_seat_overrides` table read fails or returns empty, `buildSeatSystemPrompt()` behaves exactly as it does today — no overrides appended. The chamber runs normally.

### Aesthetic Rules

- Frosted-glass overlay panel: `rgba(10, 9, 5, 0.85)` bg, `blur(18px)`, thin gold border
- No gradients, no emojis, no Kanban borders, no generic shadows
- Monospace for all data values, seat names, and prompt text
- Chevron expand icons: monospace `▶`/`▼` at 10px
- Status dots: `●` accent for active, `○` muted for absent, `◐` warning for degraded
- Accent used ONLY for: gear icon hover, active status dots, selected seat tab underline, save button, focus borders on inputs
- Text input area: dark transparent bg, thin accent border, JetBrains Mono 11px
- Seat tab selector: 10px tracking-wider uppercase labels, accent bottom border on active
- Transition: opacity 200ms on panel open/close, respects `prefers-reduced-motion`

## Development Flow

1. **Supabase migration** — create `arbitrum_seat_overrides` table + RLS policies
2. **Backend types** — extend `arbitrum/types.ts` with override types; add route types
3. **Backend service** — `arbitrum/seats.ts`: extract `loadSeatOverride()`, modify `buildSeatSystemPrompt()`; `arbitrum/index.ts`: export health+override loaders
4. **Backend routes** — `GET /api/arbitrum/health`, `GET /api/arbitrum/seats/overrides`, `PUT /api/arbitrum/seats/overrides` in `routes/arbitrum/index.ts`
5. **Route mounting** — add `PUT /api/arbitrum/seats/overrides` with `authMiddleware` + `requireAuth` + `requireSuperadmin` in `routes/index.ts`
6. **Frontend types** — extend `components/arbitrum/types.ts` with health/override types
7. **Frontend hooks** — `useArbitrumHealth.ts` + `useArbitrumSeatOverrides.ts`
8. **Frontend components** — `ArbitrumSettingsPanel.tsx` (main panel with health + editor modes), modify `ArbitrumChamber.tsx` (gear icon + overlay mount)
9. **Validation** — tsc, build, curl smoke tests, Playwright visual check
10. **Changelog + headers** — entry in `src/lib/changelog.ts`, file headers on new/modified files

## Acceptance Criteria

- [ ] Gear icon visible in top-right of ArbitrumChamber, click opens DevPasswordGate modal
- [ ] Correct password (PricedInResearch122356, hash `4d4bbd3...`) unlocks the settings panel
- [ ] Panel overlays chamber content, frosted-glass surface, closeable via X button or Escape key
- [ ] Health chevron rows expand/collapse on click, showing sub-status indicators with correct status colors
- [ ] Context Injection row shows econ/commentary/IV counts from latest verdict
- [ ] API Status row shows DeepSeek reachability and last latency
- [ ] Last Confidence Reading row shows per-seat confidence + chamber aggregate
- [ ] "Edit Agent Instructions" CTA transitions panel to seat editor mode
- [ ] Seat tabs switch between Harper/Oracle/Feucht/Consul/Herald
- [ ] Each seat's prompt textarea is editable, prefilled with current system prompt
- [ ] Source checkboxes per seat toggle context sources, persist on save
- [ ] RiskFlow category dropdown per seat selects filter, persists on save
- [ ] Save writes to Supabase via PUT endpoint; changes reflected in next deliberation
- [ ] Reset clears overrides back to empty; confirmation dialog appears before reset
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] `curl -s http://localhost:8080/api/arbitrum/health` returns valid JSON
- [ ] `curl -s http://localhost:8080/api/arbitrum/seats/overrides` returns overrides array
- [ ] `curl -s -X PUT http://localhost:8080/api/arbitrum/seats/overrides -H "Content-Type: application/json" -H "Authorization: Bearer SUPABASE_JWT" -d '{...}'` writes and returns ok (with valid admin JWT)
- [ ] Chamber deliberation still runs successfully with overrides appended to prompts
- [ ] Changelog entry added to `src/lib/changelog.ts`
- [ ] File header `// [claude-code 2026-04-30]` added to substantially modified files
- [ ] All new files under 300 lines

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Health endpoint smoke test
curl -s http://localhost:8080/api/arbitrum/health | head -c 400

# Seat overrides read smoke test
curl -s http://localhost:8080/api/arbitrum/seats/overrides | head -c 400

# Deliberation still works (no overrides)
curl -s -X POST http://localhost:8080/api/arbitrum/deliberate \
  -H "Content-Type: application/json" \
  -d '{"question":"Test: SPX direction this week?","category":"test"}' | head -c 300
```

## Commit Format

```
[S56] feat: Arbitrum chamber settings & health panel — per-seat prompt overrides, context source checkboxes, RiskFlow category filters, health diagnostics
```
