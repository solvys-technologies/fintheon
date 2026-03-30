-- Migration 027: Narrative threads registry — the 10 core narratives for NarrativeFlow
-- Each thread is a persistent column in the Timeline view
-- Catalyst cards attach to one or more threads via narrative_card_links

CREATE TABLE IF NOT EXISTS narrative_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  parent_slug VARCHAR(50) REFERENCES narrative_threads(slug),
  color VARCHAR(7) DEFAULT '#c79f4a',
  icon VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',  -- active, watching, archived
  sort_order INT DEFAULT 0,
  keywords TEXT[],                       -- keyword patterns for auto-classification
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update trigger
CREATE OR REPLACE FUNCTION update_narrative_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_narrative_thread_updated ON narrative_threads;
CREATE TRIGGER trigger_narrative_thread_updated
  BEFORE UPDATE ON narrative_threads
  FOR EACH ROW EXECUTE FUNCTION update_narrative_thread_timestamp();

-- Link table: catalyst cards → narrative threads (many-to-many)
CREATE TABLE IF NOT EXISTS narrative_card_links (
  card_id TEXT NOT NULL,
  thread_slug VARCHAR(50) NOT NULL REFERENCES narrative_threads(slug),
  confidence DECIMAL(3,2) DEFAULT 1.0,  -- how strongly this card belongs to this thread
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (card_id, thread_slug)
);

CREATE INDEX IF NOT EXISTS idx_card_links_thread ON narrative_card_links(thread_slug);
CREATE INDEX IF NOT EXISTS idx_card_links_card ON narrative_card_links(card_id);

-- Seed the 10 default narrative threads
INSERT INTO narrative_threads (slug, title, description, color, sort_order, keywords) VALUES
  ('middle-east-conflict',
   'Middle Eastern Conflict',
   'US, Iran, Israel, UAE, UK, Russia, China — all notable parties of interest in the Middle East theater',
   '#F59E0B', 1,
   ARRAY['iran', 'israel', 'houthi', 'hezbollah', 'middle east', 'gaza', 'lebanon', 'syria', 'yemen', 'red sea', 'strait of hormuz', 'idf', 'netanyahu', 'khamenei']),

  ('liquidity-credit-contraction',
   'Liquidity & Credit Contraction',
   'Blue Owl capital concerns, credit market stress, liquidity tightening signals',
   '#8B5CF6', 2,
   ARRAY['liquidity', 'credit', 'blue owl', 'lending', 'tightening', 'spread', 'high yield', 'junk bond', 'default', 'bankruptcy', 'delinquency']),

  ('ai-singularity',
   'The Singularity',
   'AI companies publishing updates, model releases, stock impacts from AI breakthroughs',
   '#3B82F6', 3,
   ARRAY['ai ', 'artificial intelligence', 'anthropic', 'openai', 'nvidia', 'gpu', 'semiconductor', 'chip', 'claude', 'gpt', 'model release', 'agi', 'deepseek']),

  ('usd-jpy-carry-trade',
   'USD-JPY Carry Trade',
   'Closely watches Fed rate cut trajectory and BoJ rate hike trajectory. Yen strength/weakness cycle.',
   '#EC4899', 4,
   ARRAY['yen', 'jpy', 'boj', 'bank of japan', 'carry trade', 'ueda', 'usdjpy', 'japan', 'yen flash', 'yen carry']),

  ('trade-war',
   'Trade War',
   'Tariffs from beginning of Trump 2026, Liberation Day, reciprocal tariffs, trade barriers',
   '#EF4444', 5,
   ARRAY['tariff', 'trade war', 'liberation day', 'reciprocal', 'import tax', 'customs', 'trade barrier', 'retaliation']),

  ('us-china-relations',
   'US-China Trade Relations',
   'Delegations, negotiations, tech restrictions, chip bans, TikTok, Huawei',
   '#14B8A6', 6,
   ARRAY['china', 'beijing', 'xi jinping', 'cnh', 'yuan', 'pboc', 'delegation', 'huawei', 'tiktok', 'chip ban', 'entity list', 'smic']),

  ('rate-cut-cycle',
   'Rate Cut Cycle',
   'Recession fears, rate cut expectations from FJ, key Fed commentary. Trump-Warsh induction on watch.',
   '#34D399', 7,
   ARRAY['rate cut', 'traders price in', 'cuts priced', 'basis points', 'recession', 'fed cut', 'powell', 'fomc', 'dovish', 'soft landing', 'hard landing', 'warsh']),

  ('trump-presidency',
   'Trump Presidency',
   'Policy actions, executive orders, appointments, commentary — connects to all other narratives',
   '#F97316', 8,
   ARRAY['trump', 'white house', 'executive order', 'maga', 'bessent', 'lutnick', 'vance', 'doge', 'musk', 'cabinet']),

  ('price-stability',
   'Price Stability (Dual Mandate)',
   'CPI, PPI, PCE, inflation expectations — the Fed''s price stability mandate',
   '#FBBF24', 9,
   ARRAY['cpi', 'ppi', 'pce', 'inflation', 'deflation', 'disinflation', 'price stability', 'consumer price', 'producer price', 'core inflation']),

  ('maximum-employment',
   'Maximum Employment (Dual Mandate)',
   'NFP, unemployment, jobless claims, labor market health — the Fed''s employment mandate',
   '#A78BFA', 10,
   ARRAY['nfp', 'jobs', 'unemployment', 'payroll', 'jobless claims', 'labor', 'employment', 'hiring', 'layoff', 'quits rate', 'jolts'])

ON CONFLICT (slug) DO NOTHING;
