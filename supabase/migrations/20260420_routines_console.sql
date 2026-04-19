-- [claude-code 2026-04-19] Routines Console — per-routine mode config, run history, awaitReply approvals
-- Adds the operator surface for the 8 Claude Code Routines documented in docs/routines.md.

-- ── routine_config ──────────────────────────────────────────────────────────
-- One row per routine. Stores the loopndroll-style mode + paused flag.
-- Keyed by trigger_id so the registry stays the source of truth for metadata.

CREATE TABLE IF NOT EXISTS routine_config (
  trigger_id      TEXT PRIMARY KEY,
  mode            TEXT NOT NULL DEFAULT 'infinite'
    CHECK (mode IN ('infinite', 'awaitReply', 'completionChecks', 'maxTurns')),
  max_turns       INTEGER NOT NULL DEFAULT 3,
  paused          BOOLEAN NOT NULL DEFAULT FALSE,
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by      TEXT NOT NULL DEFAULT 'system'
);

-- ── routine_runs ────────────────────────────────────────────────────────────
-- One row per routine invocation. Populated when a routine POSTs to
-- /api/harper-ops/feed (or via the manual rerun endpoint).

CREATE TABLE IF NOT EXISTS routine_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'ok'
    CHECK (status IN ('ok', 'degraded', 'failed')),
  severity      TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'critical')),
  title         TEXT NOT NULL,
  detail        TEXT,
  ops_entry_id  UUID,
  turn_count    INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_runs_trigger_created
  ON routine_runs (trigger_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_routine_runs_status
  ON routine_runs (status, created_at DESC);

-- ── routine_approvals ───────────────────────────────────────────────────────
-- Created when a routine in `awaitReply` mode posts results that need
-- Superadmin sign-off. Mobile + desktop both resolve via the same row.

CREATE TABLE IF NOT EXISTS routine_approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id    TEXT NOT NULL,
  routine_run_id UUID,
  ops_entry_id  UUID,
  title         TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  resolved_at   TIMESTAMPTZ,
  resolved_by   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routine_approvals_pending
  ON routine_approvals (status, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_routine_approvals_trigger
  ON routine_approvals (trigger_id, created_at DESC);
