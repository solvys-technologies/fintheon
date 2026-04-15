# Task Brief: Regime Tracker T2 — Frontend Component Decomposition + Liquid Glass

**Date:** 2026-04-14
**Scope:** Decompose the monolithic RegimeTrackerModal into subcomponents, apply liquid glass card design, redesign bias badges, overhaul ORB display, remove all fade references
**Estimated files:** 5 new + 4 modified

## Context

The regime tracker modal is a 537-line monolith with 5 inline components (BiasBadge, ConfidenceBar, OrbRecord, RegimeCard, AddRegimeForm). It needs to be decomposed, wrapped in liquid glass (iOS26 aesthetic), stripped of all "fade" bias references, and given a new 5-classification bias system. The ORB display needs theme-sensitive colors and price data support. The footer border must be removed.

## Files to Read First

- `frontend/components/regimes/RegimeTrackerModal.tsx` — The monolith to decompose. 537 lines. Contains all inline components at lines 37-347, modal shell at 349-537.
- `frontend/lib/regimes.ts` — `TradingRegime` interface (line 4-19) and `SEED_REGIMES` (line 29-173). The bias type needs changing from `"long" | "short" | "fade" | "neutral"` to 5 new classifications.
- `frontend/lib/regime-store.ts` — `useRegimes` hook with localStorage persistence. Storage key is `fintheon:regime-tracker:v2`. Needs v2→v3 migration for bias rename.
- `frontend/components/ui/liquid-glass.tsx` — Reusable `GlassEffect`, `GlassButton`, `GlassDock` components. Use `GlassEffect` for card wrapping. Props: `blur` (default 20), `tint` (optional override), standard div props.
- `frontend/lib/regime-time.ts` — ET timezone helpers: `isRegimeActive()`, `getTimeRemaining()`, `formatTimeRange12H()`, `getCurrentETTime()`. Import from here, don't recreate.
- `frontend/styles/custom.css` — Existing keyframes: `fadeSlideIn`, `greeting-shimmer`. Add new keyframes here.
- `frontend/lib/utils.ts` — Has `cn()` utility for className merging (clsx + tailwind-merge).

## What to Build/Change

### 1. Update TradingRegime Interface + Seed Data

- **Path:** `frontend/lib/regimes.ts`
- **Action:** Modify
- **Spec:**
  - Change bias type from `"long" | "short" | "fade" | "neutral"` to `"continuation" | "reversal" | "convergence" | "consolidation" | "rotation"`
  - Add optional fields to TradingRegime: `orbHistory?: Array<{ date: string; openPrice: number; price10Min: number; direction: "bullish" | "bearish"; changeBps: number }>`, `antilagConfidence?: number`, `cotSignal?: { direction: "bullish" | "bearish" | "neutral"; strength: number }`
  - Update ALL SEED_REGIMES: every `bias: "fade"` becomes `bias: "reversal"`. Keep `"neutral"` as-is. There are 5 fade entries (cash-open, gs-morning, jpm-flow, citi-boa, nfp-friday).
- **Max lines:** 200

### 2. Storage Migration v2→v3

- **Path:** `frontend/lib/regime-store.ts`
- **Action:** Modify
- **Spec:**
  - Add `const V3_STORAGE_KEY = "fintheon:regime-tracker:v3"`
  - Add `migrateV2toV3()` function that maps any `bias: "fade"` to `bias: "reversal"`
  - Update `loadRegimes()` to try v3 first, then v2 with migration, then v1 with both migrations, then SEED_REGIMES
  - Add `updateORBHistory(id: string, entry: { date: string; openPrice: number; price10Min: number; direction: "bullish" | "bearish"; changeBps: number })` callback to useRegimes — appends to regime's `orbHistory` array (max 30 entries, FIFO)
  - Add `updateAntilagConfidence(id: string, value: number)` callback to useRegimes
- **Max lines:** 150

### 3. BiasBadge Component

- **Path:** `frontend/components/regimes/BiasBadge.tsx`
- **Action:** Create
- **Spec:**
  - Takes `bias: TradingRegime["bias"]` prop
  - 5 classifications with distinct icon + color:
    - `continuation`: ArrowRight icon from lucide-react, color `text-[var(--fintheon-bullish)]` (emerald)
    - `reversal`: ArrowLeftRight icon, color `text-[var(--fintheon-bearish)]` (red)
    - `convergence`: Merge icon, color `text-[var(--fintheon-accent)]` (gold)
    - `consolidation`: Pause icon, color `text-zinc-400`
    - `rotation`: RefreshCw icon, color `text-blue-400`
  - Styling matches old badge: `inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase`
  - Icon size: `w-2.5 h-2.5`
  - NO fade option. Remove it completely.
- **Max lines:** 40

### 4. ConfidenceBar Component

- **Path:** `frontend/components/regimes/ConfidenceBar.tsx`
- **Action:** Create
- **Spec:**
  - Takes `value: number` (0-100) and optional `breakdown?: { iv: number; prediction: number; cot: number; volume: number }`
  - Main bar: same color logic as current (emerald >=70, yellow >=50, red <50) but with `rounded-full` on the bar and container
  - If `breakdown` provided, show a thin secondary bar below (h-0.5) with 4 colored segments proportional to component weights (gold for IV, blue for prediction, emerald for COT, orange for volume)
  - Percentage text to the right of the bar
  - Tooltip on hover (native `title` attribute) showing: `IV: ${breakdown.iv}% | Pred: ${breakdown.prediction}% | COT: ${breakdown.cot}% | Vol: ${breakdown.volume}%`
- **Max lines:** 60

### 5. OrbRecord Component

- **Path:** `frontend/components/regimes/OrbRecord.tsx`
- **Action:** Create
- **Spec:**
  - Takes `record: TradingRegime["record"]` and optional `orbHistory?: TradingRegime["orbHistory"]`
  - Top row: "ORB" label + bullish count (color `var(--fintheon-bullish)`) + "/" + bearish count (color `var(--fintheon-bearish)`) + win rate %. MUST use CSS variable colors, not hardcoded emerald/red.
  - If `orbHistory` exists and has entries, show a row of mini direction bars below (last 5 entries):
    - Each bar is 3px wide, 12px tall, colored `var(--fintheon-bullish)` or `var(--fintheon-bearish)` based on direction
    - Tooltip on each bar: `${entry.date}: ${entry.direction} ${entry.changeBps > 0 ? "+" : ""}${entry.changeBps} bps`
  - Icons: use Diff (lucide) for bullish, TrendingDown for bearish — same as current but with CSS var colors
- **Max lines:** 70

### 6. RegimeCard Component (Glass-Wrapped)

- **Path:** `frontend/components/regimes/RegimeCard.tsx`
- **Action:** Create
- **Spec:**
  - Extract from RegimeTrackerModal.tsx lines 106-215
  - Wrap in `<GlassEffect className="rounded-2xl">` instead of the current `<div className="bg-[#0a0a06] border...">`
  - Active state: add `style={{ borderColor: "var(--fintheon-accent)", boxShadow: "0 0 16px rgba(212,175,55,0.12)" }}` to GlassEffect
  - Inactive state: default GlassEffect styling (uses --fintheon-glass-border)
  - Import and use the new BiasBadge, ConfidenceBar, OrbRecord components
  - Keep all existing props: `regime, isActive, timeInfo, onRecordBullish, onRecordBearish, onDelete`
  - Add padding: `px-4 py-3` inside the GlassEffect
  - Remove hardcoded colors — use CSS variables throughout
- **Max lines:** 130

### 7. Slim Down RegimeTrackerModal

- **Path:** `frontend/components/regimes/RegimeTrackerModal.tsx`
- **Action:** Modify (major rewrite)
- **Spec:**
  - Remove ALL inline components (BiasBadge, ConfidenceBar, OrbRecord, RegimeCard, AddRegimeForm)
  - Import them from new files: `./BiasBadge`, `./ConfidenceBar`, `./OrbRecord`, `./RegimeCard`
  - Keep AddRegimeForm inline for now (Track 3 will extract it with glassmorphic treatment)
  - AddRegimeForm bias select: remove `<option value="fade">Fade</option>`, add 5 new options: continuation, reversal, convergence, consolidation, rotation
  - Modal container: wrap in `<GlassEffect tint="rgba(5,4,2,0.88)" blur={16} className="rounded-2xl">` instead of `bg-[var(--fintheon-bg)]`
  - Footer: remove `border-t border-zinc-800/60` from line 524. Replace with either no border or a subtle `<div className="h-px bg-[var(--fintheon-accent)]/5" />` separator
  - Keep all existing state management, grouping logic, collapse logic
  - Update lucide imports — only keep what the modal itself needs (X, Plus, Clock, ChevronDown, ChevronRight)
- **Max lines:** 250

## Key Rules

- ALWAYS use CSS variables for colors: `var(--fintheon-bullish)`, `var(--fintheon-bearish)`, `var(--fintheon-accent)`, `var(--fintheon-text)`, `var(--fintheon-bg)`, `var(--fintheon-surface)`. Never hardcode `text-emerald-400` for bullish or `text-red-400` for bearish — these must be theme-sensitive.
- Use `cn()` from `../../lib/utils` for className merging
- Use `rounded-2xl` (16px) for card border-radius consistently
- Import `GlassEffect` from `../../components/ui/liquid-glass`
- No gradients, no colored emojis (project rule)
- Build: `bun run build` from project root (not `tsc`)

## DO NOT

- Touch any backend files — that's Track 1
- Add chat input or thinking overlay animations — that's Track 3
- Add new npm dependencies
- Create documentation files
- Add framer-motion imports (Track 3 handles animation)
- Touch files outside `frontend/`

## Verification

```bash
# From project root
bun run build
# Should compile with no TypeScript errors

# Then start dev server and visually verify:
# 1. Open regime tracker modal
# 2. Cards should have frosted glass effect with rounded corners
# 3. No "FADE" badges anywhere — all former fade items show "REVERSAL"
# 4. Footer has no horizontal border line
# 5. ConfidenceBar has rounded ends
# 6. OrbRecord uses theme colors (not hardcoded emerald/red)
# 7. New bias options appear in the Add Regime form dropdown
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T18:00:00',
  agent: 'claude-code',
  summary: 'T2: Decomposed RegimeTrackerModal into subcomponents (BiasBadge, ConfidenceBar, OrbRecord, RegimeCard), applied liquid glass cards, replaced fade bias with 5 heuristic classifications, theme-sensitive ORB colors, removed footer border',
  files: ['frontend/components/regimes/RegimeTrackerModal.tsx', 'frontend/components/regimes/BiasBadge.tsx', 'frontend/components/regimes/ConfidenceBar.tsx', 'frontend/components/regimes/OrbRecord.tsx', 'frontend/components/regimes/RegimeCard.tsx', 'frontend/lib/regimes.ts', 'frontend/lib/regime-store.ts']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
