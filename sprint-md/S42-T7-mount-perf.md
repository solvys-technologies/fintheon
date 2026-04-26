# Sprint Brief: S42-T7 — Mount-Time Perf (Brotzky "Fast-Feel")

## Context

Brotzky's "How we made Fey feel fast" thread: kill data fetches that gate the first paint; render skeletons; stream history in. Fintheon's chat surfaces likely have multiple `useEffect(() => fetch(...), [])` calls at mount that delay composer visibility. Target: **<50ms** to visible composer on cold-mount, web AND mobile.

This track is purely a perf audit + skeleton + telemetry pass. No new features, no UI changes other than skeleton shells.

## Branch Target

`s42-t7-perf` (cut from worktree `~/Desktop/Codebases/fintheon-s42-chat-sota` off `v5.28.0`)

## Scope — Included

### Web

- [ ] Audit `frontend/components/ChatInterface.tsx` for blocking fetches at mount
- [ ] Render skeleton shells (composer outline + history list outline) immediately
- [ ] Defer history fetch (TanStack Query `placeholderData` pattern OR React Suspense fallback)
- [ ] Telemetry: log `mount → first-paint` ms via `performance.now()` and existing telemetry pipe (search `frontend/lib/` for telemetry helper)

### Mobile

- [ ] Same audit + skeleton + telemetry on `mobile/components/chat/ChatPage.tsx`

### Both

- [ ] Verify <50ms composer-visible target on cold mount (Chrome DevTools Performance tab)
- [ ] Document any fetches that CAN'T be deferred (e.g., auth check) and their measured overhead

## Scope — Excluded (DO NOT TOUCH)

- All composer internals (T2)
- All message render internals (T3)
- Artifact pane mount (T4) — T4's pane only mounts when an artifact arrives, so it doesn't gate first paint by default
- Browserbase wiring (T5)
- Output cards Ask button (T6)
- NothingFuse + spinners (T8) — T7 uses skeleton placeholders, not spinners; do not modify spinner files
- RiskFlow ingest, scoring, IV pipeline
- MCP routes
- Backend
- Refinement Engine
- TradingView Sanctum chart

## Reuse Inventory

- TanStack Query (already in package.json — verify) `placeholderData` for deferred fetches
- React `Suspense` + skeleton fallbacks — preferred pattern over loading spinners
- Existing telemetry helper if present (search `frontend/lib/telemetry*` or `frontend/lib/log*`)
- `solvys-transitions`: `t-text-swap` for skeleton-to-content fade-in
- `performance.now()` + `console.log` as fallback telemetry if no central pipe exists

## Known Issues to Preserve

- Auth check at app boot — likely required, do NOT remove; only measure and document overhead
- Memory: "Lifecycle v2" — token refresh on open, smart kill on close; do not interfere with lifecycle
- Memory: "Launchd backend reads from Desktop checkout" — backend stays as-is; T7 is frontend-only perf
- Conversation history — must still load eventually; deferred load is OK as long as the empty state renders immediately

## Implementation Steps

1. **Audit `ChatInterface.tsx` mount**:
   - Find every `useEffect(() => { fetch(...) }, [])` call
   - For each: classify as REQUIRED-AT-MOUNT (auth, conversation-id resolution) or DEFERRABLE (history, persona presets, recent files)
   - Measure baseline: add `performance.mark('chat-mount-start')` at component top, `performance.mark('chat-composer-visible')` after composer first renders, log diff
2. **Apply skeleton-first pattern**:
   - Before history loads, render `<HistorySkeletonList />` (gray-line outlines matching final layout)
   - Before composer is interactive, render the composer shell with disabled-state ghost (composer mounts immediately even if persona-preset fetch is pending)
3. **Defer non-critical fetches**:
   - History → TanStack Query `placeholderData: []` so the UI renders immediately with empty state, then fills in
   - Persona presets → fetch on first composer focus instead of on mount
   - Recent attachments → fetch on attachment popup open, not at mount
4. **Skeleton transitions**: when real content arrives, fade in via `t-text-swap` (avoid layout shift)
5. **Repeat audit for `mobile/components/chat/ChatPage.tsx`**: same pattern
6. **Add telemetry log**: on each cold mount, log `{ surface: "chat-web|chat-mobile", mountMs, composerMs, historyMs }` to console (and to existing telemetry pipe if present)

## Acceptance Criteria

- [ ] Cold mount of web `/chat` → composer visible in <50ms (measured in Chrome DevTools Performance tab)
- [ ] Cold mount of mobile `/chat` → composer visible in <50ms (measured in Safari Web Inspector or Chrome DevTools mobile emulation)
- [ ] History list shows skeleton immediately, fills in via streaming (no spinner shown)
- [ ] No new spinner usage (use skeleton placeholders only)
- [ ] No regression in conversation history loading correctness
- [ ] Telemetry log present in console on cold mount (`mountMs`, `composerMs`, `historyMs`)
- [ ] `cd frontend && npx tsc --noEmit --project tsconfig.json` clean
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] `cd frontend && rm -rf dist && npx vite build` clean
- [ ] `cd mobile && rm -rf dist && npx vite build` clean

## Validation Commands

```bash
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx tsc --noEmit --project tsconfig.json
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx tsc --noEmit

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx vite build

rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile/dist
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx vite build
```

## Banned Ornaments

- No spinners on first paint (use skeletons)
- No gradients, no emojis, no Kanban borders, no AI sparkles, no glassmorphic surfaces

## Commit Format

```
[v5.29.0] perf: T7 chat mount-time skeleton + deferred fetches (target <50ms web + mobile)
```
