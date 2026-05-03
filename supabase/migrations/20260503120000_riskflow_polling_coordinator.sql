-- [claude-code 2026-05-03] Round-robin X polling coordinator for multi-device team rotation.
-- Singleton row (id=1). Workers across all Mac Minis claim the active polling slot here.
-- 90-minute rotation per device with fallback chain through active team members.

CREATE TABLE IF NOT EXISTS public.riskflow_polling_coordinator (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_device_id TEXT,
  polling_started_at TIMESTAMPTZ,
  rotation_interval_minutes INTEGER DEFAULT 90,
  last_success_at TIMESTAMPTZ,
  fallback_device_id TEXT DEFAULT 'main',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed the singleton row if not present
INSERT INTO public.riskflow_polling_coordinator (id, active_device_id, polling_started_at, rotation_interval_minutes)
VALUES (1, 'main', now(), 90)
ON CONFLICT (id) DO NOTHING;

-- Enable Supabase Realtime so workers see coordinator changes instantly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'riskflow_polling_coordinator'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE riskflow_polling_coordinator;
  END IF;
END $$;
