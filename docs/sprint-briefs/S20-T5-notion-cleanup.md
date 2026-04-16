# Sprint Brief: T5 — Notion Severance Unification + Cleanup

## Context

Notion severance was completed across ~30 files: NotionService renamed to DataService, all `backend.notion.*` calls migrated to `backend.data.*`, polling removed, MCP connector removed, agent instructions cleaned. This track verifies the severance is clean, deletes the `SubAnalyst Context/` directory (after T1 extracts dossier content), and fixes any remaining Notion references.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [x] Delete `SubAnalyst Context/` directory (after confirming T1 extracted all dossier content)
- [x] Grep entire codebase for remaining Notion references (URLs, service names, env vars)
- [x] Fix any straggler references found
- [x] Verify frontend type-check clean
- [x] Verify backend build clean
- [x] Verify desktop vite build clean

## Scope — Excluded (DO NOT TOUCH)

- All T1-T4 files
- `mobile/` files (T6/T7 own)
- `boot/services.ts` (T3/T4 own)

## Known Issues to Preserve

- The Notion MCP tools in `.claude/settings.json` deferred tool list are external (Anthropic-provided), not our code. Don't touch those.
- `mcp__notion__*` tools in the system are Claude Code MCP integrations, not Fintheon code. Leave them.
- The severance already verified: `/api/riskflow/sources` returns `supabase: true` with no `notion` field on both local and prod.

## Implementation Steps

1. Confirm with T1 track that all 3 Notion dossier files have been read and their content merged into the new dossier files
2. Delete `SubAnalyst Context/` directory: `rm -rf "SubAnalyst Context/"`
3. Run comprehensive grep:
   ```bash
   grep -ri "notion" backend-hono/src/ --include="*.ts" | grep -v "node_modules" | grep -v ".d.ts"
   grep -ri "notion" frontend/src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
   ```
4. For each hit: determine if it's active code or a comment/changelog entry. Fix active code, leave changelog entries.
5. Run all 3 build checks

## Acceptance Criteria

- [x] `SubAnalyst Context/` directory does not exist
- [x] No active Notion service references in `backend-hono/src/` (comments/changelog OK)
- [x] No active Notion service references in `frontend/` (comments/changelog OK)
- [x] `cd backend-hono && bun run build` passes
- [x] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [x] `npx vite build` (desktop) passes

## Validation Commands

```bash
rm -rf "SubAnalyst Context/"
grep -ri "notionservice\|notionurl\|pollnotion\|notion-trade-idea" backend-hono/src/ frontend/
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
```
