# Task Brief: T8 — Polish, /the-feels x Nothing, Deploy

**Date:** 2026-04-14
**Scope:** Animation pass across all components, Nothing design audit, dot-matrix motifs, Lighthouse optimization, touch target audit, and final Vercel deployment to app.pricedinresearch.io.
**Estimated files:** 15-20 (modifications to existing T1-T7 files + 2-3 new)

## Project Memory (READ FIRST)

Before doing anything, read the project memory for critical context, patterns, and feedback from prior work:

- **Memory index:** `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/MEMORY.md`
- **Key memories to load:** feedback_vite_build_paths, feedback_vercel_oom_prebuilt, feedback_deploy_always_release, feedback_deploy_update_cli_tools, feedback_version_alignment, feedback_electron_stale_frontend
- **Master plan:** `/Users/tifos/.claude/plans/tidy-foraging-garden.md`

## Context

All features are built (T1-T7). This track is the quality pass — adding Nothing Design System polish, /the-feels motion design, fixing any visual inconsistencies, running accessibility/performance audits, and deploying to production. This is where the app goes from "works" to "SOTA UX with real TLC."

## Files to Read First

- `mobile/index.css` — Current token system, verify all Nothing tokens present
- `mobile/components/layout/BottomTabBar.tsx` — Tab animations to polish
- `mobile/components/layout/MobileToolbar.tsx` — Toolbar expand/collapse to polish
- `mobile/components/home/HomePage.tsx` — Page enter animations
- `mobile/components/riskflow/RiskFlowCard.tsx` — Card animations
- `mobile/components/chat/ChatPage.tsx` — Message animations
- `mobile/components/shared/BottomSheet.tsx` — Drag physics
- `mobile/components/shared/VixBadge.tsx` — Value change flash
- `mobile/vercel.json` — Deployment config to finalize

## What to Build/Polish

### 1. Page Transition System

- **Files:** `mobile/App.tsx`, `mobile/components/layout/MobileShell.tsx`
- **Action:** Polish
- **Spec:** Framer Motion `AnimatePresence` wrapping tab content. Direction-aware horizontal slide: moving to higher tab index = content slides LEFT (new page enters from right), lower = slides RIGHT. Duration: 300ms, easing: `cubic-bezier(0.25, 0.1, 0.25, 1)`. This is the ONE fluid moment in the Nothing design — the earned exception. Opacity crossfade simultaneously (0 -> 1 over 200ms). No spring, no bounce. Add `navigator.vibrate?.(10)` on tab switch for haptic.

### 2. Card Stagger Animation

- **Files:** `mobile/components/riskflow/RiskFlowPage.tsx`, `mobile/components/home/HomePage.tsx`
- **Action:** Polish
- **Spec:** When cards/widgets load, they enter with staggered opacity fade. Each card: `opacity: 0 -> 1`, duration 200ms, ease-out. Stagger delay: 50ms between cards. Use Framer Motion `variants` with `staggerChildren: 0.05`. NOT a slide — pure opacity (Nothing rule: prefer opacity over position).

### 3. VIX Gold Flash

- **Files:** `mobile/components/shared/VixBadge.tsx`
- **Action:** Polish
- **Spec:** When VIX value changes: momentary gold overlay flash. Implementation: absolute-positioned `var(--accent)` overlay on the number, opacity 0.6 -> 0 over 400ms ease-out. Trigger: compare previous value ref to current value. Only flash on actual change, not initial load.

### 4. Tab Indicator Spring

- **Files:** `mobile/components/layout/BottomTabBar.tsx`
- **Action:** Polish
- **Spec:** Gold underline indicator uses Framer Motion `layoutId="tab-indicator"`. Transition: `type: "tween", duration: 0.25, ease: [0.25, 0.1, 0.25, 1]`. NOT spring — tween with ease-out. Smooth slide between tab positions.

### 5. Toolbar Expand/Collapse

- **Files:** `mobile/components/layout/MobileToolbar.tsx`
- **Action:** Polish
- **Spec:** Chevron icon rotates 180deg when expanded. Framer Motion `animate={{ rotate: isExpanded ? 180 : 0 }}` with tween 200ms ease-out. Content area: `animate={{ height: isExpanded ? 'auto' : 0 }}` with `overflow: hidden`. Opacity fade on content: 0 -> 1 over 150ms, delayed 50ms after height starts expanding.

### 6. Bottom Sheet Drag Physics

- **Files:** `mobile/components/shared/BottomSheet.tsx`
- **Action:** Polish
- **Spec:** Framer Motion `drag="y"` with `dragConstraints={{ top: 0, bottom: 0 }}`. `dragElastic: 0.1` (minimal rubber-band — mechanical feel). `onDragEnd`: if velocity > 300 or dragY > 100px, close. Close animation: slide down + opacity 0 over 250ms ease-out. Open animation: slide up from bottom over 300ms ease-out. Backdrop: opacity 0 -> 0.8 over 200ms.

### 7. Pull-to-Refresh Mechanical Bar

- **Files:** `mobile/components/shared/PullToRefresh.tsx`
- **Action:** Polish
- **Spec:** As user pulls down, segmented bar fills proportionally (pull distance / threshold = fill percentage). Bar uses SegmentedBar component. On release past threshold: bar stays at 100%, shows `[REFRESHING...]`. On complete: bar fades out 200ms. On release before threshold: bar empties mechanically (200ms tween). Haptic on trigger: `navigator.vibrate?.(15)`.

### 8. Dot-Matrix Background Motif

- **Files:** `mobile/index.css`, `mobile/components/home/HomePage.tsx`
- **Action:** Create/Polish
- **Spec:** Add subtle dot-matrix grid to home page background (Nothing signature). CSS: `background-image: radial-gradient(circle, var(--border) 0.5px, transparent 0.5px); background-size: 16px 16px;` Very subtle — opacity 0.3. Only on HomePage, not on other tabs. Applied to the scroll container behind content cards.

### 9. Loading States Audit

- **Files:** All components with loading states
- **Action:** Audit/Polish
- **Spec:** Replace ANY skeleton shimmer or spinner with Nothing-style bracket text:
  - `[LOADING...]` — generic
  - `[LOADING FEED...]` — RiskFlow
  - `[LOADING BRIEF...]` — Briefing card
  - `[CONNECTING...]` — Chat connection
    All in Space Mono, `--text-disabled`, centered. Optional: segmented spinner (4 square blocks rotating) for page-level loading. NO skeleton shimmer. NO circular spinner.

### 10. Touch Target Audit

- **Files:** All interactive components
- **Action:** Audit
- **Spec:** Every tappable element must be >= 44px in its touch-sensitive dimension. Check: tab bar items, filter chips, toggle switches, buttons, card tap areas, bottom sheet rows, chevron toggle, hamburger icon. Fix any that are undersized by adding padding (not by scaling content).

### 11. Accessibility Pass

- **Files:** All components
- **Action:** Audit/Polish
- **Spec:** Add `aria-label` to icon-only buttons (hamburger, send, chevron). Add `role="tab"` and `aria-selected` to tab bar items. Add `role="status"` to connection status and VIX badge. Ensure color contrast: `--text-primary` (#E8E8E8) on `--black` (#000000) = 16.5:1 (passes). `--text-secondary` (#999999) on `--black` = 6.3:1 (passes AA). `--text-disabled` (#666666) on `--black` = 4.0:1 (passes AA for large text only — acceptable for disabled states).

### 12. Performance Optimization

- **Files:** `mobile/vite.config.ts`, various
- **Action:** Polish
- **Spec:** Add manual chunk splitting in Vite config: `vendor_react` (react, react-dom), `vendor_motion` (framer-motion), `vendor_markdown` (react-markdown). Lazy-load non-Home tabs: `React.lazy(() => import('./components/riskflow/RiskFlowPage'))` etc. with Suspense boundary showing `[LOADING...]`. Image optimization: ensure PWA icons are compressed. Font loading: `font-display: swap` on Google Fonts URL.

### 13. Service Worker Registration

- **Files:** `mobile/main.tsx`
- **Action:** Modify
- **Spec:** After React mounts, register service worker in production only:
  ```typescript
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register("/sw.js");
  }
  ```

### 14. Vercel Deployment

- **Files:** `mobile/vercel.json` (verify), deployment commands
- **Action:** Deploy
- **Spec:**
  1. Verify `mobile/vercel.json` has correct rewrites, headers, and SW config
  2. Build locally: `cd mobile && bun install && bun run build` (avoid Vercel remote OOM — memory: feedback_vercel_oom_prebuilt)
  3. Deploy: `cd mobile && vercel build && vercel deploy --prebuilt`
  4. Set environment variables on Vercel project: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY
  5. Add `app.pricedinresearch.io` domain to the Vercel project
  6. Add `app.pricedinresearch.io` to Supabase allowed redirect URLs
  7. Create GitHub release (memory: feedback_deploy_always_release)

### 15. `mobile/components/shared/SegmentedSpinner.tsx` (NEW)

- **Path:** `mobile/components/shared/SegmentedSpinner.tsx`
- **Action:** Create
- **Spec:** Nothing-style loading spinner. 4 square blocks (8x8px each, 2px gap) arranged in a 2x2 grid. Blocks light up sequentially in clockwise order (top-left, top-right, bottom-right, bottom-left). Active block: `--text-display`. Inactive: `--border`. Animation: 150ms per step, infinite loop. No rotation — discrete sequential fill. Used for page-level loading states.
- **Max lines:** 35

## Key Rules

- NEVER use spring or bounce easing — ease-out only (`cubic-bezier(0.25, 0.1, 0.25, 1)`)
- The tab slide is the ONE fluid exception — everything else is opacity/discrete
- Dot-matrix is subtle (opacity 0.3) — never overpowering
- Loading = bracket text, NEVER skeletons
- Touch targets >= 44px, no exceptions
- Always `vercel build && vercel deploy --prebuilt` (memory: feedback_vercel_oom_prebuilt)
- Always create GitHub release on deploy (memory: feedback_deploy_always_release)
- package.json version must match release tag (memory: feedback_version_alignment)

## DO NOT

- Add spring/bounce animations anywhere
- Use skeleton loading shimmer
- Add shadows or blur effects
- Deploy via Vercel remote build (OOMs)
- Skip the GitHub release
- Make the dot-matrix grid too prominent (0.3 opacity max)

## Verification

```bash
cd mobile && bun run build
# Zero errors, check bundle size (target < 300KB gzipped)

cd mobile && bun run dev
# Full visual audit:
# 1. Tab switching: smooth horizontal slide, gold indicator slides
# 2. Home page: cards stagger in with opacity
# 3. VIX: value changes flash gold
# 4. Toolbar: chevron rotates, content fades in
# 5. RiskFlow: pull-to-refresh fills segmented bar
# 6. Bottom sheets: drag to dismiss feels mechanical
# 7. All loading states show [LOADING...] bracket text
# 8. Dot-matrix grid visible on home page background
# 9. No skeleton shimmers anywhere

# Lighthouse audit:
# Performance > 90
# Accessibility > 90
# PWA: all checks pass
# Best Practices > 90

# Deploy:
cd mobile && vercel build && vercel deploy --prebuilt
# Verify on app.pricedinresearch.io
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T00:00:00',
  agent: 'claude-code',
  summary: 'T8: Nothing x /the-feels polish pass — page transitions, card stagger, VIX gold flash, mechanical toolbar/bottomsheet, dot-matrix motif, accessibility audit, touch targets, Vercel deploy to app.pricedinresearch.io',
  files: ['mobile/App.tsx', 'mobile/main.tsx', 'mobile/index.css', 'mobile/components/layout/BottomTabBar.tsx', 'mobile/components/layout/MobileToolbar.tsx', 'mobile/components/shared/BottomSheet.tsx', 'mobile/components/shared/PullToRefresh.tsx', 'mobile/components/shared/VixBadge.tsx', 'mobile/components/shared/SegmentedSpinner.tsx', 'mobile/vite.config.ts']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
