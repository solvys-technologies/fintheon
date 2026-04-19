# S27-T7 — Always-On News Worker + portless

## Ownership

Claude-09, Wave 2, branch `s27-w2d-browser-ops` (paired with T6), worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w2d`.

Same Claude as T6. Sequenced after T6 commit lands on the branch.

## Context — Why Separate Process

TP's rationale for a sibling news worker rather than a sub-route on `backend-hono`:

> "People who run anything on localhost ports run risk of killing an invaluable part of their trading activities, and this steers the news pipeline clear of that."

If `backend-hono` gets restarted (port collision, deploy, manual kill), news ingestion must continue. Separation decouples RiskFlow uptime from the API server's uptime. Portless makes the local worker discoverable at `news.fintheon.test` so agent MCP configs + local scripts don't hard-code a port that flips between worktrees.

## Inspiration

- [browser-use/browser-harness](https://github.com/browser-use/browser-harness) — powers the worker's scraping layer via T4 primitives
- [vercel-labs/portless](https://github.com/vercel-labs/portless) — stable local hostnames across worktrees, port-collision defense

## Branch / Worktree / CWD

- **Worktree**: `/Users/tifos/Desktop/Codebases/fintheon-s27-w2d`
- **Branch**: `s27-w2d-browser-ops`. T6 commits first, T7 stacks on top.

## Scope — Included

### 1. Worker process

Create [`backend-hono/src/workers/news-worker/`](backend-hono/src/workers/news-worker/) directory:

- `index.ts` — process entrypoint. Boots a worker scheduler that runs Herald sources on a cadence.
- `scheduler.ts` — 60s cadence for breaking-news tier (Reuters, Bloomberg, X/Twitter via browser-harness), 5-min cadence for standard tier (SEC, FOMC, newsletters).
- `sources/exa.ts` — lifted from existing `backend-hono/src/services/exa-service.ts` (imported, not duplicated).
- `sources/agent-reach.ts` — lifted from existing `agent-reach-service.ts`.
- `sources/browser-harness.ts` — consumes W1c primitives from `backend-hono/src/services/browser/`.
- `score.ts` — RiskFlow scoring (reuses existing logic; do not fork).
- `persist.ts` — writes scored items to Supabase `riskflow_items` table with `source` tag (T4 schema).

Runs on its own process, not in-proc with `backend-hono`. Shares TypeScript code via imports but has its own `package.json` entry script.

### 2. Local launchd unit

Create `launchd/io.solvys.fintheon-news-worker.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.solvys.fintheon-news-worker</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/bun</string>
    <string>run</string>
    <string>src/workers/news-worker/index.ts</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/tifos/Desktop/Codebases/fintheon/backend-hono</string>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
    <key>Crashed</key>
    <true/>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/fintheon-news-worker.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/fintheon-news-worker.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NEWS_WORKER_PORT</key>
    <string>8082</string>
  </dict>
</dict>
</plist>
```

Worker listens on port 8082 (backend is 8080, Hermes sidecar is 8318, news worker is 8082). Only serves `/healthz` for the launchd keepalive loop — no user-facing routes. All output flows through Supabase.

### 3. Fly.io production deploy

Create `backend-hono/fly.news-worker.toml`:

```toml
app = "fintheon-news-worker"
primary_region = "iad"

[build]
  dockerfile = "Dockerfile.news-worker"

[[services]]
  internal_port = 8082
  protocol = "tcp"

[deploy]
  release_command = ""

[http_service]
  internal_port = 8082
  force_https = true
  auto_stop_machines = false        # never stop — this is always-on
  auto_start_machines = true
  min_machines_running = 1

[checks.healthz]
  type = "http"
  port = 8082
  path = "/healthz"
  interval = "30s"
  timeout = "5s"
```

`restart_policy = on-failure` handled by Fly default. `min_machines_running = 1` keeps the worker alive even when no traffic.

Dockerfile uses the existing `backend-hono` Dockerfile base + points CMD at `src/workers/news-worker/index.ts`.

### 4. Portless hostname

Add `fintheon.config.ts` (or equivalent portless config — audit their docs) with:

```ts
export default {
  apps: [
    { name: "fintheon", port: 8080 },
    { name: "hermes", port: 8318, subdomain: "hermes" },
    { name: "news", port: 8082, subdomain: "news" },
  ],
};
```

Resolution: `news.fintheon.test` → `localhost:8082`. Any agent MCP config referencing the news worker uses the named URL, not the raw port. Port can flip between worktrees without breaking anything.

### 5. Supabase-coupled contract

Worker and `backend-hono` never talk HTTP. Contract = `riskflow_items` table schema. Worker writes; backend reads. Either can restart without the other noticing.

Worker writes:

- `riskflow_items` (existing) — scored news with `source` tag (T4 schema)
- `news_worker_heartbeats` (new) — once per minute, last-run timestamp per source tier. Backend surfaces this on `/api/diagnostics` as `news_worker_age_seconds`. If >300s, surface as yellow in UI.

New migration `supabase/migrations/20260419_06_worker_heartbeats.sql`:

```sql
create table public.news_worker_heartbeats (
  id uuid primary key default gen_random_uuid(),
  tier text not null,                  -- 'breaking' | 'standard'
  last_run_at timestamptz not null default now(),
  items_ingested int not null default 0,
  errors int not null default 0
);

create unique index news_worker_heartbeats_tier_idx
  on public.news_worker_heartbeats (tier);
```

Worker upserts heartbeat row per tier at end of each run cycle.

### 6. Self-healing

- **launchd** — `KeepAlive + SuccessfulExit=false + Crashed=true` auto-restarts on crash locally.
- **Fly** — `restart_policy = on-failure` + health-check failure triggers machine replacement.
- **browser-harness DOM drift** — built into T4 harness; self-healing selectors absorb layout changes without operator attention.
- **Per-source circuit breakers** — 3 consecutive failures on a source → 10-min pause, auto-fall-through to next source in the tier. Reuses AgentReach pattern.

### 7. Rollout

Boot on dev first. Verify 24h continuous operation locally before enabling Fly deploy. Include a `FLAG_NEWS_WORKER_WRITES_RISKFLOW=true` env gate — when false, worker runs but doesn't write to `riskflow_items` (dry-run mode for load testing).

## Known Issues to Preserve

Per `src/lib/changelog.ts`: v.26.2 maintenance modal + mobile notification overhaul recent and intentional. T7 does not touch either. Also preserve: AgentReach's domain circuit breaker (10-min pause after 3 failures) — the worker inherits this pattern, don't regress it.

## Scope — Excluded (DO NOT TOUCH)

- T6 files in `backend-hono/src/services/browser/operator.ts` (already landed on this branch; read-only during T7)
- T4 primitives in `backend-hono/src/services/browser/{pool,allowlist,harness}.ts` (W1c-owned; read-only)
- Rettiwt files (T4 marked them inert; T7 does not re-enable)
- Any `frontend/` paths (worker is backend-only)
- Any `mobile/` paths

## Files to touch

- NEW `backend-hono/src/workers/news-worker/index.ts`
- NEW `backend-hono/src/workers/news-worker/scheduler.ts`
- NEW `backend-hono/src/workers/news-worker/sources/exa.ts` (wrapper around existing exa-service)
- NEW `backend-hono/src/workers/news-worker/sources/agent-reach.ts` (wrapper)
- NEW `backend-hono/src/workers/news-worker/sources/browser-harness.ts`
- NEW `backend-hono/src/workers/news-worker/score.ts`
- NEW `backend-hono/src/workers/news-worker/persist.ts`
- NEW `launchd/io.solvys.fintheon-news-worker.plist`
- NEW `backend-hono/fly.news-worker.toml`
- NEW `backend-hono/Dockerfile.news-worker`
- NEW `fintheon.config.ts` (portless config at repo root)
- NEW `supabase/migrations/20260419_06_worker_heartbeats.sql`
- EDIT `backend-hono/src/routes/diagnostics.ts` (surface `news_worker_age_seconds`)
- EDIT `src/lib/changelog.ts`

## Validation Commands

```bash
# Type check
cd backend-hono && bun run build

# Frontend still compiles (no changes expected; belt-and-suspenders)
cd frontend && find dist -mindepth 1 -delete && npx vite build

# Boot worker locally
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-news-worker.plist 2>/dev/null || true
cp launchd/io.solvys.fintheon-news-worker.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-news-worker.plist

# Health check
curl http://localhost:8082/healthz
curl http://news.fintheon.test/healthz    # after portless init

# Supabase writes (after a few minutes)
# (TP verifies via Supabase dashboard or a quick psql query)
```

Live smoke:

1. Launch worker; within 2 minutes, verify `news_worker_heartbeats` shows rows for both tiers.
2. Verify `riskflow_items` gains rows with `source` in `{'exa', 'agent-reach', 'browser-harness'}`; no new `source='rettiwt'` rows.
3. Kill backend-hono process; confirm worker continues writing (decoupled uptime).
4. Kill worker; confirm launchd restarts it within 10 seconds; heartbeats resume.
5. `/api/diagnostics` includes `news_worker_age_seconds` field, value < 120.
6. 24h run: `select source, count(*), min(fetched_at), max(fetched_at) from riskflow_items where fetched_at > now() - interval '24 hours' group by source` returns continuous coverage.

## Commit Format

```
[v.27.8] feat: T7 Always-On News Worker — portless-addressed sibling process, Supabase-coupled, self-healing via launchd + Fly
```

## Ship

`v.27.8` when W2d merges (T6 + T7 together).
