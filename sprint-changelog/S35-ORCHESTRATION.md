# S35 Orchestration — Arbitrum Deliberation Engine + Fintheon Mass Rename

**Prepared:** 2026-04-24 · claude-code · Opus 4.7 (1M)
**Sprint:** S35
**Unified branch target:** `s35-unified` (per-track branches off `s34-unified`)
**Design anchor:** /solvys-feels
**Total tracks:** 13 (Wave 1: 9 parallel | Wave 2: 3 gated | Wave 3: 1 unification)

## Headline

Three problems merged into one sprint: (1) replace MiroShark's groupthink-prone persona-sim with **Arbitrum** — a 5-seat Qwen debate via Hermes, signal-landscape output (no trade tickets), event-driven + 17:00 session cadence, feeds into PMDB as "Chamber Read" section. (2) resolve every naming mismatch the audit surfaced so when TP directs an agent to "fix the Forum," the agent knows exactly what code to touch. (3) scrub user-visible OSS-inspiration fingerprints (Hermes in UI copy) and ship a NOTICES file crediting real sources.

**Build-never-breaks policy in force:** T7 ships a re-export shim, T10 does the same for news-worker-audit-scheduler, T5 keeps WT/TOTT as 2-week legacy aliases normalized to TWT, T1 `resolveProvider()` defaults to `'openrouter'` for unknown models, T1 event-trigger is fire-and-forget, T13 does ZERO symbol renames. See plan file for details.

## Wave 1 — parallel (9 tracks)

```
@sprint-md/S35-T1-arbitrum-backend.md
```

```
@sprint-md/S35-T2-arbitrum-migration.md
```

```
@sprint-md/S35-T3-arbitrum-frontend.md
```

```
@sprint-md/S35-T4-cao-copy.md
```

```
@sprint-md/S35-T5-tott-twt.md
```

```
@sprint-md/S35-T6-legacy-name-sweep.md
```

```
@sprint-md/S35-T7-riskflow-econ-enricher.md
```

```
@sprint-md/S35-T8-canonical-naming.md
```

```
@sprint-md/S35-T13-notices-oss.md
```

**Wave 1 does:** Builds the Arbitrum engine (T1 backend, T2 DB, T3 frontend), sweeps every naming mismatch that isn't infrastructure-heavy (T4 CAO copy, T5 TOTT+WT→TWT unified, T6 OpenClaw/Pulse comment stragglers, T7 RiskFlow Econ Enricher via shim), publishes the canonical-names doc (T8), and ships user-visible Hermes cleanup + NOTICES attribution file (T13). All 9 tracks have disjoint file ownership — zero merge conflicts expected within Wave 1.

## Wave 2 — dependency-gated (3 tracks)

```
@sprint-md/S35-T9-miroshark-teardown.md
```

```
@sprint-md/S35-T10-riskflow-worker.md
```

```
@sprint-md/S35-T11-pmdb-chamber-read.md
```

**Wave 2 does:** Tears MiroShark/AgentDesk out of the codebase now that Arbitrum is live (T9, gated on T1+T2+T3), renames News Worker → RiskFlow Worker across Fly/launchd/Docker/DB with shim safety (T10; actual cutover is T12), and wires the PMDB Chamber Read section to consume Arbitrum's `getLatestChamberRead()` (T11, gated on T1).

## Wave 3 — unification (1 track, new VS Code window)

```
@sprint-md/S35-T12-unification.md
```

**Wave 3 does:** Merges T1-T11 + T13 branches into `s35-unified` in dependency order, applies the three-edit atomic commit to `boot/services.ts` (arbitrum scheduler wire + econ-enricher rename + TOTT→TWT comment + riskflow-worker-audit rename), deletes the two migration shims (econ-enricher.ts, news-worker-audit-scheduler.ts), runs full tsc + clean vite + bun builds, executes Browser Harness validation for the three new UI surfaces (IV peek, Sanctum ArbitrumChamber, PMDB Chamber Read), coordinates the RiskFlow Worker Fly cutover with TP approval, waits for the first 17:00 ET cron fire + 17:15 PMDB pickup, and hands off to TP for `/solvys-deploy`.

## Collision-free policy

- **`backend-hono/src/boot/services.ts`** is NOT owned by any Wave 1 or Wave 2 track. All required changes (import swaps, TOTT→TWT comment, arbitrum scheduler wire) land exclusively in T12 atomic commit.
- **`frontend/components/narrative/Sanctum.tsx`** — T3 swaps `AgentDeskDebatePanel` → `ArbitrumChamber`. T9 only touches type-import paths (if any), never re-touches the component swap.
- **`backend-hono/src/routes/index.ts`** — T1 mounts `/api/arbitrum`, T9 removes `/api/miroshark` alias. Different lines; T9 runs post-T1.
- **`frontend/contexts/SystemStatusContext.tsx`** — T13 renames map keys; no other track touches this file.
- **`supabase/migrations/`** — T2, T9, T10 each write their own new SQL file with unique 14-digit timestamps. Zero conflict.

## Build-never-breaks policy

- T7 ships a re-export shim at `econ-enricher.ts` so `boot/services.ts:13` keeps resolving `startEconEnricher`. Build stays green mid-sprint.
- T10 ships a re-export shim at `cron/news-worker-audit-scheduler.ts` so `boot/services.ts:37` keeps resolving `startNewsWorkerAuditScheduler`.
- T5 keeps WT and TOTT as runtime-accepted aliases (normalize at entry to TWT); no caller that sends "WT" or "TOTT" today breaks.
- T1 `resolveProvider()` defaults to `'openrouter'` for unknown model IDs so harper-cao's existing Claude-Opus path is unchanged.
- T1 event-trigger is `void ... .catch(log.error)` at central-scorer write sites — never blocks the riskflow scorer.
- T13 is USER-VISIBLE STRINGS ONLY. Every backend/frontend import path, service name, hook name, function name starting with `hermes*` / `Hermes*` stays untouched. Zero symbol renames.

## Validation gate (T12)

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && (cd frontend && npx vite build)
rm -rf mobile/dist && (cd mobile && npx vite build)
cd backend-hono && bun run build
curl -s https://fintheon.fly.dev/api/arbitrum/latest | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" https://fintheon.fly.dev/api/miroshark/latest   # expect 404
curl -s -o /dev/null -w "%{http_code}\n" https://fintheon.fly.dev/api/harper/chat -X POST   # regression — expect 200/400/401, not 500
fly apps list | grep fintheon-riskflow-worker
launchctl list | grep "io.solvys.fintheon-riskflow-worker"
```

## Reference — Plan file

Full plan at `/Users/tifos/.claude/plans/happy-conjuring-floyd.md`. Every brief above was derived from it. If a brief conflicts with the plan, the plan wins.
