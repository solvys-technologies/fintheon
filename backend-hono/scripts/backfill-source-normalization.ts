// S10-T1a: Backfill source normalization for existing scored_riskflow_items
// Run: cd backend-hono && bun run scripts/backfill-source-normalization.ts

import { createClient } from '@supabase/supabase-js';

const FJ_ACCOUNTS = new Set([
  'financialjuice', 'deltaone', 'deItaone', 'deitaone',
  'firstsquawk', 'wallstjesus', 'unusual_whales', 'newsfilterio',
  'marketcurrents', 'livesquawk', 'waboratory',
]);

const ECON_KEYWORDS = [
  'cpi', 'ppi', 'nfp', 'gdp', 'pce', 'fomc', 'fed rate', 'jobless claims',
  'retail sales', 'housing starts', 'consumer confidence', 'ism ', 'adp ',
  'unemployment', 'inflation', 'payrolls', 'economic calendar', 'data release',
];

const GEO_KEYWORDS = [
  'tariff', 'sanction', 'military', 'invasion', 'war ', 'conflict',
  'nato', 'opec', 'missile', 'nuclear', 'geopolitical', 'executive order',
  'white house', 'congress', 'legislation', 'treasury secretary',
];

const PREDICTION_KEYWORDS = [
  'polymarket', 'kalshi', 'prediction market', 'betting odds', 'probability',
];

function normalizeSource(rawSource: string | undefined, headline: string, tags: string[] = []) {
  const src = (rawSource || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (rawSource === 'FinancialJuice') return 'FinancialJuice';
  if (rawSource === 'OSINTSources') return 'OSINTSources';
  if (rawSource === 'EconomicCalendar') return 'EconomicCalendar';
  if (rawSource === 'Polymarket' || rawSource === 'Kalshi') return 'Polymarket';
  if (FJ_ACCOUNTS.has(src)) return 'FinancialJuice';
  const text = (headline + ' ' + tags.join(' ')).toLowerCase();
  if (PREDICTION_KEYWORDS.some(kw => text.includes(kw))) return 'Polymarket';
  if (ECON_KEYWORDS.some(kw => text.includes(kw))) return 'EconomicCalendar';
  if (GEO_KEYWORDS.some(kw => text.includes(kw))) return 'OSINTSources';
  return 'FinancialJuice';
}

async function main() {
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: items, error } = await sb
    .from('scored_riskflow_items')
    .select('tweet_id, source, headline, tags')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) { console.error('Read error:', error); return; }
  if (!items?.length) { console.log('No items to backfill.'); return; }

  console.log(`Found ${items.length} items. Normalizing sources...`);

  const updates: { tweet_id: string; oldSource: string; newSource: string }[] = [];

  for (const item of items) {
    const normalized = normalizeSource(item.source, item.headline || '', item.tags || []);
    if (normalized !== item.source) {
      updates.push({ tweet_id: item.tweet_id, oldSource: item.source || 'null', newSource: normalized });
    }
  }

  console.log(`${updates.length} items need source update.`);

  for (const u of updates) {
    const { error: upErr } = await sb
      .from('scored_riskflow_items')
      .update({ source: u.newSource })
      .eq('tweet_id', u.tweet_id);

    if (upErr) {
      console.error(`  FAIL ${u.tweet_id}: ${upErr.message}`);
    } else {
      console.log(`  ${u.tweet_id}: ${u.oldSource} → ${u.newSource}`);
    }
  }

  console.log('Backfill complete.');
}

main();
