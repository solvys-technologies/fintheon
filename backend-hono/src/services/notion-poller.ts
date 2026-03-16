// [claude-code 2026-03-16] Agent backend v7.9: Harper-Notion / Harper-Perp responsibility docs
// [claude-code 2026-03-14] Hermes descriptions via OpenRouter (Opus 4.6)
//
// Notion Poller — polls Trade Ideas + Daily P&L on 60s interval,
// generates Hermes descriptions for new trade ideas via OpenRouter.
//
// This poller handles RETAINED Harper-Notion responsibilities only:
//   - Trade idea polling from Notion Trade Ideas DB
//   - Performance KPI polling from Daily P&L DB
//   - Hermes description generation for new trade ideas (OpenRouter)
//
// What this poller does NOT handle (Harper-Perp territory):
//   - MDB/ADB/PMDB/TOTT brief generation (done externally by Perplexity Computer)
//   - Maintenance ticket management
//   - Deployment orchestration

import {
  queryTradeIdeas,
  queryDailyPnL,
  type NotionTradeIdea,
  type NotionPerformanceKpi,
} from './notion-service.js';

const POLL_INTERVAL_MS = 60_000;

interface PollerCache {
  tradeIdeas: NotionTradeIdea[];
  performance: NotionPerformanceKpi[];
  lastPollAt: string | null;
  pollCount: number;
}

const cache: PollerCache = {
  tradeIdeas: [],
  performance: [],
  lastPollAt: null,
  pollCount: 0,
};

let intervalId: ReturnType<typeof setInterval> | null = null;

async function generateHermesDescription(idea: NotionTradeIdea): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return '';

  const url = 'https://openrouter.ai/api/v1/chat/completions';

  const slTp = idea.entry
    ? ` Entry ~${idea.entry}${idea.stopLoss ? `, SL ${idea.stopLoss}` : ''}${idea.takeProfit ? `, TP ${idea.takeProfit}` : ''}.`
    : '';
  const rr = idea.riskRewardRatio ? ` R/R ${idea.riskRewardRatio.toFixed(1)}:1.` : '';
  const prompt = `Write a 2-sentence trade brief for: "${idea.title}" (${idea.direction.toUpperCase()}).${slTp}${rr} Confidence: ${idea.confidence ?? 'unknown'}. Timeframe: ${idea.timeframe ?? 'unspecified'}. Be concise and professional.`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_APP_URL ?? 'https://fintheon-solvys.vercel.app',
        'X-Title': process.env.OPENROUTER_APP_NAME ?? 'Fintheon-AI-Gateway',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-opus-4.6',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return '';
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  } catch {
    return '';
  }
}

async function poll(): Promise<void> {
  console.log('[NotionPoller] Polling...');
  try {
    const [newIdeas, newPerf] = await Promise.all([queryTradeIdeas(), queryDailyPnL()]);

    // Detect brand-new trade ideas and generate descriptions
    const existingIds = new Set(cache.tradeIdeas.map((i) => i.id));
    const brandNew = newIdeas.filter((i) => !existingIds.has(i.id));
    if (brandNew.length > 0) {
      console.log(`[NotionPoller] ${brandNew.length} new trade idea(s) — generating descriptions`);
      for (const idea of brandNew) {
        idea.hermesDescription = await generateHermesDescription(idea);
      }
    }

    // Preserve descriptions for existing ideas
    const descMap = new Map(cache.tradeIdeas.map((i) => [i.id, i.hermesDescription]));
    for (const idea of newIdeas) {
      if (!idea.hermesDescription) idea.hermesDescription = descMap.get(idea.id);
    }

    cache.tradeIdeas = newIdeas;
    cache.performance = newPerf;
    cache.lastPollAt = new Date().toISOString();
    cache.pollCount++;

    console.log(`[NotionPoller] Done. ${newIdeas.length} trade ideas, ${newPerf.length} KPIs.`);
  } catch (err) {
    console.warn('[NotionPoller] Poll error:', err);
  }
}

export function startNotionPoller(): void {
  if (intervalId) return;
  void poll(); // immediate first fetch
  intervalId = setInterval(() => { void poll(); }, POLL_INTERVAL_MS);
  console.log('[NotionPoller] Started (60s interval)');
}

export function stopNotionPoller(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function getCachedTradeIdeas(): NotionTradeIdea[] {
  return cache.tradeIdeas;
}

export function getCachedPerformance(): NotionPerformanceKpi[] {
  return cache.performance;
}

export function getNotionPollerStatus(): {
  running: boolean;
  lastPollAt: string | null;
  pollCount: number;
  tradeIdeaCount: number;
} {
  return {
    running: intervalId !== null,
    lastPollAt: cache.lastPollAt,
    pollCount: cache.pollCount,
    tradeIdeaCount: cache.tradeIdeas.length,
  };
}
