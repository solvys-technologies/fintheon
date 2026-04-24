# S34 — Econ Pipeline Restoration + Refinement Engine Rebuild

**Orchestrator:** Claude Code (this thread) — holds review/finalize context.
**Source plan:** `/Users/tifos/.claude/plans/we-need-to-not-polymorphic-star.md`
**Start date:** 2026-04-24
**Version prefix:** `v.04.24.x`

## Problem

Econ prints haven't landed in the feed for weeks. Three root causes stacked:
1. `economic_events` table orphaned post-Notion severance (2026-04-16); no writer.
2. Rettiwt intentionally off since S27-T4; Agent-Reach replaced it but doesn't cover FJ-style actuals.
3. Refinement Engine edits (source-accounts table) don't propagate — news-worker uses hardcoded URLs.

Plus UX expansion: country/category filters, countdown modal, visual rebuild, backfill to 2023.

## Outcome

Refinement Engine = single source of truth for what we watch. Econ events surface as fade-in countdown modal that updates on print. Feed regains FJ-grade signal density. Backfill reaches 2023 via free-tier LLM cron.

## Wave plan

### Wave 1 — parallel, 4 tracks (foundation)
- **T1 / WS3** — Econ Filters UI + `econ_watch_filters` table → `sprint-md/S34-T1-econ-filters-ui-and-table.md`
- **T2 / WS4** — Refinement Engine visual rebuild → `sprint-md/S34-T2-refinement-engine-visual-rebuild.md`
- **T3 / WS5** — Econ calendar populator + `economic_events` base migration → `sprint-md/S34-T3-econ-calendar-populator.md`
- **T4 / WS9** — Web source quality audit → `sprint-md/S34-T4-web-source-quality-audit.md`

### Wave 2 — parallel, 4 tracks (wiring)
- **T5 / WS1** — Source-accounts → news-worker wiring → `sprint-md/S34-T5-source-accounts-wiring.md`
- **T6 / WS2** — Keyword trigger + event-window scheduler → `sprint-md/S34-T6-keyword-trigger-scheduler.md`
- **T7 / WS6** — Fiscal speaker sources (Trump/Bessent/Fed) → `sprint-md/S34-T7-fiscal-speaker-sources.md`
- **T8 / WS7** — Countdown modal (frontend) → `sprint-md/S34-T8-countdown-modal.md`

### Wave 3 — serial, 1 track (integration)
- **T9 / WS10** — Filters → populator → trigger → modal E2E wiring → `sprint-md/S34-T9-integration-e2e.md`

### Background (kicks off after Wave 2 clears)
- **T10 / WS8** — Backfill orchestrator to 2023 (free-tier LLMs, 2 quarters/week) → `sprint-md/S34-T10-backfill-orchestrator.md`

## Dependencies

```
T3 (economic_events base migration) ─┬─► T6 (trigger reads events)
                                     ├─► T7 (speakers write to table)
                                     └─► T8 (modal fetches upcoming)

T1 (econ_watch_filters) ─┬─► T3 (populator reads filters)
                         ├─► T6 (trigger respects filters)
                         └─► T8 (modal joins filters × events)

T4 (quality audit) ─► T5 (per-source counters inform wiring)
T2 (visual rebuild) ─── independent
T5 + T6 + T7 + T8 ─► T9 (integration)
T3 ─► T10 (backfill writes to same table)
```

## Branch strategy

Per-track branches off `main`: `s34-t{N}-{slug}`. Final merge via T9 integration track.

## Unification

T9 owns the final merge + E2E. Orchestrator (this thread) reviews each track's PR description + brief acceptance criteria before the merge fires, then runs the full /solvys-deploy after T9 + background T10 both pass.

## Banned ornaments (UI tracks: T1, T2, T8)

No gradients. No emojis. No Kanban borders. No AI sparkles / shimmer / animated gradient text. No glass effects / backdrop-blur / box-shadow (per `feedback_no_glass_effects`). Flat surfaces + accent borders + Doto numeral for numeric readouts. Solvys palette: BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`.

## Peer assignment (claude-peers MCP)

| Track | Peer ID    | Status |
| ----- | ---------- | ------ |
| T1    | a4dlos79   | dispatched Wave 1 |
| T2    | 2wxplrc7   | dispatched Wave 1 |
| T3    | 61nnt9zx   | dispatched Wave 1 |
| T4    | wlp2to6q   | dispatched Wave 1 |
| T5    | 1vlolesi   | Wave 2 (held) |
| T6    | u3pl7egk   | Wave 2 (held) |
| T7    | p5bw5t48   | Wave 2 (held) |
| T8    | ivguf0wi   | Wave 2 (held) |
| T9    | o4yv3wlt   | Wave 3 (held) |
| T10   | 0bwuvb79   | background (held) |
| spare | y2khnk3m, rohbo9ch | reserve |
