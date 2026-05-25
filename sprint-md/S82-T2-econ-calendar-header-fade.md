# Sprint Brief: S82-T2 -- Econ Calendar Header Fade

## Context

Econ Calendar should keep the TradingView iframe readable while the app header gently fades into black. The issue is overlap and lost padding, not a request to darken the whole calendar header area.

## Scope

- Use `@sprint-md/S82-T2-econ-calendar-header-fade.md` in Linear issue descriptions.
- Linear issue: `SOL-186`.
- Branch target: `sprint/S82`.
- Restore top padding so Econ Calendar controls and TradingView content do not sit on top of each other.
- Keep the header fade bounded and subtle.
- Preserve TradingView calendar URL, same-week keying, Desk Plan queue state, and Add to Calendar capture behavior.

## Files

- Owned: `frontend/components/econ/TradingViewCalendar.tsx` and shared fade CSS only if needed.
- Avoid: Desk Calendar backend routes, queue prompt generation, and RiskFlow feed logic.

## Acceptance

- Econ Calendar title/actions remain legible.
- TradingView calendar content starts below the app chrome instead of underneath it.
- `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- `rm -rf frontend/dist && cd frontend && bun run build` passes.
