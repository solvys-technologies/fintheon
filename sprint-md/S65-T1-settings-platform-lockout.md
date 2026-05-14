# Sprint Brief: T1 -- Settings Platform Defaults and Lockout Policy

## Context

This track tightens the settings experience around trading platforms and lockout policy. The user needs the default platform selector to show every available iFrame link, including custom links added in Settings, and needs the Blocker tab to own the toggle for automatic lockout outside the trading window. S64 added partial lockout plumbing, but the current Trading tab still hardcodes an always-on "Auto-lock from Desk Plan" toggle and the iFrame default selector is still hardcoded to a subset of platforms.

## Branch Target

`sprint/S65`

## Scope -- Included

- [ ] Update `frontend/contexts/SettingsContext.tsx` so `defaultPlatform` can store any `proposerIframeSources` id, including custom ids and `tradelocker`.
- [ ] Update `frontend/components/settings/IframesTab.tsx` so Browser Defaults -> Default Platform is driven by `proposerIframeSources`, not hardcoded `<option>` entries.
- [ ] Add a persistent setting such as `lockoutAutoBlockOutsideTradingWindow` to `frontend/contexts/SettingsContext.tsx`.
- [ ] Move the user-facing automatic outside-window lockout control into `frontend/components/settings/BlockerTab.tsx`.
- [ ] Remove or replace the inert always-on toggle in `frontend/components/settings/TradingTab.tsx`.
- [ ] Update `frontend/hooks/useLockout.ts`, `backend-hono/src/services/lockout.ts`, and `backend-hono/src/routes/lockout/index.ts` only as needed to make the setting actionable.
- [ ] Fix the Desk Plan lock/unlock row in `frontend/components/narrative/DayCard.tsx` and `frontend/components/narrative/DayPlanChevronNav.tsx` so the lock/unlock button and left/right chevrons sit in the same row as the day/window heading expected by the widget.

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/components/layout/TopHeader.tsx`, `frontend/components/layout/NavSidebar.tsx`, `frontend/components/layout/PanelToggleGroup.tsx` -> owned by T3.
- `frontend/components/layout/FooterToolbar.tsx` -> owned by T4.
- Peer Chat removal files -> owned by T2.
- Risk signal freshness/card polish -> owned by T5.
- Version/updater scripts -> owned by T4.

## Reuse Inventory

- `proposerIframeSources` in `frontend/contexts/SettingsContext.tsx:496` -> authoritative user-curated iFrame catalogue.
- `defaultPlatform` in `frontend/contexts/SettingsContext.tsx:419` -> currently narrow typed state that must accept custom ids.
- `IframesTab` default selector in `frontend/components/settings/IframesTab.tsx:189` -> current hardcoded Browser Defaults surface.
- `BlockerTab` in `frontend/components/settings/BlockerTab.tsx:50` -> current website blocker tab with Electron blocker status and domain controls.
- `TradingTab` inert auto-lock toggle at `frontend/components/settings/TradingTab.tsx:270` -> replace or remove; it currently has `enabled={true}` and no-op `onChange`.
- `useLockout` in `frontend/hooks/useLockout.ts:105` -> existing lock/unlock/schedule hook.
- `createLockoutRoutes` in `backend-hono/src/routes/lockout/index.ts:38` -> existing lockout API.
- `loadLockoutSettings` in `backend-hono/src/services/lockout.ts:144` -> existing but underused settings loader.
- `DayCard` lockout footer at `frontend/components/narrative/DayCard.tsx:208` -> existing partial lock/unlock row.
- `DayPlanChevronNav` at `frontend/components/narrative/DayPlanChevronNav.tsx:11` -> existing chevron control.

## Known Issues to Preserve

- User-managed iFrame catalogue is authoritative; do not force-remerge builtins after the user prunes them.
- Keep compact settings copy. Avoid explanatory paragraphs beyond what is already present.
- Follow Solvys UI constraints: no gradients, no emojis, no Kanban borders, no AI sparkles.
- Backend is launchd-managed on port 8080. Do not restart it from this track.
- Do not touch `.claude/feed-health.log`; it is runtime noise and currently dirty.

## Implementation Steps

1. In `frontend/contexts/SettingsContext.tsx`, change `DefaultPlatform` from the fixed union to a string-compatible id that can hold custom source ids. Keep builtin literals where useful, but do not reject `custom-*`.
2. Add `lockoutAutoBlockOutsideTradingWindow` to the context interface, local storage load, remote preference hydration, persisted settings payload, context value, and exported setter.
3. In `IframesTab`, replace the hardcoded Default Platform options with `proposerIframeSources.map(...)`. If `defaultPlatform` is missing from the current catalogue, fall back to the first available source and persist that fallback.
4. When adding a custom iFrame, leave `proposerDefaultIframe` behavior intact and make sure the new custom source is immediately available to the Default Platform selector.
5. In `BlockerTab`, import/use settings context and add a compact toggle row for "Auto-lock outside window" or similarly compact copy. This setting should be independent from the website domain blocker on/off state.
6. In `TradingTab`, remove the no-op `Auto-lock from Desk Plan` toggle or turn it into a read-only status that points users to Blocker only if needed. Do not leave an interactive no-op.
7. Wire the outside-window setting into lockout behavior. Prefer a small helper that compares current time against the active/next desk plan window and calls existing `scheduleLock`/`lockUntil`; do not duplicate lockout state machines.
8. Update the Desk Plan widget so the lock/unlock button and chevrons render on the same heading row as the day/window label. If the current data only exposes windows, derive compact row copy such as `WEDNESDAY` or `WINDOW 1/3` without bloating the widget.
9. Ensure manual lock uses `lockoutDefaultDuration` instead of hardcoded 30 minutes where the settings context is available.
10. Add a changelog entry in `src/lib/changelog.ts` only in the unification pass, not this track.

## Acceptance Criteria

- [ ] Settings -> iFrames -> Default Platform lists every `proposerIframeSources` entry, including custom entries added in the same session.
- [ ] Selecting a custom default platform persists and is used by the Browser/header platform picker.
- [ ] Blocker tab includes a working toggle for automatic lockout outside the trading window.
- [ ] The old always-on no-op auto-lock toggle is gone from Trading settings.
- [ ] Desk Plan row shows lock/unlock and chevrons together in the expected row and works for multi-window plans.
- [ ] No source file edited by this track exceeds 300 lines without extraction.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build

# Backend build if backend lockout files changed
cd backend-hono && bun run build
```

## Commit Format

```text
[v6.1.0] feat: S65-T1 settings platform defaults and lockout policy
```
