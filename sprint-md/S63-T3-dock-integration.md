# Sprint Brief: T3 -- macOS Dock Integration (Block Timers, Toasts, Quick Access)

## Context

Add a macOS dock menu (right-click dock icon) with lockout timer control, system toast notifications for RiskFlow news and lockout expiry, and a configurable Quick Access jump item that opens a user-set URL. This is the OS-level layer that makes Fintheon's lockout and notification system feel like a native Mac app. Depends on T1's lockout state API and lockout duration preference in SettingsContext.

## Branch Target

`sprint/S63` (single feature branch)

## Scope -- Included

- [ ] Create macOS dock menu with dynamic items (current lockout status, quick access, toggle lockout)
- [ ] Wire Electron `Notification` API for system toasts on: lockout timer expiry, high-IV RiskFlow news, econ event countdowns
- [ ] Add Quick Access URL setting in Trading settings tab
- [ ] Persist Quick Access URL in SettingsContext
- [ ] Dock menu updates dynamically as lockout state changes
- [ ] Expose dock and notification controls through preload.cjs

## Scope -- Excluded (DO NOT TOUCH)

- `backend-hono/src/services/capability-registry/` -- T2 owns capability changes
- `backend-hono/src/services/ai/soul/` -- T2 owns SOUL updates
- `backend-hono/src/services/day-plan/` -- desk plan generation untouched
- `frontend/components/narrative/Sanctum.tsx` -- recently audited
- `frontend/components/ui/Toast.tsx` -- recently deployed, off limits

## Reuse Inventory (existing code to call, not reinvent)

- `electron/main.cjs` -- existing IPC handlers at lines 1035+ and the blocker section at lines 1453+ serve as patterns
- `electron/preload.cjs` -- existing preload proxy pattern at lines 1-120 (reference `contextBridge.exposeInMainWorld` usage)
- `TradingTab.tsx` at `frontend/components/settings/TradingTab.tsx` -- add Quick Access URL text input
- `SettingsContext.tsx` at `frontend/contexts/SettingsContext.tsx` -- add `quickAccessUrl` state field
- `backend-hono/src/services/riskflow/feed-service.ts` -- RiskFlow scoring pipeline where IV-threshold events could emit
- Lockout state at `GET /api/lockout/status` from T1

## Known Issues to Preserve

- Electron lifecycle: backend is launchd-managed on port 8080. Dock and notification code must not interfere with backend spawn/shutdown.
- The blocker system already uses `sudoRun`/osascript for system-level operations -- do not use that pattern for dock menu (dock menu is app-level, no sudo needed).
- `app.dock.setMenu()` is macOS-only. Guard with `process.platform === "darwin"` consistently.

## Implementation Steps

1. **Dock menu module** -- Create `electron/dock-menu.cjs`. Export `createDockMenu(lockoutState, quickAccessUrl, callbacks)` that builds a `Menu` with:
   - Lockout status line (disabled, shows "Locked -- 23m remaining" or "Not locked")
   - "Toggle Lockout" item (calls T1's lockout API)
   - Separator
   - "Quick Access: [label]" item (opens the user's configured URL in system browser)
   - Separator
   - "Open Fintheon" (brings window to front)
2. **Wire dock menu in main.cjs** -- In `app.whenReady()` or via an IPC handler, call `app.dock.setMenu(menu)`. Update the menu whenever lockout state changes (poll or event-driven).
3. **Electron Notification wrapper** -- In `electron/main.cjs` (or a small module), create `sendSystemNotification(title, body, { onClickUrl? })` using `new Notification({ title, body }).show()`. Wire it to:
   - Lockout expiry (when timer hits 0, send "Lockout expired -- trading is available again")
   - High-IV RiskFlow items (IV >= 8.5, send "RiskFlow Alert: [headline]")
   - Econ event countdowns (5min before major event, send "Economic event in 5 minutes: [event name]")
4. **IPC endpoints** -- Add `ipcMain.handle("dock:update-menu", ...)` and `ipcMain.handle("notification:send", ...)`.
5. **Preload** -- Expose `dock.updateQuickAccessUrl(url)` and `notification.send(title, body)` in `window.electron`.
6. **TradingTab Quick Access** -- Add a "Quick Access" URL text input in the settings, similar to existing preference inputs. Persist through SettingsContext.
7. **RiskFlow notification trigger** -- In the RiskFlow feed service, after scoring items with IV >= 8.5, emit an event or call `sendSystemNotification` (or post to the backend notification emit pipeline which the Electron main process polls).

## Solvys Design Rules

No gradients, no emojis, no Kanban borders, no AI sparkles. Dock menu should use standard macOS menu styling (plain text, no custom colors).

## Acceptance Criteria

- [ ] macOS dock menu shows current lockout status
- [ ] Toggle Lockout in dock menu triggers the lockout API
- [ ] Quick Access in dock menu opens user's configured URL in browser
- [ ] System toast notifications fire on lockout expiry
- [ ] System toast notifications fire on high-IV RiskFlow items (if riskflow service is wired)
- [ ] Quick Access URL setting persists in Trading settings tab
- [ ] Electron compiles and runs without errors
- [ ] TypeScript compiles clean (`npx tsc --noEmit --project frontend/tsconfig.json`)

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts

# Syntax check on electron code
node -c electron/main.cjs && node -c electron/preload.cjs
```

## Commit Format

```
[v.5.13.2] feat: T3 macOS dock menu + system notifications + quick access
```
