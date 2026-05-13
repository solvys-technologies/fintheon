# Sprint Brief: T1 -- Lockout Button (Toolbar) + Trading Settings Control

## Context

Add a lockout button to the heading toolbar that lets the trader instantly block themselves from trading (time-based lockout). The Trading settings tab controls duration and default behavior. A new backend endpoint persists lockout state with countdown. TP solo, part of the S63 Dock & Lockout suite.

## Branch Target

`sprint/S63` (single feature branch)

## Scope -- Included

- [ ] Add lockout button to TopHeader.tsx left button group (alongside call, antilag)
- [ ] Rewrite TradingTab.tsx to include lockout controls section (duration presets, manual lock/unlock, default duration preference)
- [ ] New backend lockout route + handler: `GET /api/lockout/status`, `POST /api/lockout/toggle`
- [ ] New frontend hook: `useLockout` polls status, provides toggle action
- [ ] Lockout button shows locked/unlocked icon, remaining time on hover, onClick toggles
- [ ] Persist lockout preference in SettingsContext

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/components/narrative/Sanctum.tsx` -- recently audited, off limits
- `frontend/components/ui/Toast.tsx` -- recently deployed, off limits
- `frontend/components/settings/BlockerTab.tsx` -- separate blocker system, not lockout
- `backend-hono/src/services/day-plan/` -- desk plan generation is T2's concern
- `backend-hono/src/services/ai/soul/` -- agent instructions are T2's concern
- `electron/main.cjs` -- OS dock and notifications are T3's concern

## Reuse Inventory (existing code to call, not reinvent)

- `TopHeader.tsx` line 517 `<FluxerCallWidget />` pattern -- add lockout button in same left section
- `TopHeader.tsx` lines 536-544 -- antilag button (use same `.toolbar-icon-btn` CSS class)
- `TopHeader.tsx` lines 162-178 `handleQuickClock` -- reference for click handler pattern
- `TradingTab.tsx` at `frontend/components/settings/TradingTab.tsx` -- already wired into SettingsPanel, add lockout section
- `SettingsContext.tsx` at `frontend/contexts/SettingsContext.tsx` -- add `lockoutDuration` and `lockoutEnabled` state fields
- `frontend/lib/services/editor.ts` -- reference for backend API call pattern
- `.toolbar-icon-btn` CSS at `frontend/index.css:752` -- use for lockout button
- `.toolbar-active` CSS at `frontend/index.css` -- use for active/locked state

## Known Issues to Preserve

- S62 Sanctum layout audit is recent -- do not touch Sanctum or its imports
- Toast.tsx was deployed in v6.0.27 -- do not modify toast behavior

## Implementation Steps

1. **Backend lockout route** -- Create `backend-hono/src/routes/lockout/index.ts` with GET /status and POST /toggle. Store lockout state in-memory (Map with userId -> { locked, until, reason }). Add to `backend-hono/src/routes/index.ts`.
2. **Backend types** -- Create `backend-hono/src/types/lockout.ts` with `LockoutState { locked: boolean; until: string | null; remaining: number | null }`.
3. **Frontend hook** -- Create `frontend/hooks/useLockout.ts` that polls `GET /api/lockout/status` every 5s and exposes `{ state, toggleLockout(durationMinutes) }`.
4. **TradingTab lockout controls** -- Add lockout section with duration presets (15/30/60 min, custom), manual toggle, default duration dropdown.
5. **SettingsContext lockout preference** -- Add `lockoutDefaultDuration` to context state.
6. **TopHeader lockout button** -- Import `useLockout` hook, render lock icon button in left button group (after antilag). Icon changes (Lock/Unlock). Tooltip shows remaining time. Click toggles with default duration.

## Solvys Design Rules

No gradients, no emojis, no Kanban borders, no AI sparkles. Use `.toolbar-icon-btn` CSS class. Lock icon from lucide-react (`Lock`, `Unlock`).

## Acceptance Criteria

- [ ] Lockout button appears in heading toolbar left section
- [ ] Clicking the button triggers a lockout with default duration
- [ ] Lock icon changes when locked, tooltip shows remaining time
- [ ] Trading settings tab has lockout controls that persist
- [ ] Backend API returns current lockout status from `/api/lockout/status`
- [ ] TypeScript compiles clean (`npx tsc --noEmit --project frontend/tsconfig.json`)
- [ ] Frontend builds (`rm -rf dist && npx vite build`)

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts

# Backend build
cd backend-hono && bun run build
```

## Commit Format

```
[v.5.13.2] feat: T1 lockout button + trading settings controls
```
