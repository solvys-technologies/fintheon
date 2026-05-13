# Sprint Brief: T3 — Enhanced Lockout + OS Notifications

## Context

S63 shipped the foundational lockout feature: in-memory lockout toggle via `/api/lockout/toggle`, a lockout button in TradingTab and TopHeader, and auto-lock on desk plan generation. Sprint S64 extends this with: system-level lockout that survives page refresh (persistent Supabase-backed), automatic unlock 15 minutes before each trading window, OS-level notification ("touch grass, kid." with body "this app has been blocked by the agentic desk. see you next session!"), and Supabase schema for persistent lockout settings + audit history.

## Branch Target

`sprint/S64`

## Scope — Included

- [ ] `backend-hono/src/services/lockout.ts` — Extend from in-memory to support Supabase persistence: add `initLockoutDb()`, `saveLockoutRecord()`, `getLockoutRecord()`. Keep in-memory as a fast cache/fallback.
- [ ] `backend-hono/src/types/lockout.ts` — Extend `LockoutState` with `autoReleaseAt?: string`, `reason?: string`, `scheduledBy?: 'desk_plan' | 'manual' | 'system'`
- [ ] `backend-hono/src/routes/lockout/index.ts` — Add endpoint `POST /api/lockout/schedule` for timed lockout (lock until X, then auto-release), and `GET /api/lockout/next-window` to return next scheduled window info. Update existing toggle to support auto-release timestamps.
- [ ] `backend-hono/migrations/042_lockout_persistence.sql` [NEW] — Supabase migration creating `user_lockout_settings` table (id, user_id, lockout_enabled, auto_lock_from_desk_plan, updated_at) and `lockout_audit_log` table (id, user_id, action, reason, triggered_by, created_at)
- [ ] `backend-hono/src/routes/index.ts` — Add any new lockout routes to the router
- [ ] `frontend/hooks/useLockout.ts` — Add methods: `scheduleLock(minutes)`, `lockUntil(isoTimestamp)`, `getNextWindow()`, `autoReleaseAt` state. Add polling for scheduled unlocks.
- [ ] `frontend/contexts/SettingsContext.tsx` — Add `lockoutAutoReleaseMinutes: number` (default 15) setting, `persistentLockout: boolean` toggle
- [ ] `frontend/components/settings/TradingTab.tsx` — Add lockout settings UI: persistent lockout toggle, auto-release timing, scheduled lockout triggers
- [ ] `electron/main.cjs` — Add OS notification handler: `new Notification({ title: "touch grass, kid.", body: "this app has been blocked by the agentic desk. see you next session!" })`. Trigger from lockout route event or IPC message from renderer. Add `ipcMain.on('show-lockout-notification')` handler. Use Electron Notification API.

## Scope — Excluded (DO NOT TOUCH)

- DayCard UI or Desk Plan card rendering — handled by T2
- TV scanner or pricing engine — handled by T1
- Agent instruction files — handled by T4
- Any RiskFlow files — off-limits per sprint constraint

## Reuse Inventory (existing code to call, not reinvent)

- `getLockout()` / `setLockout()` at `backend-hono/src/services/lockout.ts` — extend these functions with Supabase persistence; keep `store: Map` as fast cache
- `LockoutState` at `backend-hono/src/types/lockout.ts` — extend with new fields rather than creating new types
- `GET /api/day-plan/today` at `backend-hono/src/routes/day-plan/handlers.ts` — call this to determine next window's start time for auto-release scheduling
- Existing `electron/main.cjs` `ipcMain.handle` patterns — follow existing IPC patterns for the lockout notification
- `preload.cjs` patterns — expose `showLockoutNotification` to renderer via contextBridge

## Known Issues to Preserve

- The existing `setLockout("default", true, 30 * 60 * 1000)` in `day-plan-service.ts` (T1 territory) should continue to work; T3's enhanced lockout adds a complementary auto-release that uses the same route
- The lockout should NOT require a password for lock/unlock — no auth check on lockout toggle (it's a productivity tool, not a security tool)
- OS notification should fire ONCE when lockout begins, not on every poll

## Implementation Steps

1. **Supabase migration `042_lockout_persistence.sql` [NEW]**:

   ```sql
   CREATE TABLE IF NOT EXISTS user_lockout_settings (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     lockout_enabled BOOLEAN DEFAULT false,
     auto_lock_from_desk_plan BOOLEAN DEFAULT true,
     auto_release_minutes INTEGER DEFAULT 15,
     updated_at TIMESTAMPTZ DEFAULT now()
   );
   ALTER TABLE user_lockout_settings ENABLE ROW LEVEL SECURITY;
   -- Add RLS policies for user owns their settings

   CREATE TABLE IF NOT EXISTS lockout_audit_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
     action TEXT NOT NULL, -- 'lock', 'unlock', 'auto_lock', 'auto_unlock'
     reason TEXT,
     triggered_by TEXT DEFAULT 'manual', -- 'manual', 'desk_plan', 'system'
     created_at TIMESTAMPTZ DEFAULT now()
   );
   ALTER TABLE lockout_audit_log ENABLE ROW LEVEL SECURITY;
   ```

2. **lockout.ts**: Add `supabase` import. Add `loadLockoutSettings(userId)` and `saveLockoutAudit(userId, action, reason, triggeredBy)`. Modify `setLockout()` to write to `lockout_audit_log`. Add `scheduleAutoRelease(userId, windowStartTime: string)` that computes release time as `windowStartTime - 15min` and stores it in the map. Load settings from `user_lockout_settings` table on init.

3. **types/lockout.ts**: Add `autoReleaseAt?: string`, `scheduledBy?: 'desk_plan' | 'manual' | 'system'`, `reason?: string` to `LockoutState`.

4. **lockout/index.ts routes**:
   - `POST /api/lockout/schedule` — accepts `{ lockUntil: string }` or `{ windowStartTime: string }`. Sets lockout with auto-release timestamp.
   - `GET /api/lockout/next-window` — returns next scheduled window info for UI polling
   - Update `POST /api/lockout/toggle` — now accepts optional `{ windowStartTime: string }` to auto-compute release

5. **useLockout.ts**: Add `scheduleLock(durationMinutes: number, windowStartTime?: string)`, `lockUntil(isoTimestamp: string)`, `getNextWindow()`. Add auto-release polling: if `state.autoReleaseAt` is set and now >= autoReleaseAt, call unlock automatically. Poll every 5s for scheduled releases.

6. **electron/main.cjs**: Import `Notification` from `electron`. Add `ipcMain.on('show-lockout-notification')` handler that shows `new Notification({ title: "touch grass, kid.", body: "this app has been blocked by the agentic desk. see you next session!" })`. Wire this to be called from the lockout route when a lock is triggered via desk plan. The route can broadcast via SSE or the electron preload can poll and fire the notification.

   Approach for Electron notification: The renderer (frontend) polls `useLockout()`. When `state.locked` transitions from false to true, call `window.electronAPI.showLockoutNotification()` (exposed via preload.cjs). This fires the native OS notification.

7. **SettingsContext.tsx**: Add `lockoutAutoReleaseMinutes: 15` (default) and `persistentLockout: boolean` (default false) to settings context. These drive the lockout behavior.

8. **TradingTab.tsx**: Add a new "Lockout Settings" section with:
   - Toggle "Auto-lock from Desk Plan" (on by default)
   - Number input "Auto-release minutes before window" (default 15, min 5, max 30)
   - Toggle "Persistent lockout (survives app restart)" (off by default)
   - Status display showing current lockout state and next scheduled unlock

## Acceptance Criteria

- [ ] Lockout persists across page refresh (Supabase-backed)
- [ ] Auto-release fires 15 minutes before each trading window start
- [ ] OS notification shows "touch grass, kid." title with correct body text
- [ ] Notification fires once per lockout event, not on every poll
- [ ] Lockout settings UI works in TradingTab
- [ ] No password required for lock/unlock
- [ ] All existing S63 lockout behavior preserved (manual lock/unlock via button, desk plan auto-lock)
- [ ] Electron notification reaches user even when app is minimized

## Validation Commands

```bash
# Backend type-check + build
cd backend-hono && bun run build

# Frontend type-check
cd .. && npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Run migration check
cd backend-hono && bun run migrate 2>/dev/null || echo "Manual migration apply needed"
```

## Commit Format

```
[v.6.13.1] feat: T3 enhanced lockout + OS notifications + Supabase persistence
```
