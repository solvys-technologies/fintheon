# S26 — Part 1: Polish + Cleanup

## Context

Part 1 of a **sequential two-part sprint** (one agent, fresh thread). You are starting on branch `s24-unify`. When this brief is complete, commit with `v.26.1` prefix, then open `@docs/sprint-briefs/S26-PART-2-heavy.md` and continue.

These 6 items are pure UI/config edits. No new modals, no backend routes, no gesture math. Goal: land the low-risk polish first so Part 2 has a clean testing surface.

## Branch Target

`s24-unify`

## Read Before Touching Anything

1. `src/lib/changelog.ts` — recent entries are intentional. Check any file you're about to edit.
2. `mobile/components/shared/SnapSheet.tsx` — **only read, do not edit in Part 1**. Rewritten in S24. Part 2 touches it, not Part 1.
3. TP's non-negotiables: glassmorphic before kanban, no gradients, no colored emojis, no vertical borders. Solvys Gold palette.
4. No time estimates. No card outlines. No Trello look.

---

## Item 2 — Briefing: no IV score

> TP: _"The briefing does not need an IV score. Do not score the IV briefings, or do not score the briefings themselves."_

The parallel thread shipped the S25 SOTA DetailSheet with an IV fuse in the footer via `DetailFooter.tsx`. It's correct for RiskFlow/catalyst views but wrong for the briefing.

### Files

- [`mobile/components/catalyst-modal/BriefDetail.tsx`](mobile/components/catalyst-modal/BriefDetail.tsx)
- [`mobile/components/catalyst-modal/DetailFooter.tsx`](mobile/components/catalyst-modal/DetailFooter.tsx)

### Steps

1. Read `DetailFooter.tsx`. Find where `IVFuseBar` is rendered.
2. Add a `showIV?: boolean` prop defaulting to `true`. When `false`, omit the fuse bar AND the "Ask CAO" Ask-CAO CTA can stay (briefings still benefit from Ask CAO). If the Ask-CAO CTA is tied structurally to the fuse, isolate them.
3. In `BriefDetail.tsx`, render `<DetailFooter showIV={false} .../>`.

### Definition of Done

- [ ] Briefing modal renders WITHOUT the left IV fuse bar
- [ ] RiskFlow + Catalyst + ToolApproval modals still render the fuse unchanged
- [ ] Ask CAO CTA still works on briefing modal (or intentionally removed — ask no one, use judgement based on TP's focus on "not scoring")
- [ ] `cd mobile && npx tsc --noEmit` clean

---

## Item 3 — Headline peek → full expansion + view-original link

> TP: _"I'm supposed to be able to click headlines in Fintheon to be able to peek and view the original headline, like the original Twitter headline, like the link to the Twitter headline. I would love that, if possible. What it most definitely needs to do is, when somebody clicks it, the whole headline should pop up, not a duplicate with the preview and the actual headline, just the full headline."_

Currently `RiskFlowDetail.tsx` renders both a summary/preview and the full headline — duplicate. Kill the preview, show the full headline once, and add a "View original" link using `item.url` (which is populated for Twitter items and Agent Reach items — see `backend-hono/src/services/agent-reach-service.ts`).

### Files

- [`mobile/components/catalyst-modal/RiskFlowDetail.tsx`](mobile/components/catalyst-modal/RiskFlowDetail.tsx)
- [`mobile/components/catalyst-modal/DetailHeader.tsx`](mobile/components/catalyst-modal/DetailHeader.tsx) (if the duplicate lives here)

### Steps

1. Grep `RiskFlowDetail.tsx` for both the preview/summary render and the full-headline render. One of them is the duplicate.
2. Keep the larger, full-text headline. Delete the truncated preview variant.
3. Below the headline, add a small link row: `→ View original` that `window.open(item.url, "_blank")` when present. Style: `font-family: var(--font-data)`, `font-size: 11px`, `color: var(--fintheon-accent)`, uppercase tracking 0.12em. Conditional render — no `item.url` = no link.
4. If the `EmbedPreview` component is already showing a tweet preview for Twitter URLs (it is, per S25 changelog), leave it — that's intentional rich preview, not duplication.

### Definition of Done

- [ ] Tapping a RiskFlow card and scrolling the modal shows the headline exactly ONCE
- [ ] For items with a `url`, a "View original" link appears under the headline
- [ ] Clicking the link opens the source (Twitter / FJ / Reuters etc.) in a new tab
- [ ] EmbedPreview tweet cards still render where applicable

---

## Item 4 — Settings: horizontal-only dividers, invisible until interacted

> TP: _"the settings look great, but I don't want them to be cards. I don't want vertical border lines. I want everything to be separated by horizontal border lines, but then I want them to be invisible so people shouldn't really be able to see what it is that is dividing them until they expand or contract a specific subsection inside the settings."_

### Files

- [`mobile/components/settings/CollapsibleSection.tsx`](mobile/components/settings/CollapsibleSection.tsx)
- [`mobile/components/settings/SettingsPage.tsx`](mobile/components/settings/SettingsPage.tsx)

### Steps

1. Read `CollapsibleSection.tsx`. It currently uses a card surface (glass background + border + rounded corners).
2. Strip the card: remove `background`, `border`, `borderRadius`, `backdropFilter`, `boxShadow`. Keep only vertical padding and the chevron header.
3. Add a bottom border (1px solid) that is `rgba(255,255,255,0)` (fully transparent) by default.
4. When the section is expanded OR its neighbor is animating, fade the border in to `var(--fintheon-accent)` at 0.08 opacity via a 200ms transition. Use a context or parent-broadcast to know when a neighbor is interacting, OR simpler: fade in on hover AND while open.
5. No vertical borders anywhere in the settings list.
6. In `SettingsPage.tsx`, strip any remaining card wrappers around CollapsibleSection instances.

### Definition of Done

- [ ] Settings page with all sections closed shows NO visible borders or card outlines
- [ ] Expanding any section fades in its separator line softly (8% accent)
- [ ] Collapsing re-fades to transparent
- [ ] No vertical lines anywhere
- [ ] Chevron still rotates on expand/collapse

---

## Item 6 — Trader section: strip everything except display name

> TP: _"the CAO name does not need to be there; it should be read-only. The display name should be read-only and it should match what is on the desktop. As far as the trader's name tag, it should be read-only. The risk limits don't need to be there; scrap that completely."_

### Files

- [`mobile/components/settings/TraderSection.tsx`](mobile/components/settings/TraderSection.tsx)

### Steps

1. Read the file.
2. Delete the CAO name row entirely (not just read-only — gone).
3. Display name: make read-only. Value source: `useSettings().traderName` (already exists — this is what desktop writes to). Render as a dim glass pill with the text, no input affordance.
4. Trader's name tag: same treatment — read-only.
5. Risk limits (max loss, position size, whatever fields exist): DELETE every risk-limit row and any associated state/persistence.
6. If the section ends up with only 2 rows, that's correct.

### Definition of Done

- [ ] TraderSection shows display name (read-only) + trader tag (read-only) and nothing else
- [ ] Desktop-set display name reflects on mobile on next settings load
- [ ] No risk-limit fields visible or persisted
- [ ] No CAO name visible
- [ ] SettingsContext no longer carries removed fields (grep for field names to confirm)

---

## Item 7 — Haptic feedback helpers

> TP: _"We still don't have any haptic feedback as far as vibration micro-interactions that could be added to the app, and I want to add those for all refreshes, denied motions, and success messages. I want them to all have vibrational micro-reactions or micro-interactions."_

### Files (new + wiring)

- **NEW** `mobile/lib/haptics.ts`
- [`mobile/components/shared/PullToRefresh.tsx`](mobile/components/shared/PullToRefresh.tsx) — fire on refresh complete
- [`mobile/components/notifications/NotificationDrawer.tsx`](mobile/components/notifications/NotificationDrawer.tsx) — fire on approve/deny
- [`mobile/contexts/ToastContext.tsx`](mobile/contexts/ToastContext.tsx) (mobile version — verify it exists) — fire on success toast
- [`mobile/contexts/SettingsContext.tsx`](mobile/contexts/SettingsContext.tsx) — add `hapticsEnabled: boolean` (default `true`)
- [`mobile/components/settings/NotificationsSection.tsx`](mobile/components/settings/NotificationsSection.tsx) — add a toggle for it

### Steps

1. Create `mobile/lib/haptics.ts`:
   ```ts
   // [claude-code YYYY-MM-DD] S26-T7: haptic micro-interactions
   let enabled = true;
   export function setHapticsEnabled(v: boolean) {
     enabled = v;
   }
   function buzz(pattern: number | number[]) {
     if (!enabled) return;
     try {
       navigator.vibrate?.(pattern);
     } catch {}
   }
   export const haptic = {
     tap: () => buzz(10),
     success: () => buzz([12, 40, 12]),
     deny: () => buzz([30, 30, 30]),
   };
   ```
2. Add `hapticsEnabled` to `SettingsContext` (boolean, default true, persist to localStorage). Wire `setHapticsEnabled()` from the module on every change.
3. In `PullToRefresh.tsx`, call `haptic.tap()` when the refresh threshold is crossed (arming the refresh), and `haptic.success()` when `onRefresh()` resolves.
4. In `NotificationDrawer.tsx`, call `haptic.success()` in the approve path and `haptic.deny()` in the deny path.
5. In the mobile toast context, call `haptic.success()` for `variant === "success"`, `haptic.deny()` for `variant === "error"`. Leave info toasts silent.
6. Add a "Haptics" toggle row in the mobile Notifications settings section.

### Definition of Done

- [ ] `navigator.vibrate` is called only when setting is enabled
- [ ] Pull-to-refresh, notification approve/deny, and success toasts all fire haptics on a real iOS or Android device (desktop browser ignores `.vibrate`)
- [ ] Settings toggle persists across reloads
- [ ] No TS errors — `vibrate` is typed optional via `navigator.vibrate?.()`

---

## Item 8 — About: website link

> TP: _"in the About section, put a link to our website, which is pricedinresearch.io/fintion."_

### Files

- [`mobile/components/settings/SettingsPage.tsx`](mobile/components/settings/SettingsPage.tsx) — About section

### Steps

1. Find the About collapsible section in `SettingsPage.tsx`.
2. Add a row: `→ pricedinresearch.io/fintion` that opens `https://pricedinresearch.io/fintion` in a new tab.
3. Style: matches the rest of the About section (data font, small caps, muted color on the arrow, accent on the link text).

### Definition of Done

- [ ] About section shows the website row
- [ ] Tapping it opens the URL in a new tab (or system browser on PWA)
- [ ] No stray card surface — matches the new borderless style from Item 4

---

## Part 1 Validation (run before committing)

```bash
# From repo root
cd mobile
npx tsc --noEmit
find dist -mindepth 1 -delete 2>/dev/null || true
npx vite build 2>&1 | tail -20
cd ..
```

- [ ] tsc clean
- [ ] vite build clean
- [ ] Changelog entry added to `src/lib/changelog.ts` (single entry covering all 6 items, date `2026-04-19T...`, agent `claude-code`)
- [ ] Git commit: `v.26.1 feat(mobile): S26-P1 polish — briefing no-IV, full headlines, invisible dividers, trader cleanup, haptics, website link`

## Handoff to Part 2

When the commit lands and validation passes, open:

```
@docs/sprint-briefs/S26-PART-2-heavy.md
```

Do not start Part 2 before Part 1 is committed.
