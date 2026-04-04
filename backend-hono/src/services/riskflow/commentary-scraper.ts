// [claude-code 2026-04-04] Exa-powered commentary scraper for FJ + OSINT sources
// Replaces Firecrawl scraping with Exa domain-scoped search.
// Feeds raw items into raw_riskflow_items on a 30-min interval.

import { writeRawItems, type RawRiskFlowItem } from '../supabase-service.js';
import { exaSearch, isExaAvailable, type ExaSearchResult } from '../exa-service.js';
import { createLogger } from '../../lib/logger.js';
import { getPollingConfig } from './polling-config.js';

const log = createLogger('CommentaryScraper');

const HOT_INTERVAL_MS = 30 * 60_000;
const OFF_PEAK_INTERVAL_MS = 60 * 60_000;

const submittedIds = new Set<string>();
let scraperTimeout: ReturnType<typeof setTimeout> | null = null;

// ─── Source Definitions ────────────────────────────────��────────

interface CommentarySource {
  name: string;
  /** Exa search query scoped to this source */
  query: string;
  /** Domain filter for Exa includeDomains */
  domains: string[];
  idPrefix: string;
  /** NewsSource value for raw_riskflow_items */
  source: string;
  numResults: number;
}

const SOURCES: CommentarySource[] = [
  {
    name: 'FinancialJuice',
    query: 'breaking financial market news headlines economic data Fed',
    domains: ['financialjuice.com', 'features.financialjuice.com'],
    idPrefix: 'fj-exa',
    source: 'FinancialJuice',
    numResults: 10,
  },
  {
    name: 'OSINT-Geopolitical',
    query: 'breaking geopolitical military conflict sanctions OSINT intelligence',
    domains: [
      'liveuamap.com',
      'understandingwar.org',
      'janes.com',
      'armscontrolwonk.com',
    ],
    idPrefix: 'osint-exa',
    source: 'OSINTSources',
    numResults: 8,
  },
];

// ─── Helpers ────────────────────────────────────────────────────

function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extractSymbols(text: string): string[] {
  const symbols: string[] = [];
  const tickerMatches = text.match(/\$[A-Z]{1,5}\b|\/[A-Z]{2,4}\b/g);
  if (tickerMatches) symbols.push(...tickerMatches);

  if (/\b(s&p|spx|spy)\b/i.test(text)) symbols.push('/ES');
  if (/\b(nasdaq|qqq|nq)\b/i.test(text)) symbols.push('/NQ');
  if (/\b(treasury|10.?year|tnx)\b/i.test(text)) symbols.push('/ZN');
  if (/\b(crude|oil|wti|cl)\b/i.test(text)) symbols.push('/CL');
  if (/\b(gold|xau)\b/i.test(text)) symbols.push('/GC');
  if (/\b(dollar|dxy|usd)\b/i.test(text)) symbols.push('DXY');

  return [...new Set(symbols)];
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  if (/\b(fed|fomc|powell|rate)\b/i.test(text)) tags.push('FED');
  if (/\b(cpi|ppi|inflation|prices)\b/i.test(text)) tags.push('INFLATION');
  if (/\b(jobs|nfp|employment|unemployment|claims)\b/i.test(text)) tags.push('EMPLOYMENT');
  if (/\b(gdp|growth|recession)\b/i.test(text)) tags.push('GDP');
  if (/\b(tariff|trade war|china|import|export)\b/i.test(text)) tags.push('TRADE');
  if (/\b(iran|israel|irgc|houthi|hezbollah|military|missile|strike)\b/i.test(text)) tags.push('GEOPOLITICAL');
  if (/\b(trump|bessent|yellen|treasury sec)\b/i.test(text)) tags.push('POLITICS');
  if (/\b(oil|opec|crude|energy)\b/i.test(text)) tags.push('ENERGY');
  if (/\b(earnings|revenue|eps|guidance)\b/i.test(text)) tags.push('EARNINGS');
  if (/\b(breaking|urgent|alert)\b/i.test(text)) tags.push('BREAKING');
  return [...new Set(tags)];
}

function hasMarketSignal(text: string): boolean {
  return /\b(market|stock|bond|yield|rate|fed|gdp|cpi|inflation|earnings|trade|tariff|oil|gold|dollar|euro|china|treasury|recession|growth|employment|jobs|fomc|cut|hike|pmi|retail|housing|consumer|bank|credit|debt|deficit|surplus|import|export|sanctions?|iran|israel|nato|opec|military|missile|geopolitical|conflict|war)\b/i.test(text);
}

// ─── Exa Result → RawRiskFlowItem ──────────────────────────────

function toRawItem(result: ExaSearchResult, source: CommentarySource): RawRiskFlowItem | null {
  const title = result.title?.trim();
  if (!title || title.length < 15 || title.length > 300) return null;

  // Skip navigation/UI text
  if (/^(home|about|contact|subscribe|sign|log|menu|search|share|comment|advertisement|cookie|newsletter)/i.test(title)) {
    return null;
  }

  if (!hasMarketSignal(`${title} ${result.text}`)) return null;

  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const publishedBucket = result.publishedDate?.slice(0, 13) ?? new Date().toISOString().slice(0, 13);
  const id = `${source.idPrefix}-${hashString(`${normalizedTitle}|${publishedBucket}`)}`;

  if (submittedIds.has(id)) return null;

  const body = [result.url, result.text].filter(Boolean).join('\n').slice(0, 1200);
  const fullText = `${title} ${result.text}`;

  return {
    tweet_id: id,
    source: source.source,
    headline: title,
    body: body || undefined,
    symbols: extractSymbols(fullText),
    tags: extractTags(fullText),
    is_breaking: /\b(breaking|urgent|alert|flash)\b/i.test(fullText),
    urgency: /\b(breaking|urgent)\b/i.test(fullText) ? 'immediate' : 'normal',
    published_at: result.publishedDate ?? new Date().toISOString(),
    submitted_by: `commentary-scraper:${source.name}`,
  };
}

// ─── Main Poll Cycle ────────────────────────────────────────────

async function pollCommentary(): Promise<void> {
  log.info('Starting Exa commentary scrape cycle');
  let totalNew = 0;

  for (const source of SOURCES) {
    try {
      const results = await exaSearch(source.query, {
        numResults: source.numResults,
        type: 'neural',
        useAutoprompt: true,
        includeDomains: source.domains,
      } as any);

      if (results.length === 0) {
        log.info(`${source.name}: 0 Exa results`);
        continue;
      }

      const items: RawRiskFlowItem[] = [];
      for (const result of results) {
        const item = toRawItem(result, source);
        if (item) items.push(item);
      }

      if (items.length === 0) {
        log.info(`${source.name}: 0 new headlines after filtering`);
        continue;
      }

      const written = await writeRawItems(items);
      for (const item of items) submittedIds.add(item.tweet_id);
      totalNew += written;

      log.info(`${source.name}: ${written} new items ingested via Exa`);
    } catch (err) {
      log.warn(`${source.name} Exa scrape failed`, { error: String(err) });
    }
  }

  log.info(`Commentary scrape complete: ${totalNew} new items total`);
}

// ─── Boot ───────────────────────────────────────────────────────

export function startCommentaryScraper(): void {
  if (!isExaAvailable()) {
    log.warn('EXA_API_KEY not set — commentary scraper disabled');
    return;
  }

  if (scraperTimeout) return;
  log.info('Commentary scraper starting (Exa-powered)');

  const scheduledPoll = async (): Promise<void> => {
    try {
      await pollCommentary();
    } catch (err) {
      log.warn('Commentary scrape cycle failed', { error: String(err) });
    }

    const { isHotHours } = getPollingConfig();
    const interval = isHotHours ? HOT_INTERVAL_MS : OFF_PEAK_INTERVAL_MS;
    log.info(`Next commentary scrape in ${Math.round(interval / 60_000)}m (hotHours=${isHotHours})`);
    scraperTimeout = setTimeout(scheduledPoll, interval);
  };

  // Initial scrape after 15s delay (let other services boot first)
  setTimeout(() => void scheduledPoll(), 15_000);
}

export function stopCommentaryScraper(): void {
  if (!scraperTimeout) return;
  clearTimeout(scraperTimeout);
  scraperTimeout = null;
  log.info('Commentary scraper stopped');
}
