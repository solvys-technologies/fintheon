# Sprint Brief: T7 -- Per-Wave Unification, Final Review, and Push Prep

## Context

S47 is a 5-agent, multi-wave bug repair and platform cleanup sprint. This track owns per-wave conflict resolution, final type/build validation, screenshots, and release-readiness. It is the only track allowed to merge wave outputs together.

## Branch Target

`s47-final-unify`

## Scope -- Included

- [ ] Unify Wave 0 tooling choices into Wave 1/2/3 briefs before implementation starts.
- [ ] Merge Wave 1 branches and resolve backend/data contract conflicts.
- [ ] Merge Wave 2 branches and resolve UI/backend interface mismatches.
- [ ] Merge Wave 3 design-system branch and resolve shared primitive conflicts.
- [ ] Run full local gates and targeted smoke checks.
- [ ] Capture before/after screenshots required by issue #234 and issue evidence.
- [ ] Update changelog and produce final review/push checklist.

## Scope -- Excluded (DO NOT TOUCH)

- Do not implement new feature scope not already in T1-T6.
- Do not deploy unless TP explicitly invokes/approves deploy flow.
- Do not force-push or reset branches.

## Reuse Inventory

- `sprint-md/S47-BUG-REPAIR-PLAN.md` -- master issue-derived plan.
- `sprint-md/S47-T0-skills-stars-tooling.md` through `S47-T6-design-icons-spinners-charts.md` -- track briefs.
- `src/lib/changelog.ts` -- must include entries for actual implementation changes.
- `CLAUDE.md` -- build/deploy/restart rules.
- `backend-hono/CLAUDE.md` -- backend build/restart/deploy constraints.
- Existing smoke endpoints: `/api/diagnostics`, `/api/riskflow/feed`, `/api/riskflow/iv-aggregate`, `/api/arbitrum/latest`, `/api/data/brief/latest?type=PMDB`, `/api/desk/calendar/queue`.

## Known Issues to Preserve

- Backend is launchd-managed. Only restart after backend build passes and only when needed.
- Never start a Vite dev server.
- Always wipe `dist` before frontend build.
- Do not bypass Supabase JWT or RLS.
- Do not reintroduce OpenRouter/DashScope/FMP/Exa/MSM direct ingestion.

## Implementation Steps

1. After T0, update orchestration notes with TP-approved tooling choices.
2. Merge Wave 1 branches: T1 and T2. Resolve data contract conflicts first.
3. Run backend build and route smokes for Wave 1.
4. Merge Wave 2 branches: T3, T4, T5. Resolve UI/backend contract mismatches.
5. Run frontend typecheck, mobile typecheck if touched, backend build if touched.
6. Merge Wave 3 branch: T6. Resolve shared visual primitive usage.
7. Run full gates: backend build, frontend tsc, frontend clean build, mobile build if touched.
8. Capture screenshots/reproductions: RiskFlow expanded card, Refinement save/rescore, Calendar Add to Calendar, Developer countdown test, Arbitrum layout, PMDB vs Arbitrum timestamp, Agentic Forum run card, Chat greeting behavior, mobile chat response.
9. Check `git status --short` and ensure no secrets, `.env*`, or unrelated generated artifacts are staged.
10. Update `src/lib/changelog.ts` with final unification summary.
11. Prepare final push/release note, but do not push/deploy unless explicitly approved.

## Acceptance Criteria

- [ ] All wave branches are integrated without unresolved conflicts.
- [ ] Backend build passes.
- [ ] Frontend typecheck and clean build pass.
- [ ] Mobile validation passes if mobile files changed.
- [ ] Smoke endpoints return valid JSON.
- [ ] Screenshot/reproduction evidence is captured for issue closure.
- [ ] Final status lists residual risks and any blocked items.

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Mobile validation if mobile changed
cd mobile && npx tsc --noEmit && rm -rf dist && npx vite build

# Smokes after local backend restart if backend changed
curl -s http://localhost:8080/api/diagnostics
curl -s http://localhost:8080/api/riskflow/feed
curl -s http://localhost:8080/api/riskflow/iv-aggregate
curl -s http://localhost:8080/api/arbitrum/latest
curl -s 'http://localhost:8080/api/data/brief/latest?type=PMDB'
curl -s http://localhost:8080/api/desk/calendar/queue
```

## Commit Format

```bash
[v5.34.0] chore: unify S47 bug repair sprint
```
