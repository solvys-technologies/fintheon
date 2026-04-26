-- [claude-code 2026-04-25] S40 data layer — additive columns + two new tables.
-- Touches: riskflow_source_accounts, commentators, news_feed_items,
-- scored_riskflow_items. New: earnings_events, worker_health.
--
-- Idempotent. Safe to re-run. Push from main worktree:
--   cd ~/Documents/Codebases/fintheon && supabase db push

-- ─── riskflow_source_accounts: per-source self-improvement ────────────────
ALTER TABLE riskflow_source_accounts
  ADD COLUMN IF NOT EXISTS tier_weight INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS noise_score REAL NOT NULL DEFAULT 0;

COMMENT ON COLUMN riskflow_source_accounts.tier_weight IS
  'S40 P2: 1-10. Daily 03:00 ET cron walks rolling 7d iv_score avg. <2 → decrement; >5 → increment. tier_weight=1 = effectively dead, fetch loop skips.';
COMMENT ON COLUMN riskflow_source_accounts.noise_score IS
  'S40 P2: 0=signal, 1=pure noise. Computed as (1 - rolling_iv_avg/10) when downweighting.';

-- ─── commentators: country scaffold for Refinement Engine US-only v1 ──────
ALTER TABLE commentators
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'US';

COMMENT ON COLUMN commentators.country IS
  'S40 P6: ISO country code for the commentator. v1 only US is selectable in the Refinement Engine country toggle; EU/UK/JP scaffolded but disabled.';

-- ─── news_feed_items: cross-source dedup + soft-delete ────────────────────
ALTER TABLE news_feed_items
  ADD COLUMN IF NOT EXISTS headline_hash TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS news_feed_items_headline_hash_idx
  ON news_feed_items(headline_hash)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS news_feed_items_archived_at_idx
  ON news_feed_items(archived_at)
  WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN news_feed_items.headline_hash IS
  'S40 P5: sha1(normalize(headline)). Cross-source dedup key. Backfill script populates historical rows.';
COMMENT ON COLUMN news_feed_items.archived_at IS
  'S40 P2: soft-delete timestamp. Daily 02:00 ET sweep hard-deletes rows where archived_at < now() - 7 days.';

-- ─── scored_riskflow_items: matching dedup + soft-delete ──────────────────
ALTER TABLE scored_riskflow_items
  ADD COLUMN IF NOT EXISTS headline_hash TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS scored_riskflow_items_headline_hash_idx
  ON scored_riskflow_items(headline_hash)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS scored_riskflow_items_archived_at_idx
  ON scored_riskflow_items(archived_at)
  WHERE archived_at IS NOT NULL;

-- ─── earnings_events: megacap earnings calendar (Pillar 8) ────────────────
CREATE TABLE IF NOT EXISTS earnings_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  company_name TEXT,
  fiscal_quarter TEXT,
  report_date DATE NOT NULL,
  report_time TEXT,
  market_cap_usd BIGINT,
  in_ndx BOOLEAN NOT NULL DEFAULT FALSE,
  in_spx BOOLEAN NOT NULL DEFAULT FALSE,
  forecast_eps NUMERIC,
  actual_eps NUMERIC,
  beat_miss TEXT,
  surprise_percent NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT earnings_events_symbol_date_uniq UNIQUE(symbol, report_date),
  CONSTRAINT earnings_events_beat_miss_chk CHECK (
    beat_miss IS NULL OR beat_miss IN ('beat', 'miss', 'inline')
  ),
  CONSTRAINT earnings_events_report_time_chk CHECK (
    report_time IS NULL OR report_time IN ('BMO', 'AMC', 'TBD')
      OR report_time ~ '^[0-9]{2}:[0-9]{2}'
  )
);

CREATE INDEX IF NOT EXISTS earnings_events_lookahead_idx
  ON earnings_events(report_date, report_time)
  WHERE in_ndx = TRUE AND in_spx = TRUE;

CREATE INDEX IF NOT EXISTS earnings_events_symbol_idx
  ON earnings_events(symbol, report_date DESC);

COMMENT ON TABLE earnings_events IS
  'S40 P8: megacap earnings calendar. FMP weekly cron upserts next 90 days. Feeds Time-To-Print eligibility list when symbol is in 12-ticker megacap watchlist.';

-- ─── worker_health: news-worker watchdog audit log (Pillar 2) ─────────────
CREATE TABLE IF NOT EXISTS worker_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker TEXT NOT NULL DEFAULT 'news-worker',
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  age_sec INTEGER,
  action_taken TEXT,
  metadata JSONB,
  CONSTRAINT worker_health_status_chk CHECK (
    status IN ('ok', 'stale', 'restart', 'recover', 'contract_violation', 'backfill_complete')
  )
);

CREATE INDEX IF NOT EXISTS worker_health_worker_ts_idx
  ON worker_health(worker, ts DESC);

COMMENT ON TABLE worker_health IS
  'S40 P2: heartbeat + watchdog event log for the news-worker (and future workers). Pruned to last 30 days by the same cron that prunes news_feed_items.';
