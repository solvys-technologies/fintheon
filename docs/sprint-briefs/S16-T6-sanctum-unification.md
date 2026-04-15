# Task Brief: S16-T6 — Sanctum.tsx Unification

**Date:** 2026-04-15
**Scope:** Wire all S16 track outputs into Sanctum.tsx in a single pass: remove Theses, move Polymarket to Page 2, insert VIX cards on Page 0, add Risk Signals to Agent Performance section. Apply /the-feels aesthetic pass.
**Estimated files:** 1
**Repo root:** `~/Documents/Codebases/fintheon`
**Working directory:** `~/Documents/Codebases/fintheon`

## Prerequisites

- Read `~/Documents/Codebases/fintheon/CLAUDE.md` for project rules (changelog protocol, no gradients/colored emojis, Solvys Gold palette).
- Build: `cd ~/Documents/Codebases/fintheon && bun run build`
- **ALL S16 tracks (T1-T5) must be committed and merged before running this brief.**
- Verify these components exist before starting:
  - `frontend/components/narrative/PolymarketPredictionCards.tsx` — enhanced by T2
  - `frontend/components/narrative/RiskSignalCards.tsx` — created by T3
  - `frontend/components/narrative/BlendedVIXCard.tsx` — created by T4
  - `frontend/components/narrative/NextSessionForecastCard.tsx` — created by T4
  - `frontend/components/narrative/useIVScoreData.ts` — created by T4

## Context

Tracks T2, T3, T4 each created new components but did NOT touch Sanctum.tsx to avoid merge conflicts during parallel execution. This unification track wires everything into the Sanctum 3-page layout in a single atomic commit. It also removes the Top Volatile Theses row (T4 deferred this to unification).

## Files to Read First

- `frontend/components/narrative/Sanctum.tsx` — The main 3-page Aquarium layout. MUST read the entire file to understand current structure before modifying.
  - Page 0 (Command Center): lines ~200-392 — chart, KPIs, briefing, AquariumPredictionCards, PolymarketPredictionCards
  - Page 1 (Economic Intelligence): lines ~394-421
  - Page 2 (Risk & Narratives): lines ~423-510 — Theses, Narratives/Risk grid, Agent Performance
- `frontend/components/narrative/BlendedVIXCard.tsx` — Props interface (needs `data: IVScoreResponse | null, isLoading: boolean`)
- `frontend/components/narrative/NextSessionForecastCard.tsx` — Same props interface
- `frontend/components/narrative/RiskSignalCards.tsx` — Check if it accepts props or self-fetches
- `frontend/components/narrative/useIVScoreData.ts` — Hook that provides IV score data
- `frontend/components/narrative/PolymarketPredictionCards.tsx` — Verify it's self-contained (fetches its own data)

## What to Build/Change

### 1. Sanctum.tsx — All Wiring in One Pass

- **Path:** `frontend/components/narrative/Sanctum.tsx`
- **Action:** Modify
- **Spec:**

**Step A — Add Imports (top of file):**

```tsx
import { BlendedVIXCard } from "./BlendedVIXCard";
import { NextSessionForecastCard } from "./NextSessionForecastCard";
import { RiskSignalCards } from "./RiskSignalCards";
import { useIVScoreData } from "./useIVScoreData";
```

**Step B — Add IV Score Data Hook (inside component body):**

```tsx
const { data: ivData, isLoading: ivLoading } = useIVScoreData();
```

**Step C — Page 0: Remove Polymarket, Add VIX Cards:**

- REMOVE the Polymarket section (the `mt-1 pt-1 border-t` div containing "Prediction Markets" label and `<PolymarketPredictionCards />`)
- INSERT in its place (after AquariumPredictionCards):

```tsx
{
  /* Blended VIX + Next Session Forecast */
}
<div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 px-4">
  <BlendedVIXCard data={ivData} isLoading={ivLoading} />
  <NextSessionForecastCard data={ivData} isLoading={ivLoading} />
</div>;
```

**Step D — Page 2: Remove Top Volatile Theses:**

- DELETE the entire "Top Volatile Theses" section: the wrapper div with the label + `<SanctumTheses>` component
- Remove `SanctumTheses` import if lint requires it (keep component file)

**Step E — Page 2: Add Polymarket to Bottom (before Agent Performance):**

- INSERT after the 50/50 grid (Active Narratives + Live Risk Signals), before the Agent Performance separator:

```tsx
{
  /* Prediction Markets & Polybot Trades — moved from Page 0 */
}
<div>
  <div className="text-[9px] text-[var(--fintheon-muted)]/40 mb-2 uppercase tracking-wider">
    Prediction Markets & Polybot Trades
  </div>
  <PolymarketPredictionCards />
</div>;
```

**Step F — Page 2: Add Risk Signals to Agent Performance Section:**

- INSERT inside the Agent Performance section (the rounded bordered div), BEFORE `<AgentScorecard />`:

```tsx
<div className="border-b border-[var(--fintheon-border)]/10">
  <div className="px-4 py-2">
    <span className="text-[9px] text-[var(--fintheon-muted)]/40 uppercase tracking-wider">
      Risk Signals
    </span>
  </div>
  <div className="px-3 pb-3">
    <RiskSignalCards />
  </div>
</div>
```

### Final Page Layout After Unification

**Page 0 — Command Center:**

1. SanctumHeader
2. TradingView Chart (58vh)
3. KPI Row (Market Heat / Regime Risk / Signal Strength)
4. SanctumBriefing
5. AquariumPredictionCards (5 instruments)
6. **NEW: BlendedVIXCard + NextSessionForecastCard (side-by-side)**

**Page 1 — Economic Intelligence:**
(unchanged)

**Page 2 — Risk & Narratives:**

1. 50/50 Grid: Active Narratives + Live Risk Signals
2. **NEW: Prediction Markets & Polybot Trades**
3. Agent Performance separator
4. **NEW: Risk Signals** (inside Agent Performance section)
5. AgentScorecard

## Key Rules

- All colors via `var(--fintheon-*)` CSS variables — no hardcoded hex
- No gradients, no colored emojis
- Keep existing snap-scroll behavior intact
- Don't change any data fetching logic already in Sanctum — the new components handle their own
- The `PolymarketPredictionCards` import should already exist in the file — just move where it renders
- Test all 3 pages after changes — make sure snap-scroll still works

## DO NOT

- Modify any of the new component files (T2/T3/T4 already built them)
- Change Page 1 (Economic Intelligence)
- Remove backend endpoints for `data.scenarios` (Theses data stays available)
- Add new npm dependencies
- Touch the header toolbar IV score hover popup (IVScoreCard.tsx)

## Verification

```bash
cd ~/Documents/Codebases/fintheon && bun run build
# Open Aquarium Page 0:
#   - Polymarket cards GONE
#   - Two VIX cards visible below instrument forecasts
#   - Snap-scroll to Page 1 works
# Navigate to Page 2:
#   - Top Volatile Theses row GONE
#   - 50/50 grid (Narratives + Risk) intact
#   - Polymarket cards visible in new bottom section
#   - Agent Performance section has Risk Signals above scorecards
# Check mobile (375px) — VIX cards stack to single column
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'S16-T6: Sanctum unification — remove Theses, move Polymarket to Page 2, add BlendedVIX + NextSessionForecast cards to Page 0, add RiskSignalCards to Agent Performance section.',
  files: ['frontend/components/narrative/Sanctum.tsx']
}
```

## Post-Push Memory Update

After committing, log any bugs or broken patterns to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md` and add pointer to `MEMORY.md`. Skip if no bugs found.
