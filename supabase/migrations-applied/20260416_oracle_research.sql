-- [claude-code 2026-04-16] S20-T3: Oracle scheduled research findings table

CREATE TABLE oracle_research_findings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  finding_type VARCHAR(50) NOT NULL,  -- 'arb_opportunity', 'divergence_analysis', 'market_signal'
  platform VARCHAR(20),               -- 'kalshi', 'polymarket', 'cross'
  contract_id VARCHAR(255),
  contract_title TEXT,
  current_price DECIMAL(5,4),
  iv_cross_score DECIMAL(4,2),        -- IV scoring engine assessment
  riskflow_correlation TEXT,           -- matching RiskFlow themes
  analysis TEXT NOT NULL,              -- Oracle's assessment
  confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'active'  -- 'active', 'resolved', 'expired'
);

-- Index for API queries (recent active findings)
CREATE INDEX idx_oracle_research_status_created
  ON oracle_research_findings (status, created_at DESC);

-- Index for platform-specific lookups
CREATE INDEX idx_oracle_research_platform
  ON oracle_research_findings (platform, finding_type);
