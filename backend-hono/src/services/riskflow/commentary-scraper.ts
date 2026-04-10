// [claude-code 2026-04-07] Fix: Hash on headline only (not publishedBucket) to prevent duplicate IDs
// [claude-code 2026-04-04] Exa-powered catalyst scraper + Twitter bookmark poller
// Exa: neural search for wire coverage, POI statements, OSINT, Mag7, liquidity
// Bookmarks: keyword-matched against active Narrative threads → only signal, no noise
// Feeds raw catalysts into raw_riskflow_items on a 30/60-min interval.

import { writeRawItems, type RawRiskFlowItem } from "../supabase-service.js";
import {
  exaSearch,
  isExaAvailable,
  type ExaSearchResult,
} from "../exa-service.js";
import {
  fetchBookmarks,
  isTwitterCliInstalled,
} from "../twitter-cli/twitter-cli-service.js";
import { createLogger } from "../../lib/logger.js";
import { getPollingConfig } from "./polling-config.js";

const log = createLogger("CommentaryScraper");

const HOT_INTERVAL_MS = 30 * 60_000;
const OFF_PEAK_INTERVAL_MS = 60 * 60_000;

const submittedIds = new Set<string>();
let scraperTimeout: ReturnType<typeof setTimeout> | null = null;

// ─── Narrative Keywords ────────────────────────────────────────
// Bookmarked tweets must match at least one active Narrative thread
// to be ingested as a Catalyst. This filters noise from signal.

const NARRATIVE_KEYWORDS: Record<string, RegExp> = {
  "middle-east-conflict":
    /\b(iran|israel|irgc|houthi|hezbollah|hamas|gaza|lebanon|netanyahu|araghchi|khamenei|hormuz|strait|missile|ceasefire|idf)\b/i,
  "liquidity-credit-contraction":
    /\b(liquidity|credit (crunch|contraction|spread)|repo|reverse repo|TGA|treasury general|RRP|QT|quantitative tight|bank (run|stress|fail)|svb|deposit flight|btfp|credit (tight|crack)|private credit|redemption gate|withdrawal limit|fund gate)\b/i,
  "ai-singularity":
    /\b(nvidia|nvda|openai|anthropic|deepmind|google ai|microsoft ai|meta ai|apple intelligence|mag.?7|magnificent|artificial intelligence|AGI|GPU|H100|H200|blackwell|data center|AI capex|AI spend)\b/i,
  "usd-jpy-carry-trade":
    /\b(usd.?jpy|carry trade|yen|boj|bank of japan|japan rate|intervention|ueda)\b/i,
  "trade-war":
    /\b(tariff|trade war|import duty|reciprocal tariff|liberation day|customs|duties|retaliatory|section 301|trade deficit)\b/i,
  "us-china-relations":
    /\b(us.?china|china.*sanction|china.*tariff|taiwan|xi jinping|chip ban|export control|tiktok ban|fentanyl|rare earth|china.*retaliat)\b/i,
  "rate-cut-cycle":
    /\b(rate cut|fed cut|fomc|fed funds|powell|dot plot|terminal rate|neutral rate|easing cycle|pivot)\b/i,
  "trump-presidency":
    /\b(trump|executive order|white house|truth social|maga|bessent|doge|elon.*gov|vivek)\b/i,
  "price-stability":
    /\b(cpi|ppi|pce|inflation|deflation|disinflation|core price|shelter cost|sticky inflation|supercore)\b/i,
  "maximum-employment":
    /\b(nfp|payroll|unemployment|jobless claim|jolts|hiring|layoff|ADP|labor market|wage growth|quit rate)\b/i,
};

function matchesNarrative(text: string): string | null {
  for (const [slug, regex] of Object.entries(NARRATIVE_KEYWORDS)) {
    if (regex.test(text)) return slug;
  }
  return null;
}

// ─── Exa Search Groups ─────────────────────────────────────────

interface SearchGroup {
  name: string;
  query: string;
  source: string;
  idPrefix: string;
  numResults: number;
  includeDomains?: string[];
}

const SEARCH_GROUPS: SearchGroup[] = [
  // ── Financial Wire Coverage ───────────────────────────────────
  {
    name: "FJ-Wire",
    query:
      "breaking market news Fed rate decision economic data CPI NFP earnings guidance tariff",
    source: "FinancialJuice",
    idPrefix: "exa-fj",
    numResults: 12,
    includeDomains: [
      "financialjuice.com",
      "features.financialjuice.com",
      "zerohedge.com",
      "reuters.com",
      "bloomberg.com",
    ],
  },

  // ── Iranian Officials — Market-Moving Statements ──────────────
  {
    name: "Iran-POI",
    query:
      'Araghchi OR Khamenei OR Pezeshkian OR "Hossein Salami" OR "Kamal Kharrazi" OR Shamkhani OR IRGC OR "Iran foreign minister" OR "Iran UN mission" statement nuclear sanctions retaliation enrichment Hormuz',
    source: "OSINTSources",
    idPrefix: "exa-iran",
    numResults: 10,
  },

  // ── Broader OSINT / Geopolitical ──────────────────────────────
  {
    name: "OSINT-Geopolitical",
    query:
      "breaking geopolitical military strike missile Iran Israel Houthi Hezbollah conflict ceasefire IRGC sanctions Yemen Lebanon",
    source: "OSINTSources",
    idPrefix: "exa-osint",
    numResults: 10,
  },

  // ── Key Government / Central Bank Statements ──────────────────
  {
    name: "GOV-POI",
    query:
      '"Federal Reserve" statement OR "Treasury Secretary Bessent" OR "White House" economic OR ECB rate OR "Bank of Japan" OR Netanyahu OR tariff announcement',
    source: "OSINTSources",
    idPrefix: "exa-gov",
    numResults: 8,
  },

  // ── Mag7 / AI Singularity Signal ──────────────────────────────
  {
    name: "Mag7-AI",
    query:
      'NVIDIA earnings OR Apple AI OR Microsoft Azure AI OR Google Gemini OR Meta AI OR Amazon AWS AI OR Tesla autopilot OR "data center" capex OR GPU shortage OR AI spending',
    source: "FinancialJuice",
    idPrefix: "exa-mag7",
    numResults: 8,
  },

  // ── Liquidity & Credit Stress ─────────────────────────────────
  {
    name: "Liquidity-Credit",
    query:
      "private credit redemption gate withdrawal limit OR liquidity crisis OR credit spread widening OR repo rate spike OR reverse repo OR TGA drawdown OR bank stress OR deposit flight OR Treasury auction OR quantitative tightening",
    source: "FinancialJuice",
    idPrefix: "exa-liq",
    numResults: 8,
  },

  // ── Macro / Fed Watcher Coverage ──────────────────────────────
  {
    name: "Macro-Watchers",
    query:
      '"Nick Timiraos" OR "WSJ Fed" OR "FOMC minutes" OR "rate cut" OR "rate hold" OR "inflation outlook" OR "Powell press conference"',
    source: "FinancialJuice",
    idPrefix: "exa-macro",
    numResults: 8,
  },
];

// ─── Helpers ────────────────────────────────────────────────────

function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function extractSymbols(text: string): string[] {
  const symbols: string[] = [];
  const tickerMatches = text.match(/\$[A-Z]{1,5}\b|\/[A-Z]{2,4}\b/g);
  if (tickerMatches) symbols.push(...tickerMatches);

  if (/\b(s&p|spx|spy)\b/i.test(text)) symbols.push("/ES");
  if (/\b(nasdaq|qqq|nq)\b/i.test(text)) symbols.push("/NQ");
  if (/\b(treasury|10.?year|tnx)\b/i.test(text)) symbols.push("/ZN");
  if (/\b(crude|oil|wti|cl)\b/i.test(text)) symbols.push("/CL");
  if (/\b(gold|xau)\b/i.test(text)) symbols.push("/GC");
  if (/\b(dollar|dxy|usd)\b/i.test(text)) symbols.push("DXY");

  return [...new Set(symbols)];
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  if (/\b(fed|fomc|powell|rate)\b/i.test(text)) tags.push("FED");
  if (/\b(cpi|ppi|inflation|prices)\b/i.test(text)) tags.push("INFLATION");
  if (/\b(jobs|nfp|employment|unemployment|claims)\b/i.test(text))
    tags.push("EMPLOYMENT");
  if (/\b(gdp|growth|recession)\b/i.test(text)) tags.push("GDP");
  if (/\b(tariff|trade war|china|import|export)\b/i.test(text))
    tags.push("TRADE");
  if (
    /\b(iran|israel|irgc|houthi|hezbollah|military|missile|strike|araghchi|khamenei)\b/i.test(
      text,
    )
  )
    tags.push("GEOPOLITICAL");
  if (/\b(trump|bessent|yellen|treasury sec)\b/i.test(text))
    tags.push("POLITICS");
  if (/\b(oil|opec|crude|energy|hormuz)\b/i.test(text)) tags.push("ENERGY");
  if (/\b(earnings|revenue|eps|guidance)\b/i.test(text)) tags.push("EARNINGS");
  if (/\b(breaking|urgent|alert)\b/i.test(text)) tags.push("BREAKING");
  if (/\b(nuclear|enrichment|uranium|iaea)\b/i.test(text)) tags.push("NUCLEAR");
  if (
    /\b(nvidia|nvda|meta|msft|aapl|goog|amzn|tsla|mag.?7|magnificent)\b/i.test(
      text,
    )
  )
    tags.push("MAG7");
  if (
    /\b(liquidity|credit spread|repo|TGA|QT|bank stress|private credit|redemption|withdrawal)\b/i.test(
      text,
    )
  )
    tags.push("LIQUIDITY");
  return [...new Set(tags)];
}

// ─── Exa Result → RawRiskFlowItem ──────────────────────────────

function exaToRawItem(
  result: ExaSearchResult,
  group: SearchGroup,
): RawRiskFlowItem | null {
  const title = result.title?.trim();
  if (!title || title.length < 15 || title.length > 500) return null;
  if (/^(home|about|contact|subscribe|sign in|log in|menu|cookie)/i.test(title))
    return null;

  // [claude-code 2026-04-07] FIX: Hash on headline ONLY — not publishedBucket.
  // The old approach created different IDs for the same article when Exa returned
  // slightly different publishedDate values across scrape cycles, causing duplicates.
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const id = `${group.idPrefix}-${hashString(normalizedTitle)}`;
  if (submittedIds.has(id)) return null;

  const fullText = `${title} ${result.text}`;
  const rawText = (result.text || "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const sentences = rawText.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  const summary = sentences.slice(0, 3).join(" ").slice(0, 300);

  return {
    tweet_id: id,
    source: group.source,
    headline: title,
    body: summary || undefined,
    url: result.url || undefined,
    symbols: extractSymbols(fullText),
    tags: extractTags(fullText),
    is_breaking: /\b(breaking|urgent|alert|flash)\b/i.test(fullText),
    urgency: /\b(breaking|urgent)\b/i.test(fullText) ? "immediate" : "normal",
    published_at: result.publishedDate ?? new Date().toISOString(),
    submitted_by: `commentary-scraper:${group.name}`,
  };
}

// ─── Bookmark Polling ──────────────────────────────────────────
// Fetches bookmarks from the authenticated X account, matches each
// against active Narrative keyword sets, and ingests only matches.

async function pollBookmarks(): Promise<number> {
  const hasTwitter = await isTwitterCliInstalled();
  if (!hasTwitter) {
    log.info("Twitter CLI not available — skipping bookmark poll");
    return 0;
  }

  const tweets = await fetchBookmarks({ limit: 30 });
  if (tweets.length === 0) {
    log.info("Bookmarks: 0 tweets fetched");
    return 0;
  }

  const items: RawRiskFlowItem[] = [];

  for (const tweet of tweets) {
    const id = `bkmk-${tweet.id}`;
    if (submittedIds.has(id)) continue;

    const text = `${tweet.text}`;
    const narrative = matchesNarrative(text);
    if (!narrative) continue;

    items.push({
      tweet_id: id,
      source: "TwitterCli",
      headline: tweet.text.slice(0, 280),
      body: tweet.text.length > 280 ? tweet.text.slice(280, 800) : undefined,
      url: `https://x.com/${tweet.author}/status/${tweet.id}`,
      symbols: extractSymbols(text),
      tags: [...extractTags(text), `narrative:${narrative}`],
      is_breaking: /\b(breaking|urgent|alert)\b/i.test(text),
      urgency: /\b(breaking|urgent)\b/i.test(text) ? "immediate" : "normal",
      published_at: tweet.publishedAt,
      submitted_by: `commentary-scraper:Bookmarks`,
    });
  }

  if (items.length === 0) {
    log.info(
      `Bookmarks: ${tweets.length} fetched, 0 matched active narratives`,
    );
    return 0;
  }

  const written = await writeRawItems(items);
  for (const item of items) submittedIds.add(item.tweet_id);
  log.info(
    `Bookmarks: ${written} catalysts ingested from ${tweets.length} bookmarks`,
  );
  return written;
}

// ─── Main Poll Cycle ────────────────────────────────────────────

export async function pollCommentary(): Promise<void> {
  log.info("Starting Exa + Bookmark catalyst scrape cycle");
  let totalNew = 0;

  // Phase 1: Exa neural search
  if (isExaAvailable()) {
    for (const group of SEARCH_GROUPS) {
      try {
        const results = await exaSearch(group.query, {
          numResults: group.numResults,
          type: "neural",
          useAutoprompt: true,
          includeDomains: group.includeDomains,
        });

        if (results.length === 0) {
          log.info(`${group.name}: 0 Exa results`);
          continue;
        }

        const items: RawRiskFlowItem[] = [];
        for (const result of results) {
          const item = exaToRawItem(result, group);
          if (item) items.push(item);
        }

        if (items.length === 0) {
          log.info(`${group.name}: 0 new catalysts after filtering`);
          continue;
        }

        const written = await writeRawItems(items);
        for (const item of items) submittedIds.add(item.tweet_id);
        totalNew += written;

        log.info(`${group.name}: ${written} catalysts ingested via Exa`);
      } catch (err) {
        log.warn(`${group.name} Exa scrape failed`, { error: String(err) });
      }
    }
  } else {
    log.warn("EXA_API_KEY not set — Exa scrape skipped");
  }

  // Phase 2: Bookmark polling (narrative-keyword gated)
  try {
    const bookmarkCount = await pollBookmarks();
    totalNew += bookmarkCount;
  } catch (err) {
    log.warn("Bookmark poll failed", { error: String(err) });
  }

  log.info(`Catalyst scrape complete: ${totalNew} new catalysts total`);
}

// ─── Boot ───────────────────────────────────────────────────────

export function startCommentaryScraper(): void {
  if (!isExaAvailable()) {
    log.warn(
      "EXA_API_KEY not set — Exa scrape disabled, bookmark polling may still work",
    );
  }

  if (scraperTimeout) return;
  log.info("Commentary scraper starting (Exa + Bookmark polling)");

  const scheduledPoll = async (): Promise<void> => {
    try {
      await pollCommentary();
    } catch (err) {
      log.warn("Catalyst scrape cycle failed", { error: String(err) });
    }

    const { isHotHours } = getPollingConfig();
    const interval = isHotHours ? HOT_INTERVAL_MS : OFF_PEAK_INTERVAL_MS;
    log.info(
      `Next catalyst scrape in ${Math.round(interval / 60_000)}m (hotHours=${isHotHours})`,
    );
    scraperTimeout = setTimeout(scheduledPoll, interval);
  };

  setTimeout(() => void scheduledPoll(), 15_000);
}

export function stopCommentaryScraper(): void {
  if (!scraperTimeout) return;
  clearTimeout(scraperTimeout);
  scraperTimeout = null;
  log.info("Commentary scraper stopped");
}
