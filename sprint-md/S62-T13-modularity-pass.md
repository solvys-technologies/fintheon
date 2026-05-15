# Sprint Brief: S62-T13 — Modularity Pass: Files Over 300 Lines

- **Linear**: SOL-51
- **Parent ORCH**: @sprint-md/S62-ORCH-platform-qa-hygiene.md
- **Branch**: `sprint/S62`
- **Assignee**: Shashank
- **Wave**: 2 (after Wave 1 — S62-T11 rename completes)

## Context

Per project rules, each `.ts`/`.tsx` file must serve one purpose and stay under 300 lines. This task identifies all files exceeding 300 lines and splits them into focused modules. Extract related functionality into separate files while preserving exports at the original file (re-export from new files if needed). Do not split intentionally monolithic files like `src/lib/changelog.ts`, generated files, or third-party types. Run after the S62-T11 rename to avoid merge conflicts on renamed files.

## Branch Target

`sprint/S62`

## Scope — Included

- [ ] All `.ts` and `.tsx` files in the project exceeding 300 lines (frontend, backend-hono, mobile, electron)
- [ ] Extracted modules re-exported from the original file to preserve import paths

## Scope — Excluded (DO NOT TOUCH)

- `src/lib/changelog.ts` — intentionally monolithic changelog
- Generated files (auto-generated types, protobuf stubs, etc.)
- Third-party vendor files or `.d.ts` files
- Test files — split only if they also exceed 300 lines and serve multiple test domains
- Files owned by Sam Frederique's Wave 1 tasks (S62-T11, S62-T12, S62-T14)

## Implementation Steps

1. Identify offenders:
   ```bash
   find . -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -30
   ```
2. For each file over 300 lines:
   - Identify discrete functional groups within the file (e.g., separate hooks, utility functions, sub-renderers)
   - Extract each group into a colocated file (e.g., `BigComponent.utils.ts`, `BigComponent.SubPanel.tsx`)
   - Re-export from the original file to preserve existing imports
   - Verify no circular dependencies introduced
3. Re-run the line count to confirm all files under 300 lines
4. Run full type check and build

## Split Heuristics

- **Utility functions** → `{filename}.utils.ts`
- **Sub-components** → `{filename}.{SubName}.tsx`
- **Type definitions** → `{filename}.types.ts` (unless already small enough to keep inline)
- **Constants/config** → `{filename}.constants.ts`
- **Hooks** → `{filename}.hooks.ts` or individual `use{X}.ts`

## Acceptance Criteria

- [ ] All frontend source `.tsx`/`.ts` files under 300 lines
- [ ] All backend source `.ts` files under 300 lines
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx vite build` passes
- [ ] No broken imports — existing consumers don't need updates (re-exports handle this)
- [ ] No lint errors introduced

## Validation Commands

```bash
# Identify offenders
find . -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -30

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build
```

## Commit Format

```
[v.6.0.27-s62-t13] refactor: modularity pass — split files over 300 lines
```
