# S8-T4: Aquarium/Sanctum Redesign + Econ Intelligence

**Sprint**: S8 — The Mega Sprint
**Track**: T4 (after T1)
**Branch**: `v.8.28.1`

## Context
The Aquarium shows ERROR badge + "Simulation failed: 500", has mismatched card styles (prediction cards rounded but KPI cards aren't), dead simulation history section, and Econ Intelligence shows "loading data..." on all 8 cards. This track redesigns the Sanctum pages: cleans up the chart area, unifies card styles, replaces simulation history with agent scorecards, fixes econ data pipeline, and restructures the Risk & Narratives page.

## Files to Read First
- `frontend/components/narrative/Sanctum.tsx` (390 lines) — 3-page dashboard structure
- `frontend/components/narrative/SanctumHeader.tsx` (300 lines) — ERROR badge, presets, run button
- `frontend/components/narrative/SanctumEconIntel.tsx` — econ cards, ECON_TICKERS, history fetching
- `frontend/components/narrative/CategoryScoreCard.tsx` (54 lines) — risk category cards
- `frontend/types/mirofish.ts` — `ivHeatColor()`, `RISK_CATEGORY_LABELS`
- `frontend/lib/severity-config.ts` — severity config with theme CSS vars
- `frontend/components/narrative/SanctumRiskAssessment.tsx` — live risk signals
- `frontend/components/refinement/RefinementEngine.tsx` — refinement engine (multiplier source)
- `backend-hono/src/services/supabase-service.ts` — `readEconHistory()`, `ECON_KEYWORD_MAP`
- `backend-hono/src/routes/data/index.ts` — econ calendar enrichment

## Files to Modify
- `frontend/components/narrative/Sanctum.tsx` — Restructure all 3 pages
- `frontend/components/narrative/CategoryScoreCard.tsx` — Whole border + fuse + percentage
- `frontend/components/narrative/SanctumEconIntel.tsx` — Fix loading, populate with FJ data
- `frontend/components/narrative/SanctumHeader.tsx` — Remove KanbanTitle usage

## Files to Create
- `frontend/components/narrative/SanctumAgentScorecard.tsx` (<200 lines) — replaces simulation history

## Implementation

### 1. Chart Area Cleanup (Page 0: Command Center)
- **Remove**: IV Risk Bars that sat under the TradingView chart
- **Remove**: Category scale key legend (geopolitical, political, monetary, etc. row at line 214-231)
- **Center**: Prediction cards (/NQ, /ES, /YM, /CL, /GC) — currently left-aligned, center them
- **Unify KPI cards**: Market Heat, Regime Risk, Signal Strength cards must match the rounded style of prediction cards above them. Currently they have `rounded` but different border treatment. Match border-radius, padding, sizing.

### 2. CategoryScoreCard Redesign
Current: `border-l-2` kanban left border, confidence progress bar.

New design:
- **Whole border**: Replace `border-l-2` with `border` (all sides) colored by `ivHeatColor(score)`
- **Volatility fuse**: Add a progress bar/gauge below the score showing the volatility level (use the existing `score` value normalized to 0-10 scale). Bar color follows `ivHeatColor()`.
- **Percentage score**: Replace the confidence progress bar (lines 39-49) with a percentage text display: `{Math.round(confidence * 100)}%` in the same position. Style: `text-sm font-mono`, color follows confidence thresholds (>=70% green, >=50% amber, <50% red via CSS vars).
- Remove the "Conf" label and thin progress bar.

### 3. Top Volatile Theses Redesign
Current: Shows probability %, confidence/volatility/consensus bars with numerical scores.

New:
- **Remove**: probability percentage and all three score bars (confidence, volatility, consensus)
- **Add**: Volatility amplifier multiplier `x1.25` from refinement engine live data
- Fetch multiplier from refinement engine endpoint (check `RefinementEngine.tsx` for the data source)
- Display: `x{multiplier.toFixed(2)}` in gold accent color, positioned where probability % was
- This represents: how much more volatile the instrument becomes when this thesis is active vs baseline

### 4. Delete Simulation History → Agent Scorecards
- **Remove**: The entire "SIMULATION HISTORY" section (Mar 26 full-brief IV 6.7 conf 72% REGIME rows)
- **Replace with**: `SanctumAgentScorecard` component showing:
  - MiroShark debate results (gov official agent outputs — summary)
  - Hermes deliberation notes
  - Harper-Opus (Claude CLI) scoring rationale
  - Same data as the Proposals slide-out debate panel (T5 creates that)
  - Shows: agent name, their assessment, confidence, key quote
  - Format: compact cards, expandable for detail

### 5. Page 2 Layout: Risk & Narratives
Restructure the bottom half of page 2:
- **Top section**: Top Volatile Theses (with new multiplier format)
- **Bottom section split 50/50**:
  - **Left**: Active Narratives — connected to NarrativeFlow. Clicking a narrative navigates to that narrative hub on the Observatory map. Show: thread name, event count, latest catalyst title, health score.
  - **Right**: Live Risk Signals (`SanctumRiskAssessment`)

### 6. Econ Intelligence Fix (Page 1)
Backend verification:
```bash
curl localhost:8080/api/data/econ-history/CUTS?limit=5
curl localhost:8080/api/data/econ-history/CPI?limit=5
```
If empty → `readEconHistory()` keyword patterns aren't matching FJ data in `scored_riskflow_items`. Check the `ECON_KEYWORD_MAP` patterns against actual headlines in the DB.

Frontend fix in `SanctumEconIntel.tsx`:
- The component fetches from `/api/data/econ-history/{ticker}` — verify the endpoint is called correctly
- Populate each card with:
  - Latest FJ headline for that event type
  - Beat/miss/inline indicator (use existing `DIRECTION_CONFIG`: beat=green, miss=red, inline=amber)
  - Deviation from forecast (actual - forecast as +/- value)
  - IV score for that headline
  - Next scheduled date with countdown
- Remove `<KanbanTitle>` at the top of the Econ Intelligence section

### 7. Remove KanbanTitle Usage
- Line 282-285 in `Sanctum.tsx`: `<KanbanTitle title="Economic Intelligence" tone="cyan">` → replace with flat heading text
- Any other KanbanTitle instances in Sanctum

## Verification
1. `bun run build` — clean
2. Aquarium Page 0: No IV risk bars, no category legend, prediction cards centered, KPI cards match rounded style
3. CategoryScoreCard: whole border colored by heat, volatility fuse visible, percentage (not bar) for confidence
4. Top Volatile Theses: shows `x1.25` multiplier, no probability/score bars
5. No simulation history visible
6. Agent scorecards render (may show placeholder until T5 provides MiroShark data)
7. Econ cards: at least some show FJ headline data with beat/miss/inline
8. Active narratives clickable → navigates to NarrativeFlow

## Changelog Entry
```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S8-T4: Aquarium redesign — chart cleanup, CategoryScoreCard whole border + fuse, volatility multiplier, agent scorecards replace sim history, econ intel fix', files: ['frontend/components/narrative/Sanctum.tsx', 'frontend/components/narrative/CategoryScoreCard.tsx', 'frontend/components/narrative/SanctumEconIntel.tsx', 'frontend/components/narrative/SanctumAgentScorecard.tsx'] }
```

## DO NOT
- Do NOT fix the ERROR badge (T1 handles that)
- Do NOT rename MiroFish (T5 handles that)
- Do NOT touch NarrativeFlow canvas (T2 owns that)
- Do NOT modify rope rendering (T3 owns that)
- Do NOT modify Ask Harp chat (T7 owns that)
