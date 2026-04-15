# Task Brief: T3 — Mobile Shell + Navigation + Toolbar + Hamburger

**Date:** 2026-04-14
**Scope:** Bottom tab navigation, expandable VIX toolbar, StickyBulletin expander, and hamburger menu with Harper connection refresh.
**Estimated files:** 10

## Project Memory (READ FIRST)

Before doing anything, read the project memory for critical context, patterns, and feedback from prior work:

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Key memories to load:** feedback_intersection_observer_root, feedback_agent_colors_unified, feedback_catalyst_terminology, feedback_backend_client_pattern
- **Master plan:** `/Users/tifos/.claude/plans/tidy-foraging-garden.md`

## Context

This track builds the app shell — the persistent chrome that wraps all page content. Nothing Design System: monochrome, typographic, industrial. Bottom tab bar with Space Mono ALL CAPS labels and gold dot indicator. Expandable toolbar with live VIX in Doto font and StickyBulletin. Hamburger menu in a bottom sheet for Harper connection refresh and session management.

## Files to Read First

- `frontend/components/layout/TopHeader.tsx` — Desktop header pattern (VIX display, controls)
- `frontend/components/layout/NavSidebar.tsx` — Desktop navigation pattern
- `frontend/components/StickyBulletin.tsx` — StickyBulletin component (personal trade notes + antilag)
- `frontend/lib/services/data.ts` — MarketDataService (getVix, market data endpoints)
- `frontend/lib/severity-config.ts` — Severity color mapping
- `mobile/index.css` — Nothing x Fintheon tokens (created by T1)
- `mobile/contexts/AuthContext.tsx` — useAuth() for session info (created by T2)
- `mobile/lib/backend.ts` — useBackend() for API calls (created by T2)

## What to Build

### 1. `mobile/hooks/useVixTicker.ts`

- **Path:** `mobile/hooks/useVixTicker.ts`
- **Action:** Create
- **Spec:** Polls `/api/market-data` every 30s via `useBackend().marketData.getVix()` (or equivalent service method — check the MarketDataService). Returns `{ value: number, change: number, changePercent: number, isStale: boolean, lastUpdated: Date }`. Uses Zustand store for global access so VIX is available in toolbar and home page without duplicate fetches. `isStale` = true if last update > 90s ago. Start polling on mount, stop on unmount.
- **Max lines:** 50

### 2. `mobile/hooks/useSwipeGesture.ts`

- **Path:** `mobile/hooks/useSwipeGesture.ts`
- **Action:** Create
- **Spec:** Generic touch swipe detection hook. Takes a ref and callbacks: `onSwipeLeft`, `onSwipeRight`, `onSwipeUp`, `onSwipeDown`. Velocity threshold: 0.3px/ms minimum to avoid accidental swipes. Minimum distance: 50px. Uses `touchstart`/`touchmove`/`touchend` events. Returns nothing — just attaches listeners.
- **Max lines:** 60

### 3. `mobile/hooks/useStickyBulletin.ts`

- **Path:** `mobile/hooks/useStickyBulletin.ts`
- **Action:** Create
- **Spec:** Fetches StickyBulletin data from `/api/sticky-bulletin` via `useBackend()`. Returns `{ notes: string[], antilagTimes: string[], isLoading: boolean, refresh: () => void }`. Fetches on mount, provides manual refresh.
- **Max lines:** 40

### 4. `mobile/components/layout/MobileShell.tsx`

- **Path:** `mobile/components/layout/MobileShell.tsx`
- **Action:** Create
- **Spec:** Root layout component. Structure: `MobileToolbar` (fixed top) + `<main>` content area (flex-1, overflow-y-auto) + `BottomTabBar` (fixed bottom). Handles `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` padding. Background: `var(--black)`. Content area receives the active tab's page component via `activeTab` prop or context. Uses `useSwipeGesture` on the main content area for tab switching.
- **Max lines:** 60

### 5. `mobile/components/layout/BottomTabBar.tsx`

- **Path:** `mobile/components/layout/BottomTabBar.tsx`
- **Action:** Create
- **Spec:** 4 tabs: Home (LayoutDashboard icon), RiskFlow (Newspaper), Chat (MessageSquare), Settings (Settings) — all from lucide-react. Labels: Space Mono, ALL CAPS, 11px, letter-spacing 0.08em. Active tab: `--text-display` color + 2px gold underline below (Framer Motion `layoutId="tab-indicator"` for sliding animation). Inactive: `--text-disabled`. Height: 56px. Background: `var(--surface)`. Top border: `1px solid var(--border)`. Icons: 20x20, monoline. Touch targets: each tab is flex-1, full height (>= 44px). Export `activeTab` state and `setActiveTab` via context or props.
- **Max lines:** 80

### 6. `mobile/components/layout/MobileToolbar.tsx`

- **Path:** `mobile/components/layout/MobileToolbar.tsx`
- **Action:** Create
- **Spec:** Fixed top bar. Collapsed state (48px height): Fintheon wordmark left (Space Grotesk 500, 18px), VixBadge center, hamburger icon right (three horizontal lines, `--text-secondary`). Below the main bar: chevron toggle row (centered ChevronDown icon). When chevron tapped: expands to reveal `ToolbarExpanded` below (Framer Motion `animate={{ height: 'auto' }}` with `ease-out` 300ms — NOT spring). Chevron rotates 180deg when expanded. Background: `var(--black)`. Bottom border: `1px solid var(--border)` (only when collapsed).
- **Max lines:** 80

### 7. `mobile/components/layout/ToolbarExpanded.tsx`

- **Path:** `mobile/components/layout/ToolbarExpanded.tsx`
- **Action:** Create
- **Spec:** Expanded content below toolbar chevron. Shows StickyBulletin data from `useStickyBulletin()`. Renders: personal trade notes as compact text rows (Space Grotesk, `--text-primary`, 14px), antilag times as Space Mono `--text-secondary` ALL CAPS labels. Background: `var(--surface)`. Padding: 12px 16px. Bottom border: `1px solid var(--border)`. Fades in with opacity 200ms ease-out. Max 3 notes shown, with `[+N MORE]` if truncated.
- **Max lines:** 60

### 8. `mobile/components/layout/HamburgerMenu.tsx`

- **Path:** `mobile/components/layout/HamburgerMenu.tsx`
- **Action:** Create
- **Spec:** Bottom sheet triggered by hamburger icon tap. Uses Framer Motion for slide-up animation (300ms ease-out). Backdrop: `rgba(0,0,0,0.8)`. Sheet: `var(--surface)` bg, 16px top radius, 2px handle bar centered. Content rows (44px height each, full-width, `1px solid var(--border)` dividers):
  1. `[REFRESH HARPER]` — Space Mono ALL CAPS. On tap: pings `/api/harper/health` (or relay endpoint). Shows inline status: `[CONNECTED]` in `--success` or `[OFFLINE]` in `--error`, Space Mono caption. Status replaces button text for 3s then reverts.
  2. `[SESSION]` — Shows `user.email` from `useAuth()` in `--text-secondary`
  3. `[SIGN OUT]` — Space Mono ALL CAPS, `--error` color. On tap: calls `signOut()` from auth context.
  4. `[ABOUT]` — Shows version and build timestamp in `--text-disabled`
     Close on backdrop tap or swipe down.
- **Max lines:** 100

### 9. `mobile/components/shared/VixBadge.tsx`

- **Path:** `mobile/components/shared/VixBadge.tsx`
- **Action:** Create
- **Spec:** Compact VIX display. Shows value in Doto font (24px on mobile, the "one moment of surprise"). Change percent in Space Mono `--text-secondary` 11px. Color logic: value < 20 = `--text-display` (calm), 20-30 = `--warning`, >30 = `--error`. On value change: gold flash animation (opacity 1 -> 0 over 300ms on a `var(--accent)` overlay). Uses `useVixTicker()` hook. Shows `[--.-]` in `--text-disabled` when stale.
- **Max lines:** 50

### 10. `mobile/App.tsx` (UPDATE)

- **Path:** `mobile/App.tsx`
- **Action:** Modify
- **Spec:** Replace `[AUTHENTICATED]` placeholder with `<MobileShell>` wrapping tab content. Create a simple tab router: state `activeTab` (0-3), render the matching page placeholder: `[HOME]`, `[RISKFLOW]`, `[CHAT]`, `[SETTINGS]` centered text. Wrap in `TabContext` provider so BottomTabBar and MobileShell can read/write activeTab. Page transitions: Framer Motion `AnimatePresence` with horizontal slide (slide left when going to higher index, right when lower). Duration: 300ms, ease-out.
- **Max lines:** 100

## Key Rules

- Nothing design: NO spring/bounce easing. Use `cubic-bezier(0.25, 0.1, 0.25, 1)` or ease-out only.
- NO shadows, NO blur, NO glass morphism on any component
- ALL labels in Space Mono, ALL CAPS, 0.06-0.08em letter-spacing
- Touch targets >= 44px on all interactive elements
- VIX is the ONE Doto hero moment in the toolbar
- Agent colors are always #D4AF37 (Solvys Gold) — never per-agent variations (memory: feedback_agent_colors_unified)
- Haptic feedback: `navigator.vibrate?.(10)` on tab switch

## DO NOT

- Add spring or bounce animations
- Use shadows or blur effects
- Create page content (Home, RiskFlow, Chat, Settings pages are T4-T6)
- Touch `frontend/` or `backend-hono/` files
- Add skeleton loading — use `[LOADING...]` bracket text

## Verification

```bash
cd mobile && bun run build
cd mobile && bun run dev
# Should show: toolbar with VIX badge + bottom tab bar with 4 tabs
# Tapping tabs: placeholder text slides horizontally
# Swiping left/right on content: changes tabs
# Tapping chevron: expands/collapses StickyBulletin
# Tapping hamburger: bottom sheet with Harper refresh + session + sign out
# VIX updates every 30s (check network tab)
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T00:00:00',
  agent: 'claude-code',
  summary: 'T3: Mobile shell with Nothing-style bottom tabs, expandable VIX toolbar (Doto font), StickyBulletin expander, hamburger menu with Harper refresh',
  files: ['mobile/components/layout/MobileShell.tsx', 'mobile/components/layout/BottomTabBar.tsx', 'mobile/components/layout/MobileToolbar.tsx', 'mobile/components/layout/ToolbarExpanded.tsx', 'mobile/components/layout/HamburgerMenu.tsx', 'mobile/components/shared/VixBadge.tsx', 'mobile/hooks/useVixTicker.ts', 'mobile/hooks/useSwipeGesture.ts', 'mobile/hooks/useStickyBulletin.ts', 'mobile/App.tsx']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
