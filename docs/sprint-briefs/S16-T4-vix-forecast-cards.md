# Task Brief: S16-T4 — Blended VIX Score + Next Session Forecast Cards

**Date:** 2026-04-15
**Scope:** Create BlendedVIXCard and NextSessionForecastCard components. Do NOT touch Sanctum.tsx — wiring handled by T6 unification.
**Estimated files:** 2
**Repo root:** `~/Documents/Codebases/fintheon`
**Working directory:** `~/Documents/Codebases/fintheon`

## Prerequisites

- Read `~/Documents/Codebases/fintheon/CLAUDE.md` for project rules (changelog protocol, no gradients/colored emojis).
- Build: `cd ~/Documents/Codebases/fintheon && bun run build`
- This track does NOT touch Sanctum.tsx — T6 unification handles all Sanctum wiring after all tracks land.

## Context

The Aquarium's header toolbar has an IV score widget (`IVScoreCard.tsx`) that shows rich data on hover: blended VIX breakdown (3 components with weights), implied point range, systemic risk overlay, and next session forecast with scenarios. This data is valuable but hidden behind a hover popup. We need to surface it as two visible cards on Page 0, in the space freed by Polymarket moving to Page 2.

## Files to Read First

- `frontend/components/IVScoreCard.tsx` — The hover popup. Lines 212-295: blended breakdown with progress bars. Lines 313-357: systemic risk overlay. Lines 361-424: next session forecast with scenarios. Lines 25-31: `getEnvironmentLabel()`. Lines 48-75: `getVixPulseStyle()`.
- `frontend/types/market-data.ts` — Lines 82-144: `IVScoreResponse` interface with ALL the data fields (`score`, `vixComponent`, `headlineComponent`, `mirosharkComponent`, `weights`, `vix`, `points`, `prediction`, `systemic`, `rationale`).
- `frontend/components/narrative/Sanctum.tsx` — Page 0 layout. AquariumPredictionCards at line 370. The Polymarket section (lines 373-381) will be removed by T2 — that's where these cards go.
- `frontend/components/narrative/AquariumPredictionCards.tsx` — Reference for fetch/poll pattern within Sanctum.

## What to Build/Change

### 1. BlendedVIXCard Component

- **Path:** `frontend/components/narrative/BlendedVIXCard.tsx`
- **Action:** Create
- **Spec:**
  - Props: `data: IVScoreResponse | null`, `isLoading: boolean`
  - Display:
    - **Header**: "Blended IV Score" with the numeric score (0-10) and environment label (reuse `getEnvironmentLabel` from IVScoreCard.tsx lines 25-31: <2 "Calm Seas", 2-4 "Light Winds", 4-6 "Gathering Storm", 6-8 "Tipping Point", 8+ "Shit Show")
    - **Three component bars** (horizontal progress, value/10):
      - VIX Component: `data.vixComponent` — label "VIX" — show actual VIX level in parentheses (`data.vix.level`)
      - Headline Component: `data.headlineComponent` — label "Headlines" — show event count
      - MiroShark Component: `data.mirosharkComponent` — label "MiroShark"
    - **Weight labels**: 70% / 20% / 10% next to each bar
    - **Implied Range**: `±${data.points.scaledPoints} pts` for the instrument, dollar risk per contract
    - **Rationale**: first 2 rationale lines from `data.rationale[]`
  - Style: subtle card with `var(--fintheon-surface)` bg, thin border, compact text (9-11px)
  - Component bar colors: use urgency colors based on component value (>7 red, >5 orange, >3 yellow, else emerald)
  - **Max lines:** 180

### 2. NextSessionForecastCard Component

- **Path:** `frontend/components/narrative/NextSessionForecastCard.tsx`
- **Action:** Create
- **Spec:**
  - Props: `data: IVScoreResponse | null`, `isLoading: boolean`
  - Display:
    - **Header**: "Next Session Forecast" with source badge ("MiroShark" or "Heuristic" from `data.prediction?.source`)
    - **Projected IV score**: large number (0-10) with color coding
    - **Confidence**: horizontal bar showing `data.prediction?.confidence` as percentage
    - **Regime Shift Probability**: `data.prediction?.regimeShiftProbability` — amber highlight when >10%, red when >25%
    - **Scenario Table**: for each `data.prediction?.scenarios[]`, show: label, probability %, projected score. Compact rows.
    - **Systemic Risk Overlay** (if `data.systemic` exists):
      - Score: `data.systemic.score` /10
      - Active causal chains: `data.systemic.activeChains`
      - Top historical rhyme: `data.systemic.topRhyme.label` with match % (if >50%)
      - Credit signals: `data.systemic.creditSignals` in last 48h
  - Style: matching card to BlendedVIXCard, same border/bg treatment
  - Show "No forecast available" gracefully when `data.prediction` is null
  - **Max lines:** 200

### 3. Data Fetch Hook

- **Path:** `frontend/components/narrative/useIVScoreData.ts`
- **Action:** Create
- **Spec:**
  - Custom hook `useIVScoreData()` that fetches `GET /api/market-data/iv-score?instrument=/ES`
  - 60s polling interval (match VIX service cache TTL)
  - Returns `{ data: IVScoreResponse | null, isLoading: boolean }`
  - Uses `API_BASE` pattern: `import.meta.env.VITE_API_URL || "http://localhost:8080"`
  - T6 unification will call this hook from Sanctum.tsx and pass data to both cards
  - **Max lines:** 50

## Key Rules

- All colors via `var(--fintheon-*)` CSS variables — no hardcoded hex
- No gradients, no colored emojis
- Reuse the visual patterns from IVScoreCard.tsx (progress bars, color functions) but don't import from it directly — copy the helper functions into the new components or extract shared utilities
- The `API_BASE` pattern: `const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080"`
- Cards should be compact — this is a dashboard, not a detail page

## DO NOT

- Touch `Sanctum.tsx` — T6 handles placing these cards on Page 0
- Modify IVScoreCard.tsx (the hover popup stays as-is)
- Add new npm dependencies
- Fetch from any endpoint other than `GET /api/market-data/iv-score`

## Verification

```bash
cd ~/Documents/Codebases/fintheon && bun run build
# Components build without errors — Sanctum wiring verified in T6
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'S16-T4: Blended VIX Score + Next Session Forecast as visible cards on Aquarium Page 0. Three-component IV breakdown, implied range, scenario table, systemic risk overlay. 60s polling.',
  files: [
    'frontend/components/narrative/BlendedVIXCard.tsx',
    'frontend/components/narrative/NextSessionForecastCard.tsx',
    'frontend/components/narrative/useIVScoreData.ts'
  ]
}
```

## Post-Push Memory Update

After committing, log any bugs or broken patterns to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md` and add pointer to `MEMORY.md`. Skip if no bugs found.
