# Sprint Brief: S56 — Arbitrum Settings + Sanctum Restructure + Dashboard Signals + Mobile Menu (single-agent)

## Intent

TP gets a fully-aligned Arbitrum surface across desktop and mobile. The Chamber finally publishes its briefing where the briefing belongs; risk signals live where they have audience (Dashboard right rail); the Volatility Read reads as one block instead of two cards; instrument cards stop duplicating Chamber-owned conviction copy; the developer can open a gear-gated panel inside the Chamber to inspect health and edit per-seat prompts without redeploying; and on mobile, the main menu behaves like Twitter — content slides right to reveal a left drawer with TP's profile and primary navigation, instead of the current bottom-up sheet.

## Branch Target

`S56-arbitrum-settings-health-panel` (cut from current `v.5.29.1-s53-refinement-riskflow-sync`)

## Scope — Included

### Track A: Arbitrum Settings + Health Panel

- [ ] Supabase migration: `arbitrum_seat_overrides` table + RLS (read: authenticated; write: admin)
- [ ] `GET /api/arbitrum/health` — public, returns API/context/last-confidence/chamber-state
- [ ] `GET /api/arbitrum/seats/overrides` — public read, returns 5-seat override array
- [ ] `PUT /api/arbitrum/seats/overrides` — JWT + `requireSuperadmin`, partial-seat updates
- [ ] `buildSeatSystemPrompt()` appends override prompt + context-source list + category filter
- [ ] Gear icon top-right of `ArbitrumChamber`, opens `ArbitrumSettingsPanel` overlay scoped to the chamber container (NOT the full Sanctum viewport)
- [ ] DevPasswordGate centered in-chamber on first open per session
- [ ] Health view: 3 expandable chevron rows (Context Injection, API Status, Last Confidence Reading)
- [ ] "Edit Agent Instructions" CTA transitions to seat editor mode
- [ ] Per-seat prompt textarea (Harper/Oracle/Feucht/Consul/Herald), source checkboxes, RiskFlow category dropdown
- [ ] Save (PUT) + Reset-to-factory (with confirmation) buttons
- [ ] Escape closes panel; transitions respect `prefers-reduced-motion`

### Track B: Sanctum Arbitrum view restructure

- [ ] In `Sanctum.tsx:240-294` brief-pattern container, swap right-bottom slot from `<ArbitrumRiskSignals />` to `<SanctumBriefing briefing={data?.briefing} isLoading={isLoading} noBorder />`
- [ ] Restructure `BlendedIVForecastCard.tsx`:
  - Forecast main fuse + confidence on TOP
  - Three scenarios (Continuation / Risk-on rally / Headline escalation) reflowed into ONE row with prob+score inline
  - Blended IV components (VIX / Headlines / Agent Desk) rendered BELOW
  - Drop the regime-shift bips line
- [ ] `ArbitrumChamberPredictionCards.tsx`:
  - Remove "Heat" label at top-left of heat fuse (lines 160–162)
  - Replace conviction tag (lines 187–195) with a "MARKET HEAT" label in the same slot
  - Drop the Drivers section + data-point footer (lines 199–210)

### Track C: Dashboard Arbitrum risk signals (desktop only)

- [ ] In `MainDashboard.tsx:377-389`, beneath the bare `<DayCard />` in the right column, mount a Chamber Risk Signals block (reuse `ArbitrumRiskSignals` directly with a thin wrapper for the header)
- [ ] Header label: `KanbanTitle title="Chamber Risk Signals" tone="gold"` (matching Core KPIs / Regime Tracker / RiskFlow style)
- [ ] Chevron-collapsible (parity with Core KPIs / Regime Tracker)
- [ ] Reuse `useArbitrumLatest()` — no new poller

### Track D: Mobile Twitter-style main menu

- [ ] New `mobile/components/layout/MainMenuDrawer.tsx` — left drawer ~80vw wide, flat `--fintheon-bg` (no gradient/Kanban borders)
- [ ] Drawer header: Solvys-gold target glyph + display name (`settings.traderName` || "T.P.") + `@handle` + "X Following X Followers" counts; Add-Person icon top-right
- [ ] Primary nav rows (icon + label, large tap targets): Dashboard, Sanctum, RiskFlow, Calendar, Performance, Apparatus
- [ ] Divider (1px `--fintheon-accent/15`)
- [ ] Footer utilities: Open Harper Chat, Settings & Privacy, Help Center
- [ ] Wrap `MobileShell.tsx` `<main>` (lines 100–117) in a transformable container; on `menuOpen` apply `translateX(80vw)` with framer-motion 250ms ease-in-out
- [ ] Soft scrim (`bg-black/45 backdrop-blur-sm`) over the slid content; tap to close
- [ ] Hamburger icon in `MobileToolbar` cross-fades 150ms to a back-arrow when `menuOpen`
- [ ] Edge-swipe-from-left (≤24px from left edge, x-velocity > 0.3 OR x-distance > 60) opens the drawer
- [ ] Drag-to-close: drag the drawer leftward; release at >40% drawer width or velocity < -0.3 closes
- [ ] Retire `mobile/components/layout/HamburgerMenu.tsx` (delete file)

### Track E: Desktop shell pre-pass (already landed)

- Already in working tree — see `src/lib/changelog.ts` top entry. NavSidebar relative positioning, MainLayout middle-flex `bg-surface`, main content stripped of `rounded-l-2xl + border-l + heavy shadow`, FooterToolbar bg → surface, Epoch label legibility fix. No further action; carried in this branch.

## Scope — Excluded (OUT OF BOUNDS)

- Changing the model, provider, temperature, or weight of any seat (`ARBITRUM_SEATS` stays `as const`)
- MoA architecture changes
- New AI providers / routing paths
- Chamber round logic / facilitator synthesis
- Live RiskFlow feed injection into the seat editor (the dropdown is a filter, not a feed viewer)
- Mobile dashboard Arbitrum surface — already has `ArbitrumVerdictCard` (`mobile/components/home/HomePage.tsx:28`)
- Anything in `RiskSignalCards.tsx` (mobile dashboard primitive — separate)
- `NextSessionForecastCard.tsx` deletion — still imported by `useIVScoreData.ts` and `BlendedIVForecastCard.tsx` as a legacy fallback
- Sidebar text-color sweep beyond the Epoch label already bumped in the pre-pass

## Known Issues to Preserve

- `ARBITRUM_SEATS` array in `seats.ts:24-80` is `as const` — overrides are additive only
- `deepseek-reasoner` is the only active model path; OpenRouter blocked for Arbitrum seats (`adapters.ts:153-157`)
- `useArbitrumLatest()` polls every 60s — settings panel must not trigger extra polls
- `ROLE_DISPLAY_NAMES` in `frontend/components/arbitrum/ChamberSeats.tsx` is the seat-label source of truth
- Recent changelog entries `src/lib/changelog.ts` lines ~10–55 (S56 shell pre-pass + S54/S55 RiskFlow operator control + econ live race) — do not revert
- Mobile menu currently uses framer-motion (already a dep) — keep it, just swap transform target from `y` to `x`

## Design Pass

### Sanctum Volatility Read combined layout

```
┌─ VOLATILITY READ ─────────────────────────────────┐
│ NEXT SESSION FORECAST                  Heuristic  │
│ 3.8       Confidence ▰▰▰▰▰▰▰▰▱▱  85%              │
│                                                   │
│ Continuation 59% 3.8 │ Rally 24% 2.3 │ HE 18% 5.8 │
│ ───────                                           │
│ BLENDED IV SCORE 3.8         Light Winds          │
│ VIX        ▰▰▰▰▱▱▱▱▱▱  3.6  70% (16.9)            │
│ Headlines  ▰▰▰▰▰▱▱▱▱▱  4.0  20% (29 events)       │
│ Agent Desk ▰▰▰▰▰▱▱▱▱▱  5.0  10%                   │
└───────────────────────────────────────────────────┘
```

### Sanctum right column (chart-mode off)

```
┌─ CHAMBER ─────────────────────────────────────┐
│ Harper 6.5 │ Oracle 5.0 │ Feucht 4.0 │ ...     │
│ Chamber reads 51% on: Read the next session... │
└───────────────────────────────────────────────┘
┌─ CHAMBER BRIEFING (scrollable) ───────────────┐
│ Persistent API crude oil stock misses indicate│
│ supply tightness, reinforcing Fed officials' …│
│ Key Findings:                                 │
│   1. ...                                      │
│ Risk Alerts:                                  │
│ Harper Analysis: ...                          │
│ Consensus: 51% session-read                   │
└───────────────────────────────────────────────┘
```

(Risk signals removed from this slot. They now live on Dashboard right rail.)

### Instrument card (after rip)

```
/NQ                       — NEUTRAL
▰▰▰▰▰▱▱▱▱▱  4.7
RANGE              -69 to +71 pts
MARKET HEAT
```

### Dashboard right column (under DayCard)

```
[ DayCard bare ]
─────────────────────
CHAMBER RISK SIGNALS                ▼
─────────────────────
HERALD                          7.0
▰▰▰▰▰▰▰▱▱▱
Repeated API draws…
─────────────────────
HARPER                          6.5
▰▰▰▰▰▰▱▱▱▱
Persistent API crude oil…
…
```

### Mobile drawer (Twitter pattern, mapped to Solvys)

```
┌──────────────────────────┐ ┌── (slid main content) ──┐
│ [target glyph]   [add+]  │ │ ◀ icon (was hamburger)  │
│                          │ │                         │
│ T.P.                     │ │   FOR YOU               │
│ @handle                  │ │   (scrim 45% over)      │
│                          │ │                         │
│ 144 Following  40 Followe│ │                         │
│                          │ │                         │
│ [icon] Dashboard         │ │                         │
│ [icon] Sanctum           │ │                         │
│ [icon] RiskFlow          │ │                         │
│ [icon] Calendar          │ │                         │
│ [icon] Performance       │ │                         │
│ [icon] Apparatus         │ │                         │
│ ─────────────            │ │                         │
│ [icon] Open Harper Chat  │ │                         │
│ [icon] Settings & Privacy│ │                         │
│ [icon] Help Center       │ │                         │
└──────────────────────────┘ └─────────────────────────┘
  ~80vw                       ~20vw peek strip
```

(All icons are lucide-react line icons.)

### Aesthetic Rules

- Frosted-glass `--fintheon-glass-bg` for the desktop settings panel overlay only; flat `--fintheon-bg` for mobile drawer interior
- No gradients, no emojis, no Kanban borders, no AI sparkles, no generic shadows
- Monospace (`Doto, ui-monospace`) for all numerals + seat names + prompt text
- `--fintheon-accent` (#c79f4a) used ONLY for: gear icon hover, active status dots, selected seat tab underline, save button, focus borders, drawer profile target glyph, active nav-row tint
- Chevron expand icons monospace `▶`/`▼` 10px
- Status dots `●` accent / `○` muted / `◐` warning
- Transitions: opacity 200ms on overlay open/close; transformX 250ms ease-in-out on mobile drawer; respect `prefers-reduced-motion`

## API / Service Shape

### Endpoints (Track A)

`GET /api/arbitrum/health` — public, no auth

```json
{
  "timestamp": "...",
  "api_status": { "deepseek_reachable": true, "deepseek_api_key_set": true, "last_latency_ms": 3421, "last_error": null },
  "context_injection": { "econ_context_loaded": true, "econ_prints_count": 7, "commentary_loaded": true, "commentary_entries_count": 3, "iv_simulation_present": false, "riskflow_feed_injected": false },
  "last_confidence": { "verdict_id": "...", "created_at": "...", "seats": [...], "chamber_confidence": 0.63 },
  "chamber_state": "idle"
}
```

`GET /api/arbitrum/seats/overrides` — public read, 5-seat array. Each seat: `{ seat_id, seat_prompt, override_prompt, context_sources[], category_filter, has_override, updated_at }`.

`PUT /api/arbitrum/seats/overrides` — JWT + `requireSuperadmin`; body `{ overrides: [{ seat_id, override_prompt, context_sources[], category_filter }] }` (partial). Returns `{ ok: true, updated: N }`.

### Engine integration

In `buildSeatSystemPrompt()`, after the base prompt:

```typescript
const override = await loadSeatOverride(seat.id);
if (override?.override_prompt?.trim()) {
  prompt += `\n\n## Seat-Specific Instructions (Override)\n${override.override_prompt}`;
}
if (override?.context_sources?.length) {
  prompt += `\n\n## Available Context Sources\n${override.context_sources.join(", ")}`;
}
if (override?.category_filter && override.category_filter !== "all") {
  prompt += `\n\n## Category Focus\nPrioritize analysis through the lens of: ${override.category_filter}`;
}
```

Fallback: any read failure → no overrides appended; chamber runs as-is.

## Data / Agent Shape

```sql
CREATE TABLE IF NOT EXISTS public.arbitrum_seat_overrides (
  seat_id TEXT PRIMARY KEY,
  override_prompt TEXT DEFAULT '',
  context_sources TEXT[] DEFAULT '{}',
  category_filter TEXT DEFAULT 'all',
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: read = authenticated; write = admin role only
```

No agent owns the override prompt — it's appended verbatim, no LLM rewriting.

## Development Flow

1. **Data layer** — migration `supabase/migrations/{ts}_arbitrum_seat_overrides.sql` + RLS; push from main worktree (`supabase db push`).
2. **Backend types** — extend `backend-hono/src/services/arbitrum/types.ts` with override + health types.
3. **Backend service** — `arbitrum/seats.ts`: `loadSeatOverride()` + `buildSeatSystemPrompt()` extension; `arbitrum/index.ts`: export health + override loaders.
4. **Backend routes** — `routes/arbitrum/index.ts` with three endpoints; `routes/index.ts` adds `authMiddleware + requireAuth + requireSuperadmin` for the PUT.
5. **Backend build + smoke** — `cd backend-hono && bun run build`; `launchctl unload && load io.solvys.fintheon-backend.plist`; curl all three endpoints.
6. **Frontend types + hooks** — extend `frontend/components/arbitrum/types.ts`; new `useArbitrumHealth.ts` + `useArbitrumSeatOverrides.ts` under `frontend/hooks/`.
7. **Frontend Track A UI** — `ArbitrumSettingsPanel.tsx` (health + editor modes); modify `ArbitrumChamber.tsx` (gear icon + overlay mount).
8. **Frontend Track B (Sanctum)** — restructure `BlendedIVForecastCard`; swap right-bottom slot in `Sanctum.tsx`; rip `ArbitrumChamberPredictionCards`.
9. **Frontend Track C (Dashboard)** — mount Chamber Risk Signals beneath DayCard in `MainDashboard.tsx`.
10. **Mobile Track D** — write `MainMenuDrawer.tsx`; wrap `MobileShell.tsx <main>` in transform container; update `MobileToolbar` icon cross-fade; delete `HamburgerMenu.tsx`.
11. **Validation** — `tsc --noEmit`, `rm -rf dist && npx vite build`, mobile clean build, `bun run build` (backend), curl smoke, manual mobile drag/swipe verify.
12. **Changelog + headers** — single S56 entry summarizing all five tracks; `// [claude-code 2026-05-01]` headers on substantially modified files.
13. **Ship** — `/solvys-deploy` cuts `v6.0.4`; archive `S56-BRIEF-...` to `sprint-changelog/`.

## Acceptance Criteria

### Track A

- [ ] Gear icon visible top-right of ArbitrumChamber; click opens DevPasswordGate first-time-per-session
- [ ] Correct password unlocks settings panel; panel overlays chamber (NOT full Sanctum); closeable via X or Escape
- [ ] All 3 health rows expand/collapse; sub-status indicators correct (●/○/◐)
- [ ] "Edit Agent Instructions" CTA transitions to seat editor; 5 seat tabs work
- [ ] Each seat textarea editable, prefilled from current system prompt
- [ ] Source checkboxes + category dropdown persist on Save (PUT)
- [ ] Reset clears overrides with confirmation dialog
- [ ] Chamber deliberation still runs successfully with override appended

### Track B

- [ ] Sanctum right-bottom slot renders `SanctumBriefing` (not `ArbitrumRiskSignals`)
- [ ] Volatility Read shows Forecast on top, scenarios in one row, IV components below, no regime-shift bips line
- [ ] Instrument cards: no "Heat" label, no Drivers/headline copy block, conviction tag replaced with "MARKET HEAT"

### Track C

- [ ] Dashboard right column under DayCard renders Chamber Risk Signals with KanbanTitle header
- [ ] Reuses `useArbitrumLatest()` — no new poller
- [ ] Chevron-collapsible (parity with Core KPIs)

### Track D

- [ ] Mobile main menu opens as left drawer (~80vw), content slides right with scrim
- [ ] Hamburger icon cross-fades to back-arrow when open
- [ ] Edge-swipe from left opens; drag-leftward closes; tap-scrim closes
- [ ] Drawer header shows TP profile (target glyph + display name + handle + follow counts)
- [ ] Primary nav routes correctly (Dashboard / Sanctum / RiskFlow / Calendar / Performance / Apparatus)
- [ ] Footer utilities (Open Harper Chat / Settings / Help) wired
- [ ] Old `HamburgerMenu.tsx` deleted; no dead imports remain

### Cross-cutting

- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] `cd mobile && rm -rf dist && bunx vite build` passes
- [ ] Backend launchd reload — `curl -s http://localhost:8080/api/arbitrum/health` returns valid JSON
- [ ] `curl -s http://localhost:8080/api/arbitrum/seats/overrides` returns 5-seat array
- [ ] `curl -s -X PUT .../seats/overrides -H "Authorization: Bearer $JWT" -d {...}` returns `{ok:true}`
- [ ] Single S56 changelog entry covering all tracks added to `src/lib/changelog.ts`
- [ ] `// [claude-code 2026-05-01]` headers on all substantially modified files
- [ ] All new files under 300 lines

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Mobile build (clean rebuild — feedback_clean_rebuild_mobile)
cd mobile && rm -rf dist && bunx vite build

# Restart local backend (launchd)
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Endpoint smoke tests
curl -s http://localhost:8080/api/arbitrum/health | head -c 400
curl -s http://localhost:8080/api/arbitrum/seats/overrides | head -c 400
curl -s -X POST http://localhost:8080/api/arbitrum/deliberate \
  -H "Content-Type: application/json" \
  -d '{"question":"Test: SPX direction this week?","category":"test"}' | head -c 300
```

## Commit Format

```
[v6.0.4] feat: S56 Arbitrum settings + Sanctum restructure + Dashboard signals + mobile main-menu drawer
```
