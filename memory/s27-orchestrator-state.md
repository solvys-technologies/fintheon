# S27 Orchestrator State — Claude-01

Persistent state for the S27 orchestrator. Survives process crashes across three checkpoints: **kickoff → mid-sprint → final sanitation**. Any orchestrator resume reads this first.

## Current Checkpoint

- [x] **KICKOFF** — 2026-04-20T04:30 ET (Claude-01)
- [ ] **MID-SPRINT** — gate Wave 1 merges, greenlight Wave 2
- [ ] **FINAL SANITATION** — integration QA, v.27.10 release

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
