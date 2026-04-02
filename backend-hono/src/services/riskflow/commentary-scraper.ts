// [claude-code 2026-03-28] Firecrawl-powered commentary scraper for FJ, DeItaOne
// Feeds raw items into raw_riskflow_items on a 30-min interval.
// Twitter CLI handles real-time econ prints + geopolitical; this handles web commentary.

import { writeRawItems, type RawRiskFlowItem } from '../supabase-service.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('CommentaryScraper');

const SCRAPE_INTERVAL_MS = 30 * 60_000; // 30 minutes
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1';

// Dedup: track IDs we've already pushed this session
const submittedIds = new Set<string>();

// ─── Source Definitions ─────────────────────────────────────────

interface CommentarySource {
  name: string;
  url: string;
  /** CSS selector or path filter for the scrape */
  extractPattern: RegExp;
  /** How to derive a unique ID from a headline */
  idPrefix: string;
  /** NewsSource value for raw_riskflow_items */
  source: string;
}

const SOURCES: CommentarySource[] = [
  {
    name: 'FinancialJuice',
    url: 'https://www.financialjuice.com/home',
    extractPattern: /^.{15,300}$/,  // Headlines between 15-300 chars
    idPrefix: 'fj-web',
    source: 'FinancialJuice',
  },
  {
    name: 'DeItaOne',
    // DeItaOne primarily posts on X — scrape their aggregator/mirror site
    url: 'https://www.forexlive.com/news',
    extractPattern: /^.{15,300}$/,
    idPrefix: 'delta',
    source: 'DeItaOne',
  },
];

// ─── Firecrawl Scrape ───────────────────────────────────────────

interface FirecrawlScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: { title?: string; description?: string };
  };
}

async function scrapeSite(url: string): Promise<string | null> {
  if (!FIRECRAWL_API_KEY) {
    log.warn('FIRECRAWL_API_KEY not set — skipping web scrape');
    return null;
  }

  try {
    const res = await fetch(`${FIRECRAWL_BASE}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
        timeout: 15000,
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      log.warn(`Scrape failed for ${url}: ${res.status}`);
      return null;
    }

    const json = (await res.json()) as FirecrawlScrapeResult;
    return json.data?.markdown ?? null;
  } catch (err) {
    log.warn(`Scrape error for ${url}`, { error: String(err) });
    return null;
  }
}

// ─── Headline Extraction ────────────────────────────────────────

function extractHeadlines(markdown: string, source: CommentarySource): RawRiskFlowItem[] {
  const items: RawRiskFlowItem[] = [];
  const now = new Date().toISOString();

  // Extract lines that look like headlines from markdown
  // Headlines are typically: ## Title, **Title**, or plain bold lines
  const lines = markdown.split('\n');

  for (const line of lines) {
    // Strip markdown formatting
    let clean = line
      .replace(/^#{1,4}\s+/, '')     // ## Heading
      .replace(/\*\*/g, '')           // **bold**
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
      .replace(/^\s*[-*]\s+/, '')     // - bullet
      .trim();

    // Skip empty, too short, or too long
    if (!clean || clean.length < 15 || clean.length > 300) continue;

    // Skip navigation/UI text
    if (/^(home|about|contact|subscribe|sign|log|menu|search|share|comment)/i.test(clean)) continue;
    if (/^(advertisement|sponsored|newsletter|cookie)/i.test(clean)) continue;

    // Must contain at least one financial/market keyword to be relevant
    const hasMarketSignal = /\b(market|stock|bond|yield|rate|fed|gdp|cpi|inflation|earnings|trade|tariff|oil|gold|dollar|euro|china|treasury|recession|growth|employment|jobs|fomc|cut|hike|pmi|retail|housing|consumer|bank|credit|debt|deficit|surplus|import|export|sanctions?|iran|israel|nato|opec)\b/i.test(clean);

    if (!hasMarketSignal) continue;

    const id = `${source.idPrefix}-${hashString(clean)}`;
    if (submittedIds.has(id)) continue;

    items.push({
      tweet_id: id,
      source: source.source,
      headline: clean,
      body: undefined,
      symbols: extractSymbols(clean),
      tags: extractTags(clean),
      is_breaking: /\b(breaking|urgent|alert|flash)\b/i.test(clean),
      urgency: /\b(breaking|urgent)\b/i.test(clean) ? 'immediate' : 'normal',
      published_at: now,
      submitted_by: `commentary-scraper:${source.name}`,
    });
  }

  return items;
}

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
  // Match $TICKER or /ES style
  const tickerMatches = text.match(/\$[A-Z]{1,5}\b|\/[A-Z]{2,4}\b/g);
  if (tickerMatches) symbols.push(...tickerMatches);

  // Common implied symbols
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

// ─── Main Poll Cycle ────────────────────────────────────────────

async function pollCommentary(): Promise<void> {
  log.info('Starting commentary scrape cycle');
  let totalNew = 0;

  for (const source of SOURCES) {
    try {
      const markdown = await scrapeSite(source.url);
      if (!markdown) {
        log.warn(`No content from ${source.name}`);
        continue;
      }

      const items = extractHeadlines(markdown, source);
      if (items.length === 0) {
        log.info(`${source.name}: 0 new headlines`);
        continue;
      }

      // Write to raw_riskflow_items — central scorer picks them up
      const written = await writeRawItems(items);
      items.forEach((item) => submittedIds.add(item.tweet_id));
      totalNew += written;

      log.info(`${source.name}: ${written} new items ingested`);
    } catch (err) {
      log.warn(`${source.name} scrape failed`, { error: String(err) });
    }
  }

  log.info(`Commentary scrape complete: ${totalNew} new items total`);
}

// ─── Boot ───────────────────────────────────────────────────────

export function startCommentaryScraper(): void {
  if (!FIRECRAWL_API_KEY) {
    log.warn('FIRECRAWL_API_KEY not set — commentary scraper disabled');
    return;
  }

  log.info(`Commentary scraper starting (${SCRAPE_INTERVAL_MS / 60_000}min interval)`);

  // Initial scrape after 10s delay (let other services boot first)
  setTimeout(() => {
    pollCommentary().catch((err) =>
      log.warn('Initial commentary scrape failed', { error: String(err) })
    );
  }, 10_000);

  // Recurring scrape
  setInterval(() => {
    pollCommentary().catch((err) =>
      log.warn('Commentary scrape cycle failed', { error: String(err) })
    );
  }, SCRAPE_INTERVAL_MS);
}
