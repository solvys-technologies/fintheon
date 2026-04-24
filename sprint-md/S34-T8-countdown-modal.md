# Sprint Brief: T8 — Econ Countdown Modal (frontend)

## Context

When an econ print (CPI, NFP, FOMC, speaker event, etc.) is within T-5min, TP wants a fade-in countdown card to surface so he can't miss the release. At print arrival the card updates in place with `Actual {X} vs Forecast {Y}` and fades out ~20s later. No backdrop-blur, no glass, no emoji, no gradient. Doto numeral for the mm:ss countdown.

The modal joins two datasets owned by sibling tracks:

- **T1** owns `econ_watch_filters` (country × category toggles).
- **T3** owns the `economic_events` base migration + column shape.

T8 is Wave 2 — by the time this runs, T1's `/api/econ-filters` and T3's `economic_events` table must exist. If they don't, T8 builds against a **local stub fixture** and documents the fact in the PR; T9 wires the real DB path at integration.

## Branch target

`s34-t8-countdown-modal` off `main`.

## Scope — Included

- [ ] New backend route: `backend-hono/src/routes/econ/index.ts` — add `GET /api/econ/active-watch`.
  - Joins `economic_events` × `econ_watch_filters WHERE active=true`.
  - Returns events where `scheduled_at` is in the window `[now - 2min, now + 30min]`, ordered ascending.
  - Shape: `{ id, eventName, country, category, scheduledAt, forecast?, previous?, actual?, status: 'upcoming'|'printed'|'missed' }`.
  - If either table is missing (fresh dev DB), return `[]` with a single `console.warn` — never 500.
- [ ] `backend-hono/src/services/riskflow/sse-broadcaster.ts` — add `broadcastEconPrint(payload: EconPrintPayload)` using the same client-fanout primitive as `broadcastLevel4` (lines 34–53). Event name: `econ-print`. Payload shape: `{ eventId, eventName, actual, forecast?, previous?, surprisePercent?, beatMiss: 'beat'|'miss'|'inline', printedAt: ISO }`.
- [ ] `backend-hono/src/services/riskflow/econ-bridge.ts` — inside `injectEconPrintToFeed` (after the successful INSERT, line 97), call `broadcastEconPrint(...)` with the derived payload. **Must not** gate on macro level — fire for every successful insert so T-5 modals don't miss low-macro prints.
- [ ] New frontend component: `frontend/components/feed/EconCountdownModal.tsx`.
  - Polls `/api/econ/active-watch` every 30s (via a dedicated `useEconActiveWatch` hook co-located in the same file or `frontend/hooks/useEconActiveWatch.ts`).
  - Subscribes to SSE `/api/riskflow/stream` (reuse `useRiskFlow`-style EventSource pattern at [frontend/hooks/useRiskFlow.ts:10-44](frontend/hooks/useRiskFlow.ts#L10-L44)) and listens for `econ-print` frames. When a print matches an active watch by `eventName`, flip that card's `status` to `printed` in local state.
  - Render **at most one** card at a time — the nearest upcoming event. If multiple events fire the T-5 threshold in the same minute, stack them vertically inside the same container but cap at 3.
  - Lifecycle per event:
    - T-5min → fade-in: `opacity 0 → 1` over 400ms, `translateY(8px) → translateY(0)`, one-shot accent-border pulse (`#c79f4a` at full, decays to 40% opacity over 600ms). CSS-only, no library.
    - T-5min → T-0: Doto mm:ss counts down, updates every 1s via `setInterval`.
    - Print arrives (via SSE): cross-fade to result view — shows `Actual {X}` big + `Forecast {Y}` muted + `beat|miss|inline` chip (`beat` gold, `miss` slate, `inline` neutral). Brief 300ms gold flash on the whole frame on transition.
    - T+20s after print: fade-out `opacity 1 → 0`, `translateY(0) → translateY(-8px)` over 400ms, then unmount.
    - If no print arrives by T+15min from scheduled time → mark `missed`, fade out immediately with no flash.
  - No `backdrop-blur`, no `box-shadow`, no glass. Solid BG `#050402` with thin 1px `#c79f4a` border, 14px inner padding. Doto for the countdown numeral via `var(--font-data)`.
  - Mount location: inside `frontend/components/feed/RiskFlowMain.tsx` as an absolutely-positioned card anchored top-right of the feed pane (margin 12px from edge). Pass a `portalTarget?: HTMLElement` escape hatch for future use but default to in-flow.
- [ ] Wire the modal into `RiskFlowMain.tsx` (single import + render, no layout change to the rest of the component).
- [ ] Changelog entry in `src/lib/changelog.ts` + top-of-file `// [claude-code 2026-04-24]` comments on every modified file.

## Scope — Excluded (DO NOT TOUCH)

- `econ_watch_filters` table / API / manager component → **T1**.
- `economic_events` base migration / column additions → **T3**.
- Econ calendar populator (writes to `economic_events`) → **T3**.
- Econ keyword-trigger / event-window scheduler (promotes raw items to prints) → **T6**.
- Refinement Engine layout → **T2**.
- `sse-broadcaster.ts` `broadcastLevel4` / `broadcastProposal` functions — leave untouched; only **add** `broadcastEconPrint`.
- `injectEconPrintToFeed` logic above line 97 — only add the broadcast call after the successful insert.
- Any existing feed card rendering (`AnnotatableItem`, `FeedItem`, `RiskFlowDetailCard`).

## Known issues to preserve

- `feedback_no_glass_effects` — flat surfaces + accent borders only. Overrides the `/solvys-feels` frosted-glass default for this modal.
- `feedback_supabase_migration_filenames` — no SQL migrations in this track; T3 owns schema. If you need a column T3 didn't ship, flag in PR rather than write a migration.
- `feedback_fuses_are_sacred` — do not touch any fuse component.
- `feedback_riskflow_card_anatomy` — the countdown modal is a **new** card type, not a restyle of `AnnotatableItem`. Do not redesign existing RiskFlow card internals.
- `feedback_send_button_style` — no Send/airplane icon anywhere if you add an action affordance (dismiss button is a small × glyph, not an icon-lib send icon).
- Banned: emojis, gradients, Kanban borders, AI sparkles, shimmer, colored 3D icons, backdrop-blur, box-shadow.

## Implementation steps

1. **Backend first:**
   - Add `broadcastEconPrint` to `sse-broadcaster.ts` (mirror the `broadcastLevel4` fanout loop).
   - Wire it inside `econ-bridge.ts:injectEconPrintToFeed` after the successful `INSERT`.
   - Add `GET /api/econ/active-watch` handler in `backend-hono/src/routes/econ/index.ts` (the file already exists; add the GET alongside `POST /synthesize`). Return `[]` with `console.warn` if either table is missing.
   - `cd backend-hono && bun run build` clean.
   - Restart launchd backend; `curl localhost:8080/api/econ/active-watch` returns `[]` or an array.
2. **Frontend:**
   - Build `EconCountdownModal.tsx` with the polling + SSE hook + lifecycle state machine described above.
   - Mount it inside `RiskFlowMain.tsx`.
   - Local smoke: temporarily seed one row into `economic_events` with `scheduled_at = now() + 4 minutes` via a dev-only `curl POST` or direct Supabase SQL. Confirm modal fades in at T-5, counts down, fades out after T+15min.
   - Simulate a print arrival: `curl -X POST localhost:8080/api/data/econ-print` with matching `event` name; confirm cross-fade + gold flash + T+20s fade-out.
3. `npx tsc --noEmit --project frontend/tsconfig.json` → clean.
4. `rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts` → clean.
5. Changelog + top-of-file comments. Commit.

## Acceptance criteria

- [ ] `curl localhost:8080/api/econ/active-watch` returns JSON array (empty or populated, never 500).
- [ ] `broadcastEconPrint` fires an `econ-print` SSE frame observable via `curl -N localhost:8080/api/riskflow/stream?token=...` when `injectEconPrintToFeed` succeeds.
- [ ] Seeded event at T+4min → modal fades in at T-5 → Doto mm:ss counts down every second → arrives at 00:00.
- [ ] Simulated print → modal cross-fades to `Actual / Forecast / beat|miss|inline` view with one-shot 300ms gold flash.
- [ ] T+20s after print → modal fades out cleanly, no ghost DOM node left mounted.
- [ ] No glass / gradient / emoji / Kanban / shimmer / backdrop-blur / box-shadow anywhere in the component tree.
- [ ] `tsc --noEmit` clean, `vite build` clean, backend `bun run build` clean.
- [ ] No existing feed card rendering is regressed — `RiskFlowMain` still shows the full feed with the modal overlaid only when active.

## Validation commands

```bash
# Backend
cd backend-hono && bun run build && cd ..
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# API smokes
curl -s http://localhost:8080/api/econ/active-watch | jq 'type'          # expect "array"
curl -s http://localhost:8080/api/diagnostics | jq '.services'            # no new errors

# Frontend
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts

# SSE smoke (in a second terminal, needs a valid token)
curl -N "http://localhost:8080/api/riskflow/stream?token=$SUPABASE_JWT"
# then in a third terminal:
curl -X POST http://localhost:8080/api/data/econ-print \
  -H 'content-type: application/json' \
  -d '{"event":"CPI","actual":3.1,"forecast":3.0,"date":"2026-04-24"}'
# expect an `econ-print` frame on the SSE tail
```

## Commit format

```
[v.04.24.8] feat: T8 econ countdown modal + SSE econ-print channel
```

## Peer coordination

- **Peer ID:** `ivguf0wi` (per `sprint-md/S34-ORCHESTRATION.md`).
- On kickoff, `set_summary` to something like `"S34 T8 — econ countdown modal + SSE econ-print broadcast"`.
- If `econ_watch_filters` (T1) or `economic_events` (T3) is not yet available in your local DB at kickoff, proceed against the stub path (`[]` return) and flag it in the PR description. T9 will verify end-to-end wiring.
- Do **not** block on T6's keyword trigger — the SSE broadcast is already fired from `injectEconPrintToFeed`, which has prior callers (`econ-enricher`, `econ-triggered-poller`) sufficient for smoke.

## Open questions

- Should the modal persist across tab switches inside the app shell, or only render on the Strategium/feed tab? Default assumption: render only where `RiskFlowMain` is mounted (current behavior is fine). If TP wants global-shell behavior later, it's a one-line mount relocation — leave it local for now.
- Mobile: this brief is desktop-first. Mobile `RiskFlowMain` equivalent is out of scope; mobile pickup lands in a follow-on track if TP wants it.
