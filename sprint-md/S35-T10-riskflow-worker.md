# Sprint Brief: T10 — News Worker → RiskFlow Worker Rename (Infra-Heavy)

## Context

The `news-worker` Fly app / launchd service / Docker image / DB table is misnamed — the feature it powers is RiskFlow. Rename to `riskflow-worker` across every surface. This is infra-heavy: Fly app rename requires NEW app + cutover + old-app retire (Fly doesn't support in-place rename). T10 PREPARES the new app, env, plist, Dockerfile, code, migration — T12 unification coordinates the actual deploy-window cutover with TP approval.

## Branch Target

`s35-t10-riskflow-worker` (off `s34-unified` — independent of Wave 1)

## Scope — Included

### Fly app (prepare, don't deploy yet)

- [ ] NEW `backend-hono/fly.riskflow-worker.toml` — copy `fly.news-worker.toml` and adjust:
  - `app = "fintheon-riskflow-worker"`
  - `dockerfile = "Dockerfile.riskflow-worker"`
  - Env: `RISKFLOW_WORKER_PORT = "8082"`, `FLAG_RISKFLOW_WORKER_ENABLED = "true"` (renamed from FLAG_NEWS_WORKER_WRITES_RISKFLOW — drop the "WRITES_RISKFLOW" redundancy)
  - Everything else (regions, machines, always-on config) identical to the news-worker toml
- [ ] NEW `backend-hono/Dockerfile.riskflow-worker` — copy `Dockerfile.news-worker` and adjust:
  - `ENV RISKFLOW_WORKER_PORT=8082`
  - `CMD ["node", "dist/workers/riskflow-worker/index.js"]`
  - Comment at top: `# Fintheon RiskFlow Worker — Always-On Sibling Process (renamed from news-worker in S35)`

### Launchd (prepare, don't swap yet)

- [ ] NEW `launchd/io.solvys.fintheon-riskflow-worker.plist` — copy `launchd/io.solvys.fintheon-news-worker.plist` and adjust:
  - `Label` → `io.solvys.fintheon-riskflow-worker`
  - `ProgramArguments` → point at `src/workers/riskflow-worker/index.ts` (or compiled dist path, mirror news-worker pattern)
  - `EnvironmentVariables.RISKFLOW_WORKER_PORT = 8082`
  - `StandardOutPath` / `StandardErrorPath` paths renamed
- [ ] Mark old `launchd/io.solvys.fintheon-news-worker.plist` for deletion in T12 (don't delete here yet — T12 coordinates the swap)

### Worker directory rename

- [ ] RENAME via `git mv`: `backend-hono/src/workers/news-worker/` → `backend-hono/src/workers/riskflow-worker/`
- [ ] Inside the renamed directory, update symbols in every file:
  - `service: "news-worker"` → `service: "riskflow-worker"` (logs in index.ts, persist.ts, scheduler.ts, sources/index.ts)
  - `submitted_by: "news-worker"` → `submitted_by: "riskflow-worker"` in persist.ts:65
  - Env var reads: `process.env.NEWS_WORKER_PORT` → `process.env.RISKFLOW_WORKER_PORT`
  - Flag reads: `process.env.FLAG_NEWS_WORKER_WRITES_RISKFLOW` → `process.env.FLAG_RISKFLOW_WORKER_ENABLED`
  - Comments referencing "news-worker" → "riskflow-worker"

### Audit scheduler rename

- [ ] RENAME via `git mv`: `backend-hono/src/services/cron/news-worker-audit-scheduler.ts` → `riskflow-worker-audit-scheduler.ts`
- [ ] RENAME via `git mv`: `backend-hono/src/services/cron/news-worker-audit-handler.ts` → `riskflow-worker-audit-handler.ts`
- [ ] Rename symbols inside:
  - `startNewsWorkerAuditScheduler` → `startRiskFlowWorkerAuditScheduler`
  - `stopNewsWorkerAuditScheduler` → `stopRiskFlowWorkerAuditScheduler`
  - `isNewsWorkerAuditSchedulerActive` → `isRiskFlowWorkerAuditSchedulerActive`
  - `runNewsWorkerAudit` → `runRiskFlowWorkerAudit`
  - Trigger IDs: `news_worker_audit_morning/midday/close` → `riskflow_worker_audit_morning/midday/close`

### Shim for boot/services.ts import

- [ ] **CRITICAL safety step**: create a thin re-export shim at `backend-hono/src/services/cron/news-worker-audit-scheduler.ts` that forwards to the renamed file, so `boot/services.ts:37` import (`startNewsWorkerAuditScheduler` from `news-worker-audit-scheduler.js`) keeps resolving:

```ts
// [claude-code 2026-04-24 S35-T10] Re-export shim — keeps boot/services.ts:37 building
// until T12 rewires the import. T12 deletes this file.
export {
  startRiskFlowWorkerAuditScheduler as startNewsWorkerAuditScheduler,
  stopRiskFlowWorkerAuditScheduler as stopNewsWorkerAuditScheduler,
  isRiskFlowWorkerAuditSchedulerActive as isNewsWorkerAuditSchedulerActive,
} from "./riskflow-worker-audit-scheduler.js";
```

### Diagnostics response

- [ ] EDIT `backend-hono/src/routes/diagnostics/index.ts` — **keep both keys** for 2-week migration window:
  - Add new key `riskflow_worker: {...}` (same shape as existing `news_worker: {...}`)
  - Keep `news_worker` alias populated from the same snapshot (dual-write)
  - Comment: `// S35-T10: riskflow_worker is primary; news_worker alias sunsets 2026-05-08`

### DB migration

- [ ] NEW `supabase/migrations/YYYYMMDDHHMMSS_rename_news_worker_heartbeats.sql`:

```sql
-- [S35-T10] Rename news_worker_heartbeats -> riskflow_worker_heartbeats
-- (worker renamed; table name should match)

ALTER TABLE public.news_worker_heartbeats
  RENAME TO riskflow_worker_heartbeats;

-- Keep a VIEW aliasing the old name for 2-week legacy window
CREATE OR REPLACE VIEW public.news_worker_heartbeats AS
  SELECT * FROM public.riskflow_worker_heartbeats;

COMMENT ON VIEW public.news_worker_heartbeats IS
  'Legacy alias view — sunsets 2026-05-08. Reads resolve to riskflow_worker_heartbeats.';
```

- [ ] EDIT table read sites: any `.from("news_worker_heartbeats")` → `.from("riskflow_worker_heartbeats")`. Grep `news_worker_heartbeats` in backend-hono/src/ to find them.

### Env var references

- [ ] EDIT `backend-hono/.env.example` — add `RISKFLOW_WORKER_PORT` and `FLAG_RISKFLOW_WORKER_ENABLED`; keep old `NEWS_WORKER_PORT` + `FLAG_NEWS_WORKER_WRITES_RISKFLOW` with `# DEPRECATED 2026-05-08` comments.

### Deploy instructions

- [ ] EDIT `backend-hono/CLAUDE.md` — update the "Deploy (news-worker)" section to "Deploy (riskflow-worker)" with the new config file reference. Keep the old section with a `// DEPRECATED — use riskflow-worker` note for 2 weeks.

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/boot/services.ts` — T12 owns the import swap (and deletion of the shim)
- Any file touched by T1-T9, T11, T13
- Old `fly.news-worker.toml`, `Dockerfile.news-worker`, `launchd/io.solvys.fintheon-news-worker.plist` — T12 deletes these AFTER the Fly cutover succeeds. T10 does not delete.
- The actual Fly cutover (`fly deploy --config fly.riskflow-worker.toml`) — T12 executes during deploy window with TP approval

## Reuse Inventory

- Existing `fly.news-worker.toml` shape — mirror exactly for the new toml
- Existing `Dockerfile.news-worker` — mirror exactly for the new Dockerfile
- Existing `launchd/io.solvys.fintheon-news-worker.plist` — mirror exactly for the new plist
- Existing audit scheduler registration pattern in `boot/services.ts:37` — the shim preserves it unchanged

## Known Issues to Preserve

- Fly app rename is **non-rollback-safe** (memory: plan file risk notes). New app + cutover + retire is the only pattern; old app stays up until new app validates.
- `news_worker_heartbeats` table data must not be lost — the `ALTER TABLE ... RENAME TO` preserves data; the VIEW preserves backward-compatible reads.
- `submitted_by: "news-worker"` in existing DB rows becomes historical. Any dashboard query filtering on `submitted_by = 'news-worker'` still sees historical rows; new rows get `"riskflow-worker"`.
- Fintheon backend is launchd-managed (`io.solvys.fintheon-backend`) — the news-worker is a SEPARATE launchd service. Don't conflate them.
- TP memory: "Fly apps run 24/7" — the new riskflow-worker Fly app must have `auto_stop_machines = false` and `min_machines_running >= 1`, same as news-worker.

## Implementation Steps

1. Copy fly toml, Dockerfile, launchd plist — rename all internal strings
2. `git mv` the `workers/news-worker/` directory and both cron scheduler files
3. Rename symbols inside
4. Create the shim at `services/cron/news-worker-audit-scheduler.ts` for boot import safety
5. Update diagnostics to dual-write both keys
6. Write the heartbeats-rename migration
7. Update `.env.example` and `backend-hono/CLAUDE.md`
8. `cd backend-hono && bun run build` — MUST be clean (shim saves you)
9. Smoke-test nothing cut over yet: `fly apps list | grep fintheon-news-worker` still shows old app up; T12 handles the rest.

## Acceptance Criteria

- [ ] New fly toml, Dockerfile, plist exist alongside old ones (old not deleted yet)
- [ ] Worker dir renamed; symbols + log strings all say "riskflow-worker"
- [ ] Audit scheduler files renamed + symbol-renamed
- [ ] Shim at `news-worker-audit-scheduler.ts` re-exports, keeps boot import resolving
- [ ] Diagnostics response has both `riskflow_worker` and `news_worker` keys
- [ ] Migration file written (14-digit timestamp), ready for TP
- [ ] `.env.example` has both new and old env vars (old marked DEPRECATED)
- [ ] `cd backend-hono && bun run build` clean

## Validation Commands

```bash
# Shim resolves old import
node -e "const m = require('./backend-hono/dist/services/cron/news-worker-audit-scheduler.js'); console.log(typeof m.startNewsWorkerAuditScheduler);"

# Build clean
cd backend-hono && bun run build

# New fly toml parses
fly config validate --config backend-hono/fly.riskflow-worker.toml 2>&1 | head -5

# DB migration file exists
ls supabase/migrations/*rename_news_worker_heartbeats* 2>/dev/null
ls supabase/migrations/*riskflow_worker_heartbeats* 2>/dev/null
```

## Commit Format

```
[v5.25.0-S35-T10] feat: News Worker -> RiskFlow Worker rename (prep; cutover in T12)

Creates fly.riskflow-worker.toml, Dockerfile.riskflow-worker,
io.solvys.fintheon-riskflow-worker.plist. Renames workers/news-worker
-> workers/riskflow-worker + cron/news-worker-audit-*.ts ->
cron/riskflow-worker-audit-*.ts (git mv preserves history). Symbols,
log strings, submitted_by tags, env var refs all updated. Shim at
cron/news-worker-audit-scheduler.ts preserves boot import. Diagnostics
dual-writes riskflow_worker + news_worker keys. DB migration renames
news_worker_heartbeats -> riskflow_worker_heartbeats + VIEW alias for
2wk. Fly cutover + old-app retire + shim+plist+toml+Dockerfile deletion
deferred to T12 unification.
```
