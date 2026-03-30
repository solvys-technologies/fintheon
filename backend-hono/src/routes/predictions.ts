// [claude-code 2026-03-28] S7: Forward-looking performance prediction endpoint
// Aggregates scored FJ items + scheduled econ events → per-instrument outlook
import { Hono } from 'hono';
import { getSupabaseClient } from '../config/supabase.js';

const app = new Hono();

const PREDICTION_INSTRUMENTS = [
  { symbol: '/NQ', name: 'Nasdaq', keywords: ['nq', 'nasdaq', 'tech', 'qqq', 'nvda'] },
  { symbol: '/ES', name: 'S&P 500', keywords: ['es', 's&p', 'spx', 'spy', 'sp500'] },
  { symbol: '/YM', name: 'Dow Jones', keywords: ['ym', 'dow', 'djia'] },
  { symbol: '/CL', name: 'Crude Oil', keywords: ['cl', 'oil', 'crude', 'wti', 'opec', 'barrel', 'energy'] },
  { symbol: '/GC', name: 'Gold', keywords: ['gc', 'gold', 'safe haven', 'precious'] },
];

interface InstrumentOutlook {
  symbol: string;
  name: string;
  ivScore: number;
  lean: 'bullish' | 'bearish' | 'neutral';
  range: [number, number]; // [low, high] in points
  conviction: 'low' | 'moderate' | 'elevated';
  drivers: string[];
  scoredItemCount: number;
}

// GET /api/predictions/outlook
app.get('/outlook', async (c) => {
  try {
    const sb = getSupabaseClient();
    if (!sb) {
      return c.json({ instruments: [], fetchedAt: new Date().toISOString(), error: 'No database connection' });
    }

    // Fetch recent scored items (last 48h)
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: scoredItems, error: scoredErr } = await sb
      .from('scored_riskflow_items')
      .select('headline, sentiment, iv_score, macro_level, published_at, tags')
      .gte('published_at', cutoff)
      .order('published_at', { ascending: false })
      .limit(200);

    if (scoredErr) {
      console.error('[Predictions] scored items fetch error:', scoredErr.message);
    }

    // Fetch upcoming econ events (next 3 days)
    const now = new Date().toISOString().slice(0, 10);
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: econEvents, error: econErr } = await sb
      .from('econ_events')
      .select('name, date, impact')
      .gte('date', now)
      .lte('date', threeDays)
      .order('date', { ascending: true })
      .limit(20);

    if (econErr) {
      console.error('[Predictions] econ events fetch error:', econErr.message);
    }

    const items = scoredItems ?? [];
    const events = econEvents ?? [];

    // Compute per-instrument outlook
    const instruments: InstrumentOutlook[] = PREDICTION_INSTRUMENTS.map(({ symbol, name, keywords }) => {
      // Find relevant items for this instrument
      const relevant = items.filter(item => {
        const text = (item.headline ?? '').toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });

      // Also include broad macro items for equity indices
      const isBroadEquity = ['/NQ', '/ES', '/YM'].includes(symbol);
      const broadItems = isBroadEquity
        ? items.filter(item => {
            const text = (item.headline ?? '').toLowerCase();
            return text.includes('market') || text.includes('stocks') || text.includes('equity') || text.includes('fed ');
          })
        : [];

      const allRelevant = [...new Map([...relevant, ...broadItems].map(i => [i.headline, i])).values()];

      // Aggregate sentiment
      let bullishWeight = 0;
      let bearishWeight = 0;
      let totalIV = 0;

      for (const item of allRelevant) {
        const weight = (item.iv_score ?? 3) / 10; // Normalize 0-1
        if (item.sentiment === 'bullish') bullishWeight += weight;
        else if (item.sentiment === 'bearish') bearishWeight += weight;
        totalIV += (item.iv_score ?? 3);
      }

      const avgIV = allRelevant.length > 0 ? totalIV / allRelevant.length : 3;

      // Determine lean — be humble
      const sentimentDelta = bullishWeight - bearishWeight;
      let lean: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (sentimentDelta > 1.5) lean = 'bullish';
      else if (sentimentDelta < -1.5) lean = 'bearish';

      // Compute range — wider with higher IV, wider with fewer data points
      const uncertaintyMultiplier = Math.max(1, 3 - Math.log2(allRelevant.length + 1));
      const baseRange = avgIV * 15 * uncertaintyMultiplier;
      const leanOffset = sentimentDelta * 5;
      const rangeLow = Math.round(-baseRange + leanOffset);
      const rangeHigh = Math.round(baseRange + leanOffset);

      // Conviction — humble by default
      let conviction: 'low' | 'moderate' | 'elevated' = 'low';
      if (allRelevant.length >= 10 && Math.abs(sentimentDelta) > 3) conviction = 'elevated';
      else if (allRelevant.length >= 5 && Math.abs(sentimentDelta) > 1.5) conviction = 'moderate';

      // Key drivers from upcoming econ events
      const highImpactEvents = events.filter(e => e.impact === 'high');
      const drivers = highImpactEvents.slice(0, 3).map(e => `${e.name} (${e.date})`);
      if (drivers.length === 0 && allRelevant.length > 0) {
        // Use top headline as driver
        drivers.push(allRelevant[0].headline?.slice(0, 50) ?? 'Market sentiment');
      }

      return {
        symbol,
        name,
        ivScore: Math.round(avgIV * 10) / 10,
        lean,
        range: [rangeLow, rangeHigh] as [number, number],
        conviction,
        drivers,
        scoredItemCount: allRelevant.length,
      };
    });

    return c.json({
      instruments,
      fetchedAt: new Date().toISOString(),
      dataPoints: items.length,
      upcomingEvents: events.length,
    });
  } catch (err) {
    console.error('[Predictions] outlook error:', err);
    return c.json({ instruments: [], fetchedAt: new Date().toISOString(), error: 'Prediction failed' }, 500);
  }
});

export default app;
