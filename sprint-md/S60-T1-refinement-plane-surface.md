# Sprint Brief: S60-T1 -- Refinement Plane Surface

## Context

Plane must be accessible from Refinement (not Hermes:Admin), with a right-justified Plane control using a TV icon. Selecting Plane should swap Refinement main content to Plane while leaving sidebar CAO chat fully usable. Browser iframe is blocked by `x-frame-options: DENY` for Plane, so Electron `webview` behavior must be first-class with safe popup handling.

## Branch Target

`s60-openagents-plane-loop`

## Scope -- Included

- [ ] Add Refinement header Plane control (right-justified) with TV icon.
- [ ] Add Refinement mode switch so Plane replaces Refinement main content.
- [ ] Reuse `EmbeddedBrowserFrame` for Plane render path.
- [ ] Keep all existing Refinement controls intact when not in Plane mode.
- [ ] Ensure sidebar chat remains interactive while Plane is open.
- [ ] Add Electron popup allowlist entries for Plane auth/navigation if needed.

## Scope -- Excluded (DO NOT TOUCH)

- Chat runtime migration files (T2).
- Composer/modal parity files (T3).
- Any backend integration/webhook files (T4/T5).
- Route registration or changelog entries (T6).

## File Ownership

- `frontend/components/refinement/RefinementEngine.tsx`
- `frontend/components/layout/EmbeddedBrowserFrame.tsx`
- `electron/main.cjs`
- `frontend/components/admin/AdminShell.tsx` (only if required for Refinement sub-tab label text/UX affordance)

## Reuse Inventory

- `frontend/components/refinement/RefinementEngine.tsx:544` -- header toolbar insertion point.
- `frontend/components/layout/EmbeddedBrowserFrame.tsx:14` -- Electron `webview` path.
- `frontend/components/layout/EmbeddedBrowserFrame.tsx:27` -- browser `iframe` fallback.
- `electron/main.cjs:450` -- popup host allowlist function.
- `electron/main.cjs:868` -- `setWindowOpenHandler` webview popup handling.

## Known Issues to Preserve

- Keep existing Refinement save/kickstart controls unchanged.
- Do not regress Google OAuth popup behavior in Electron.
- Do not alter chat panel wiring in `MainLayout`/`ChatPanel`.

## Implementation Steps

1. Add `viewMode` state in `RefinementEngine` (`"scoring" | "plane"`), defaulting to `"scoring"`.
2. Add Plane button in header action cluster, right-aligned, TV icon, active/inactive styles in Solvys palette.
3. Add main-content conditional render:
   - `viewMode === "plane"` => render `EmbeddedBrowserFrame` with Plane URL from settings or constant fallback.
   - else render existing Refinement controls unchanged.
4. Keep drawer overlays and mutate actions scoped to scoring mode only.
5. If Plane login pops new windows in Electron, extend `shouldAllowInAppPopup` for `app.plane.so` and `silo.plane.so`.
6. Validate in desktop and browser builds (browser may show external-open fallback messaging if embed blocked).

## Acceptance Criteria

- [ ] Refinement header shows right-justified Plane control with TV icon.
- [ ] Clicking Plane switches Refinement main surface to Plane content.
- [ ] Clicking back to scoring restores original Refinement content and state.
- [ ] Electron Plane popups work without breaking existing OAuth popups.
- [ ] Sidebar chat remains usable while Plane is open.

## Validation Commands

```bash
# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf frontend/dist && cd frontend && bun run build && cd ..
```

## Commit Format

```
[v6.1.0-alpha] feat: T1 add Refinement Plane surface toggle and embed path
```
