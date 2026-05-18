# Desk Plans Anchored To Stale Or Past Econ Events

## Summary

Desk Plans were reusing stale persisted plans and could anchor a current plan to past or after-hours econ events. On May 18, 2026, the plan surfaced GDP even though that print was not an upcoming actionable event for the session.

## Fix

- Desk Plan generation now plans from the current America/New_York date.
- Existing persisted plans are rejected when they disagree with the current upcoming/actionable econ plan.
- Past same-day prints are excluded unless they are still within the allowed refresh window.
- After-hours prints are not clamped into the regular-session close window.
- Multi-day summit/forum/conference events remain eligible as explicit exceptions.
- Agentic Desk context now includes upcoming econ events so desk synthesis stays forward-looking.
- Legacy day-plan table shapes hydrate generated window event names without forcing repeated regeneration.

## Validation

- `cd backend-hono && bun run build`
- `git diff --check`
- Local `GET /api/day-plan/today` returned 200 with upcoming TIC/capital-flow windows instead of GDP.
- Live `GET /health` returned 200 after backend deploy.
- Live `GET /api/day-plan/today` returned 200 with upcoming TIC/capital-flow windows instead of GDP.

## References

- @sprint-md/S71-BUG-desk-plans-upcoming-events.md
- @backend-hono/src/services/day-plan/window-scheduler.ts
- @backend-hono/src/services/day-plan/day-plan-service.ts
- @backend-hono/src/services/agent-desk/agent-desk-context.ts
