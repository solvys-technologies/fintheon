# Sprint Brief: S62-T23 — Execution Econ Calendar Ingest Hardening

- **Track**: `S62-T23`
- **Branch target**: `sprint/S62`
- **Parent ORCH**: `@sprint-md/S62-ORCH-platform-qa-hygiene.md`

## Objective
Harden the TradingView/econ calendar ingest pipeline so duplicate calendars and duplicate events are removed at ingest and render layers, with normalized source identity across performance and desk surfaces.

## Required Work
- Add deterministic calendar dedupe keys at ingest (provider + normalized calendar id + trading date window).
- Add event-level dedupe pass for same event represented with source-variant payload shapes.
- Normalize source metadata used by downstream performance and desk consumers.
- Ensure rendering layers do not re-introduce duplicates when merged feeds are displayed.
- Preserve existing calendar functionality while eliminating duplicate cards/rows.

## Acceptance Criteria
- No duplicate calendar containers for same logical source/date scope.
- No duplicate event rows for same event across source variants.
- Performance and desk surfaces consume normalized calendar identity fields.
- Regression checks pass for existing ingest paths and event rendering.

## Validation
- Data integrity tests: same event payload variants collapse to one canonical event.
- UI checks: calendar views show no duplicate containers or rows.
- Build checks: `npx tsc --noEmit --project frontend/tsconfig.json` and `cd backend-hono && bun run build`.
