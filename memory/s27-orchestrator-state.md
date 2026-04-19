# S27 Orchestrator State — Claude-01

Persistent state for the S27 orchestrator. Survives process crashes across three checkpoints: **kickoff → mid-sprint → final sanitation**. Any orchestrator resume reads this first.

## Current Checkpoint

- [x] **KICKOFF** — 2026-04-20T04:30 ET (Claude-01)
- [x] **MID-SPRINT** — 2026-04-20T14:00 ET. Wave 1 merged clean (v.27.1..v.27.4). Wave 2 fast-forwarded. Cleared to launch.
- [x] **FINAL SANITATION** — 2026-04-20T17:30 ET. v.27.10 unified release stamped. T4–T11 shipped; T1/T2§4-6/T3 rolled to S28.

## Final-Pass Results (2026-04-20T17:30)

### Wave 2 merges

| Branch                   | Source   | Merge commit | Tag    | Notes                                                                                                         |
| ------------------------ | -------- | ------------ | ------ | ------------------------------------------------------------------------------------------------------------- |
| s27-w2c-voice            | 910f31a9 | 49c28646     | v.27.7 | Clean merge, no conflicts                                                                                     |
| s27-w2d-browser-ops      | 9e403c3a | ae53d080     | v.27.8 | changelog.ts conflict only (2 entries unioned)                                                                |
| s27-w2e-routing-hub-gepa | a36e02e4 | 32855e13     | v.27.9 | changelog.ts + diagnostics/index.ts DiagnosticsResponse unioned (browser_operator+news_worker ∪ routing+gepa) |

Unified release: **v.27.10 → 32855e13** (head of v5.22 after Wave 2 merges).

### Final verification block

| Step                                                             | Result                                                                                                                            |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `cd backend-hono && bun run build`                               | ✅ clean (tsc + copy-assets)                                                                                                      |
| `cd frontend && npx tsc --noEmit`                                | ✅ clean                                                                                                                          |
| `cd frontend && find dist -mindepth 1 -delete && npx vite build` | ✅ ✓ built in 3.43s                                                                                                               |
| `launchctl list \| grep io.solvys.fintheon`                      | ⚠ `-backend` green; `-hermes`, `-news-worker`, `-gepa` plists committed but NOT loaded (needs `/install-maintenance` post-ship)   |
| `curl /api/diagnostics`                                          | ✅ 200 (via both launchd stale checkout and manual merged dist boot)                                                              |
| `curl /api/diagnostics/headline-volume`                          | ⚠ 500 on merged dist (route mounts; fails because migration 20260419_02_sources.sql not yet applied). Stale checkout returns 404. |
| `curl /api/diagnostics/routing`                                  | ✅ 200 on merged dist                                                                                                             |
| `curl /api/diagnostics/gepa`                                     | ✅ 200 on merged dist                                                                                                             |
| `curl /api/skills`                                               | ✅ 401 on merged dist (Supabase JWT enforced — expected)                                                                          |
| `curl /api/harper/tools/browse_task`                             | ✅ 200 on merged dist                                                                                                             |
| `bun run scripts/soul-ground-check.ts`                           | ✅ PASS — 5/5 SOULs grounded cleanly on CLAUDE.md                                                                                 |

### Per-track outcomes

| Track                                           | Owner         | Status            | Notes                                                                                                                                                                                                 |
| ----------------------------------------------- | ------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1 generative UI cards                          | W2a Claude-06 | ❌ **NOT LANDED** | Branch s27-w2a-cards-ui sat at mid-sprint HEAD with zero commits. Schema contracts (W1a shared/harper-cards.ts) exist; renderers, stream parser, Harper prompt extension never authored. Roll to S28. |
| T2 Hermes sidecar infra (§1-3)                  | W1b Claude-03 | ✅ shipped        | Python FastAPI sidecar boots local; Fly deploy deferred to TP.                                                                                                                                        |
| T2 context engine integration (§4-6)            | W2b Claude-07 | ❌ **NOT LANDED** | Branch s27-w2b-context-handoff sat at mid-sprint HEAD with zero commits. Conversation-store.ts still runs the 80k Haiku summarizer. Roll to S28.                                                      |
| T3 A2A handoff protocol                         | W2b Claude-07 | ❌ **NOT LANDED** | Same branch as T2 §4-6. handoff*to*{oracle,feucht,consul,herald} tools never registered. Roll to S28.                                                                                                 |
| T4 browser primitives + Rettiwt cut + telemetry | W1c Claude-04 | ✅ shipped        | Pool/allowlist/harness live; headline-volume route mounts (needs migration applied).                                                                                                                  |
| T5 voice assistant end-to-end                   | W2c Claude-08 | ✅ shipped        | qwen/qwen3.6-plus-preview:free chosen; rim UX + session routes + tests.                                                                                                                               |
| T6 Harper Browser Operator + action cache       | W2d Claude-09 | ✅ shipped        | browseTask tool + cache + Harper wiring; `/api/harper/tools/browse_task` green.                                                                                                                       |
| T7 Always-On News Worker                        | W2d Claude-09 | ⚠ partial         | Code landed; launchd unit + Fly app not yet installed. `/install-maintenance` covers.                                                                                                                 |
| T8 SOUL.md full conversion (5 agents)           | W1d Claude-05 | ✅ shipped        | Grounded literally on CLAUDE.md; drift guard PASS.                                                                                                                                                    |
| T9 Smart Model Routing live                     | W2e Claude-10 | ✅ shipped        | selectModel + llmCall wired across hermes-handler + harper-handler; budget degrade logic in budget.ts; routing_decisions writes ready when migration 20260419_04 applied.                             |
| T10 Skills Hub                                  | W2e Claude-10 | ✅ shipped        | 5 desks + 3 imports + security scanner; malicious fixture proves rejection; migration 20260419_08 ready.                                                                                              |
| T11 GEPA self-improvement loop                  | W2e Claude-10 | ✅ shipped        | Nightly runner + sidecar DSPy plugin + PR-gated promotion; launchd plist + Fly cron committed.                                                                                                        |

### Delivery score

- **8 of 11 tracks shipped.** T5/T6/T8/T9/T10/T11 fully live; T2 §1-3 + T4 + T7 shipped with install/migration gates pending.
- **3 tracks rolled to S28**: T1 generative UI cards, T2 §4-6 context engine integration, T3 A2A handoff protocol.
- **Regression guard**: no Wave 1 foundation broke on Wave 2 merges; all contract tests (SOUL drift guard, build, tsc) green end-to-end.

## Outstanding for TP / S28 follow-up

### Install / deploy items (before the tracks become fully visible in prod)

1. `supabase db push` against local + prod — 6 pending migrations: `20260419_02_sources.sql`, `20260419_04_gepa_metrics.sql`, `20260419_05_action_cache.sql`, `20260419_06_worker_heartbeats.sql`, `20260419_07_user_budgets.sql`, `20260419_08_skill_imports.sql`.
2. Install + `launchctl load` the three new plists:
   - `hermes-sidecar/launchd/io.solvys.fintheon-hermes.plist`
   - `launchd/io.solvys.fintheon-news-worker.plist`
   - `launchd/io.solvys.fintheon-gepa.plist`
3. Create Fly apps: `fintheon-hermes` (from `hermes-sidecar/fly.toml`), `fintheon-news-worker` (from `backend-hono/fly.news-worker.toml`). First deploys held for TP approval.
4. Sync `~/Desktop/Codebases/fintheon` checkout (launchd backend runs from there): `git pull` + `bun run build` + `launchctl reload`. Without this, `/api/diagnostics/{headline-volume,routing,gepa}` return 404 on localhost port 8080.
5. Resolve `origin/v5.22` divergence — local is 23 ahead / 2 diverged vs origin. Rebase or merge call, then push.
6. `/install-maintenance` post-ship audit to codify all of the above in setup/update scripts.

### S28 scope candidates

- **T1 rollover** — generative UI cards. Schema contracts (shared/harper-cards.ts, CARD_FENCE_OPEN/CLOSE, CARD_VARIANT_CATALOG) already landed from W1a. Remaining: frontend CardPartRenderer + 6 variant components, stream-parser fence handling in frontend/lib/harper/stream-parser.ts, Harper prompt extension with card-emission rules (ideally via SOUL extras so T11 GEPA can evolve them), Boardroom DirectionAwareHover polish.
- **T2 §4-6 rollover** — context engine integration. Hermes sidecar is up; hermes-handler.ts still bypasses it. Work: route every Hermes message through POST /v1/context/ingest → /v1/chat → handle tool_call events; delete 80k Haiku summarizer in conversation-store.ts; persistent-memory bridge (agent_context_bank + agent_memory → system_overrides.persistent_memory); context_messages mirror migration; observability via context_views table.
- **T3 rollover** — A2A handoff tools. Wire handoff*to*{oracle,feucht,consul,herald} tools into Harper's tool registry; depth cap 2; visited set; rejection on self-handoff. Agent-router replaces regex intent router in harper-handler.ts.
- Sidecar rollout beyond local (first `fly deploy --config hermes-sidecar/fly.toml`) with INTERNAL_HERMES_JWT rotation.
- GEPA dry-run → live PR promotion cycle (needs 7-day baseline in routing_decisions after migrations applied).

## Mid-Sprint Results

| Branch               | Commit   | Tag    | Merge commit | Conflicts resolved                                                   |
| -------------------- | -------- | ------ | ------------ | -------------------------------------------------------------------- |
| s27-w1a-schema       | 0d00538e | v.27.1 | 5e584fdd     | changelog.ts                                                         |
| s27-w1b-sidecar      | dd27bdb0 | v.27.2 | 6961a589     | changelog.ts; shared/sidecar-contract.ts (kept W1a's richer version) |
| s27-w1c-browser      | 6fdb586b | v.27.3 | 4a936f42     | changelog.ts                                                         |
| s27-w1d-soul-routing | dab41e71 | v.27.4 | 849808d2     | changelog.ts; hermes-sidecar/README.md (unified layouts + SOUL)      |

**v5.22 HEAD**: `849808d2`

**Post-merge verification**:

- `cd backend-hono && bun run build` → clean (tsc + copy-assets)
- `cd frontend && npx tsc --noEmit` → clean
- `cd frontend && find dist -mindepth 1 -delete && npx vite build` → ✓ built in 3.36s
- `bun run scripts/soul-ground-check.ts` → PASS (5 SOUL files grounded cleanly on CLAUDE.md)
- `/api/diagnostics` → 200 (via launchd, which reads the separate `~/Desktop/Codebases/fintheon` checkout and serves stale dist — normal)
- `/api/diagnostics/headline-volume` → confirmed mounts correctly via manual `bun dist/index.js` from the merged tree (returned 500 as expected because the `v_headline_volume_48h` Supabase view isn't deployed yet — migration `20260419_02_sources.sql` awaits `supabase db push`). Launchd unit is reading a separate checkout and serves 404 until TP syncs it.

## Contract Stability (mid-sprint gate — all GREEN ✅)

| Contract                                                     | Owner   | Status at v5.22 HEAD                                                                                                                                   |
| ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `shared/harper-cards.ts` + fence tokens                      | W1a     | ✅ Full Zod discriminated union for 6 variants + CARD_FENCE_OPEN/CLOSE + parser                                                                        |
| `shared/sidecar-contract.ts` HTTP contract                   | W1a     | ✅ W1a's richer version retained (AgentIdSchema, discriminated ChatEvent, LCM)                                                                         |
| `shared/skill-manifest.ts` + `shared/plugin-manifest.ts`     | W1a     | ✅ agentskills.io manifest + Hermes v0.9 plugin.yaml schemas populated                                                                                 |
| `backend-hono/src/services/ai/sidecar-client.ts`             | W1b     | ✅ Real typed HTTP client with SSE parser + JWT + isSidecarEnabled gate                                                                                |
| `hermes-sidecar/` Python FastAPI tree                        | W1b     | ✅ uv pyproject, launchd plist, Fly toml, Docker, auth, models, runtime adapter                                                                        |
| `backend-hono/src/services/browser/{pool,allowlist,harness}` | W1c     | ✅ Pool + allowlist tiers + self-healing harness + circuit breaker + audit                                                                             |
| Supabase migrations (sources, gepa_metrics)                  | W1c+W1d | ✅ `20260419_02_sources.sql` + `20260419_04_gepa_metrics.sql` committed — NOT YET APPLIED. Run `supabase db push` before Wave 2 W2d/W2e runtime smoke. |
| SOUL.md files (5 agents) + loader + drift guard              | W1d     | ✅ All 5 agents grounded on CLAUDE.md; loader fail-fast; drift guard PASS                                                                              |
| `backend-hono/src/services/ai/routing.ts` + `llm-call.ts`    | W1d     | ✅ ROUTING_TABLE populated; selectModel + env overrides; routing_decisions writer                                                                      |

## Wave 2 Branches (fast-forwarded)

All 5 Wave 2 branches are now at `849808d2` (v5.22 HEAD) via fast-forward. Foundations available to each:

| Claude    | Branch                     | Depends on      | Unblocked |
| --------- | -------------------------- | --------------- | --------- |
| Claude-06 | `s27-w2a-cards-ui`         | W1a + W1d SOUL  | ✅ yes    |
| Claude-07 | `s27-w2b-context-handoff`  | W1a + W1b + W1d | ✅ yes    |
| Claude-08 | `s27-w2c-voice`            | W1b + W1d       | ✅ yes    |
| Claude-09 | `s27-w2d-browser-ops`      | W1c             | ✅ yes    |
| Claude-10 | `s27-w2e-routing-hub-gepa` | W1b + W1d       | ✅ yes    |

## Outstanding Items for TP

- **Supabase migrations not yet applied** — `20260419_02_sources.sql` (W1c sources + quotas) and `20260419_04_gepa_metrics.sql` (W1d routing telemetry). Run `supabase db push` against prod + local when TP approves. Wave 2 W2d runtime smoke (`/api/diagnostics/headline-volume`) + W2e routing_decisions row writes will return empty/500 until applied.
- **`~/Desktop/Codebases/fintheon` checkout** (launchd backend runs from here) is stale. `git pull` from that directory to sync v5.22 HEAD + rebuild dist + reload launchd if TP wants `/api/diagnostics/headline-volume` + SOUL-prompted Harper to serve locally.
- **`origin/v5.22` divergence** — local v5.22 has 12 commits ahead; origin has 2 commits (`8720d72c INSTALL-UPDATE env vars` + `90af0085 auto checkpoint`) that weren't pulled pre-kickoff. Not pushing; left for TP to decide rebase-or-merge strategy.
- **Hermes Fly app `fintheon-hermes` not yet created** — W1b deferred first `fly deploy` to TP approval. No-op locally (rollback flag `HERMES_SIDECAR_ENABLED=false` default).

## Repo Anchor

- Base branch: `v5.22`
- Base HEAD at kickoff: `819c5a2e` (`chore: changelog entry for v5.22.2 3-target deploy`)
- Kickoff tag: `v.27.0-kickoff` → `819c5a2e`
- Main worktree: `/Users/tifos/Documents/Codebases/fintheon`

## Worktree Lineup

| Slot | Claude    | Task                                                 | Branch                     | Worktree path                                     |
| ---- | --------- | ---------------------------------------------------- | -------------------------- | ------------------------------------------------- |
| W1a  | Claude-02 | T1 schema layer                                      | `s27-w1a-schema`           | `/Users/tifos/Desktop/Codebases/fintheon-s27-w1a` |
| W1b  | Claude-03 | T2 Hermes sidecar infra                              | `s27-w1b-sidecar`          | `/Users/tifos/Desktop/Codebases/fintheon-s27-w1b` |
| W1c  | Claude-04 | T4 browser primitives + Rettiwt cut + telemetry      | `s27-w1c-browser`          | `/Users/tifos/Desktop/Codebases/fintheon-s27-w1c` |
| W1d  | Claude-05 | T8 SOUL + T9 routing foundation + manifest scaffolds | `s27-w1d-soul-routing`     | `/Users/tifos/Desktop/Codebases/fintheon-s27-w1d` |
| W2a  | Claude-06 | T1 renderers + Harper prompt + stream parser         | `s27-w2a-cards-ui`         | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2a` |
| W2b  | Claude-07 | T2 DAG engine + T3 A2A handoff                       | `s27-w2b-context-handoff`  | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2b` |
| W2c  | Claude-08 | T5 voice assistant full loop                         | `s27-w2c-voice`            | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2c` |
| W2d  | Claude-09 | T6 Harper Browser Operator + T7 News Worker          | `s27-w2d-browser-ops`      | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2d` |
| W2e  | Claude-10 | T9 routing live + T10 Skills Hub + T11 GEPA loop     | `s27-w2e-routing-hub-gepa` | `/Users/tifos/Desktop/Codebases/fintheon-s27-w2e` |

All 9 branches currently at `819c5a2e` — confirmed via `git worktree list` at kickoff.

## Foundation Stubs (verified present at kickoff, from commit 3a5b1872)

| File                                             | Owner (Wave 1)              | Notes                                                                                  |
| ------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------- |
| `shared/harper-cards.ts`                         | W1a                         | Zod schema + CARD_FENCE_OPEN/CLOSE + 6 variants defined; W2a consumes read-only        |
| `shared/skill-manifest.ts`                       | W1a                         | Stub for T10 Skills Hub manifests                                                      |
| `shared/plugin-manifest.ts`                      | W1a                         | Stub for Hermes sidecar plugin registry                                                |
| `shared/sidecar-contract.ts`                     | W1a creates / W1b populates | Typed HTTP contract scaffolding                                                        |
| `shared/soul-schema.ts`                          | W1d                         | Zod SoulSchema + `Soul` type                                                           |
| `backend-hono/src/services/browser/index.ts`     | W1c                         | Barrel export; pool/allowlist/harness populated by W1c                                 |
| `backend-hono/src/services/ai/sidecar-client.ts` | W1b                         | Stub throws with pointer to brief; types inlined to avoid cross-tsconfig root-dir leak |
| `backend-hono/src/services/ai/routing.ts`        | W1d / W2e                   | `ROUTING_READY=false`; selectModel throws until W1d lands ROUTING_TABLE                |
| `backend-hono/src/services/ai/soul/README.md`    | W1d                         | Directory marker; harper/oracle/feucht/consul/herald.md land during W1d                |
| `hermes-sidecar/README.md`                       | W1b                         | Placeholder for Python sidecar tree (pyproject/config/entrypoint/Dockerfile/Fly/plist) |

## Kickoff Build Verification

- `cd backend-hono && bun run build` → clean (`tsc && cp src/config/*.json dist/config/`)
- `cd frontend && npx tsc --noEmit` → clean (silent exit)
- `cd frontend && find dist -mindepth 1 -delete && npx vite build` → ✓ built in 3.82s
- `curl http://localhost:8080/api/diagnostics` → HTTP 200

## Wave 1 Launch Preconditions — ALL GREEN ✅

- [x] 9 worktrees exist on isolated branches off v5.22 (819c5a2e)
- [x] Foundation stubs compile (tsc + vite build + bun run build)
- [x] Local backend responsive on port 8080
- [x] Kickoff tag `v.27.0-kickoff` stamped
- [x] Changelog entry appended
- [x] State snapshot committed (this file)

Wave 1 (Claudes 02–05) cleared to start in parallel. Each Claude:

- Works inside its assigned worktree (never touches main worktree)
- Imports from `shared/` + `backend-hono/` stubs — owner files only
- Adds a changelog entry on merge
- Lands ship tag per orchestration doc (`v.27.1`..`v.27.4`)

## Wave 2 Gate (mid-sprint checkpoint)

Do **not** release Wave 2 until all four Wave 1 branches merge cleanly to `v5.22` and these contracts are stable:

| Contract                                                  | Owner | Consumed by                   |
| --------------------------------------------------------- | ----- | ----------------------------- |
| `shared/harper-cards.ts` card schema + fence tokens       | W1a   | W2a, W2b                      |
| `shared/soul-schema.ts` + `ai/soul/*.md` + `loader.ts`    | W1d   | W2c (voice), W2e (GEPA)       |
| `ai/routing.ts` ROUTING_TABLE + selectModel + telemetry   | W1d   | W2e (flip live on call sites) |
| `ai/sidecar-client.ts` HTTP contract + Hermes :8318 alive | W1b   | W2b, W2c, W2e                 |
| `browser/{pool,allowlist,harness}.ts` + v_headline_volume | W1c   | W2d                           |

Mid-sprint verification commands:

```
cd backend-hono && bun run build
cd frontend && npx tsc --noEmit && find dist -mindepth 1 -delete && npx vite build
curl http://localhost:8080/api/diagnostics
curl http://localhost:8080/api/diagnostics/headline-volume  # new (W1c)
curl -H "Authorization: Bearer $INTERNAL_HERMES_JWT" http://localhost:8318/healthz  # new (W1b)
```

## Conflict Matrix (for merge sequencing)

Per orchestration doc §Conflict Matrix — re-stated here for crash-recovery:

| File / Area                                      | Merge Order                                               |
| ------------------------------------------------ | --------------------------------------------------------- |
| `shared/*.ts`                                    | W1a first; W2a/W2b/W2c/W2e rebase on top                  |
| `backend-hono/src/services/browser/`             | W1c first; W2d rebases                                    |
| `backend-hono/src/services/ai/sidecar-client.ts` | W1b first; W2b/W2c/W2e rebase                             |
| `backend-hono/src/services/ai/soul/*.md`         | W1d owns; W2c/W2e read-only; GEPA PRs → `soul-evolution/` |
| `backend-hono/src/services/ai/routing.ts`        | W1d lands scaffold; W2e flips live (sequential)           |
| `backend-hono/src/services/harper-handler.ts`    | W2a merges first; W2b rebases                             |
| `src/lib/changelog.ts`                           | orchestrator resolves any merge conflicts at final        |

## Ship Tag Plan

- `v.27.0-kickoff` — ✅ stamped
- `v.27.1` — W1a schemas
- `v.27.2` — W1b sidecar
- `v.27.3` — W1c browser + telemetry
- `v.27.4` — W1d SOUL + routing foundation
- `v.27.5` — W2a cards UI
- `v.27.6` — W2b context + handoff
- `v.27.7` — W2c voice assistant
- `v.27.8` — W2d browser ops + news worker
- `v.27.9` — W2e routing live + hub + GEPA
- `v.27.10` — Orchestrator unified release → `/solvys-deploy`

## Blockers / Risk Notes

- **No blockers at kickoff.** Hermes sidecar (W1b) will be the highest-risk foundation — rollback flag `HERMES_SIDECAR_ENABLED=false` preserves legacy `hermes-handler.ts` path.
- **Merge-conflict risk high** on `src/lib/changelog.ts` (all 10 Claudes append). Orchestrator resolves at final sanitation, not per-merge.
- **`harper-handler.ts` contention** between W2a (prompt + card emission) and W2b (handoff tools) — W2a must merge first; W2b rebases. Enforce at mid-sprint.
- **Crash-recovery contract:** if Claude-01 is respawned mid-sprint, resume reads this file. Each checkpoint updates sections above.

## Resume Instructions (for future Claude-01 instances)

1. Read this file in full.
2. `git worktree list` — confirm 9 worktrees still present + their current HEADs.
3. `git log --oneline --all --decorate -20` — find latest v.27.N tag landed.
4. If at mid-sprint checkpoint → run full build commands above; gate Wave 2.
5. If at final sanitation → re-run Verification §1–6 from `docs/sprint-briefs/S27-ORCHESTRATION.md`.
6. Update this file at every checkpoint transition.
