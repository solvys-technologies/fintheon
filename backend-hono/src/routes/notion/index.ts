// [claude-code 2026-03-11] Phase 3: Notion API routes — single-item brief, TOTT type, RiskFlow prints merged into schedule
import { Hono } from 'hono';
import { generateText } from 'ai';
import { fetchMDBBrief, fetchSchedule, writeMDBReportToNotion, getCurrentBriefType } from '../../services/notion-service.js';
import type { BriefType } from '../../services/notion-service.js';
import { getTradeIdeas, getPerformance, getPollStatus, updateTradeIdeaStatus } from './handlers.js';
import { getFeed } from '../../services/riskflow/feed-service.js';
import { fetchEconCalendar } from '../../services/econ-calendar-service.js';
import { fetchEconomicFeed } from '../../services/riskflow/economic-feed.js';
import { selectModel } from '../../services/ai/model-selector.js';

const BRIEF_LABELS: Record<string, string> = {
  MDB: 'Dawn Dispatch',
  ADB: 'Midday Dispatch',
  PMDB: 'Dusk Dispatch',
  TOTT: 'The Weekly Tribune',
};
import { createEconCalendarRoutes } from './econ-calendar.js';

export function createNotionRoutes(): Hono {
  const app = new Hono();

  // Econ calendar routes (GET /econ-calendar, /econ-prints, POST /econ-print, PATCH /econ-event/:id/actual)
  app.route('/', createEconCalendarRoutes());

  // GET /api/notion/mdb-brief?type=MDB|ADB|PMDB|TOTT (legacy alias: /ntn-brief)
  app.get('/mdb-brief', async (c) => {
    try {
      const typeParam = c.req.query('type')?.toUpperCase() as import('../../services/notion-service.js').BriefType | undefined;
      const validTypes = ['MDB', 'ADB', 'PMDB', 'TOTT'];
      const briefType = typeParam && validTypes.includes(typeParam) ? typeParam : undefined;
      const items = await fetchMDBBrief(briefType);
      return c.json({ items, briefType: briefType ?? getCurrentBriefType() });
    } catch (err) {
      console.error('[Notion] /mdb-brief error:', err);
      return c.json({ items: [] }, 500);
    }
  });
  app.get('/ntn-brief', async (c) => {
    try {
      const items = await fetchMDBBrief();
      return c.json({ items });
    } catch (err) {
      return c.json({ items: [] }, 500);
    }
  });

  // GET /api/notion/schedule — economic calendar + recent RiskFlow prints merged
  app.get('/schedule', async (c) => {
    try {
      const [notionItems, econPrints] = await Promise.allSettled([
        fetchSchedule(),
        fetchEconomicFeed(),
      ]);

      const items = notionItems.status === 'fulfilled' ? notionItems.value : [];

      // Merge RiskFlow economic prints as schedule items
      if (econPrints.status === 'fulfilled' && econPrints.value.length > 0) {
        const existingTitles = new Set(items.map(i => i.title.toLowerCase()));
        for (const print of econPrints.value) {
          // Skip duplicates already in Notion schedule
          const printName = print.headline.split('|')[0].trim().toLowerCase();
          if (existingTitles.has(printName)) continue;

          // Parse "Name | Actual: X | Forecast: Y | Prev: Z" headline
          const parts = print.headline.split('|').map(s => s.trim());
          const title = parts[0] || 'Economic Print';
          const actual = parts.find(p => p.startsWith('Actual:'))?.replace('Actual:', '').trim();
          const forecast = parts.find(p => p.startsWith('Forecast:'))?.replace('Forecast:', '').trim();
          const previous = parts.find(p => p.startsWith('Prev:'))?.replace('Prev:', '').trim();

          items.push({
            title,
            detail: `RiskFlow print — IV ${print.ivScore ?? '?'}/10`,
            forecast,
            actual,
            previous,
            date: print.publishedAt ? new Date(print.publishedAt).toISOString().slice(0, 10) : undefined,
          });
        }
      }

      return c.json({ items });
    } catch (err) {
      console.error('[Notion] /schedule error:', err);
      return c.json({ items: [] }, 500);
    }
  });

  // GET /api/notion/trade-ideas — live trade ideas from Notion poller cache
  app.get('/trade-ideas', getTradeIdeas);

  // PATCH /api/notion/trade-ideas/:id/status — approve/deny trade proposals (updates Notion Kanban)
  app.patch('/trade-ideas/:id/status', updateTradeIdeaStatus);

  // GET /api/notion/performance — KPI data from Daily P&L database
  app.get('/performance', getPerformance);

  // GET /api/notion/poll-status — poller health check
  app.get('/poll-status', getPollStatus);

  // POST /api/notion/mdb-report/generate — generate AI brief and store in Notion
  app.post('/mdb-report/generate', async (c) => {
    try {
      const briefType = getCurrentBriefType();
      const today = new Date().toISOString().slice(0, 10);

      // Fetch feed context and econ calendar in parallel
      const [feedResponse, econEvents] = await Promise.allSettled([
        getFeed('system', { limit: 20 }),
        fetchEconCalendar({ from: today, to: today }),
      ]);

      const feedItems = feedResponse.status === 'fulfilled' ? feedResponse.value.items.slice(0, 15) : [];
      const events = econEvents.status === 'fulfilled' ? econEvents.value : [];

      // Build prompt
      const feedSummary = feedItems.length > 0
        ? feedItems.map((item, i) => `${i + 1}. [${item.macroLevel >= 3 ? 'HIGH' : 'MED'}] ${item.headline}`).join('\n')
        : 'No significant feed items at this time.';

      const econSummary = events.length > 0
        ? events.map((e) => `• ${e.name}${e.time ? ` at ${e.time}` : ''}${e.actual != null ? ` — Actual: ${e.actual}` : ''}${e.forecast != null ? `, Forecast: ${e.forecast}` : ''}`).join('\n')
        : 'No major economic events today.';

      // MDB and TOTT get comprehensive reports; ADB and PMDB get short updates
      const isFull = briefType === 'MDB' || briefType === 'TOTT';

      const prompt = isFull
        ? `You are Fintheon, the macro trading command center for Priced In Capital. Generate a comprehensive ${BRIEF_LABELS[briefType]}.

## Today's Economic Events
${econSummary}

## Recent RiskFlow Headlines
${feedSummary}

## Instructions
${briefType === 'MDB'
  ? `Write a full Dawn Dispatch in this exact format:

**Day Type:** [Macro/Catalyst/Drift/Compounding] — one-line reason
**Key Prints & Speeches (ET):** List each with time, actual vs expected, directional read (bullish/bearish)
**After-Hours Movers:** Top movers with % and implied NQ/ES point impact
**Macro/Political Take:** 2-3 sentences on the macro picture — labor, inflation, geopolitical, Fed
**Pressure Summary:** Current price action, key levels, consolidation vs breakout
**Market Risks & VIX:** Event risk status, VIX level and direction, what it means
**Overall Sentiment:** One punchy sentence
**Best Intraday Approach:** Specific strategy recommendation (Ripper, AWV, Snipe, etc.)

Be direct, use financial shorthand. Anchor ONLY to key macro events. No scattergun anchoring. 400-600 words.`
  : `Write a comprehensive Weekly Tribune (The Weekly Tribune) covering:

**Past Week Recap:**
- Market Overview (S&P, Nasdaq, equal-weight, sector rotation)
- Top 3 S&P 500 Performers ($200B+) with headlines
- Bottom 3 S&P 500 Performers ($200B+) with headlines
- NQ Futures Daily % Change (each day)
- Key Macro Data released
- Political Commentary (administration figures, policy impact)
- VIX Levels (range for the week)
- Sentiment summary

**Upcoming Week Preview:**
- Scheduled Events with VolScore (1-10), Forecast, Prior, NQ Reaction expectation, Priced In assessment
- Key earnings to watch
- Sentiment outlook

Be analytical, direct, use financial shorthand. 600-1000 words.`}
`
        : `You are Fintheon, the macro trading command center for Priced In Capital. Generate a brief ${BRIEF_LABELS[briefType]}.

## Today's Economic Events
${econSummary}

## Recent RiskFlow Headlines
${feedSummary}

## Instructions
${briefType === 'ADB'
  ? 'Write 3-5 bullet points covering ONLY new headlines and data since the morning that moved or could move the market. Skip anything already covered in the MDB. Be direct and actionable. Max 200 words.'
  : 'Write 3-5 bullet points covering ONLY new developments since the afternoon brief — post-market moves, after-hours earnings, overnight catalysts. Be direct and actionable. Max 200 words.'}
`;

      const { model, provider } = selectModel({ taskType: 'analysis', maxBudgetUsd: isFull ? 0.05 : 0.01 });
      const { text } = await generateText({ model, prompt });

      // Store in Notion (archives previous same-type entry)
      const notionResult = await writeMDBReportToNotion(text, briefType);

      return c.json({
        content: text,
        briefType,
        generatedAt: new Date().toISOString(),
        notionUrl: notionResult?.url ?? null,
        provider,
      });
    } catch (err) {
      console.error('[Notion] /mdb-report/generate error:', err);
      return c.json({ error: 'Generation failed', details: String(err) }, 500);
    }
  });

  return app;
}
