# Sprint Brief: T9 — MiroShark / AgentDesk Tear-out (Wave 2)

## Context

Once Arbitrum is live (T1+T2+T3 merged), MiroShark and its AgentDesk naming scaffolding must come out. The **Aquarium UI surface label stays** in Sanctum — it's just sourced from `arbitrum_verdicts` now instead of `miroshark_deliberations`. Deletes the old deliberation service, the AgentDesk debate panel, the `/api/miroshark` legacy alias, and renames `frontend/types/agent-desk.ts` → `frontend/types/arbitrum.ts` with a type-name rename that cascades through ~25 importing files.

## Branch Target

`s35-t9-miroshark-teardown` (off `s35-unified` or directly off `s34-unified` — merge conflicts resolved by T12)

## Gated on

- T1 Arbitrum backend merged (so `services/arbitrum/` exists and is serving `/api/arbitrum/*`)
- T2 Arbitrum migration applied (so `arbitrum_verdicts` table exists)
- T3 Arbitrum frontend merged (so `Sanctum.tsx` already swapped `AgentDeskDebatePanel` → `ArbitrumChamber`)

Do NOT start this track until `s35-unified` has T1+T2+T3.

## Scope — Included

Backend:

- [ ] DELETE `backend-hono/src/services/agent-desk/agent-desk-deliberation.ts`
- [ ] DELETE any other file under `backend-hono/src/services/agent-desk/` that is deliberation-specific. If the directory has other utilities NOT related to deliberation, leave those and just delete deliberation-\*.ts files.
- [ ] EDIT `backend-hono/src/routes/index.ts` — remove the `app.route("/api/miroshark", agentDeskRoutes)` legacy alias mount. Leave the primary `/api/agent-desk` mount if it exists (that one handles non-deliberation endpoints; Arbitrum doesn't replace those).
- [ ] If `backend-hono/src/routes/agent-desk/` has deliberation-specific routes, delete them. Keep non-deliberation routes.

Frontend type rename:

- [ ] RENAME `frontend/types/agent-desk.ts` → `frontend/types/arbitrum.ts` via `git mv`
- [ ] Inside the renamed file, rename every exported type:
  - `AgentDeskCategoryScore` → `ArbitrumCategoryScore`
  - `AgentDeskRiskCategory` → `ArbitrumRiskCategory`
  - `AgentDeskGeneratedEvent` → `ArbitrumGeneratedEvent`
  - Any other `AgentDesk*` identifier → `Arbitrum*`
  - Constants like `AUDITORIUM_PAGES`, `RISK_CATEGORY_LABELS`, `ivHeatColor` — if their names don't include "AgentDesk," leave them. Only AgentDesk-prefixed names rename.

Frontend imports (~25 files):

- [ ] Update every `from "../../types/agent-desk"` → `from "../../types/arbitrum"` (path adjusts for actual nesting depth)
- [ ] Update every `AgentDeskXxx` identifier reference to `ArbitrumXxx`

Files that import from `types/agent-desk` (enumerate at kickoff with `grep -rnE "from\\s+['\"].*agent-desk['\"]" frontend/`):

- `frontend/components/narrative/Sanctum.tsx` — note: T3 already touched this file for the AgentDeskDebatePanel swap; CAREFULLY only update the type imports, not re-touching T3's component swap
- `frontend/components/narrative/SanctumEconIntel.tsx`
- `frontend/components/narrative/SanctumNarratives.tsx`
- `frontend/components/narrative/SanctumKanban.tsx`
- `frontend/components/narrative/SanctumMacroStrip.tsx`
- (approx 25 total per prior audit)

Frontend component tear-out:

- [ ] DELETE `frontend/components/agent-desk/AgentDeskDebatePanel.tsx` (replaced by ArbitrumChamber in T3)
- [ ] If `frontend/components/agent-desk/` contains other components still in use (non-deliberation ones like maybe `AgentDeskCategoryPanel` or similar), verify via grep — if referenced by live code, LEAVE them; if orphaned after your tear-out, delete.

Mobile:

- [ ] EDIT `mobile/hooks/useAgentDeskLatest.ts` — rename to `useArbitrumLatest.ts` via `git mv`; update URL from `/api/miroshark/latest` to `/api/arbitrum/latest`; rename hook function.
- [ ] EDIT `mobile/components/home/AquariumSummary.tsx` — any `mirosharkComponent` / `agentDeskComponent` field reads change to `arbitrumComponent`. Note: mobile UI label "Aquarium Summary" STAYS (Aquarium is the surface name).
- [ ] EDIT `mobile/components/home/HomePage.tsx` — update the comment at line ~9-11 about the rename history to acknowledge the final Arbitrum landing.

Migration (hand to TP, do not apply yourself):

- [ ] NEW `supabase/migrations/YYYYMMDDHHMMSS_miroshark_deliberations_archive.sql` — does NOT drop the table outright. Renames to `archive_miroshark_deliberations_2026_04` so historical data is preserved but not read by any live code. Adds a comment. Deferred actual DROP to a future cleanup sprint.

```sql
-- [S35-T9] Archive miroshark_deliberations (superseded by arbitrum_verdicts)
-- Rename preserves history for compliance / retrospective analysis.
-- Actual DROP deferred to follow-up sprint ≥ 30 days post-ship.

ALTER TABLE public.miroshark_deliberations
  RENAME TO archive_miroshark_deliberations_2026_04;

COMMENT ON TABLE public.archive_miroshark_deliberations_2026_04 IS
  'Archived 2026-04-24 (S35-T9). Superseded by public.arbitrum_verdicts. Kept for 90 days; DROP scheduled post 2026-07-24.';
```

## Scope — Excluded (DO NOT TOUCH)

- `services/arbitrum/*`, `routes/arbitrum/*`, `cron/arbitrum-session-scheduler.ts` — T1 owns
- `supabase/migrations/*arbitrum_verdicts*` — T2 owns
- `frontend/components/arbitrum/*`, `frontend/hooks/useArbitrumLatest.ts` — T3 owns
- `frontend/components/narrative/Sanctum.tsx` — T3 already swapped the component; you ONLY update the type import path (if Sanctum imports from `types/agent-desk`); DO NOT re-touch the component swap
- `frontend/components/narrative/AquariumPredictionCards.tsx` — UI surface, unchanged (just re-sourced from arbitrum via T3)
- `backend-hono/src/boot/services.ts` — T12 owns
- Any file touched by T1-T8, T10, T11, T13
- The Aquarium surface label anywhere (don't rename "Aquarium" to "Arbitrum" in UI copy — the label stays Aquarium)

## Reuse Inventory

- `frontend/types/arbitrum.ts` (renamed-from-agent-desk) is the single source of truth for all Arbitrum-related types. Components import from here.
- Existing grep pattern: `grep -rnE "AgentDesk|agent-desk" --include="*.ts" --include="*.tsx" frontend/ mobile/ backend-hono/src/` enumerates everything this track touches

## Known Issues to Preserve

- **Aquarium IS the surface label.** Do NOT rename Aquarium to Arbitrum anywhere in frontend/mobile copy. Only internal types, services, and DB tables rename.
- T3 landed Sanctum's component swap; if your grep hits `Sanctum.tsx` for type imports, ONLY touch the `from "../../types/agent-desk"` path — leave the JSX element `<ArbitrumChamber ... />` alone.
- Migration does NOT drop the MiroShark table. Rename-to-archive pattern preserves data for 90 days.
- `/api/miroshark/latest` endpoint must return 404 after this ships; the mobile `useArbitrumLatest` hook (renamed) hits `/api/arbitrum/latest`. Any still-deployed mobile client on the old version will 404 on the miroshark call — that's acceptable; mobile auto-refreshes.
- `grep -rnE "miroshark_deliberations" backend-hono/src/` — if you find any SELECT against the archived table name, update to read from `arbitrum_verdicts` OR flag to orchestrator that the read-path still needs migrating.

## Implementation Steps

1. Verify gates: check that `s35-unified` (or your base branch) has T1/T2/T3 merged. `git log --oneline | grep -E "S35-T[1-3]"` should show all three.
2. Backend: delete `services/agent-desk/agent-desk-deliberation.ts`. If there are sibling deliberation-\*.ts files, delete them too. Verify `grep -rn "agent-desk-deliberation" backend-hono/src/` returns only stale references to clean up.
3. Backend: edit `routes/index.ts` — remove `/api/miroshark` mount. Keep `/api/agent-desk` mount if it serves non-deliberation endpoints.
4. Backend: any orphaned imports from the deleted file → clean up. `bun run build` should be clean after.
5. Frontend types: `git mv frontend/types/agent-desk.ts frontend/types/arbitrum.ts`. Inside, rename exported types: `AgentDesk*` → `Arbitrum*`.
6. Frontend imports: grep `from ["\"].*agent-desk["\"]` across frontend/, mobile/; update every hit to `arbitrum`. Build tsc after to verify.
7. Frontend components: delete `components/agent-desk/AgentDeskDebatePanel.tsx` (T3 already stopped rendering it). Verify nothing else imports it.
8. Mobile: `git mv mobile/hooks/useAgentDeskLatest.ts mobile/hooks/useArbitrumLatest.ts`. Update URL from `/api/miroshark/latest` to `/api/arbitrum/latest`. Update exported hook name.
9. Mobile: update `AquariumSummary.tsx` field reads, preserve the "Aquarium" label.
10. Migration: write the archive SQL file with 14-digit timestamp. Hand to TP.
11. Run full build: `npx tsc --noEmit --project frontend/tsconfig.json`, `cd backend-hono && bun run build`, `rm -rf mobile/dist && cd mobile && npx vite build`.

## Acceptance Criteria

- [ ] `backend-hono/src/services/agent-desk/agent-desk-deliberation.ts` gone
- [ ] `frontend/components/agent-desk/AgentDeskDebatePanel.tsx` gone
- [ ] `frontend/types/agent-desk.ts` renamed to `arbitrum.ts`; AgentDesk* type names renamed to Arbitrum*
- [ ] `mobile/hooks/useAgentDeskLatest.ts` renamed to `useArbitrumLatest.ts`; hits `/api/arbitrum/latest`
- [ ] `grep -rnE "from\\s+['\\\"].*agent-desk" frontend/ mobile/` returns zero live hits
- [ ] `grep -rnE "AgentDesk(CategoryScore|RiskCategory|GeneratedEvent)" frontend/ mobile/` returns zero live hits
- [ ] `/api/miroshark/latest` 404s (endpoint removed)
- [ ] `/api/arbitrum/latest` 200s (T1 serves)
- [ ] Sanctum UI still labels its surface "Aquarium" — NOT renamed
- [ ] tsc clean, vite build clean (frontend + mobile), bun build clean
- [ ] Migration SQL file present, ready for TP to `supabase db push`

## Validation Commands

```bash
grep -rnE "from\\s+['\\\"].*agent-desk" frontend/ mobile/
grep -rnE "AgentDesk" frontend/ mobile/ | grep -v node_modules | grep -v changelog
grep -rnE "miroshark_deliberations" backend-hono/src/ | grep -v dist

cd backend-hono && bun run build
cd .. && npx tsc --noEmit --project frontend/tsconfig.json
rm -rf mobile/dist && (cd mobile && npx vite build)

# Post-deploy smoke (T12 runs these)
curl -s -o /dev/null -w "%{http_code}\n" https://fintheon.fly.dev/api/miroshark/latest   # expect 404
curl -s -o /dev/null -w "%{http_code}\n" https://fintheon.fly.dev/api/arbitrum/latest    # expect 200
```

## Commit Format

```
[v5.25.0-S35-T9] feat: MiroShark/AgentDesk tear-out post-Arbitrum

Deletes services/agent-desk/agent-desk-deliberation.ts and
components/agent-desk/AgentDeskDebatePanel.tsx. Removes /api/miroshark
legacy alias. Renames frontend/types/agent-desk.ts -> arbitrum.ts and
cascades AgentDesk* -> Arbitrum* type rename through ~25 importing
files. Renames mobile/hooks/useAgentDeskLatest -> useArbitrumLatest,
URL -> /api/arbitrum/latest. Migration archives miroshark_deliberations
to archive_miroshark_deliberations_2026_04 (DROP deferred 90 days).
Aquarium surface label UNTOUCHED (TP's canonical name for the Sanctum
panel; Arbitrum is just the engine behind it).
```
