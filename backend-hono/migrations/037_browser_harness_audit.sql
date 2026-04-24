-- [claude-code 2026-04-23] S32-T8 browser-harness audit log
-- Harper invokes browser_harness via the Strands tool registry; every call
-- (search/open/read/click/fill/screenshot/close) lands here so we can audit
-- rate-limit behavior, replay sequences, and debug bad pages.

CREATE TABLE IF NOT EXISTS browser_harness_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  tool TEXT NOT NULL,
  input JSONB,
  result_summary TEXT,
  duration_ms INT
);

CREATE INDEX IF NOT EXISTS browser_harness_audit_user_ts_idx
  ON browser_harness_audit (user_id, ts DESC);

CREATE INDEX IF NOT EXISTS browser_harness_audit_ts_idx
  ON browser_harness_audit (ts DESC);
