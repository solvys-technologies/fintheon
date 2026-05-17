# Sprint Brief: S70-T6 -- Unification, Validation, and Visual Tightening

## Context

This is the required final unification pass. It reconciles the backend
projection, evidence, deliberation bridge, review controls, and rebuilt surface,
then proves old NarrativeFlow behavior still works.

## Linear Scope

- **Issue**: SOL-136
- **Beta Phase**: Closed Beta
- **Cycle**: Cycle 8
- **Branch Target**: `sprint/S70`
- **Constituent**: @sprint-md/S70-T6-unification-validation-visual-tightening.md

## Scope -- Included

- [ ] Reconcile contracts across S70-T1 through S70-T5.
- [ ] Validate legacy `/api/narrative/catalysts`.
- [ ] Validate `/api/themes`.
- [ ] Validate `/api/narrative/orchestra`.
- [ ] Tighten NarrativeFlow empty, fallback, and populated states.
- [ ] Add changelog entry in `src/lib/changelog.ts`.

## Scope -- Excluded

- New feature scope beyond integration fixes.
- Replacing S69 Agent Lounge.
- Broad unrelated refactors.

## Implementation Steps

1. Pull all completed track outputs together on `sprint/S70`.
2. Resolve shared type or route mismatches.
3. Verify legacy catalyst promotion and new hypothesis projection coexist.
4. Run full backend and frontend validation.
5. Smoke the three narrative endpoints and inspect NarrativeFlow visually.
6. Add final changelog entry and report validation evidence.

## Acceptance Criteria

- [ ] NarrativeFlow has story spine, evidence constellation, agent rail, and
  routing gate.
- [ ] Legacy catalyst promotion still works.
- [ ] Theme Tracker data appears as hypothesis context, not a raw list.
- [ ] Agent deliberation renders from S69-style data or fallback fixtures.
- [ ] Human routing decisions persist.
- [ ] No banned visual ornaments.
- [ ] Backend build, frontend typecheck, and Vite build pass.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
curl -s http://localhost:8080/api/narrative/catalysts | head -c 300
curl -s http://localhost:8080/api/themes | head -c 300
curl -s http://localhost:8080/api/narrative/orchestra | head -c 300
```
