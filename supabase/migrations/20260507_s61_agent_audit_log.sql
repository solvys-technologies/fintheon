-- [S61-T1] Agent audit log — shared mutation contract for tool approval + permission decisions
-- Every approve/deny/timeout/grant/revoke writes an immutable record here.
-- RLS: authenticated users read own records; service_role writes (backend uses service_role key).

CREATE TABLE IF NOT EXISTS public.agent_audit_log (
  id BIGSERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  tool_input JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'denied', 'timed_out')),
  reason TEXT,
  surface TEXT DEFAULT 'chat',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_agent_created
  ON public.agent_audit_log (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_decision
  ON public.agent_audit_log (decision);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_surface
  ON public.agent_audit_log (surface);

CREATE INDEX IF NOT EXISTS idx_agent_audit_log_correlation
  ON public.agent_audit_log (correlation_id);

-- RLS
ALTER TABLE public.agent_audit_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own audit records
CREATE POLICY "authenticated_read_own_audit_log"
  ON public.agent_audit_log
  FOR SELECT
  TO authenticated
  USING (agent_id = auth.uid()::text);

-- No client insert/update/delete — only service_role writes
-- (No INSERT/UPDATE/DELETE policies = denied for authenticated; service_role bypasses)

COMMENT ON TABLE public.agent_audit_log IS
  'Immutable audit trail for tool approvals, permission grants/revokes, and mutation decisions. Written by service_role; read by authenticated users (own records only).';

COMMENT ON COLUMN public.agent_audit_log.agent_id IS
  'Which agent initiated the action (e.g. harper, oracle). Maps to Supabase user_id when applicable.';

COMMENT ON COLUMN public.agent_audit_log.tool_name IS
  'Name of the tool being approved/denied, or permission_grant/permission_revoke for permanent changes.';

COMMENT ON COLUMN public.agent_audit_log.correlation_id IS
  'Links audit records to the original approval request. Typically the approvalId or requestId.';

COMMENT ON COLUMN public.agent_audit_log.surface IS
  'Which UI surface the approval came from: chat, mobile, quick-action, etc.';
