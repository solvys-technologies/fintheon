CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS marketing_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'fintheon-landing',
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketing_waitlist_created_at
  ON marketing_waitlist (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketing_waitlist_source
  ON marketing_waitlist (source);

ALTER TABLE marketing_waitlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE marketing_waitlist FROM anon, authenticated;
