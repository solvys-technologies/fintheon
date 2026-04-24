# Sprint Brief: T12 — Unification + Full Validation + Deploy Prep (Wave 3, New VS Code Window)

## Context

T12 merges all S35 track branches into `s35-unified`, wires the three `boot/services.ts` edits that Wave 1 deferred, deletes the migration-period shims once everything's coherent, runs full validation, executes the RiskFlow Worker Fly cutover, waits for the first 17:00 ET Arbitrum fire + 17:15 PMDB pickup, then hands off to TP for `/solvys-deploy`. This track runs in ITS OWN VS Code window per TP's preference.

## Branch Target

Starts on `s34-unified`, creates `s35-unified` as the merge target. Final commit is on `s35-unified`, ready to ship.

## Gated on

- All of T1-T11 and T13 have merged commits on their per-track branches
- Each track reported `✓ built clean` in its commit message

## Scope — Included

### Pre-work (already done at plan kickoff)

- S30 sprint-md briefs already archived to sprint-changelog/ by orchestrator (commit at kickoff). T12 can verify: `ls sprint-md/S30*` returns nothing; `ls sprint-changelog/S30*` shows the 5 files.

### Branch merge order

Merge tracks into `s35-unified` in this order (to minimize conflicts):

1. `git checkout -b s35-unified s34-unified`
2. Merge `s35-t2-arbitrum-migration` (isolated file; zero conflict)
3. Merge `s35-t7-riskflow-econ-enricher` (file rename + shim)
4. Merge `s35-t1-arbitrum-backend` (adds new services + hermes edits + commentator helper)
5. Merge `s35-t3-arbitrum-frontend` (adds new components + Sanctum wire)
6. Merge `s35-t4-cao-copy` (7 unrelated file edits)
7. Merge `s35-t5-tott-twt` (union + validator + multiple files)
8. Merge `s35-t6-legacy-name-sweep` (comment sweep)
9. Merge `s35-t8-canonical-naming` (CLAUDE.md edit)
10. Merge `s35-t13-notices-oss` (NOTICES + user-visible Hermes copy)
11. Merge `s35-t9-miroshark-teardown` (post-Arbitrum cleanup)
12. Merge `s35-t10-riskflow-worker` (infra rename prep)
13. Merge `s35-t11-pmdb-chamber-read` (brief-generator edit)

Expected conflict: `backend-hono/src/boot/services.ts` will cleanly merge because no Wave 1/2 track edits it. YOU edit it next (see below).

### boot/services.ts triple edit (atomic commit)

After all merges, apply three edits to `backend-hono/src/boot/services.ts`:

1. **Line 13 — Econ Enricher rename:** update the import:
   ```ts
   // FROM:
   import { startEconEnricher } from "../services/cron/econ-enricher.js";
   // TO:
   import { startRiskFlowEconEnricher } from "../services/cron/riskflow-econ-enricher.js";
   ```
2. **Line 265 — call site:**
   ```ts
   // FROM:
   startEconEnricher();
   // TO:
   startRiskFlowEconEnricher();
   ```
3. **Line 276 — TOTT → TWT comment:**
   ```ts
   // FROM:
   // Dispatch scheduler (cron-driven MDB/ADB/PMDB/TOTT briefing generation)
   // TO:
   // Dispatch scheduler (cron-driven MDB/ADB/PMDB/TWT briefing generation)
   ```
4. **Arbitrum scheduler wire — add new import + call:**

   ```ts
   // Near the other cron imports:
   import { startArbitrumSessionScheduler } from "../services/cron/arbitrum-session-scheduler.js";

   // Near the other cron starts (in bootBackground or similar):
   startArbitrumSessionScheduler();
   log.info("ArbitrumSessionScheduler started");
   ```

5. **News Worker audit scheduler — update the import name:**
   ```ts
   // FROM:
   import { startNewsWorkerAuditScheduler } from "../services/cron/news-worker-audit-scheduler.js";
   // TO:
   import { startRiskFlowWorkerAuditScheduler } from "../services/cron/riskflow-worker-audit-scheduler.js";
   ```
   (and update the call site from `startNewsWorkerAuditScheduler()` to `startRiskFlowWorkerAuditScheduler()`)

Commit message for this atomic edit:

```
[v5.25.0-S35-T12] chore(boot): wire arbitrum scheduler + rename econ + riskflow-worker imports

- Import startRiskFlowEconEnricher (was startEconEnricher)
- Import startArbitrumSessionScheduler (new; T1)
- Import startRiskFlowWorkerAuditScheduler (was startNewsWorkerAuditScheduler)
- TOTT -> TWT in boot comment
- Call sites updated
```

### Shim deletion

After boot/services.ts wires the canonical names, delete the migration shims:

- `rm backend-hono/src/services/cron/econ-enricher.ts` (T7's shim)
- `rm backend-hono/src/services/cron/news-worker-audit-scheduler.ts` (T10's shim)

Build again after deletion — should still be clean because boot/services.ts no longer imports from the shim paths.

### Full validation

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && (cd frontend && npx vite build)
rm -rf mobile/dist && (cd mobile && npx vite build)
cd backend-hono && bun run build
```

All four must exit 0.

### Local backend restart + smoke

Per memory `feedback_start_backend_after_deploy` and `feedback_launchd_backend_desktop_checkout`:

1. Sync Desktop checkout: `cp -R /Users/tifos/Documents/Codebases/fintheon/backend-hono/dist/ /Users/tifos/Desktop/Codebases/fintheon/backend-hono/dist/` (or however the sync is normally done — confirm with TP)
2. `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null`
3. `launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`
4. Wait 3s, then `curl -s http://localhost:8080/api/diagnostics | head -c 300`

Expected: diagnostics returns JSON with `services.*` populated, `riskflow_worker` key present (dual-aliased with `news_worker`).

### Browser Harness validation

Three UI surfaces need a visual smoke test:

1. **IV scoring widget hover peek** — hover the IV score element in the header toolbar. The tooltip should render; the ArbitrumPeek sub-element should show either an empty-state message ("No fresh read — chamber convenes at 17:00 ET or on IV ≥ 8.5.") or a real digest if a session ran.
2. **Sanctum Arbitrum chamber** — navigate to the Sanctum page. The `ArbitrumChamber` component should render where `AgentDeskDebatePanel` used to. If no chamber has run yet, the component shows its empty state. NO AgentDesk references should be visible.
3. **PMDB Chamber Read section** — trigger a PMDB brief: `curl -X POST http://localhost:8080/api/data/brief/generate -H "Content-Type: application/json" -d '{"type":"PMDB"}'`. The response should include a "Chamber Read" section (empty before 17:00 run; populated after).

### Event-trigger smoke

Synthesize a high-IV RiskFlow row to fire the Arbitrum event trigger:

```bash
curl -X POST http://localhost:8080/api/arbitrum/deliberate \
  -H "Content-Type: application/json" \
  -d '{"question":"Will Fed cut 50bps in June?","category":"macro","iv_score":8.6,"speaker":"Powell","trigger_type":"event"}' \
  | jq '.verdict_id, .consensus_probability, .dissent.seat'
```

Expected: verdict_id is populated, consensus_probability is in [0, 1], optional dissent.seat is one of lead/forecaster/risk/quant/bear.

### Session cron validation (wait window)

Wait until 17:05 ET (or trigger manually via `startArbitrumSessionScheduler.triggerNow()` if T1 exposes such a hook). Verify:

1. A new row in `arbitrum_verdicts` with `trigger_type = 'session'`
2. At 17:15 ET, PMDB auto-fires (if dispatch-scheduler is running); the generated brief includes a "Chamber Read" section with the session digest

If running on a non-weekday or outside 17:00 ET window, skip this check — document in handoff.

### Fly cutover (T10 execution)

**CRITICAL: TP approval required before executing.** Do NOT run without confirming.

1. `cd backend-hono && fly deploy --config fly.riskflow-worker.toml --yes` — deploys new `fintheon-riskflow-worker` Fly app
2. Wait for health-check: `fly status -a fintheon-riskflow-worker | head -10`
3. Validate heartbeats are writing to `riskflow_worker_heartbeats` table: `curl -s https://fintheon.fly.dev/api/diagnostics | jq '.riskflow_worker'`
4. TP confirms cutover is clean → retire old app: `fly apps destroy fintheon-news-worker --yes` (TP runs this, not T12 — destructive op needs explicit approval)
5. Delete old infra files from `s35-unified`: `rm backend-hono/fly.news-worker.toml backend-hono/Dockerfile.news-worker launchd/io.solvys.fintheon-news-worker.plist`
6. Commit the cleanup: `[v5.25.0-S35-T12] chore: retire old news-worker Fly app + infra files`

### LaunchD swap (local)

After Fly cutover succeeds:

1. `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-news-worker.plist 2>/dev/null || true`
2. `cp launchd/io.solvys.fintheon-riskflow-worker.plist ~/Library/LaunchAgents/`
3. `launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-riskflow-worker.plist`
4. Verify: `launchctl list | grep riskflow-worker`
5. Delete old plist: `rm ~/Library/LaunchAgents/io.solvys.fintheon-news-worker.plist`

### Desktop sync + local restart

After all the above:

1. Sync backend-hono dist to `~/Desktop/Codebases/fintheon/backend-hono/dist/` (TP's memory `feedback_launchd_backend_desktop_checkout`)
2. Restart launchd backend
3. Final curl smoke to localhost:8080/api/arbitrum/latest + /api/diagnostics

### Handoff to TP for /solvys-deploy

Post a final summary listing:

- All 12 track branches merged into `s35-unified`
- Full tsc + vite + bun builds clean
- Browser Harness validation passed on the 3 UI surfaces
- Arbitrum event trigger + session cron validated (or noted as waiting for next 17:00 if outside window)
- RiskFlow Worker Fly cutover complete (or deferred with TP approval pending)
- Summary of files deleted/renamed/added
- Version to bump: v5.25.0

TP runs `/solvys-deploy` from here.

## Scope — Excluded (DO NOT TOUCH)

- Any per-track source file on the track branches — unification only touches boot/services.ts + shim deletions + infra files
- Global `~/.claude/CLAUDE.md`, user memory files, or personal configs
- Anthropic Routines (not in use — memory confirms)
- `trades` table (memory: no base migration exists; never `ALTER TABLE trades`)

## Reuse Inventory

- All track acceptance criteria in their respective `S35-T{N}-*.md` briefs
- Plan file at `/Users/tifos/.claude/plans/happy-conjuring-floyd.md` for cross-cut verification
- Memory `feedback_solvys_deploy_protocol` for deploy protocol alignment
- Memory `feedback_backend_restore_to_prod` — every backend touch must finish with fintheon.fly.dev/api/\* fully healthy

## Known Issues to Preserve

- **Supabase migrations are TP's responsibility to apply.** T12 does NOT run `supabase db push`. Hand the 3 new migrations (arbitrum_verdicts, miroshark archive, news_worker_heartbeats rename) to TP.
- **Fly destructive ops need TP explicit approval.** Never `fly apps destroy` without confirming.
- **Launchd backend reads from Desktop checkout.** Any new route / cron lands locally only after Desktop sync + launchd restart.
- **Wave 2 tracks have hard gates.** T9 needs T1+T2+T3 in s35-unified; T11 needs T1 exported helper. T12 verifies gates are met before merging.
- **Mobile build uses VERCEL unset.** If rebuilding mobile as part of validation, `unset VERCEL` first (memory: `feedback_vercel_mobile_deploy`).
- **Auto-checkpoint hook noise** (memory: `reference_auto_checkpoint_hook`) — `.claude/feed-health.log` conflicts are default-resolved with `--theirs`.

## Acceptance Criteria

- [ ] `s35-unified` exists with all 12 track merges + boot/services.ts atomic commit + shim deletions
- [ ] Full tsc + vite build (frontend + mobile) + bun build (backend-hono) all clean
- [ ] Local backend restarted and responding on :8080; `/api/diagnostics` returns JSON; `/api/arbitrum/latest` returns 200
- [ ] Browser Harness validation: IV peek renders, Sanctum ArbitrumChamber renders, PMDB Chamber Read section renders (empty-state OK before first session)
- [ ] Event trigger smoke passed via curl
- [ ] Session cron validated (or noted as waiting)
- [ ] Fly RiskFlow Worker cutover complete (or TP-approval-pending)
- [ ] Launchd updated (or deferred per TP)
- [ ] Desktop synced
- [ ] Final summary written and handed to TP for `/solvys-deploy`

## Validation Commands

See inline throughout the Scope section. Comprehensive list at `/Users/tifos/.claude/plans/happy-conjuring-floyd.md` Verification section.

## Commit Format

Multiple commits during unification (one per merge), then final:

```
[v5.25.0-S35-T12] chore(s35-unified): full validation passed, ready for /solvys-deploy

- boot/services.ts: wired arbitrum scheduler, renamed econ + riskflow-worker imports, TOTT -> TWT
- Removed migration shims: cron/econ-enricher.ts, cron/news-worker-audit-scheduler.ts
- Retired Fly fintheon-news-worker (infra files deleted; app destroyed with TP approval)
- Launchd swap complete (local)
- tsc + vite + bun builds clean
- Browser Harness validated IV peek + Sanctum ArbitrumChamber + PMDB Chamber Read
- Arbitrum event-trigger smoke passed; session cron validated at 17:00 ET

Ready for /solvys-deploy to v5.25.0.
```
