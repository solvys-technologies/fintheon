# Sprint Brief: T1 — Econ Filters UI + `econ_watch_filters` table

## Context

TP needs the Refinement Engine to surface country + category filters that drive which econ events the system watches. Currently there's no such filter surface and no backing table. The Refinement Engine's existing `SourceAccountsManager` is the design template for CRUD + seed-on-empty behavior.

## Branch target

`s34-t1-econ-filters-ui-and-table` off `main`.

## Scope — Included

- [ ] Supabase migration: `supabase/migrations/20260424100000_econ_watch_filters.sql` — **local file only**, do NOT apply via MCP. Hand to TP to `supabase db push`.
  - Columns: `id uuid pk default gen_random_uuid()`, `country text`, `category text`, `active boolean default true`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`, `unique(country, category)`.
  - Seed 7 countries × 4 categories = 28 rows all active:
    - Countries: `US`, `EU`, `UK`, `JP`, `NZ`, `AU`, `CA`.
    - Categories: `Fiscal`, `Supply Chain`, `Inflation`, `Job Market`.
- [ ] Backend type + service: `backend-hono/src/types/econ-watch-filter.ts`, `backend-hono/src/services/econ-watch-filters/econ-watch-filters-service.ts`.
  - Mirror the CRUD + cache + seed-on-empty pattern in `backend-hono/src/services/source-accounts/source-accounts-service.ts:22-78`.
- [ ] Backend routes: `backend-hono/src/routes/econ-filters/index.ts` + `handlers.ts` (GET list, PATCH toggle, POST create, DELETE).
  - Register in `backend-hono/src/routes/index.ts` following the `source-accounts` block.
- [ ] Frontend component: `frontend/components/refinement/EconFiltersManager.tsx`.
  - Mirror `frontend/components/refinement/SourceAccountsManager.tsx` layout (headers, per-row toggles, category chip colors).
  - Accent-border flat rows; no glass/gradient/emoji.
  - Category chip palette: Fiscal → warm gold, Inflation → muted amber, Supply Chain → neutral, Job Market → slate.
- [ ] Slot into `frontend/components/refinement/RefinementEngine.tsx` — pass state + fetcher into the `AdvancedPane` alongside `SourceAccountsManager` (lines 456–485).
- [ ] Changelog entry in `src/lib/changelog.ts` and top-of-file `// [claude-code 2026-04-24] ...` comments on every modified file.

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/refinement/RefinementEngine.tsx` layout flip → owned by **T2**. You only add the new manager as a new child in the existing AdvancedPane; do NOT touch layout or visual styling.
- `economic_events` table / migration → owned by **T3**.
- Countdown modal → owned by **T8**.
- News-worker / source-accounts polling wiring → owned by **T5**.

## Known issues to preserve

- `feedback_supabase_migration_filenames`: 14-digit timestamp filenames, local file only, never `mcp__claude_ai_Supabase__apply_migration`.
- `feedback_no_glass_effects`: flat surfaces, accent borders only.
- Recent changelog entries (2026-04-23/24) that touch Refinement Engine are intentional — don't revert.

## Implementation steps

1. Write the migration SQL file; self-review it has `if not exists`, full seed, `unique(country, category)`.
2. Create `econ-watch-filter.ts` type + `econ-watch-filters-service.ts` service (copy `source-accounts-service.ts` shape).
3. Add `/api/econ-filters` routes; register in `routes/index.ts`.
4. Build `EconFiltersManager.tsx` visually matching `SourceAccountsManager.tsx`.
5. Wire fetcher + state in `RefinementEngine.tsx` (additive only, no layout change).
6. Type-check + build. Changelog + top-of-file comments. Commit.

## Acceptance criteria

- [ ] `curl localhost:8080/api/econ-filters` returns 28 rows on first call (seed-on-empty fires).
- [ ] Toggling a filter in UI → `PATCH /api/econ-filters/:id` → next GET reflects the change.
- [ ] Component renders inside RefinementEngine AdvancedPane without breaking existing panels.
- [ ] No glass effects, no emojis, no gradients in the new component.

## Validation commands

```bash
# Backend
cd backend-hono && bun run build && cd ..
# Frontend type-check
npx tsc --noEmit --project frontend/tsconfig.json
# Clean frontend build
rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts
# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
# Smoke
curl -s http://localhost:8080/api/econ-filters | jq 'length'  # expect 28 first time
```

## Commit format

```
[v.04.24.1] feat: T1 econ-watch-filters table + UI manager
```

## Open questions

- Should filters be per-user or global? Plan recommends **global for now, `user_id` nullable for future**. Add the nullable column; do NOT enforce ownership yet.
