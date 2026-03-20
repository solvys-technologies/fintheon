// [claude-code 2026-03-20] Data routes — Supabase-backed, replaces /api/notion/* endpoints
import { Hono } from 'hono';
import { generateText } from 'ai';
import {
  readTradeIdeas,
  updateTradeIdeaStatus,
  readDailyPnl,
  readLatestBrief,
  readBriefs,
  writeBrief,
  readEconEvents,
  readEconPrints,
  writeEconPrint,
  updateEconEventActual,
  type BriefType,
  type TradeIdeaRecord,
  type DailyPnlRecord,
} from '../../services/supabase-service.js';
import { getFeed } from '../../services/riskflow/feed-service.js';
import { selectModel } from '../../services/ai/model-selector.js';
import { getUserSettings } from '../../services/settings-store.js';

// ── Brief rotation (ported from notion-service.ts) ──────────────────────────

const BRIEF_LABELS: Record<string, string> = {
  MDB: 'Morning Daily Brief (MDB)',
  ADB: 'Afternoon Daily Brief (ADB)',
  PMDB: 'Post-Market Daily Brief (PMDB)',
  TOTT: 'Tip of the Tape (TOTT)',
};

function getCurrentBriefType(): BriefType {
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours();
  const timeVal = h * 60 + now.getMinutes();
  if (day === 0 && timeVal >= 17 * 60) return 'TOTT';
  if (day === 1 && h < 7) return 'TOTT';
  if (timeVal >= 17 * 60 + 30) return 'PMDB';
  if (timeVal >= 11 * 60) return 'ADB';
  return 'MDB';
}

// ── Helpers: transform DB records → frontend shapes ─────────────────────────

function confidenceLabel(n: number): string {
  if (n >= 70) return 'high';
  if (n >= 50) return 'medium';
  return 'low';
}

function tradeIdeaToFrontend(r: TradeIdeaRecord) {
  const entry = r.entry_price ?? undefined;
  const exitPrice = r.take_profit ?? undefined;
  const rawDir = (r.direction ?? 'neutral').toLowerCase();
  const direction: 'long' | 'short' | 'neutral' =
    rawDir === 'long' ? 'long' : rawDir === 'short' ? 'short' : 'neutral';

  let potentialRisk: number | undefined;
  let potentialProfit: number | undefined;
  let riskRewardRatio: number | undefined;

  if (entry && entry <= 1) {
    potentialRisk = entry * 100;
    potentialProfit = (1 - entry) * 100;
    if (potentialRisk > 0) riskRewardRatio = potentialProfit / potentialRisk;
  } else if (entry && exitPrice) {
    potentialProfit = (Math.abs(exitPrice - entry) / entry) * 100;
  }

  return {
    id: r.id!,
    title: r.title || r.ticker || 'Untitled Trade',
    ticker: r.ticker || r.title || 'UNKNOWN',
    direction,
    entry,
    stopLoss: r.stop_loss ?? undefined,
    takeProfit: exitPrice,
    potentialRisk,
    potentialProfit,
    riskRewardRatio: r.risk_reward_ratio ?? riskRewardRatio,
    confidence: r.confidence != null ? confidenceLabel(r.confidence) : undefined,
    timeframe: r.timeframe ?? undefined,
    sourceAgent: r.analyst ?? undefined,
    hermesDescription: r.hermes_description ?? r.thesis?.slice(0, 300) ?? undefined,
    notionUrl: '', // No Notion URL for Supabase records
    createdAt: r.created_at ?? new Date().toISOString(),
    updatedAt: r.updated_at ?? new Date().toISOString(),
  };
}

function dailyPnlToKpis(records: DailyPnlRecord[]) {
  if (records.length === 0) return [];
  const latest = records[0]; // already sorted desc
  const kpis: Array<{ label: string; value: string; meta: string }> = [];

  const pnl = latest.net_pnl ?? latest.gross_pnl;
  if (pnl != null) {
    const n = Number(pnl);
    kpis.push({
      label: 'Net P&L',
      value: isNaN(n) ? String(pnl) : `${n >= 0 ? '+' : ''}$${Math.abs(n).toLocaleString()}`,
      meta: 'Live · Supabase',
    });
  }
  if (latest.win_rate != null) {
    const n = Number(latest.win_rate);
    kpis.push({
      label: 'Win Rate',
      value: isNaN(n) ? String(latest.win_rate) : `${(n > 1 ? n : n * 100).toFixed(0)}%`,
      meta: 'Daily sessions',
    });
  }
  if (latest.trades_taken != null) {
    kpis.push({
      label: 'Trades Taken',
      value: String(latest.trades_taken),
      meta: latest.bias ? `Bias: ${latest.bias}` : 'Today',
    });
  }
  if (latest.trades_taken && pnl != null) {
    const avg = Number(pnl) / latest.trades_taken;
    if (!isNaN(avg)) {
      kpis.push({
        label: 'Avg P&L / Trade',
        value: `${avg >= 0 ? '+' : ''}$${Math.abs(avg).toFixed(0)}`,
        meta: 'Per trade',
      });
    }
  }
  return kpis;
}

// ── Route factory ───────────────────────────────────────────────────────────

export function createDataRoutes(): Hono {
  const app = new Hono();

  // ── Trade Ideas ─────────────────────────────────────────────────

  // GET /api/data/trade-ideas
  app.get('/trade-ideas', async (c) => {
    const ideas = await readTradeIdeas();
    const tradeIdeas = ideas.map(tradeIdeaToFrontend);
    return c.json({ tradeIdeas, count: tradeIdeas.length, fetchedAt: new Date().toISOString() });
  });

  // PATCH /api/data/trade-ideas/:id/status
  app.patch('/trade-ideas/:id/status', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ status: string }>().catch(() => null);
    if (!id || !body?.status) {
      return c.json({ error: 'Missing id or status' }, 400);
    }
    const validStatuses = ['Proposed', 'Approved', 'Rejected', 'Closed'];
    if (!validStatuses.includes(body.status)) {
      return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 400);
    }
    const ok = await updateTradeIdeaStatus(id, body.status);
    if (!ok) return c.json({ error: 'Failed to update trade idea' }, 500);
    return c.json({ success: true, id, status: body.status });
  });

  // ── Performance ─────────────────────────────────────────────────

  // GET /api/data/performance
  app.get('/performance', async (c) => {
    const records = await readDailyPnl({ limit: 1 });
    const kpis = dailyPnlToKpis(records);
    return c.json({ kpis, count: kpis.length, fetchedAt: new Date().toISOString() });
  });

  // ── Briefs ──────────────────────────────────────────────────────

  // GET /api/data/brief?type=MDB|ADB|PMDB|TOTT
  app.get('/brief', async (c) => {
    try {
      const typeParam = c.req.query('type')?.toUpperCase() as BriefType | undefined;
      const validTypes = ['MDB', 'ADB', 'PMDB', 'TOTT'];
      const briefType = typeParam && validTypes.includes(typeParam) ? typeParam : getCurrentBriefType();

      const brief = await readLatestBrief(briefType);
      if (brief) {
        return c.json({
          items: [{ title: `${briefType} — Brief`, detail: brief.content }],
          briefType,
        });
      }

      // Fallback: any active brief
      const fallback = await readBriefs(undefined, 1);
      if (fallback.length > 0) {
        return c.json({
          items: [{ title: `Latest — ${fallback[0].brief_type}`, detail: fallback[0].content }],
          briefType,
        });
      }

      return c.json({ items: [], briefType });
    } catch (err) {
      console.error('[Data] /brief error:', err);
      return c.json({ items: [] }, 500);
    }
  });

  // POST /api/data/brief/generate — AI brief generation + store in Supabase
  app.post('/brief/generate', async (c) => {
    try {
      const briefType = getCurrentBriefType();
      const today = new Date().toISOString().slice(0, 10);

      const [feedResponse, econEvents] = await Promise.allSettled([
        getFeed('system', { limit: 20 }),
        readEconEvents({ from: today, to: today }),
      ]);

      const feedItems = feedResponse.status === 'fulfilled' ? feedResponse.value.items.slice(0, 15) : [];
      const events = econEvents.status === 'fulfilled' ? econEvents.value : [];

      const feedSummary = feedItems.length > 0
        ? feedItems.map((item: any, i: number) => `${i + 1}. [${item.macroLevel >= 3 ? 'HIGH' : 'MED'}] ${item.headline}`).join('\n')
        : 'No significant feed items at this time.';

      const econSummary = events.length > 0
        ? events.map((e) => `• ${e.name}${e.time ? ` at ${e.time}` : ''}${e.actual != null ? ` — Actual: ${e.actual}` : ''}${e.forecast != null ? `, Forecast: ${e.forecast}` : ''}`).join('\n')
        : 'No major economic events today.';

      const isFull = briefType === 'MDB' || briefType === 'TOTT';

      const prompt = isFull
        ? `You are Fintheon, a macro trading assistant for Priced In Capital. Generate a comprehensive ${BRIEF_LABELS[briefType]}.

## Today's Economic Events
${econSummary}

## Recent RiskFlow Headlines
${feedSummary}

## Instructions
${briefType === 'MDB'
  ? `Write a full Morning Daily Brief in this exact format:

**Day Type:** [Macro/Catalyst/Drift/Compounding] — one-line reason
**Key Prints & Speeches (ET):** List each with time, actual vs expected, directional read (bullish/bearish)
**After-Hours Movers:** Top movers with % and implied NQ/ES point impact
**Macro/Political Take:** 2-3 sentences on the macro picture — labor, inflation, geopolitical, Fed
**Pressure Summary:** Current price action, key levels, consolidation vs breakout
**Market Risks & VIX:** Event risk status, VIX level and direction, what it means
**Overall Sentiment:** One punchy sentence
**Best Intraday Approach:** Specific strategy recommendation (Ripper, AWV, Snipe, etc.)

Be direct, use financial shorthand. Anchor ONLY to key macro events. No scattergun anchoring. 400-600 words.`
  : `Write a comprehensive Weekly Tribune covering:

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
        : `You are Fintheon, a macro trading assistant for Priced In Capital. Generate a brief ${BRIEF_LABELS[briefType]}.

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

      // Store in Supabase
      const stored = await writeBrief({
        brief_type: briefType,
        content: text,
        generated_by: 'hermes',
        category: briefType,
      });

      return c.json({
        content: text,
        briefType,
        generatedAt: new Date().toISOString(),
        notionUrl: null,
        supabaseId: stored?.id ?? null,
        provider,
      });
    } catch (err) {
      console.error('[Data] /brief/generate error:', err);
      return c.json({ error: 'Generation failed', details: String(err) }, 500);
    }
  });

  // ── Schedule (Econ Events + Prints merged) ──────────────────────

  // GET /api/data/schedule
  app.get('/schedule', async (c) => {
    try {
      const [eventsResult, printsResult] = await Promise.allSettled([
        readEconEvents(),
        readEconPrints({ limit: 30 }),
      ]);

      const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
      const prints = printsResult.status === 'fulfilled' ? printsResult.value : [];

      // Map events → schedule items
      const items = events.map((e) => ({
        title: e.name,
        detail: e.detail || 'No details provided',
        forecast: e.forecast ?? undefined,
        previous: e.previous ?? undefined,
        actual: e.actual ?? undefined,
        date: e.date ?? undefined,
      }));

      // Merge prints as additional schedule items (dedup by title)
      const existingTitles = new Set(items.map(i => i.title.toLowerCase()));
      for (const p of prints) {
        const printName = p.headline.split('|')[0].trim().toLowerCase();
        if (existingTitles.has(printName)) continue;
        items.push({
          title: p.headline.split('|')[0].trim() || 'Economic Print',
          detail: `Print — IV ${p.iv_score ?? '?'}/10`,
          forecast: p.forecast_value ?? undefined,
          actual: p.actual_value ?? undefined,
          previous: p.previous_value ?? undefined,
          date: p.printed_at ? new Date(p.printed_at).toISOString().slice(0, 10) : undefined,
        });
      }

      return c.json({ items });
    } catch (err) {
      console.error('[Data] /schedule error:', err);
      return c.json({ items: [] }, 500);
    }
  });

  // ── Econ Calendar Sub-routes ────────────────────────────────────

  // GET /api/data/econ-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
  app.get('/econ-calendar', async (c) => {
    try {
      const from = c.req.query('from');
      const to = c.req.query('to');
      const events = await readEconEvents({ from: from ?? undefined, to: to ?? undefined });
      return c.json({ events, count: events.length });
    } catch (err) {
      console.error('[Data] /econ-calendar error:', err);
      return c.json({ events: [], count: 0 }, 500);
    }
  });

  // GET /api/data/econ-prints?event=CPI
  app.get('/econ-prints', async (c) => {
    try {
      const eventName = c.req.query('event');
      const prints = await readEconPrints({ eventName: eventName ?? undefined });
      return c.json({ prints, count: prints.length });
    } catch (err) {
      console.error('[Data] /econ-prints error:', err);
      return c.json({ prints: [], count: 0 }, 500);
    }
  });

  // POST /api/data/econ-print — write an actual print result
  app.post('/econ-print', async (c) => {
    try {
      const body = await c.req.json<{
        eventName: string;
        date: string;
        actual: number;
        forecast?: number;
        previous?: number;
      }>();
      if (!body.eventName || !body.date || body.actual == null) {
        return c.json({ error: 'eventName, date, actual required' }, 400);
      }
      const result = await writeEconPrint({
        headline: body.eventName,
        actual_value: String(body.actual),
        forecast_value: body.forecast != null ? String(body.forecast) : undefined,
        previous_value: body.previous != null ? String(body.previous) : undefined,
      });
      if (!result) return c.json({ error: 'Failed to write print' }, 500);
      return c.json({ success: true, id: result.id });
    } catch (err) {
      console.error('[Data] /econ-print POST error:', err);
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  // PATCH /api/data/econ-event/:id/actual — update actual on existing event
  app.patch('/econ-event/:id/actual', async (c) => {
    try {
      const id = c.req.param('id');
      const { actual } = await c.req.json<{ actual: string }>();
      if (!actual) return c.json({ error: 'actual required' }, 400);
      const ok = await updateEconEventActual(id, actual);
      return ok ? c.json({ success: true }) : c.json({ error: 'Update failed' }, 500);
    } catch (err) {
      console.error('[Data] PATCH econ-event error:', err);
      return c.json({ error: 'Internal error' }, 500);
    }
  });

  // GET /api/data/econ-poller-status — smart polling window status
  app.get('/econ-poller-status', async (c) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const events = await readEconEvents({ from: today, to: today });
      const highImportance = events.filter((e) => e.impact === 'high' || e.impact === 'medium');

      const now = Date.now();
      const PRE = 5;
      const POST = 15;

      const upcoming = highImportance
        .map((e) => {
          if (!e.date || !e.time) return null;
          const eventMs = new Date(`${e.date}T${e.time}`).getTime();
          const diffMin = (now - eventMs) / 60_000;
          return { name: e.name, time: e.time, msUntil: eventMs - now, inWindow: diffMin >= -PRE && diffMin <= POST };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null)
        .sort((a, b) => a.msUntil - b.msUntil);

      const activeInWindow = upcoming.filter(e => e.inWindow);
      const nextEvent = upcoming.find(e => e.msUntil > -POST * 60_000);

      let autoRefresh = true;
      try {
        const settings = await getUserSettings('default');
        if (settings.autoRefresh !== undefined) autoRefresh = settings.autoRefresh as boolean;
      } catch { /* default true */ }

      return c.json({
        active: activeInWindow.length > 0,
        autoRefresh,
        nextEvent: nextEvent ? { name: nextEvent.name, time: nextEvent.time, msUntil: nextEvent.msUntil } : null,
        todayEventCount: highImportance.length,
        eventsInWindow: activeInWindow.length,
      });
    } catch (err) {
      return c.json({ active: false, autoRefresh: true, nextEvent: null, todayEventCount: 0, eventsInWindow: 0 }, 500);
    }
  });

  return app;
}
