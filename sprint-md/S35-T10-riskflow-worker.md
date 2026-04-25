# Sprint Brief: T10 — RiskFlow Worker Rename (infra-heavy)

## Context

The "News Worker" Fly app (`fintheon-news-worker`) is a RiskFlow ingestion tier. Its name predates the canonical-naming decision and leaks the old "News Feed" terminology into infra, env vars, cron job names, the Supabase heartbeat table, and the local launchd plist. Rename everything code-side to `riskflow-worker` so the infra label matches the feature.

This track **prepares new infra files and code**; it does **not** perform the Fly cutover (new app provision, secrets migration, DNS swap, old-app retire). T12 unification coordinates the cutover in its deploy window so that the old `fintheon-news-worker` app stays up serving traffic during validation, and is only retired once the new `fintheon-riskflow-worker` app is confirmed healthy.

## Branch Target

`s35-t10-riskflow-worker` (off `s34-unified`)

## Scope — Included

### New infra files

- [ ] NEW `backend-hono/fly.riskflow-worker.toml` — mirror of `fly.news-worker.toml` with:
  - `app = "fintheon-riskflow-worker"`
  - `dockerfile = "Dockerfile.riskflow-worker"`
  - env block: `RISKFLOW_WORKER_PORT = "8082"`, `FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW = "true"` (preserve existing flag semantics)
  - Preserve all other settings (regions, http_service, machine sizing, min_machines_running ≥ 1 per `feedback_fly_always_on`)
- [ ] NEW `backend-hono/Dockerfile.riskflow-worker` — mirror of `Dockerfile.news-worker` with:
  - Top comment header `# Fintheon RiskFlow Worker`
  - `ENV RISKFLOW_WORKER_PORT=8082`
  - `CMD ["node", "dist/workers/riskflow-worker/index.js"]`
  - Every other line preserved (bun install flow, copy order, prune steps)
- [ ] NEW `launchd/io.solvys.fintheon-riskflow-worker.plist` — mirror of `io.solvys.fintheon-news-worker.plist` with:
  - `<string>io.solvys.fintheon-riskflow-worker</string>` (Label)
  - ProgramArguments path `<string>src/workers/riskflow-worker/index.ts</string>`
  - Logs `/tmp/fintheon-riskflow-worker.out.log` + `/tmp/fintheon-riskflow-worker.err.log`
  - Env key `RISKFLOW_WORKER_PORT`
  - `NODE_ENV=development` per `feedback_launchd_node_env_development`

### Code renames (git mv where possible)

- [ ] RENAME dir: `backend-hono/src/workers/news-worker/` → `backend-hono/src/workers/riskflow-worker/` via `git mv` (preserves history on all 9 files: `index.ts`, `scheduler.ts`, `persist.ts`, `score.ts`, `sources/types.ts`, `sources/exa.ts`, `sources/index.ts`, `sources/agent-reach.ts`, `sources/browser-harness.ts`)
- [ ] Inside the renamed dir: update any self-referential imports and comments that say `news-worker` (internal relative imports use `./` and stay intact; look for top-of-file comments, logger names, and any string literals)
- [ ] RENAME `backend-hono/src/services/cron/news-worker-audit-handler.ts` → `backend-hono/src/services/cron/riskflow-worker-audit-handler.ts` via `git mv`
- [ ] RENAME `backend-hono/src/services/cron/news-worker-audit-scheduler.ts` → `backend-hono/src/services/cron/riskflow-worker-audit-scheduler.ts` via `git mv`
- [ ] Inside both audit files: rename exported symbols following T7 convention
  - `startNewsWorkerAudit*` → `startRiskFlowWorkerAudit*`
  - `stopNewsWorkerAudit*` → `stopRiskFlowWorkerAudit*`
  - `createLogger("NewsWorkerAudit*")` → `createLogger("RiskFlowWorkerAudit*")`
  - `[NewsWorkerAudit]` log prefixes → `[RiskFlowWorkerAudit]`
  - Cron id strings containing `news-worker-audit-*` → `riskflow-worker-audit-*` (notification source strings in `notifications/notify-superadmins.ts` get updated in the cross-ref pass below)

### Env var rename

- [ ] `backend-hono/.env.example` lines ~332-333 — rename `FLAG_NEWS_WORKER_WRITES_RISKFLOW` → `FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW` and `NEWS_WORKER_PORT` → `RISKFLOW_WORKER_PORT` (keep both commented; old names stay as legacy alias comments only)
- [ ] In code that reads these env vars: add legacy-alias fallback
  ```ts
  const port =
    process.env.RISKFLOW_WORKER_PORT ?? process.env.NEWS_WORKER_PORT ?? "8082";
  const writeFlag =
    process.env.FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW ??
    process.env.FLAG_NEWS_WORKER_WRITES_RISKFLOW;
  ```
  Sunset the legacy reads 2026-05-08 (matches T5's WT+TOTT alias window).

### Diagnostics

- [ ] EDIT `backend-hono/src/routes/diagnostics/index.ts` — rename `news_worker` keys to `riskflow_worker`:
  - `DiagnosticsResponse.news_worker` property → `riskflow_worker`
  - `news_worker_age_seconds` field → `riskflow_worker_age_seconds`
  - Supabase read `.from("news_worker_heartbeats")` → `.from("riskflow_worker_heartbeats")` (table renamed in migration below)
  - Keep the old key mirrored in the response body for 2 weeks (dual-emit pattern used in T4 `ask_cao`/`ask_harper`): include both `news_worker` and `riskflow_worker` with identical payloads; sunset old key 2026-05-08

### Supabase migration

- [ ] NEW `supabase/migrations/{14-digit-timestamp}_rename_news_worker_heartbeats.sql` — 14-digit UTC timestamp naming per `feedback_supabase_migration_filenames`

  ```sql
  -- Rename news_worker_heartbeats -> riskflow_worker_heartbeats
  -- S35-T10: RiskFlow Worker rename. Keep legacy view alias until 2026-05-08.

  alter table if exists public.news_worker_heartbeats rename to riskflow_worker_heartbeats;
  alter index  if exists public.news_worker_heartbeats_tier_idx rename to riskflow_worker_heartbeats_tier_idx;

  -- Legacy view for readers that haven't cut over yet (sunset 2026-05-08).
  create or replace view public.news_worker_heartbeats as
    select * from public.riskflow_worker_heartbeats;
  ```

- [ ] Grep for `CREATE TABLE` of the new name first to confirm the base migration exists. It does (`supabase/migrations/20260419060000_worker_heartbeats.sql`). **Do NOT** alter/rewrite that migration in place — append a new rename migration.
- [ ] **DO NOT run `supabase db push`** in this track. T12 unification runs the push atomically with the Fly cutover to avoid mid-sprint schema drift against the still-running `fintheon-news-worker` app.
- [ ] EDIT `backend-hono/src/workers/riskflow-worker/persist.ts` — `.from("news_worker_heartbeats").upsert(...)` → `.from("riskflow_worker_heartbeats").upsert(...)` (works pre-push because the legacy view alias keeps existing writes functional)
- [ ] EDIT `backend-hono/src/workers/riskflow-worker/index.ts` header comment — `riskflow_items + news_worker_heartbeats` → `riskflow_items + riskflow_worker_heartbeats`

### Cross-reference comment sweep

All of these are comment-only edits — no behavior change. Each is a single line:

- [ ] `backend-hono/src/services/fiscal-sources/bessent-speeches.ts` — `news-worker allowlist` → `riskflow-worker allowlist`
- [ ] `backend-hono/src/services/riskflow/feed-poller.ts` — `news-worker tier coordinators` → `riskflow-worker tier coordinators`
- [ ] `backend-hono/src/services/riskflow/drop-counters.ts` — `news-worker items_ingested: 0` → `riskflow-worker items_ingested: 0`
- [ ] `backend-hono/src/services/source-accounts/source-accounts-service.ts` — `news-worker DB-driven handle` → `riskflow-worker DB-driven handle`
- [ ] `backend-hono/src/services/cron/econ-keyword-scheduler.ts` — `news-worker-audit-scheduler` → `riskflow-worker-audit-scheduler`
- [ ] `backend-hono/src/services/notifications/notify-superadmins.ts` — source string literals `"news-worker-audit-morning"`, `"news-worker-audit-midday"`, `"news-worker-audit-afternoon"` → `"riskflow-worker-audit-morning"` etc. (these are alert tags; dual-emit for 2 weeks if Harper-Ops filters on them — grep first)

### Docs + scripts

- [ ] EDIT `backend-hono/CLAUDE.md` lines 9, 15, 17, 20, 23 — replace `news-worker` with `riskflow-worker` in deploy/restore commands and app-name references
- [ ] EDIT `scripts/fintheon-update.sh` lines 220, 225, 232, 243 — update launchd step comment, plist symlink filename, and `launchctl load` command to the new plist path (`io.solvys.fintheon-riskflow-worker.plist`)

### Delete old files

- [ ] DELETE `backend-hono/fly.news-worker.toml`
- [ ] DELETE `backend-hono/Dockerfile.news-worker`
- [ ] DELETE `launchd/io.solvys.fintheon-news-worker.plist`

Deleting these does **not** stop the old Fly app — `fintheon-news-worker` continues running its last-deployed image until T12 runs `fly apps destroy fintheon-news-worker` during cutover. The local launchd service should be `launchctl unload`ed + unlinked from `~/Library/LaunchAgents/` by TP in T12's Desktop-sync step.

## Scope — Excluded (DO NOT TOUCH)

- **`backend-hono/src/boot/services.ts`** — same collision-free policy as T7. If the boot imports the audit scheduler, T12 handles the import-symbol rename atomically with the other boot edits (T1 arbitrum scheduler, T5 TWT comment, T7 riskflow-econ-enricher). Do NOT edit boot/services.ts in this track.
- **Actual Fly cutover** — T12 runs `fly launch --config fly.riskflow-worker.toml`, migrates secrets with `fly secrets list -a fintheon-news-worker` piped into `fly secrets set -a fintheon-riskflow-worker`, confirms health, then `fly apps destroy fintheon-news-worker`. Do NOT `fly launch` or `fly apps create` here.
- **`supabase db push`** — T12 runs the migration push from the main worktree during cutover. Writing the SQL file is in scope; pushing it is NOT.
- **Never use `mcp__claude_ai_Supabase__apply_migration`** — memory `feedback_supabase_migration_filenames` forbids it. SQL file + `supabase db push` only.
- **`sprint-changelog/S27-*.md`** and **`docs/sprint-briefs/S27-T7-news-worker.md`** — archived sprint docs; do NOT edit. History stays accurate.
- **`.claude/command-log.txt`** — archive file, do NOT edit.
- **`fintheon` main Fly app** — this track only touches the worker app. Never alter `fly.toml` or `Dockerfile` (the main backend configs).
- **Actual API/frontend callers of diagnostics** — if any caller reads `news_worker_age_seconds`, the dual-emit window (2 weeks) covers them. Do NOT edit the frontend in this track.
- **`trades` table** — memory `feedback_trades_table_migration`: no base migration. Do NOT touch. (Not expected to come up here; listed as a safety reminder.)
- **`dist/**`\*\* — regenerated on next build.

## Reuse Inventory

- Existing worker dir structure + file conventions inside `backend-hono/src/workers/news-worker/` — preserve exactly during `git mv`
- Legacy-alias pattern — mirror T5 (WT+TOTT kept as runtime aliases, sunset 2026-05-08)
- Migration rename convention — `feedback_supabase_migration_filenames` (14-digit UTC timestamp, run `supabase db push` from main worktree manually, never via MCP)
- Always-on Fly policy — `feedback_fly_always_on` (min_machines_running ≥ 1, no auto_stop_machines)
- Launchd env — `feedback_launchd_node_env_development` (NODE_ENV=development for local plist)
- Boot-file collision policy — `feedback_orchestrator_brief_factcheck` + T7 pattern (boot/services.ts routed to T12)

## Known Issues to Preserve

- `fintheon-news-worker` Fly app stays up during the sprint — all its env/secrets live in Fly, not in the toml. Deleting the toml does not stop the app.
- The legacy Supabase view alias (`news_worker_heartbeats`) keeps any stragglers (harper-ops, mobile, off-branch code) readable until 2026-05-08. Removal migration lands in a future sprint.
- Notification source strings in `notify-superadmins.ts` may be filtered on by Harper-Ops routines — dual-emit (send both the old + new source tag for 2 weeks) is safer than a hard swap. Grep Harper-Ops feed handlers first; if no filter, single-swap is fine.
- The audit cron schedulers touch `cron-ids` used by node-cron's registry. Renaming the cron id must be paired (old id removed AND new id registered) inside the same commit to avoid duplicate firings during boot.
- `econ-keyword-scheduler.ts` is a cross-reference comment only; verify no import path points at the renamed audit files from it.

## Implementation Steps

1. **New infra files first (so reviewer can diff old vs new cleanly):**

   ```bash
   cp backend-hono/fly.news-worker.toml backend-hono/fly.riskflow-worker.toml
   cp backend-hono/Dockerfile.news-worker backend-hono/Dockerfile.riskflow-worker
   cp launchd/io.solvys.fintheon-news-worker.plist launchd/io.solvys.fintheon-riskflow-worker.plist
   ```

   Then edit each to replace `news-worker` → `riskflow-worker`, `fintheon-news-worker` → `fintheon-riskflow-worker`, `NEWS_WORKER_PORT` → `RISKFLOW_WORKER_PORT`, `FLAG_NEWS_WORKER_WRITES_RISKFLOW` → `FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW`, log paths, labels.

2. **Rename the workers dir:**

   ```bash
   git mv backend-hono/src/workers/news-worker backend-hono/src/workers/riskflow-worker
   ```

3. **Rename the cron audit files:**

   ```bash
   git mv backend-hono/src/services/cron/news-worker-audit-handler.ts   backend-hono/src/services/cron/riskflow-worker-audit-handler.ts
   git mv backend-hono/src/services/cron/news-worker-audit-scheduler.ts backend-hono/src/services/cron/riskflow-worker-audit-scheduler.ts
   ```

4. **Apply symbol/string renames inside the renamed files** (per scope list above).

5. **Migration SQL file** — create the 14-digit-timestamped rename migration. Do NOT push.

6. **Code table refs** — swap `news_worker_heartbeats` → `riskflow_worker_heartbeats` in `persist.ts`, `index.ts` comment, and `diagnostics/index.ts`.

7. **Env var + diagnostics** — apply legacy-alias fallback + dual-emit.

8. **Cross-reference comment sweep** — 6 files, 1 line each. Grep before/after:

   ```bash
   grep -rn "news-worker\|news_worker\|NewsWorker\|NEWS_WORKER" backend-hono/src scripts launchd | grep -v dist/ | grep -v sprint-changelog
   ```

9. **Docs + scripts** — `backend-hono/CLAUDE.md` + `scripts/fintheon-update.sh`.

10. **Delete old infra files** (last, after diffs are clean):

    ```bash
    /bin/rm -f backend-hono/fly.news-worker.toml backend-hono/Dockerfile.news-worker launchd/io.solvys.fintheon-news-worker.plist
    ```

    (Use `/bin/rm` per `reference_block_dangerous_hook`; avoid `rm -rf`.)

11. **Build check:**

    ```bash
    cd backend-hono && bun run build 2>&1 | tail -30
    ```

    Expected: clean build IF `boot/services.ts` doesn't import the renamed cron audit symbols. If it does, the break is expected and T12 will fix. Note in the commit message.

12. **Commit + push to `s35-t10-riskflow-worker` branch.** Do NOT merge to s34-unified — T12 handles the merge into s35-unified.

13. **Add changelog entry** in `src/lib/changelog.ts`:
    ```ts
    { date: '2026-04-24T{HH:mm:ss}', agent: 'claude-code', summary: 'S35-T10 RiskFlow Worker rename — new fly/docker/plist, workers dir + cron audit files renamed, env vars + heartbeats table renamed with legacy aliases. Fly cutover deferred to T12.', files: ['backend-hono/fly.riskflow-worker.toml', 'backend-hono/Dockerfile.riskflow-worker', 'launchd/io.solvys.fintheon-riskflow-worker.plist', 'backend-hono/src/workers/riskflow-worker/**', 'backend-hono/src/services/cron/riskflow-worker-audit-*.ts', 'supabase/migrations/{new-file}.sql'] }
    ```

## Acceptance Criteria

- [ ] New `fly.riskflow-worker.toml`, `Dockerfile.riskflow-worker`, `launchd/io.solvys.fintheon-riskflow-worker.plist` exist with the exact substitutions listed in scope
- [ ] `backend-hono/src/workers/riskflow-worker/` exists (via `git mv`); `news-worker/` does not
- [ ] Both cron audit files renamed + symbols updated; build passes OR expected-break in boot/services.ts is the only error
- [ ] Migration SQL file created with 14-digit timestamp; `news_worker_heartbeats` view alias preserved
- [ ] Env vars renamed in `.env.example` + code reads fall back to legacy names
- [ ] Diagnostics response dual-emits `news_worker` + `riskflow_worker` payloads
- [ ] All 6 cross-reference comment edits applied
- [ ] `backend-hono/CLAUDE.md` + `scripts/fintheon-update.sh` updated
- [ ] Old `fly.news-worker.toml`, `Dockerfile.news-worker`, old plist deleted
- [ ] `boot/services.ts` UNTOUCHED
- [ ] No `fly apps create`, no `supabase db push`, no `fly apps destroy` run
- [ ] Changelog entry added
- [ ] Commit message flags T12 as the atomic owner of boot-import rename + Fly cutover + db push

## Validation Commands

```bash
# 1) New infra files exist
ls -la backend-hono/fly.riskflow-worker.toml backend-hono/Dockerfile.riskflow-worker launchd/io.solvys.fintheon-riskflow-worker.plist

# 2) Old infra files gone
test ! -f backend-hono/fly.news-worker.toml && test ! -f backend-hono/Dockerfile.news-worker && test ! -f launchd/io.solvys.fintheon-news-worker.plist && echo "OK: old infra gone"

# 3) Workers dir moved with history
git log --follow backend-hono/src/workers/riskflow-worker/index.ts | head -5

# 4) Cron audit renames
git log --follow backend-hono/src/services/cron/riskflow-worker-audit-handler.ts | head -5

# 5) No lingering "news-worker" references in live code (sprint-changelog excluded)
grep -rn "news-worker\|news_worker\|NewsWorker\|NEWS_WORKER" \
  backend-hono/src scripts launchd supabase/migrations \
  | grep -v "/dist/" | grep -v sprint-changelog | grep -v command-log.txt
# Expected output: ONLY the legacy-alias fallback lines in code (process.env.NEWS_WORKER_* fallback) + the view in the new migration SQL.

# 6) Migration file exists and is 14-digit
ls supabase/migrations/*_rename_news_worker_heartbeats.sql

# 7) boot/services.ts untouched
git diff s34-unified -- backend-hono/src/boot/services.ts | head -3
# (should be empty)

# 8) Build (break-in-boot expected only if boot imports the renamed symbols)
cd backend-hono && bun run build 2>&1 | tail -20
```

## Commit Format

```
[v5.25.0-S35-T10] refactor: News Worker -> RiskFlow Worker (infra + code, cutover deferred)

Renames the News Worker Fly app and its code-side artifacts to
RiskFlow Worker. New fly.riskflow-worker.toml, Dockerfile.riskflow-worker,
launchd plist. Workers dir + cron audit files moved via git mv. Env vars
RISKFLOW_WORKER_PORT / FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW with legacy
NEWS_WORKER_* fallback (sunset 2026-05-08). Supabase migration renames
news_worker_heartbeats -> riskflow_worker_heartbeats with legacy view alias.
Diagnostics endpoint dual-emits news_worker + riskflow_worker keys.

Fly app cutover (fly launch new app, migrate secrets, swap DNS, destroy
old app) + supabase db push + boot/services.ts import rename all deferred
to T12 unification window so the old fintheon-news-worker app stays up
during validation.

Build may break at boot/services.ts if it imports the renamed cron audit
symbols; T12 owns that edit atomically with T1/T5/T7.
```

## Handoff Notes for T12 (unification)

T12 must:

1. Merge `s35-t10-riskflow-worker` into `s35-unified`.
2. Apply the audit scheduler rename inside `backend-hono/src/boot/services.ts` (if the boot wires the audit scheduler — grep first).
3. From the linked main worktree: `supabase db push` to run the heartbeats rename migration.
4. Fly cutover sequence:

   ```bash
   # a) Provision new app
   cd backend-hono
   fly launch --config fly.riskflow-worker.toml --copy-config --name fintheon-riskflow-worker --no-deploy

   # b) Migrate secrets
   fly secrets list -a fintheon-news-worker --json | jq -r '.[] | .Name' > /tmp/secrets.txt
   for name in $(cat /tmp/secrets.txt); do
     value=$(fly ssh console -a fintheon-news-worker -C "printenv $name" 2>/dev/null)
     [ -n "$value" ] && fly secrets set -a fintheon-riskflow-worker $name="$value"
   done

   # c) Deploy new app
   fly deploy --config fly.riskflow-worker.toml -a fintheon-riskflow-worker

   # d) Confirm health + heartbeat writes
   fly status -a fintheon-riskflow-worker
   # Check Supabase: select * from riskflow_worker_heartbeats order by updated_at desc limit 5;

   # e) Retire old app (only after 30+ min of clean heartbeats from new app)
   fly apps destroy fintheon-news-worker
   ```

5. Local launchd: unload the old plist symlink, link the new one, load:
   ```bash
   launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-news-worker.plist 2>/dev/null || true
   /bin/rm -f ~/Library/LaunchAgents/io.solvys.fintheon-news-worker.plist
   ln -sf "$PWD/launchd/io.solvys.fintheon-riskflow-worker.plist" ~/Library/LaunchAgents/io.solvys.fintheon-riskflow-worker.plist
   launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-riskflow-worker.plist
   ```
6. Desktop checkout sync per `feedback_launchd_backend_desktop_checkout` (launchd reads from ~/Desktop/Codebases/fintheon).

Rollback path: the legacy view alias + env-var fallback + diagnostics dual-emit keep the system functional if the new Fly app needs to be retired and the old one rebuilt from the Fly registry image.
