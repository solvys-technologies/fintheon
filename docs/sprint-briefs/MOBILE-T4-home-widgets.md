# Task Brief: T4 — Home Page + Briefing + Widgets

**Date:** 2026-04-14
**Scope:** Landing page with daily briefing card, QuickStats row, MiniRegimeTracker with Doto countdown, MiniSessionCalendar, and shared BottomSheet/SurfaceCard components.
**Estimated files:** 12

## Project Memory (READ FIRST)

Before doing anything, read the project memory for critical context, patterns, and feedback from prior work:

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Key memories to load:** feedback_backend_client_pattern, feedback_catalyst_terminology, feedback_unified_feed_no_filters
- **Master plan:** `/Users/tifos/.claude/plans/tidy-foraging-garden.md`

## Context

The Home tab is the landing page. It surfaces the morning daily brief, quick account stats, active market regimes with countdown timers, and upcoming economic events — all in Nothing Design System aesthetic. Three-layer visual hierarchy per widget: Primary (Doto hero numbers), Secondary (Space Grotesk body), Tertiary (Space Mono ALL CAPS labels).

## Files to Read First

- `frontend/components/mission-control/SessionCalendarMini.tsx` — Desktop econ calendar (TradingView embed — we replace with native)
- `frontend/components/regimes/RegimeTrackerModal.tsx` — Regime tracker with bias badges, confidence bars
- `frontend/lib/regimes.ts` — Regime definitions, MARKET_REGIMES constant
- `frontend/lib/regime-time.ts` — `isRegimeActive()`, `getTimeRemaining()`, `getCurrentETTime()`, `getUpcomingRegimes()`
- `frontend/lib/regime-store.ts` — Zustand store for regime state
- `frontend/lib/services/data.ts` — EconCalendarService, NotionService, MarketDataService
- `frontend/types/regime.ts` — MarketRegime type, regime constants
- `frontend/types/context-bank.ts` — ContextBankSnapshot, EconEventSummary, ConsolidatedBrief
- `mobile/components/shared/VixBadge.tsx` — VIX display pattern (T3)
- `mobile/hooks/useVixTicker.ts` — VIX polling pattern (T3)

## What to Build

### 1. `mobile/components/shared/SurfaceCard.tsx`

- **Path:** `mobile/components/shared/SurfaceCard.tsx`
- **Action:** Create
- **Spec:** Nothing-style card wrapper. `var(--surface)` bg, `1px solid var(--border)`, 12px border-radius. Props: `children`, `className?`, `noPadding?` (default padding 16px), `accentBorder?: 'left' | 'top'` (adds 2px `var(--accent)` border on specified side). No shadows. No blur. Flat.
- **Max lines:** 25

### 2. `mobile/components/shared/BottomSheet.tsx`

- **Path:** `mobile/components/shared/BottomSheet.tsx`
- **Action:** Create
- **Spec:** Reusable bottom sheet. Framer Motion slide-up from bottom (300ms ease-out). Backdrop: `rgba(0,0,0,0.8)`. Sheet: `var(--surface)` bg, 16px top border-radius, centered 32px-wide 2px-tall handle bar in `--border-visible`. Props: `isOpen`, `onClose`, `title?` (Space Mono ALL CAPS, centered), `children`. Close on backdrop tap or drag-down (threshold: 100px). Max height: 85vh. Scrollable content area.
- **Max lines:** 80

### 3. `mobile/components/shared/SegmentedBar.tsx`

- **Path:** `mobile/components/shared/SegmentedBar.tsx`
- **Action:** Create
- **Spec:** Nothing signature segmented progress bar. Props: `value: number` (0-100), `segments?: number` (default 10), `color?: string` (default `--text-display`), `size?: 'hero' | 'standard' | 'compact'` (heights: 16px/8px/4px). Renders discrete rectangular blocks with 2px gaps. Filled segments use `color`, empty use `var(--border)`. Square-ended (no border-radius).
- **Max lines:** 40

### 4. `mobile/hooks/useBriefing.ts`

- **Path:** `mobile/hooks/useBriefing.ts`
- **Action:** Create
- **Spec:** Fetches daily brief from backend. Try `useBackend().notion.getMdbBrief()` or equivalent — check NotionService/ContextBankService for the right method. Returns `{ brief: ConsolidatedBrief | null, isLoading: boolean, error: string | null, refresh: () => void }`. Caches in state. Fetch on mount.
- **Max lines:** 40

### 5. `mobile/hooks/useRegimeTracker.ts`

- **Path:** `mobile/hooks/useRegimeTracker.ts`
- **Action:** Create
- **Spec:** Wraps shared regime utilities. Import `isRegimeActive`, `getTimeRemaining`, `getUpcomingRegimes`, `getCurrentETTime` from `@frontend/lib/regime-time`. Import `useRegimes` from `@frontend/lib/regime-store` (if it's a Zustand store). Returns `{ activeRegimes: Regime[], upcomingRegimes: Regime[], timeRemaining: Record<string, string> }`. Updates every 15 seconds (same as desktop RegimeMini). `timeRemaining` is a map of regime name -> formatted countdown string (e.g., "2h 34m").
- **Max lines:** 60

### 6. `mobile/hooks/useEconCalendar.ts`

- **Path:** `mobile/hooks/useEconCalendar.ts`
- **Action:** Create
- **Spec:** Fetches economic events from `useBackend().econCalendar.getEvents()`. Returns `{ events: EconEvent[], isLoading: boolean, refresh: () => void }`. EconEvent shape: `{ time: string, name: string, country: string, importance: 1|2|3, actual?: string, forecast?: string, previous?: string }`. Fetch today + tomorrow events. Sorts by time ascending.
- **Max lines:** 40

### 7. `mobile/components/home/HomePage.tsx`

- **Path:** `mobile/components/home/HomePage.tsx`
- **Action:** Create
- **Spec:** Vertical scroll page. Order top to bottom with `var(--space-xl)` (32px) gaps between sections: BriefingCard, QuickStatsRow, MiniRegimeTracker, MiniSessionCalendar. Padding: 16px horizontal. Cards enter with opacity fade 200ms ease-out, staggered 50ms per section (Framer Motion).
- **Max lines:** 50

### 8. `mobile/components/home/BriefingCard.tsx`

- **Path:** `mobile/components/home/BriefingCard.tsx`
- **Action:** Create
- **Spec:** Daily brief display. SurfaceCard wrapper. Header: `DAILY BRIEF` in Space Mono ALL CAPS `--text-secondary` 11px. Body: brief content in Space Grotesk 14px `--text-primary`. Truncated to 6 lines with `[READ MORE]` link in `--accent` that opens full brief in BottomSheet. Loading state: `[LOADING BRIEF...]` in Space Mono `--text-disabled`. Error: `[BRIEF UNAVAILABLE]` with `[RETRY]` button.
- **Max lines:** 80

### 9. `mobile/components/home/QuickStatsRow.tsx`

- **Path:** `mobile/components/home/QuickStatsRow.tsx`
- **Action:** Create
- **Spec:** Horizontal row of 3 instrument-style mini cards (flex, equal width, 8px gap). Each card: SurfaceCard. Layout per card: top = Space Mono ALL CAPS label (`--text-secondary`, 11px), middle = value in Space Mono 20px `--text-display`, bottom = change/subtitle in `--text-secondary` 12px. Cards: (1) VIX — value from `useVixTicker()`, color-coded. (2) BALANCE — from `useBackend().account.getAccount()`, shows equity. (3) P&L — daily P&L from account, green/red color, with SegmentedBar (compact) showing progress toward daily target (default $500). Data that fails to load shows `[--]`.
- **Max lines:** 80

### 10. `mobile/components/home/MiniRegimeTracker.tsx`

- **Path:** `mobile/components/home/MiniRegimeTracker.tsx`
- **Action:** Create
- **Spec:** SurfaceCard with gold left accent border. Header: `ACTIVE REGIMES` Space Mono ALL CAPS. Active regime: name in Space Grotesk 16px `--text-primary`, countdown in Doto 36px `--text-display` (THE hero number of this widget). Below: bias badge as Nothing-style chip (`1px solid --border-visible`, pill radius, Space Mono ALL CAPS 11px), confidence as SegmentedBar (standard). Next 2 upcoming regimes below in compact rows: name + start time in `--text-secondary`. If no active regime: `[NO ACTIVE REGIME]` in `--text-disabled`. Tap any regime opens BottomSheet with full description, instruments, historical record.
- **Max lines:** 100

### 11. `mobile/components/home/MiniSessionCalendar.tsx`

- **Path:** `mobile/components/home/MiniSessionCalendar.tsx`
- **Action:** Create
- **Spec:** Native econ events list (NO TradingView embed). SurfaceCard wrapper. Header: `ECONOMIC CALENDAR` Space Mono ALL CAPS. Event rows: time in Space Mono `--text-secondary` (12px, fixed width 60px), event name in Space Grotesk `--text-primary` (14px, flex-1), importance as dot indicators (1-3 filled circles, 4px each, 2px gaps). High-importance (3) events: dots in `var(--accent)` gold + name in 500 weight. Dividers: `1px solid var(--border)` between rows. Row height: 44px. Max 8 events shown, with `[+N MORE TODAY]` footer if truncated.
- **Max lines:** 80

### 12. `mobile/App.tsx` (UPDATE)

- **Path:** `mobile/App.tsx`
- **Action:** Modify
- **Spec:** Replace `[HOME]` tab placeholder with `<HomePage />`. Other tabs remain as placeholders.
- **Max lines:** N/A (minor edit)

## Key Rules

- Three-layer hierarchy per widget: one Doto hero, Space Grotesk body, Space Mono ALL CAPS labels
- Segmented progress bars for quantitative data (Nothing signature)
- Loading state is `[LOADING...]` bracket text, NOT skeletons
- No TradingView embeds — build native calendar widget
- Cards: flat, bordered, no shadows, no blur
- Regime tracker countdown in Doto font is the hero moment of the widget
- All data fetched from existing backend endpoints — no new API work needed

## DO NOT

- Use TradingView widget embeds
- Add skeleton loading animations
- Use spring/bounce easing
- Create shadow or blur effects
- Touch `frontend/` or `backend-hono/` files

## Verification

```bash
cd mobile && bun run build
cd mobile && bun run dev
# Home tab shows: BriefingCard, QuickStatsRow, MiniRegimeTracker, MiniSessionCalendar
# Brief loads from backend (or shows [LOADING BRIEF...] then content)
# Regime countdown ticks in Doto font
# Calendar shows today's economic events
# Tap [READ MORE] on brief: bottom sheet with full content
# Tap regime: bottom sheet with full details
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T00:00:00',
  agent: 'claude-code',
  summary: 'T4: Home page with daily briefing card, QuickStats instrument row, MiniRegimeTracker with Doto countdown, native MiniSessionCalendar, shared BottomSheet/SurfaceCard/SegmentedBar components',
  files: ['mobile/components/home/HomePage.tsx', 'mobile/components/home/BriefingCard.tsx', 'mobile/components/home/QuickStatsRow.tsx', 'mobile/components/home/MiniRegimeTracker.tsx', 'mobile/components/home/MiniSessionCalendar.tsx', 'mobile/components/shared/SurfaceCard.tsx', 'mobile/components/shared/BottomSheet.tsx', 'mobile/components/shared/SegmentedBar.tsx', 'mobile/hooks/useBriefing.ts', 'mobile/hooks/useRegimeTracker.ts', 'mobile/hooks/useEconCalendar.ts']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
