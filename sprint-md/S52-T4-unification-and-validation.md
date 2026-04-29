# Sprint Brief: T4 -- Unification, Regression Gate, Changelog

## Context

This track merges T1/T2/T3 outputs into one sprint-complete state, runs full validation, confirms local desktop/mobile acceptance, and records changelog updates. It is the quality and release-readiness pass.

## Branch Target

`s51-cards-and-arbitrum`

## Scope -- Included

- [ ] Resolve cross-track integration mismatches.
- [ ] Run full frontend/backend validation suite.
- [ ] Perform local runtime smoke checks for RiskFlow and Arbitrum.
- [ ] Update changelog with accurate rollback-first + rebuilt outcome.

## Scope -- Excluded (DO NOT TOUCH)

- Net-new feature additions beyond T1/T2/T3 scope.
- Any deploy/publish operation (unless separately requested).

## File Ownership

- `src/lib/changelog.ts`
- Integration edits in touched T1/T2/T3 files only when needed to resolve merge regressions.

## Dependencies

- Requires completion of: T1, T2, T3.

## Reuse Inventory (existing code to call, not reinvent)

- Existing project build/type commands in root and `backend-hono`.
- Existing local API diagnostics endpoints (`/api/riskflow/feed`, `/api/arbitrum/latest`, `/api/diagnostics`).

## Known Issues to Preserve

- Do not revert unrelated working-tree changes.
- Keep desktop/local-first verification as the final gate.
- Changelog entries must avoid sensitive/plaintext private content.

## Implementation Steps

1. Merge outputs from T1/T2/T3 and resolve interface mismatches.
2. Run full validations in order:
   - frontend typecheck,
   - frontend clean build,
   - backend build.
3. Run runtime smoke checks:
   - RiskFlow feed payload and card behavior expectations,
   - Arbitrum latest verdict and UI states.
4. Add changelog entry summarizing:
   - rollback-first recovery,
   - RiskFlow full refactor outcome,
   - Arbitrum final changes.
5. Prepare final QA handoff note.

## Acceptance Criteria

- [ ] T1/T2/T3 integrate cleanly with no regressions.
- [ ] Full validation suite passes.
- [ ] Local desktop/mobile checks confirm expected final behavior.
- [ ] Changelog reflects final shipped delta accurately.

## Validation Commands

```bash
# Frontend typecheck
npx tsc --noEmit --project frontend/tsconfig.json

# Frontend clean build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Diagnostics + feed + arbitrum
curl -s http://localhost:8080/api/diagnostics | jq '.'
curl -s http://localhost:8080/api/riskflow/feed | jq '.[0] | {headline, tags, riskType, econData}'
curl -s http://localhost:8080/api/arbitrum/latest | jq '.'
```

## Commit Format

```text
[v.5.29.4] chore: S52-T4 unify RiskFlow+Arbitrum reset sprint and validation
```
