# S27-T11 — GEPA Self-Improvement Loop (Absorbed S28-D)

## Ownership

Claude-10, Wave 2, branch `s27-w2e-routing-hub-gepa` (paired with T9 live + T10), worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w2e`.

Sequenced last on the branch. Metrics foundation already landed in W1d (T9 §2 created `gepa_metrics` + `routing_decisions` tables).

## Inspiration + Decision

- [GEPA — ICLR 2026 Oral (MIT licensed)](https://github.com/NousResearch/hermes-agent-self-evolution) — evolutionary self-improvement for Hermes Agent using DSPy + GEPA. Optimizes skills, prompts, and code based on measured accuracy.
- TP's decision: **full loop** — not metrics-foundation only. Wire the evolutionary loop. Constraint: **never auto-merges prompt changes.** GEPA opens PRs against a `soul-evolution/` branch for TP review.

## Branch / Worktree / CWD

- **Worktree**: `/Users/tifos/Desktop/Codebases/fintheon-s27-w2e`
- **Branch**: `s27-w2e-routing-hub-gepa` off `v5.22` (stacked after T9 live + T10)

## Scope — Included

### 1. GEPA runner

Create [`backend-hono/src/services/gepa/runner.ts`](backend-hono/src/services/gepa/runner.ts):

- Reads last 24h of `routing_decisions` + `agent_memory` accuracy feedback per agent
- Computes baseline metrics: accuracy, avg latency, avg cost per turn, handoff success rate
- Writes baseline rows to `gepa_metrics` (one row per (agent, metric_name, window))
- For each agent whose accuracy dropped >5% from prior 7-day average, triggers an optimization run

### 2. DSPy optimization loop

Install `dspy-ai` + `gepa` as Python deps inside `hermes-sidecar/` (GEPA is Python). Add sidecar routes:

- `POST /v1/gepa/optimize` — accepts `{ agent_id, baseline_metrics, samples }` and returns a proposed SOUL.md evolution
- `GET /v1/gepa/status` — returns current optimization state

Runner calls `POST /v1/gepa/optimize` via sidecar-client, waits for the proposal, writes it to disk as a candidate evolution.

### 3. PR creation to `soul-evolution/` branch

GEPA never writes directly to the main SOUL files. Instead:

- Proposed evolution lands in `soul-evolution/{agent_id}/{timestamp}.md`
- Runner creates a git branch `soul-evolution/{agent_id}-{timestamp}`, commits the candidate, pushes, opens a PR via `gh pr create`
- PR body includes: baseline metrics, proposed change diff, which optimization run produced it, projected improvement + projected risk
- TP reviews and merges (or rejects) manually

Never auto-merges. This is the critical safety property — GEPA suggests, TP decides.

### 4. Cron schedule

- Local: launchd-driven nightly run at 02:00 ET (post-close window). Add `launchd/io.solvys.fintheon-gepa.plist`
- Prod: Fly.io cron via the existing Fly scheduler pattern — add a cron machine to the `fintheon-hermes` app

Runner is idempotent — re-running within a window is safe (existing `gepa_metrics` rows just get new entries).

### 5. Diagnostics surfacing

Add to `/api/diagnostics`:

```json
"gepa": {
  "last_run_at": "...",
  "evolutions_proposed_7d": 3,
  "evolutions_merged_7d": 1,
  "current_metric_deltas": {
    "harper": { "accuracy": "+1.2%", "latency": "-80ms", "cost": "+$0.02" },
    "oracle": { ... },
    ...
  }
}
```

Widget on diagnostics page shows per-agent metric trend sparklines + count of open evolution PRs.

### 6. Sample sourcing

GEPA needs labeled samples for accuracy measurement. Sources:

- **Explicit user feedback** — thumbs-up/down on agent responses (new UI in T1's card renderer? or existing chat feedback affordance — audit). When thumbs-down, prompt user for 1-word reason.
- **Accuracy feedback rows** — existing `agent_memory` table has `accuracy_feedback` type. Reuse.
- **Handoff success** — if Harper handed off to Feucht and TP followed the Feucht recommendation successfully, tag as positive. If TP ignored or contradicted, tag negative.

Claude-10 adds: extend `agent_memory` ingestion to capture implicit signals from the RiskFlow → trade-followthrough pipeline (did TP act on a Herald catalyst? how did it pan out?). Foundation for richer training data.

### 7. Safety rails

- Evolution PRs auto-close after 7 days of no review
- If 3 consecutive evolutions for the same agent are rejected, pause that agent's optimization for 14 days
- Prompt size cap: evolution cannot increase SOUL.md length >25%
- Token-cost projection: runner simulates evolved prompt against 100 sample queries, reports cost delta in PR body

## Known Issues to Preserve

- T8 SOUL files — GEPA is the ONLY automated writer; never touch main branch SOUL files from runner
- `agent_memory` + `agent_context_bank` schemas — GEPA reads, never writes destructively
- S26 mobile work — untouched

## Scope — Excluded (DO NOT TOUCH)

- Main-branch SOUL.md files (T8)
- Routing table (T9)
- Skill manifests (T10)
- `mobile/**`, `frontend/**` except the diagnostics widget

## Files to touch

- NEW `backend-hono/src/services/gepa/runner.ts`
- NEW `backend-hono/src/services/gepa/pr-creator.ts`
- NEW `backend-hono/src/services/gepa/sample-sourcing.ts`
- NEW `hermes-sidecar/plugins/gepa/plugin.yaml` + `engine.py` (installs DSPy + GEPA, exposes `/v1/gepa/*`)
- NEW `launchd/io.solvys.fintheon-gepa.plist`
- NEW `backend-hono/fly.gepa-cron.toml` (or cron-machine config merged into `fintheon-hermes`)
- NEW `frontend/components/diagnostics/GepaWidget.tsx`
- EDIT `backend-hono/src/routes/diagnostics.ts` (gepa section)
- EDIT `frontend/components/diagnostics/DiagnosticsPage.tsx` (mount GepaWidget)
- EDIT `src/lib/changelog.ts`

## Validation Commands

```bash
cd backend-hono && bun run build
cd frontend && find dist -mindepth 1 -delete && npx vite build

# Dry-run the runner
bun run backend-hono/src/services/gepa/runner.ts --dry-run --agent=harper
```

Live smoke:

1. Manually insert a routing_decisions row with artificially low user_feedback_score for Oracle → run runner → verify `gepa_metrics` rows written + if threshold met, verify sidecar `/v1/gepa/optimize` called.
2. Runner proposes an evolution → confirm PR opens on `soul-evolution/oracle-<timestamp>` branch with diff + metrics in the body.
3. `GET /api/diagnostics` shows `gepa` section populated.
4. Force a rejection scenario (3 consecutive rejected evolutions) → verify agent optimization pauses for 14 days.
5. `launchctl list | grep fintheon-gepa` shows unit loaded. Fly cron configured + visible.

## Commit Format

```
[v.27.9] feat: T11 GEPA self-improvement loop — DSPy evolutionary optimization, PR-gated review, 5-agent coverage
```

## Ship

`v.27.9` bundled with T9 live + T10.
