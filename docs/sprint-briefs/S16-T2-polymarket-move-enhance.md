# Task Brief: S16-T2 — Polymarket Card Visual Overhaul

**Date:** 2026-04-15
**Scope:** Enhance PolymarketPredictionCards with FUSE scores, severity borders, expanded details, price delta, and full-width grid layout for Page 2. Do NOT touch Sanctum.tsx — wiring handled by T6 unification.
**Estimated files:** 2
**Repo root:** `~/Documents/Codebases/fintheon`
**Working directory:** `~/Documents/Codebases/fintheon`

## Prerequisites

- Read `~/Documents/Codebases/fintheon/CLAUDE.md` for project rules (changelog protocol, no gradients/colored emojis, Solvys Gold palette).
- Build: `cd ~/Documents/Codebases/fintheon && bun run build` (root Vite build, NOT tsc)
- This track modifies Sanctum.tsx — other tracks (T3, T4, T5) also touch it. This track commits FIRST among Sanctum tracks.

## Context

PolymarketPredictionCards currently renders on Page 0 of the Aquarium (Command Center), directly under the 5 instrument forecast cards. It needs to move to Page 2 (Risk & Narratives) in the bottom section, before Agent Performance. The "Top Volatile Theses" row on Page 2 is being removed (data stays for agentic layer). The space freed on Page 0 will be used by Track 5 (VIX cards) — don't add anything there.

Cards also need a visual upgrade: expanded state with price-at-proposal vs current price, FUSE confidence score, severity-colored borders, and theme-linked colors.

## Files to Read First

- `frontend/components/narrative/Sanctum.tsx` — Main 3-page Aquarium layout. Page 0 lines 200-392, Page 2 lines 423-510. Polymarket is at lines 373-381. Theses is at lines 440-450.
- `frontend/components/narrative/PolymarketPredictionCards.tsx` — Current card component. `PolymarketOutlook` interface at line 7, `probabilityColor()` at line 46, card rendering ~line 90+. 120s polling, localStorage cache.
- `frontend/components/narrative/SanctumTheses.tsx` — Component being removed from render (keep file alive).
- `frontend/components/narrative/AquariumPredictionCards.tsx` — Sibling component for reference on card patterns, polling, cache.

## What to Build/Change

### 1. Remove Top Volatile Theses from Page 2

- **Path:** `frontend/components/narrative/Sanctum.tsx`
- **Action:** Modify
- **Spec:**
  - Delete lines 440-450 (the `Top Volatile Theses` div wrapper + `<SanctumTheses>` render)
  - Remove the `SanctumTheses` import if lint requires it
  - Do NOT delete `SanctumTheses.tsx` or any backend endpoints serving `data.scenarios`
  - Commit this change first before proceeding to the Polymarket move

### 2. Move Polymarket from Page 0 to Page 2

- **Path:** `frontend/components/narrative/Sanctum.tsx`
- **Action:** Modify
- **Spec:**
  - **Remove** lines 373-381 (the Polymarket section from Page 0: the `mt-1 pt-1 border-t` div containing the "Prediction Markets" label and `<PolymarketPredictionCards />`)
  - **Insert** on Page 2 after the 50/50 grid (Active Narratives + Live Risk Signals), before the Agent Performance separator (around line 488 after Theses removal)
  - Add a section header matching Page 2's emerald-300 accent:
    ```tsx
    <div className="text-[9px] text-[var(--fintheon-muted)]/40 mb-2 uppercase tracking-wider">
      Prediction Markets & Polybot Trades
    </div>
    ```
  - Do NOT add anything in the space freed on Page 0 — Track 5 handles that

### 3. Enhanced PolymarketPredictionCards

- **Path:** `frontend/components/narrative/PolymarketPredictionCards.tsx`
- **Action:** Modify
- **Spec:**
  - Extend `PolymarketOutlook` interface with: `priceProposedAt?: number` (snapshot at creation), `fuseConfidence?: number` (0-100 confidence score)
  - Add expand/collapse state per card (click to expand)
  - **Collapsed card** shows: question (truncated), YES probability large, severity-colored left border
  - **Expanded card** shows:
    - Full question text
    - **Price proposed at** vs **Current price (yesPrice)** with delta: green arrow-up if current > proposed, red arrow-down if lower
    - **Volume** formatted (existing `formatVolume`)
    - **Category** badge
    - **Close time** relative (e.g., "3d left")
    - **Kalshi divergence** when >10%: show both prices with divergence % badge
    - **FUSE confidence score**: right-justified in card header, styled as a small badge. Color: >80 green, >60 gold, >40 orange, <40 red
  - **Severity-colored borders** (left border, 2px): map fuseConfidence to color — >80 `var(--fintheon-bullish)`, >60 `var(--fintheon-accent)`, >40 `var(--fintheon-caution, orange)`, <40 `var(--fintheon-bearish)`
  - **Theme-linked colors**: replace ALL hardcoded color values with `var(--fintheon-*)` CSS variables. Zero hardcoded hex colors.
  - Cards should be full-width on Page 2 (not the narrow 220px horizontal scroll from Page 0). Use a responsive grid: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3`
  - **Max lines:** 250

### 4. Backend — Add priceProposedAt and fuseConfidence

- **Path:** Check `backend-hono/src/routes/predictions.ts` and any polymarket service file
- **Action:** Modify
- **Spec:**
  - When a polymarket outlook is first generated/cached, snapshot `yesPrice` as `priceProposedAt`
  - Compute `fuseConfidence` as: if kalshiDivergence exists and divergencePct > 10, boost confidence by 15 points; base from the YES price distance from 0.50 (more extreme = higher confidence)
  - Return both new fields in the API response

## Key Rules

- All colors must use `var(--fintheon-*)` CSS variables — zero hardcoded hex colors
- No gradients, no colored emojis
- Cards must work at mobile (375px) and desktop (1440px)
- Keep the existing 120s polling and localStorage cache pattern
- The `PolymarketPredictionCards` import in Sanctum.tsx stays — just move where it renders

## DO NOT

- Add anything to the space freed on Page 0 (Track 5 handles that)
- Delete `SanctumTheses.tsx` component file or its backend endpoints
- Touch any files outside Sanctum.tsx, PolymarketPredictionCards.tsx, and the backend prediction route
- Add new npm dependencies
- Change the Polymarket API endpoint or polling interval

## Verification

```bash
cd ~/Documents/Codebases/fintheon && bun run build
# Open browser: Aquarium Page 0 — Polymarket cards should be GONE
# Navigate to Page 2 — Polymarket cards in bottom section, Theses row gone
# Click a card to expand — verify all enhanced fields render
# Check mobile viewport (375px)
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'S16-T2: Remove Top Volatile Theses from Page 2. Move PolymarketPredictionCards from Page 0 to Page 2 bottom. Add FUSE confidence score, severity borders, price-at-proposal vs current price delta, expanded card details. Theme-link all colors.',
  files: [
    'frontend/components/narrative/Sanctum.tsx',
    'frontend/components/narrative/PolymarketPredictionCards.tsx'
  ]
}
```

## Post-Push Memory Update

After committing, log any bugs or broken patterns to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md` and add pointer to `MEMORY.md`. Skip if no bugs found.
