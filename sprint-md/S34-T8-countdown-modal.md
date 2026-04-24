# Sprint Brief: T8 — Countdown Modal (WS7)

## Context

TP wants a modal that fades in 5 minutes before any scheduled, subscribed econ event, shows a Doto-numeral countdown, and — when the print lands — updates in place with the actual value, holds for 15–30 seconds, then fades out. Triggered by SSE from `injectEconPrintToFeed` (T6 wires the broadcast; T8 consumes it).

## Branch target

`s34-t8-countdown-modal` off `main`. Wave 2 — depends on T1 (filters), T3 (events + `/api/econ/upcoming`), T6 (`/api/econ/active-watch` + SSE broadcast stub).

## Scope — Included

- [ ] New component: `frontend/components/feed/EconCountdownModal.tsx`.
  - Mounted at app root next to other global overlays (find and mirror existing global-overlay slot; common candidates are `App.tsx` or a `<GlobalOverlays>` wrapper — verify).
  - Polls `GET /api/econ/active-watch` every 30s to know upcoming events.
  - Renders when any event has `msToStart` between 0 and 300_000 (T-5min window).
  - **Fade-in:** opacity 0→1 over 400ms, `translateY(8px → 0)`, gold accent border pulses once (single 1.2s animation, not continuous).
  - **Body:** Doto numeral `mm:ss` countdown, event name, country chip, category chip.
  - **On print arrival** via SSE channel `econ-print`:
    - In-place update: countdown swaps to `Actual {X} vs Forecast {Y}`, brief 400ms gold flash on the accent border.
    - Start a 20-second fade-out timer (configurable constant `PRINT_DISPLAY_MS=20_000`).
  - **Fade-out:** opacity 1→0, `translateY(0 → -8px)`, 400ms, unmounts when opacity=0.
  - Stack: if 2+ events fire within 5min of each other, stack vertically bottom-right with a 12px gap; newest on top. Max 3 concurrent; fourth pushes oldest out.
- [ ] New hook: `frontend/hooks/useEconActiveWatch.ts` — fetches active watch, subscribes to SSE channel `econ-print`, merges event + print data.
- [ ] New SSE channel registration in `backend-hono/src/services/riskflow/sse-broadcaster.ts`:
  - `broadcastEconPrint(payload: { event_key, actual, forecast, previous, printed_at })`.
  - Replace the stub T6 added with the real pub/sub.
  - Frontend subscribes via `/api/sse/econ-print`.
- [ ] Visual: Solvys palette, BG `#050402`, accent `#c79f4a`, text `#f0ead6`. **No backdrop-blur**, no glass. Solid panel `rgba(5,4,2,0.98)`, 1px accent border, 4px border-radius. Doto font for countdown numerals. Flat.
- [ ] `frontend/components/feed/` directory must exist; verify + create if missing.
- [ ] Changelog + top-of-file comments.

## Scope — Excluded (DO NOT TOUCH)

- `RefinementEngine.tsx` → T2 owns layout.
- Backend econ calendar tables or population → T3/T7 own.
- Keyword trigger / scheduler → T6 owns.
- Do NOT add `backdrop-filter: blur`, `box-shadow` glow, or gradients anywhere in the modal.
- Do NOT install a new animation library — use `framer-motion` if it's already in `frontend/package.json`; otherwise plain CSS transitions.

## Known issues to preserve

- `feedback_no_glass_effects`: flat, accent-border only. Overrides `/solvys-feels` frosted-glass default.
- `feedback_send_button_style`: irrelevant here (no send button), but if any CTA appears, circular ArrowUp.
- `feedback_fuses_are_sacred`: the modal must NOT use the RiskFlow card's fuse primitive — it's a separate overlay layer.
- `feedback_riskflow_card_anatomy`: Doto numerals only on numeric readouts (the countdown + the actual/forecast values). Event name stays in the body text font.
- SSE channel names on the backend already use `sse-broadcaster.ts` conventions — reuse, don't invent.

## Implementation steps

1. Read `sse-broadcaster.ts` end-to-end; note how existing channels are registered + consumed.
2. Add `broadcastEconPrint` publisher + `/api/sse/econ-print` subscriber route.
3. Wire T6's stub call to the real publisher.
4. Build `useEconActiveWatch` hook — polling + SSE fan-in.
5. Build `EconCountdownModal.tsx` — layout, fade states, Doto countdown.
6. Mount at app root; verify it doesn't affect existing overlays.
7. Manually test: seed a fake event 6 min out via SQL → modal fades in at T-5 → POST a fake print → modal updates → fades ~20s later.
8. `tsc --noEmit` + `rm -rf dist && vite build` clean.
9. Changelog + comments + commit.

## Acceptance criteria

- [ ] Modal fades in exactly at T-5min for any active-watch event.
- [ ] Countdown Doto numerals update every 1s, no jitter.
- [ ] On SSE print event, countdown swaps to `Actual vs Forecast` with a 400ms gold flash.
- [ ] Modal fades out 20s after print; unmounts cleanly.
- [ ] 3-concurrent stack works (stack of 3 renders; 4th displaces oldest).
- [ ] No glass, no gradient, no emoji, no kanban border. Doto font on numerals only.
- [ ] tsc + build clean.

## Validation commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts
cd backend-hono && bun run build && cd ..
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
# SSE smoke (separate terminal):
curl -N http://localhost:8080/api/sse/econ-print
# Seed event (SQL) 6min out; countdown should appear in desktop app shortly after.
```

## Commit format

```
[v.04.24.8] feat: T8 econ countdown modal + SSE print channel
```
