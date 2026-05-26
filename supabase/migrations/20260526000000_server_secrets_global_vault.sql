-- Global backend-only secret vault.
-- Fintheon local/desktop backends read this through DATABASE_URL so shared
-- product credentials like ProxVoice/LiveKit do not depend on one user's .env.

CREATE TABLE IF NOT EXISTS public.server_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.server_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS server_secrets_no_user_select ON public.server_secrets;
CREATE POLICY server_secrets_no_user_select
  ON public.server_secrets
  FOR SELECT
  USING (false);

DROP POLICY IF EXISTS server_secrets_service_role_all ON public.server_secrets;
CREATE POLICY server_secrets_service_role_all
  ON public.server_secrets
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
