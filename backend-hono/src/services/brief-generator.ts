// [claude-code 2026-03-22] Extracted brief generation logic — shared by data routes + dispatch scheduler
// [claude-code 2026-03-23] Fix: use createModelClient() instead of passing raw model key to generateText
// [claude-code 2026-03-25] Add Nous Direct fallback when OpenRouter DNS fails (EAI_AGAIN)
import { generateText } from 'ai';
import {
  writeBrief,
  readLatestBrief,
  readEconEvents,
  type BriefType,
  type BriefRecord,
} from './supabase-service.js';
import { getFeed } from './riskflow/feed-service.js';
import { selectModel, createModelClient, getFallbackModel, markProviderUnhealthy, type AiModelKey } from './ai/model-selector.js';
import { createLogger } from '../lib/logger.js';

const log = createLogger('BriefGenerator');

/* ------------------------------------------------------------------ */
/*  Brief type rotation (time-of-day / day-of-week)                    */
/* ------------------------------------------------------------------ */

export const BRIEF_LABELS: Record<string, string> = {
  MDB: 'Morning Daily Brief (MDB)',
  ADB: 'Afternoon Daily Brief (ADB)',
  PMDB: 'Post-Market Daily Brief (PMDB)',
  TOTT: 'Tip of the Tape (TOTT)',
};

export function getCurrentBriefType(): BriefType {
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours();
  const timeVal = h * 60 + now.getMinutes();
  // TOTT: Sunday >= 17:00 through Monday < 07:00
  if (day === 0 && timeVal >= 17 * 60) return 'TOTT';
  if (day === 1 && h < 7) return 'TOTT';
  // PMDB stays active overnight until MDB fires at 6:30 AM
  if (timeVal < 6 * 60 + 30) return 'PMDB';
  if (timeVal >= 17 * 60 + 30) return 'PMDB';
  if (timeVal >= 11 * 60) return 'ADB';
  return 'MDB';
}

/* ------------------------------------------------------------------ */
/*  Generate a brief and store in Supabase                             */
/* ------------------------------------------------------------------ */

export interface GenerateBriefResult {
  content: string;
  briefType: BriefType;
  generatedAt: string;
  supabaseId: string | null;
  provider: string;
}

/**
 * Generate a brief of the given type (or auto-detect from time of day),
 * store in Supabase, and return the result.
 */
export async function generateBrief(
  overrideType?: BriefType
): Promise<GenerateBriefResult> {
  const briefType = overrideType ?? getCurrentBriefType();
  const today = new Date().toISOString().slice(0, 10);

  const [feedResponse, econEvents] = await Promise.allSettled([
    getFeed('system', { limit: 20 }),
    readEconEvents({ from: today, to: today }),
  ]);

  const feedItems =
    feedResponse.status === 'fulfilled'
      ? feedResponse.value.items.slice(0, 15)
      : [];
  const events =
    econEvents.status === 'fulfilled' ? econEvents.value : [];

  const feedSummary =
    feedItems.length > 0
      ? feedItems
          .map(
            (item: any, i: number) =>
              `${i + 1}. [${item.macroLevel >= 3 ? 'HIGH' : 'MED'}] ${item.headline}`
          )
          .join('\n')
      : 'No significant feed items at this time.';

  const econSummary =
    events.length > 0
      ? events
          .map(
            (e) =>
              `• ${e.name}${e.time ? ` at ${e.time}` : ''}${e.actual != null ? ` — Actual: ${e.actual}` : ''}${e.forecast != null ? `, Forecast: ${e.forecast}` : ''}`
          )
          .join('\n')
      : 'No major economic events today.';

  const isFull = briefType === 'MDB' || briefType === 'TOTT';

  const prompt = isFull
    ? `You are Fintheon, a macro trading assistant for Priced In Capital. Generate a comprehensive ${BRIEF_LABELS[briefType]}.

## Today's Economic Events
${econSummary}

## Recent RiskFlow Headlines
${feedSummary}

## Instructions
${
  briefType === 'MDB'
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

Be analytical, direct, use financial shorthand. 600-1000 words.`
}`
    : `You are Fintheon, a macro trading assistant for Priced In Capital. Generate a brief ${BRIEF_LABELS[briefType]}.

## Today's Economic Events
${econSummary}

## Recent RiskFlow Headlines
${feedSummary}

## Instructions
${
  briefType === 'ADB'
    ? 'Write 3-5 bullet points covering ONLY new headlines and data since the morning that moved or could move the market. Skip anything already covered in the MDB. Be direct and actionable. Max 200 words.'
    : 'Write 3-5 bullet points covering ONLY new developments since the afternoon brief — post-market moves, after-hours earnings, overnight catalysts. Be direct and actionable. Max 200 words.'
}`;

  const selection = selectModel({
    taskType: 'analysis',
    maxBudgetUsd: isFull ? 0.05 : 0.01,
  });

  let text: string;
  let usedProvider = selection.provider;

  try {
    const model = createModelClient(selection.model as AiModelKey);
    const result = await generateText({ model, prompt });
    text = result.text;
  } catch (err: any) {
    const isNetworkError = ['EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'fetch failed']
      .some((code) => err?.message?.includes(code) || err?.cause?.code === code);

    if (!isNetworkError) throw err;

    log.warn(`Primary provider network error, attempting Nous Direct fallback`, {
      primaryModel: selection.model,
      error: err?.message ?? String(err),
    });
    markProviderUnhealthy(selection.provider);

    // Try fallback chain via model-selector
    const fallback = getFallbackModel(selection.model as AiModelKey);
    if (!fallback) throw err;

    const fallbackModel = createModelClient(fallback.model as AiModelKey);
    const fallbackResult = await generateText({ model: fallbackModel, prompt });
    text = fallbackResult.text;
    usedProvider = fallback.provider;
    log.info(`Fallback succeeded via ${fallback.model}`, { provider: fallback.provider });
  }

  // Store in Supabase
  const stored = await writeBrief({
    brief_type: briefType,
    content: text,
    generated_by: 'hermes',
    category: briefType,
  });

  log.info(`Brief generated: ${briefType}`, {
    supabaseId: stored?.id,
    provider: usedProvider,
    length: text.length,
  });

  return {
    content: text,
    briefType,
    generatedAt: new Date().toISOString(),
    supabaseId: stored?.id ?? null,
    provider: usedProvider,
  };
}

/**
 * Check if a brief of the given type was already generated today.
 */
export async function wasBriefGeneratedToday(type: BriefType): Promise<boolean> {
  const latest = await readLatestBrief(type);
  if (!latest?.created_at) return false;
  const today = new Date().toISOString().slice(0, 10);
  return latest.created_at.startsWith(today);
}
