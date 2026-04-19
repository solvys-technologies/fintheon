# S26 — Part 2: Heavy UX + Backend

## Context

Part 2 of a **sequential two-part sprint**. Part 1 must be committed before you start here. You are on branch `s24-unify`.

These 4 items are the hard ones — gesture-math rewrite, full theme-picker overhaul, new backend route + super-admin modal, and a choreographed IV-fuse animation between two React trees. Read every TP quote carefully; the voice of the request often carries a spec detail the prose would lose.

TP sign-off on this part:

> _"Make all this stuff a win. It's necessary for all this stuff to get done, but you know, make me proud."_

## Branch Target

`s24-unify`

## Read Before Touching Anything

1. [`mobile/components/shared/SnapSheet.tsx`](mobile/components/shared/SnapSheet.tsx) — **rewritten in S24, read the whole file and the S24 changelog entry before touching.** Every popup in the app uses this surface. Breakage cascades.
2. `src/lib/changelog.ts` — S24 + S25 entries name most of the files you'll touch.
3. Pre-tool hook blocks `rm -rf`. Use `find dist -mindepth 1 -delete` instead.
4. No time estimates, no card outlines, no vertical borders. Glassmorphic before kanban.

---

## Item 1 — Bulletin scroll-lock (SnapSheet gesture math)

> TP: _"we have to make sure the bulletin expands to a static state where it doesn't move, so that users are able to scroll inside of the bulletin to be able to get in between things and be able to read all the information in it. Right now, if you scroll far enough up, it just minimizes it completely. I want it to be only to where you can tap that top iOS bar to retract it. Okay, then also, or at least, let's just make it a little bit rougher for it to be able to actually retract fully. Make it so that the motion has to range wider for the swipe down or something like that. Right now it is too easy to collapse. People need to still be able to read things."_

### Current broken state (SnapSheet.tsx:65-70)

```ts
const handleDragEnd = useCallback(
  (_: unknown, info: PanInfo) => {
    if (info.velocity.y > 300 || info.offset.y > 120) onClose();
  },
  [onClose],
);
```

120px offset OR 300 velocity → dismisses. Trivially easy. Also: the entire sheet is draggable, which means scrolling inside is mis-interpreted as a drag-down.

### Files

- [`mobile/components/shared/SnapSheet.tsx`](mobile/components/shared/SnapSheet.tsx)
- [`mobile/components/bulletin/MobileBulletin.tsx`](mobile/components/bulletin/MobileBulletin.tsx) — only if props need to propagate; prefer keeping changes inside SnapSheet

### Specification

1. **Static expanded state.** Once open, the sheet height is fixed at `calc(100vh - topPx)` and the INSIDE content scrolls (this already works — `overflowY: auto` on the content div). The sheet itself must NOT translate during vertical gestures UNLESS those gestures start at the pill handle.
2. **Only dismiss via**:
   - Tap on the pill handle (new — add an `onClick` to the handle wrapper that calls `onClose`)
   - Swipe down starting on the pill handle with BOTH `info.offset.y > 260` AND `info.velocity.y > 500` (AND, not OR)
   - Backdrop tap (keep existing)
3. **Remove the whole-sheet drag.** Move the `drag="y"` from the outer `motion.div` to the pill-handle wrapper only. The content area never initiates a drag.
4. **Raised thresholds.** 260 offset + 500 velocity is the new dismiss threshold. `dragElastic` drops to 0.08 so the sheet barely rubber-bands if the user tries to push past.
5. **Prevent scroll-edge pull-down from triggering close.** Already partially handled by `overscrollBehavior: contain` on the content. Confirm iOS Safari doesn't send drag events when content is at scrollTop=0 and the user pulls down.

### Steps

1. Read the full file.
2. Refactor the JSX so the drag handle is its own `motion.div` with `drag="y"`, `dragConstraints={{ top: 0, bottom: 0 }}`, `dragElastic={0.08}`, and its own `onDragEnd` using the AND-threshold. Add `onClick={onClose}` to the same element (tap to dismiss).
3. Remove `drag="y"` and related props from the outer sheet `motion.div`.
4. Increase the pill handle hit target: wrapper padding `16px 32px 12px` so finger-width covers a big target; visible pill stays 40×5.
5. Add a subtle interaction cue — pill tint shifts from `var(--border-visible)` to `var(--fintheon-accent)` at 0.4 opacity on pointer-down (CSS `:active` via a style hook or framer `whileTap`).

### Definition of Done

- [ ] Open the bulletin; scroll inside all the way up and past — sheet stays open
- [ ] Swipe down anywhere in the content area — NO dismiss
- [ ] Swipe down 260+ px with velocity 500+ from the pill handle — dismisses
- [ ] Tap the pill handle — dismisses
- [ ] Backdrop tap — dismisses (unchanged)
- [ ] Every other SnapSheet-consumer popup (NotificationDrawer, BriefingCard, RiskFlow modal) still dismisses via the new rules — regress-test by opening each

---

## Item 5 — Theme picker: full-bleed swatches + light/dark toggle in hamburger

> TP: _"for the theme, the color palette, let's just make it a drop-down menu, like a list drop-down menu... the preview swatch should be the whole color; you understand what I mean, like the primary theme color... People should have the option to switch between the light theme and the dark theme on a toggle inside of the menu that pops up from the hamburger menu."_

### Files

- [`mobile/components/settings/ThemePickerAccordion.tsx`](mobile/components/settings/ThemePickerAccordion.tsx)
- [`mobile/components/settings/FontPickerList.tsx`](mobile/components/settings/FontPickerList.tsx)
- [`mobile/contexts/ThemeContext.tsx`](mobile/contexts/ThemeContext.tsx) — add mode state (`"dark" | "light"`, default `"dark"`)
- [`mobile/components/layout/MobileToolbar.tsx`](mobile/components/layout/MobileToolbar.tsx) — hamburger popup gets the light/dark toggle

### Spec

1. **Theme picker = dropdown list.** Inside the accordion, each row is a `<button>` that spans the full width. Background = the primary accent color of that theme. Text (theme name) sits on the swatch in high-contrast white or black depending on luminance.
2. **Dot-in-square → the whole row IS the square.** No tiny preview dot. Row height 44px. Rounded corners 8px. Active/selected theme gets a 2px inset ring in `var(--fintheon-text)`.
3. **Fonts picker = same dropdown pattern.** Each row renders the heading font in its own typeface at ~18px so the user sees what they're picking. Data font rendered smaller as a secondary line.
4. **Light/Dark toggle moves.** Remove it from the settings page if present. Add a toggle row to the hamburger menu popup (top-left burger icon) that sits with the other global actions.
5. **Dark is default.** Per TP: _"everything is going to be black by default."_ Mode persists to localStorage.

### Steps

1. **ThemeContext** — add `mode: "dark" | "light"`, `setMode(m)`, persist to `localStorage.setItem("fintheon:theme-mode", m)`. When mode changes, toggle a `data-theme="light"` attribute on `<html>` or flip the CSS-vars block. Dark stays the default; light mode should dim `--fintheon-bg` to a paper color and adjust text to dark.
2. **ThemePickerAccordion** — rewrite the list into the full-bleed swatch grid described above. Keep the NOTHING DESIGN divider (muted label between presets and specials). Remove any tiny preview dot remnants.
3. **FontPickerList** — rewrite each row so the heading font renders live (e.g., use a style `fontFamily: fontKit.headingFontFamily`). Same pattern as themes — the row itself is the preview.
4. **MobileToolbar** — find the hamburger popup. Add a small two-state toggle (sun/moon icon) that calls `setMode("light" | "dark")`. Glass surface, borderless, accent on active state.
5. Test light mode actually flips the palette — if the app uses hardcoded `#050402` anywhere, swap to CSS vars. Grep for hex colors in `mobile/` to catch stragglers.

### Definition of Done

- [ ] Theme picker rows are full-bleed colored squares, 44px tall
- [ ] Selected theme has a visible inset ring
- [ ] Font picker rows render the heading font live
- [ ] Light/dark toggle in hamburger popup flips the palette across the whole app
- [ ] Mode persists across reloads
- [ ] Default is dark

---

## Item 9 — Maintenance request modal + backend route

> TP: _"add new updates that come from routines, like advisory things that a super admin would need to approve or deny. The maintenance request should be able to have their own special pop-up modal, similar to the Catalyst card, but it should just have: the preview of the issue, the description of what the fix was that was applied, permission to go ahead and commit it. Have the code stored inside the local codebase until the super admin approves it and then goes in there manually and authorizes the solvers to deploy. Better yet, in that same notification you can put a third option for it to be deployed. The approved option should be for it to just commit the changes."_

### Backend

**New route file:** `backend-hono/src/routes/maintenance.ts`

```
POST /api/maintenance/decision
Body: { requestId: string, action: "approve_commit" | "approve_and_deploy" | "deny" }
```

- Super-admin hard gate. Use the same pattern as `handleRescoreAll` in `backend-hono/src/routes/riskflow/handlers.ts` — check `c.get("userId")` against `process.env.SUPER_ADMIN_USER_ID` or env list. Reject non-super-admins with 403.
- Stub the `approve_commit` and `approve_and_deploy` actions with a no-op + log for now; the orchestration layer (git + solvys-deploy trigger) is a follow-up sprint. Return `{ ok, action, requestId, message }`.
- Log every decision to a new Supabase table `maintenance_decisions` IF `isSupabaseConfigured()` — otherwise just log to console.

Register in [`backend-hono/src/routes/index.ts`](backend-hono/src/routes/index.ts) as `/api/maintenance`.

**Notifications category:**

- Add `"maintenance_request"` to `NOTIFICATION_CATEGORIES` in [`backend-hono/src/services/notifications/emit.ts:44`](backend-hono/src/services/notifications/emit.ts:44).
- Extend the web-push-sender's PushPayload `actions` already accepts lock-screen buttons from S25. For maintenance requests, populate actions: `[{action:"approve_commit", title:"Commit"}, {action:"approve_deploy", title:"Deploy"}, {action:"deny", title:"Deny"}]`. Service worker routes all three to `/api/maintenance/decision`.
- Mobile service worker (`mobile/public/sw.js` or whatever the S25 SW file is — grep) already has lock-screen action dispatch logic for tool approvals. Clone that pattern for `maintenance_request` category.

### Frontend

**New modal:** `mobile/components/catalyst-modal/MaintenanceDetail.tsx`

Render:

- Header: issue title + severity badge (map severity from payload)
- Body: `issuePreview` (the problem) + `fixDescription` (what was applied) — two labeled blocks
- Three action buttons at the bottom: `COMMIT` (accent gold), `COMMIT + DEPLOY` (accent gold, filled), `DENY` (muted secondary)
- Each calls `backend.maintenance.decide({ requestId, action })` and dismisses on success

Register in [`mobile/components/catalyst-modal/DetailSheetRoot.tsx`](mobile/components/catalyst-modal/DetailSheetRoot.tsx) — dispatch on `{ kind: "maintenance_request", requestId }`.

Add `mobile/lib/services/maintenance.ts` with the `decide()` method. Wire to `backend` aggregator.

### Data source

`useMaintenanceById(id)` hook analogous to `useToolApprovalById` from S25. GET `/api/maintenance/request/:id` — a second backend route that returns `{issuePreview, fixDescription, severity, createdAt, sourceCommit}` from the `maintenance_requests` table (new) OR from an in-memory store for now (keep scope small — TP is ok with code living locally until approval).

### Super-admin gate

- Backend: env `SUPER_ADMIN_USER_ID` (TP's sub `826e7c65-...` per memory). Decision endpoint checks `userId === SUPER_ADMIN_USER_ID`.
- Frontend: the modal can render for anyone (read-only) but the action buttons only show if `auth.userId === SUPER_ADMIN_USER_ID`. Expose a `isSuperAdmin` helper in the mobile auth context if not present.

### Definition of Done

- [ ] `POST /api/maintenance/decision` exists, super-admin gated, returns 403 for others
- [ ] `"maintenance_request"` is a valid NotificationCategory
- [ ] Push payload carries 3 lock-screen actions (commit / deploy / deny)
- [ ] SW routes the lock-screen tap to the backend
- [ ] MaintenanceDetail modal renders via the DetailSheet system
- [ ] Non-admins see the modal but no action buttons
- [ ] Super admin sees and can click all three; each calls the backend and dismisses

---

## Item 10 — RiskFlow card → catalyst modal + IV fuse drain/refill choreography

> TP: _"instead of it being a pop-up for the risk flow tab when somebody clicks to expand to read more details on the catalyst itself, like the preview of the catalyst when they click it to expand it, it should expand into that catalyst model, right? I also want this cool micro interaction that kind of depletes the IV gauge on the left and then fills it down in the footer when it expands. That would be so fucking cool if you could do that. I'm gonna let you end on that note. Please make that a win."_

### Files

- [`mobile/components/riskflow/RiskFlowCard.tsx`](mobile/components/riskflow/RiskFlowCard.tsx)
- [`mobile/components/catalyst-modal/RiskFlowDetail.tsx`](mobile/components/catalyst-modal/RiskFlowDetail.tsx)
- [`mobile/components/shared/IVFuseBar.tsx`](mobile/components/shared/IVFuseBar.tsx)
- [`mobile/components/catalyst-modal/DetailSheetRoot.tsx`](mobile/components/catalyst-modal/DetailSheetRoot.tsx) — should already accept `{kind:"riskflowItem", itemId}`; just verify
- [`mobile/contexts/NotificationModalContext.tsx`](mobile/contexts/NotificationModalContext.tsx) — may need an `openRiskFlowItem(id)` helper

### Reroute card tap

1. `RiskFlowCard.tsx` currently expands inline. Replace the expand handler with a modal dispatch: call `notificationModal.open({kind:"riskflowItem", itemId})`. Remove the inline expanded state entirely.
2. Keep the card tap target the whole card.

### Fuse choreography

Goal: when the card is tapped, the left-side vertical IV fuse on the card visually **drains downward**, then the modal opens and the fuse in the modal footer **fills upward** to the same level. Reads like the juice flowing from the card into the modal.

Two workable approaches:

**A. Framer `layoutId` shared element** (preferred — cleaner handoff)

- Give the IV bar on `RiskFlowCard` `layoutId={`iv-${itemId}`}` on its motion.div.
- The modal footer's IV bar in `RiskFlowDetail` uses the same layoutId.
- Framer animates the shared element across the two trees. Because the card version is vertical-left and the modal version is horizontal/bottom, add an `AnimatePresence` wrapper and tune the transition — spring, `duration: 0.45`, bounce: `0.15`.

**B. Explicit drain+fill orchestration** (fallback if shared layout looks jank)

- Add `drainOnExit?: boolean` and `fillOnEnter?: boolean` props to `IVFuseBar`.
- On card tap: set local `draining=true`, animate the fill-percentage down to 0 over 200ms, THEN call `openRiskFlowItem(id)`.
- The modal's footer fuse enters with `fillOnEnter`, animating from 0 up to the real fill over 350ms on a 80ms delay so the drain finishes first.

Implementer: try A first for 10 minutes. If the spring looks off because of the rotation, fall back to B.

### Definition of Done

- [ ] Tapping a RiskFlow card no longer expands inline — it opens the full-viewport modal
- [ ] The IV fuse drain-then-fill effect is visible and feels intentional (not a flicker)
- [ ] Works for all macro levels (bar heights vary)
- [ ] No regression on notification-tap → modal (already works via `useNotificationTapRouter`)
- [ ] No layout thrash on slower devices — test with Chrome devtools CPU throttle 4×

---

## Part 2 Validation

```bash
cd mobile
npx tsc --noEmit
find dist -mindepth 1 -delete 2>/dev/null || true
npx vite build 2>&1 | tail -20
cd ../backend-hono
bun run build 2>&1 | tail -10
cd ..

# Local backend reload
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
until curl -fsS http://localhost:8080/api/diagnostics >/dev/null; do sleep 1; done
echo "backend ready"

# Smoke new endpoints
curl -s -w "\n[%{http_code}]\n" -X POST http://localhost:8080/api/maintenance/decision \
  -H "Content-Type: application/json" \
  -d '{"requestId":"test","action":"deny"}'
# Expect 401 without auth header
```

- [ ] All 4 items ship
- [ ] Mobile + backend both build clean
- [ ] Backend restarted, diagnostics 200
- [ ] Maintenance endpoint returns 401 unauthed
- [ ] Git commit: `v.26.2 feat(mobile): S26-P2 heavy — scroll-lock bulletin, theme dropdown + dark/light toggle, maintenance modal, RiskFlow card → modal with IV drain/fill`

## Sprint Close

After Part 2 commits:

1. Push `s24-unify` to origin
2. Add a single changelog entry for S26-P2 in `src/lib/changelog.ts`
3. Run `/solvys-deploy` (or manual equivalent if the skill is model-invocation-disabled)
4. Short debrief to TP listing each item's status — use their TP-voice quotes as section anchors

Make it a win.
