# S35 Orchestration — Arbitrum Deliberation Engine + Fintheon Mass Rename

**Prepared:** 2026-04-24 · claude-code · Opus 4.7 (1M)
**Sprint:** S35
**Unified branch target:** `s35-unified` (per-track branches off `s34-unified`)
**Design anchor:** /solvys-feels

## Headline

Two problems merged into one sprint: (1) replace MiroShark's groupthink-prone persona-sim with **Arbitrum** — a 5-seat Qwen debate via Hermes, signal-landscape output (no trade tickets), event-driven + 17:00 session cadence, feeds into PMDB as "Chamber Read" section. (2) resolve every naming mismatch the audit surfaced so when TP directs an agent to "fix the Forum," the agent knows exactly what code to touch.

## Wave 1 — parallel (8 tracks)

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

**Wave 1 does:** Builds the Arbitrum engine (T1 backend, T2 DB, T3 frontend), sweeps every naming mismatch that isn't infrastructure-heavy (T4 CAO copy, T5 TOTT→TWT, T6 OpenClaw/Pulse comment stragglers, T7 RiskFlow Econ Enricher), and publishes the canonical-names doc (T8) so future agents stop re-drifting.

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

**Wave 2 does:** Tears MiroShark/AgentDesk out of the codebase now that Arbitrum is live (T9, gated on T1+T2+T3), renames News Worker → RiskFlow Worker across Fly/launchd/Docker/DB (T10, infra-heavy, prepares new app; actual cutover is T12), and wires the PMDB Chamber Read section to consume Arbitrum's `getLatestChamberRead()` (T11, gated on T1).

## Wave 3 — unification (1 track, new VS Code window)

```
@sprint-md/S35-T12-unification.md
```

**Wave 3 does:** Pre-work archives any stray sprint-md state, merges T1-T11 branches into `s35-unified`, resolves the three expected `boot/services.ts` edits in one atomic pass (T1 arbitrum scheduler, T5 TOTT comment, T7 econ-enricher import rename), runs full tsc + clean vite + bun builds, executes Browser Harness validation for the three new UI surfaces (IV peek, Sanctum ArbitrumChamber, PMDB Chamber Read), coordinates the Fly cutover for T10's RiskFlow Worker, waits for the first 17:00 ET cron fire + 17:15 PMDB pickup, and hands off to TP for `/solvys-deploy`.

## Collision-free policy

- **`backend-hono/src/boot/services.ts`** is NOT owned by any Wave 1 or Wave 2 track. Any import/wire change lands exclusively in T12 unification.
- **`frontend/components/narrative/Sanctum.tsx`** — T3 swaps `AgentDeskDebatePanel` → `ArbitrumChamber`. T9 MUST NOT touch this file; it's post-T3.
- **`backend-hono/src/routes/index.ts`** — T1 mounts `/api/arbitrum`, T9 removes `/api/miroshark` alias. Both edits target different lines; T9 runs after T1 ships.

## Validation gate (T12)

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && (cd frontend && npx vite build)
rm -rf mobile/dist && (cd mobile && npx vite build)
cd backend-hono && bun run build
curl -s https://fintheon.fly.dev/api/arbitrum/latest | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" https://fintheon.fly.dev/api/miroshark/latest   # expect 404
fly apps list | grep fintheon-riskflow-worker
launchctl list | grep "io.solvys.fintheon-riskflow-worker"
```

## Reference — Plan file

Full plan at `/Users/tifos/.claude/plans/happy-conjuring-floyd.md`. Every brief below was derived from it. If a brief conflicts with the plan, the plan wins.
