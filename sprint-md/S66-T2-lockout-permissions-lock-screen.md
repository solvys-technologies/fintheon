# Sprint Brief: T2 — Lockout Permanent Permissions + Themed Lock Screen

## Context

The lockout feature requires one-time macOS Accessibility permission grant so clicking "Lock" or "Lock til Desk Session" works immediately without a password re-prompt. Additionally, opening Fintheon while locked should show a themed lock screen (using the user's theme colors) instead of a white flashbang — the lock screen displays the same message as the lockout notification ("this app has been blocked by the agentic desk").

## Branch Target

`sprint/S66`

## Scope — Included

### Electron
- [ ] `electron/main.cjs` — Add macOS Accessibility permission check + request flow. Use `systemPreferences.getMediaAccessStatus` pattern already established at line 1430-1459, but for `accessibility` (not `media`). macOS Accessibility permission is checked via `systemPreferences.isTrustedAccessibilityClient(false)`. If not trusted, prompt user to grant via `systemPreferences.askForTrustedAccessibilityClient()`. Store grant state in userData so we know permission was granted.
- [ ] `electron/main.cjs` — Add new IPC handlers:
  - `"lockout:check-accessibility"` → returns `{ granted: boolean }`
  - `"lockout:request-accessibility"` → triggers the one-time macOS prompt
  - `"lock-screen:show"` → sends IPC to renderer to display lock overlay
  - `"lock-screen:hide"` → sends IPC to renderer to hide lock overlay
- [ ] `electron/main.cjs` — Update the existing lock button logic at lines 586-606. When `lockoutState.locked` is true, send `"lock-screen:show"` to renderer INSTEAD of just the system notification. The themed lock screen replaces the app UI.
- [ ] `electron/preload.cjs` — Expose new IPC bridges: `lockout.checkAccessibility()`, `lockout.requestAccessibility()`, `onLockScreenShow(callback)`, `onLockScreenHide(callback)`.

### Backend
- [ ] `backend-hono/src/services/lockout.ts` — Add `lockUntilDeskSession()` method. Reads the current/next desk plan window from `day-plan-service.ts` and computes the `autoReleaseAt` time as `windowStartTime - 15min`. The duration is auto-computed (no user input needed).
- [ ] `backend-hono/src/routes/lockout/index.ts` — Add `POST /api/lockout/lock-until-desk-session` endpoint. Calls `lockUntilDeskSession()`.
- [ ] `backend-hono/src/routes/lockout/index.ts` — Update `POST /api/lockout/toggle` to accept `reason: "desk_session" | "manual"` discriminator.
- [ ] `backend-hono/src/types/lockout.ts` — Add `triggeredBy: "desk_session" | "manual" | "system"` to LockoutState.

### Frontend: Lock Screen
- [ ] `frontend/components/LockScreen.tsx` **[NEW file]** — Themed full-screen overlay. Renders using `createPortal` to `document.body`. Key design:
  - Background: `var(--fintheon-bg)` (matches user theme)
  - Content centered: lock icon (`Lock` from lucide-react) + message text
  - Message: "This app has been blocked by the agentic desk. See you next session!"
  - Sub-message: Remaining time countdown (e.g., "Locked for 23m until next session")
  - Font: system font (not monospace), text-white/60
  - No gradient, no emoji, no sparkle — flat surface, Solvys Gold accent on lock icon
  - Show/hide controlled by backend lockout state via useLockout hook
  - Auto-dismiss when lockout expires (polling from useLockout)
- [ ] `frontend/components/LockScreen.tsx` — Include a subtle countdown display using `useLockout().state.remaining` formatted as `HH:MM:SS` counting down.
- [ ] `frontend/components/LockScreen.tsx` — Listen for Electron IPC `lock-screen:show` / `lock-screen:hide` events (via preload bridge). Show/hide accordingly.

### Frontend: Settings
- [ ] `frontend/contexts/SettingsContext.tsx` — Add `lockoutPermission: 'prompt' | 'granted' | 'denied'` field. Check on init via Electron IPC `lockout.checkAccessibility()`. Default `'prompt'` on non-macOS.
- [ ] `frontend/components/settings/BlockerTab.tsx` — Add "Lockout Permissions" section:
  - Show current Accessibility permission status
  - Button to "Grant Permission" if not granted (calls `lockout.requestAccessibility()`)
  - Tooltip explaining why: "Pre-authorizes Fintheon so clicking Lock works without a password prompt"
  - Show "Lock til Desk Session" option with description

### Frontend: Lock Button
- [ ] `frontend/components/layout/TopHeader.tsx:584-644` — The existing lock button pill section currently shows: lock/unlock toggle, custom time input, "Go" button. Consolidate to:
  1. Lock/Unlock button (existing, keep)
  2. "Lock til Desk Session" button (new) — one click locks until the next desk plan window starts
  3. If lockout is active, show remaining time (existing, keep)
  4. Remove the custom time input if present
- [ ] `frontend/hooks/useLockout.ts` — Add `lockUntilDeskSession()` method that calls `POST /api/lockout/lock-until-desk-session`. Return the computed lock duration for display.

### Mobile
- [ ] `mobile/` — If mobile has lockout UI, add simplified lock screen overlay using same themed design. If not, skip for this track (T5 may add mobile lock screen later).

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/iv-scoring/` — T1 owns instrument/IV changes
- `backend-hono/src/services/day-plan/` — T1 owns desk plan backend
- `frontend/components/narrative/DayCard.tsx` — T1 owns lock button data/placement; T3 owns shimmer animation
- `frontend/components/layout/TopHeader.tsx` complete toolbar rework — T3 owns the toolbar visual overhaul. T2 only touches the lock button section (lines 584-644).
- `frontend/components/chat/` — T4 owns all chat changes
- `frontend/components/layout/NavSidebar.tsx` — T3 owns
- `frontend/components/IVScoreCard.tsx` — T3 owns sizing
- `src/lib/changelog.ts` — T5 owns
- `frontend/contexts/SettingsContext.tsx` — T1 also adds `selectedInstrument` field here. T2 adds `lockoutPermission`. Both are new field additions — do NOT delete any existing fields, do NOT refactor the entire context.

## Reuse Inventory

- `useLockout()` at `frontend/hooks/useLockout.ts` — Existing lockout hook with `state`, `lock()`, `unlock()`, `refresh()`, `scheduleLock()`. T2 adds `lockUntilDeskSession()`.
- `systemPreferences.getMediaAccessStatus()` at `electron/main.cjs:1432` — Existing pattern for permission queries. T2 follows same pattern for Accessibility.
- `getLatestDeskPlan()` at `backend-hono/src/services/desk-planner.ts:187` — Returns cached plan. Use for computing next session lock time.
- `scheduleAutoRelease()` at `backend-hono/src/services/lockout.ts` — Already exists. T2 extends for desk-session-duration auto-release.
- `Notification` at `electron/main.cjs` (already require'd) — Used for fallback notification if lock screen can't render.
- `createPortal` at `frontend/components/IVScoreCard.tsx:292` — Established pattern for portal-based overlays. T2's LockScreen follows same pattern.
- `SolvysLoader` at `frontend/components/shared/SolvysLoader.tsx` — Optional: spinner while lock screen is loading/unloading.

## Known Issues to Preserve

- S65 just reconciled "Settings platform defaults, Blocker tab lockout policy toggles, Desk Plan lock/unlock row placement" in BlockerTab and TradingTab. T2 must preserve S65's reconciliation — only ADD the Accessibility permissions section, do not reorder S65's layout.
- S64 added "touch grass, kid." notification and dock menu lockout polling. Preserve both.
- The existing lock button in TopHeader at line 584-606 uses `lockoutState.locked` toggle + custom time input. T2 consolidates this into a cleaner button group but must preserve the existing lock/unlock toggle function.
- macOS Accessibility permission can't be tested in dev without a signed app bundle. The IPC handler should return `{ granted: false, reason: "dev-mode" }` when app is not packaged to avoid blocking dev workflow.
- Backend lockout is in-memory (not persistent across restarts). If this causes issues with the desk-session lock, add Supabase persistence (but start with in-memory).

## Implementation Steps

1. **Add Accessibility IPC to Electron** (`electron/main.cjs`): After the existing `system-permissions:query` handler at line 1440, add `lockout:check-accessibility` and `lockout:request-accessibility` handlers. Use `systemPreferences.isTrustedAccessibilityClient(false)` and `systemPreferences.isTrustedAccessibilityClient(true)` for prompt.
2. **Add lock screen IPC** (`electron/main.cjs`): Send `lock-screen:show` / `lock-screen:hide` to renderer when lockout state changes.
3. **Expose preload bridge** (`electron/preload.cjs`): Add `lockout` and `lockScreen` channels via `contextBridge.exposeInMainWorld`.
4. **Backend lockout service** (`services/lockout.ts`): Add `lockUntilDeskSession()` — reads `getLatestDeskPlan()` or `readDayPlan()`, computes next window start, sets lockout duration to that window start - 15min.
5. **Backend lockout route** (`routes/lockout/index.ts`): Add `POST /lock-until-desk-session`.
6. **Lock screen component** (`frontend/components/LockScreen.tsx`): Create themed overlay with `createPortal`. Use `var(--fintheon-bg)` background, centered content. Show remaining time countdown. Wire to `useLockout` state.
7. **useLockout hook** (`hooks/useLockout.ts`): Add `lockUntilDeskSession()` method. Add Electron IPC listener for `lock-screen:show`/`hide`. Integrate LockScreen component rendering.
8. **Settings context** (`contexts/SettingsContext.tsx`): Add `lockoutPermission` field with Electron IPC check on init. Non-macOS defaults to `'granted'`.
9. **Blocker tab** (`settings/BlockerTab.tsx`): Add "Lockout Permissions" section below existing lockout settings. Show status + grant button.
10. **TopHeader lock button** (`layout/TopHeader.tsx:584-644`): Consolidate button group. Add "Lock til Desk Session" button next to existing lock toggle. Wire to `useLockout().lockUntilDeskSession()`.
11. **Integrate**: When lockout activates via any trigger (manual lock, desk session lock, scheduled lock), the LockScreen component should render over the app. When lockout expires, LockScreen hides.
12. **Build + validate**.

## Acceptance Criteria

- [ ] macOS Accessibility permission can be checked via Electron IPC
- [ ] One-time grant prompt works (no re-prompt on subsequent locks)
- [ ] Non-macOS platforms default to granted (no prompt needed)
- [ ] "Lock til Desk Session" button exists in toolbar lock pill
- [ ] "Lock til Desk Session" one-click locks until next desk plan window
- [ ] Lock screen overlay shows themed background (no white flashbang)
- [ ] Lock screen shows message + remaining time countdown
- [ ] Lock screen auto-dismisses when lockout expires
- [ ] Lock button works same as before (manual duration lock/unlock)
- [ ] Settings → Blocker tab shows Accessibility permission status
- [ ] `npx tsc --noEmit` passes on frontend
- [ ] `vite build` passes on frontend (rm -rf dist first)
- [ ] `bun run build` passes on backend

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

```bash
cd backend-hono && bun run build
```

```bash
# Test lockout status
curl -s http://localhost:8080/api/lockout/status
```

## Commit Format

```
[v6.2.0] feat: T2 permanent lockout permissions + themed lock screen
```
