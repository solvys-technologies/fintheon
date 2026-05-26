-- S80-T4: Desk Forecast Data Model
-- Formal scored time-bound thesis objects tied to narrative_desks.
-- Catalysts link to RiskFlow items; market refs are read-only snapshots only.

CREATE TABLE IF NOT EXISTS coliseum_desk_forecasts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  desk_id              UUID        NOT NULL REFERENCES narrative_desks(id) ON DELETE CASCADE,
  narrative_session_id TEXT,
  title                TEXT        NOT NULL,
  thesis               TEXT        NOT NULL,
  direction            TEXT,
  probability          NUMERIC(5,2)
                         CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100)),
  timeframe            TEXT        NOT NULL,
  validation_rule      TEXT,
  status               TEXT        NOT NULL DEFAULT 'draft'
                         CHECK (status IN (
                           'draft','published','watching',
                           'gaining_support','thesis_proven','invalidated','expired'
                         )),
  publisher_id         TEXT,
  published_at         TIMESTAMPTZ,
  expires_at           TIMESTAMPTZ,
  last_checked_at      TIMESTAMPTZ,
  created_by           TEXT        NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coliseum_forecasts_desk
  ON coliseum_desk_forecasts(desk_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_coliseum_forecasts_status
  ON coliseum_desk_forecasts(status);

-- RiskFlow catalyst attachments (unique per forecast+item)
CREATE TABLE IF NOT EXISTS coliseum_forecast_catalysts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id      UUID NOT NULL REFERENCES coliseum_desk_forecasts(id) ON DELETE CASCADE,
  riskflow_item_id TEXT NOT NULL,
  evidence_label   TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (forecast_id, riskflow_item_id)
);

CREATE INDEX IF NOT EXISTS idx_coliseum_forecast_catalysts_forecast
  ON coliseum_forecast_catalysts(forecast_id);

-- Read-only prediction-market reference snapshots (no orders, no settlement)
CREATE TABLE IF NOT EXISTS coliseum_forecast_market_refs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id   UUID        NOT NULL REFERENCES coliseum_desk_forecasts(id) ON DELETE CASCADE,
  venue         TEXT        NOT NULL,
  market_title  TEXT        NOT NULL,
  market_url    TEXT,
  price_or_odds NUMERIC,
  expiry        TIMESTAMPTZ,
  fetched_at    TIMESTAMPTZ DEFAULT now(),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coliseum_forecast_market_refs_forecast
  ON coliseum_forecast_market_refs(forecast_id);
