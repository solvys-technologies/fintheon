# S18 Session Debrief — Mobile PWA T8 Polish + S18 Redesign

**Date:** 2026-04-15
**Commits:** v5.15.4 (`0074c6e`), v5.15.5 (`38a2176`)
**Production URL:** https://fintheon.pricedinresearch.io
**Vercel Project:** `fintheon-mobile` (renamed from `mobile`) under `solvys` team

---

## What Was Done

### Phase 1: T8 Polish Pass (v5.15.4)

Completed the full T8 brief from `docs/sprint-briefs/MOBILE-T8-polish-deploy.md`. Every item was implemented:

1. **Page transitions** — Direction-aware horizontal slide + split opacity (200ms) / position (300ms) easing
2. **Card stagger** — Framer Motion `variants` with `staggerChildren: 0.05`, pure opacity
3. **VIX gold flash** — 400ms duration, skips initial load (only on actual value change)
4. **Tab indicator** — Tween 0.25s with Nothing ease, `role="tab"` + `aria-selected`
5. **Toolbar expand** — Chevron rotates 200ms, content opacity fades with 50ms delay
6. **BottomSheet** — Velocity > 300 OR drag > 100px closes, `dragConstraints` both axes
7. **PullToRefresh** — Haptic `navigator.vibrate(15)` on trigger
8. **Dot-matrix** — 0.5px dots on 16px grid, opacity 0.3 background layer on HomePage only
9. **SegmentedSpinner** — New 2x2 block spinner at `mobile/components/shared/SegmentedSpinner.tsx`
10. **Lazy loading** — RiskFlowPage, ChatPage, SettingsPage lazy-loaded with `[LOADING...]` fallback
11. **Chunk splitting** — `vendor_react` (1.5KB), `vendor_motion` (45KB), `vendor_markdown` (36KB)
12. **SW registration** — Production-only in `main.tsx`
13. **Accessibility** — aria-labels on all icon buttons, role="status" on VIX + connection
14. **Touch targets** — Chevron 28→44px, theme swatches 40→44px, session button padded

### Phase 2: Deployment Issues

Several issues discovered and fixed during first production deploy:

1. **Vercel deployment protection** — `ssoProtection: "all_except_custom_domains"` gates `.vercel.app` URLs but not custom domains. Custom domain `fintheon.pricedinresearch.io` bypasses the gate.

2. **No env vars on Vercel project** — `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` were never set on the `fintheon-mobile` Vercel project. Added via `vercel env add`. Without these, the supabase client is `null` and login silently fails.

3. **`detectSessionInUrl: false`** — The shared `@frontend/lib/supabase.ts` has `detectSessionInUrl: false` for Electron deep links. Mobile web needs `true` to pick up OAuth tokens from the URL hash. Created `mobile/lib/supabase.ts` with `detectSessionInUrl: true`. Updated `mobile/contexts/AuthContext.tsx` to import from `../lib/supabase` instead of `@frontend/lib/supabase`.

4. **Supabase redirect URL** — `https://fintheon.pricedinresearch.io/**` must be in Supabase Auth > URL Configuration > Redirect URLs. User added this manually in the Supabase dashboard.

5. **Domain assignment** — `fintheon.pricedinresearch.io` was aliased to the mobile deployment via `vercel alias`. The domain `app.pricedinresearch.io` remains on `pulse-legacy` (attempted move but CLI couldn't force-remove from another project).

### Phase 3: S18 Redesign (v5.15.5)

After production testing revealed multiple issues, executed a full redesign:

#### Bugs Fixed

1. **RiskFlow crash** — `MobileRiskFlowProvider` was never mounted in the component tree. `useMobileRiskFlow()` threw. Also, `RiskFlowContext.tsx` imported `useBackend()` from `@frontend/lib/backend` which uses the desktop supabase client. Changed to `getMobileBackend(getAccessToken)` from `../lib/backend.ts`.

2. **Themes breaking Nothing tokens** — `applyThemeToDOM()` in `ThemeContext.tsx` was overwriting `--surface`, `--border`, `--text`, etc. with theme values, destroying the Nothing design system base tokens. Fixed: only set `--fintheon-*` tokens and `--accent`. Nothing base tokens (`--surface: #0a0a0a`, `--border: #1a1a1a`, etc.) are now immutable.

3. **Toggle styling** — The push notification toggle had `minHeight: 44` on a 28px-tall button, causing the visual toggle and knob to misalign. Restructured: outer `<button>` is the 44px hit area, inner `<div>` is the visual 48x28 toggle. Uses `var(--accent)` when ON.

4. **ChatPage merge conflicts** — The `fintheon install` script caused a `git stash pop` that created merge conflicts in ChatPage, HamburgerMenu, and RiskFlowCardExpanded. Resolved by keeping S18 changes. ChatPage was reverted to clean T6 version (no S17 store/queue features) since those deps weren't available.

#### Navigation Overhaul

1. **Removed `<BottomTabBar>`** from `MobileShell`. No more fixed bottom nav.
2. **Hamburger menu** now contains navigation items: `[DASH]`, `[RISKFLOW]`, `[SETTINGS]` with accent highlight on active tab. Accepts `activeTab` and `onNavigate` props.
3. **FloatingChatButton** — New component at `mobile/components/layout/FloatingChatButton.tsx`. 56px accent circle, `MessageSquare` icon, bottom-right corner, opens chat overlay. Hides when chat is open.
4. **Chat is now a full-screen overlay** — Slides up over content, has an X close button (top-right, `zIndex: 1000`). Stays mounted with `display: none` when closed per memory.
5. **MobileShell** accepts new props: `chatOpen` and `onChatToggle`.

#### Dash Page Restructure

1. Renamed concept "HOME" → "DASH" in nav labels
2. Widget order: **VIX hero** (centered, large) → **IV Scoring placeholder** → **Brief** → **Regime Tracker** → **Economic Calendar**
3. Removed Balance/P&L tickers from QuickStatsRow (will go on separate KPI page later)
4. Increased section gaps from 32px → 48px
5. Fintheon wordmark in toolbar uses `var(--accent)` for theme sensitivity

#### Fading Dividers

Added `.fade-divider` CSS class to `index.css`:

```css
.fade-divider {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--border-visible) 20%,
    var(--border-visible) 80%,
    transparent
  );
}
```

Replaced solid `borderBottom: "1px solid var(--border)"` with `<div className="fade-divider" />` elements across: MobileToolbar, HamburgerMenu rows, ChatPage header, RiskFlowCardExpanded.

---

## What's NOT Done (Carry Forward)

1. **S17 chat features** — The S17 window added `useChatStore`, `QueuePopover`, `ThinkingIndicator`, `ToolCallPane`, stop button, etc. These were partially clobbered by the update script. ChatPage is currently running the clean T6 SSE version. S17 features need to be re-integrated once the store exists.

2. **KPI page** — Balance/P&L removed from Dash but no dedicated KPI page created yet. Spec: separate page accessible from header menu, shows Balance + P&L as hero numbers.

3. **IV Scoring widget** — Currently a `[IV SCORING COMING SOON]` placeholder on Dash. Needs the actual IV scoring data from the backend.

4. **Economic Calendar embed** — Currently using native backend econ calendar data. User mentioned wanting a real API-driven calendar if TradingView embed isn't possible. Current implementation works but may need enhancement.

5. **Update script isolation** — `fintheon install/update` clobbers uncommitted mobile changes via `git stash pop`. Needs a `--target` flag or variant detection so mobile and desktop don't interfere. Memory saved: `feedback_update_script_clobbers_mobile.md`.

6. **Scroll-lock pagination** — User requested "scroll lock function from Fintheon's local variant" on the Dash. Not implemented yet.

7. **`app.pricedinresearch.io` domain** — Still assigned to `pulse-legacy` project. CLI couldn't force-move it. Needs manual removal in Vercel dashboard before reassigning to `fintheon-mobile`.

---

## Key Files Modified

| File                                              | What Changed                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `mobile/App.tsx`                                  | Lazy loading, MobileRiskFlowProvider wrapping, chat overlay state, removed BottomTabBar references |
| `mobile/lib/supabase.ts`                          | NEW — Mobile-specific supabase with `detectSessionInUrl: true`                                     |
| `mobile/contexts/AuthContext.tsx`                 | Imports from `../lib/supabase` not `@frontend/lib/supabase`                                        |
| `mobile/contexts/RiskFlowContext.tsx`             | Uses `getMobileBackend(getAccessToken)` not `useBackend()`                                         |
| `mobile/contexts/ThemeContext.tsx`                | Only sets `--fintheon-*` + `--accent`, doesn't override Nothing tokens                             |
| `mobile/components/layout/MobileShell.tsx`        | Removed BottomTabBar, added FloatingChatButton, new chatOpen/onChatToggle props                    |
| `mobile/components/layout/HamburgerMenu.tsx`      | Added nav items (DASH/RISKFLOW/SETTINGS), accepts activeTab/onNavigate                             |
| `mobile/components/layout/FloatingChatButton.tsx` | NEW — 56px accent FAB                                                                              |
| `mobile/components/layout/MobileToolbar.tsx`      | Wordmark uses `var(--accent)`, chevron 44px height, fading dividers                                |
| `mobile/components/home/HomePage.tsx`             | Reordered: VIX → IV placeholder → Brief → Regime → Calendar, 48px gaps                             |
| `mobile/components/settings/SettingsPage.tsx`     | Toggle redesigned: hit area wrapper, accent ON state                                               |
| `mobile/components/shared/SegmentedSpinner.tsx`   | NEW — Nothing-style 2x2 clockwise block spinner                                                    |
| `mobile/components/shared/VixBadge.tsx`           | 400ms flash, skips initial load, role="status"                                                     |
| `mobile/components/shared/SurfaceCard.tsx`        | Removed `border border-[var(--border)]` class                                                      |
| `mobile/components/shared/BottomSheet.tsx`        | Velocity check, dragConstraints both axes                                                          |
| `mobile/index.css`                                | Added `.fade-divider` + `.fade-divider-top::before` CSS, dot-matrix 0.5px/16px                     |
| `mobile/vite.config.ts`                           | Manual chunk splitting (vendor_react, vendor_motion, vendor_markdown)                              |
| `mobile/main.tsx`                                 | SW registration in production                                                                      |

---

## Vercel Config

- **Project:** `fintheon-mobile` (ID: `prj_JYYZ5KqQgdEUkQtjKgrPRxd6PP0W`)
- **Team:** `solvys` (ID: `team_buW79sm7SrdpqYCxzjxbMPG4`)
- **Env vars set:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Domain:** `fintheon.pricedinresearch.io` (aliased)
- **SSO Protection:** `all_except_custom_domains` — custom domain bypasses Vercel login
- **Deploy method:** Always `vercel build --prod && vercel deploy --prebuilt --prod` (remote OOMs)

---

## Memories Saved This Session

- `feedback_update_script_clobbers_mobile.md` — `fintheon install` reverts uncommitted mobile changes

## Critical Rules for Next Instance

1. **Never import from `@frontend/lib/supabase` or `@frontend/lib/backend`** in mobile code — use `mobile/lib/supabase.ts` and `mobile/lib/backend.ts`
2. **Never override Nothing base CSS tokens** (`--surface`, `--border`, `--text-*`) in ThemeContext — only `--fintheon-*` and `--accent`
3. **Always commit mobile changes before running `fintheon install/update`** — the script will clobber uncommitted files
4. **Chat must stay mounted with `display: none`** when not visible — streams survive navigation
5. **Always `vercel build --prod && vercel deploy --prebuilt --prod`** — remote build OOMs
6. **Always create GitHub release on deploy** (skipped this session due to rapid iteration)
