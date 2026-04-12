// [claude-code 2026-04-11] Rettiwt poller transform: tweet→FeedItem, symbol/tag extraction, FJ filter, dedup, Supabase push

import {
  filterByTier,
  extractFJEmojiFromText,
  fjTierFromEmoji,
  type FJClassification,
} from "./fj-emoji-filter.js";
import { getMatchedKeywords } from "../headline-parser.js";
import { assignMacroLevel } from "../../utils/assign-macro-level.js";
import { writeConsiliumMessage } from "../supabase-service.js";
import type { FeedItem, NewsSource, RiskType } from "../../types/riskflow.js";
import { checkContentGuard } from "./content-guard.js";

// In-memory dedup — don't re-post same item to Supabase across polls
const postedIds = new Set<string>();

export function shouldPushToConsilium(macroLevel: number | undefined): boolean {
  return (macroLevel ?? 1) >= 3;
}

/** Push Critical/High FeedItems to Supabase consilium_messages (fire-and-forget, deduplicated) */
export async function pushToSupabase(items: FeedItem[]): Promise<void> {
  const newItems = items.filter(
    (item) => shouldPushToConsilium(item.macroLevel) && !postedIds.has(item.id),
  );
  if (newItems.length === 0) return;

  for (const item of newItems) {
    postedIds.add(item.id);
    const tier = item.macroLevel === 4 ? "Critical" : "High";

    writeConsiliumMessage({
      agent_name: "EconRettiwtPoller",
      agent_role: "econ-monitor",
      content: `[${tier}] ${item.headline}`,
      message_type: `RiskFlow-${tier}`,
      metadata: { source: item.source, tweetId: item.id },
    }).catch((err) =>
      console.warn("[EconRettiwtPoller] Supabase push failed:", err),
    );
  }

  console.log(
    `[EconRettiwtPoller] Pushed ${newItems.length} items to Supabase consilium`,
  );
}

// ── FeedItem Conversion ────────────────────────────────────────────────────

export function tweetToFeedItem(
  tweet: { id: string; text: string; author: string; publishedAt: string },
  fjClassification: FJClassification,
): FeedItem {
  const authorLower = tweet.author.toLowerCase();
  const source: NewsSource =
    authorLower === "financialjuice"
      ? "FinancialJuice"
      : authorLower === "osintdefender"
        ? "OSINTSources"
        : authorLower === "deitaone"
          ? "DeItaOne"
          : "TwitterCli";

  const keywordMatches = getMatchedKeywords(tweet.text);
  const riskType = inferRiskTypeFromTweet(tweet.text);
  const fjEmojiTier = fjTierFromEmoji(extractFJEmojiFromText(tweet.text));
  const normalizedIvFromTier: Record<1 | 2 | 3 | 4, number> = {
    1: 0,
    2: 40,
    3: 70,
    4: 90,
  };
  const urgencySignals =
    (fjClassification.urgency !== "normal" ? 1 : 0) +
    (fjClassification.macroLevel >= 3 ? 1 : 0) +
    (keywordMatches.length > 0 ? 1 : 0);
  const macroLevel = assignMacroLevel({
    ivScore: normalizedIvFromTier[fjClassification.macroLevel],
    fjEmojiTier,
    riskType,
    keywordMatches,
    urgencySignals,
  });

  return {
    id: `rt-${tweet.id}`,
    source,
    headline: tweet.text,
    symbols: extractSymbolsFromText(tweet.text),
    tags: extractTagsFromText(tweet.text),
    isBreaking: fjClassification.urgency === "immediate",
    urgency: fjClassification.urgency,
    macroLevel,
    publishedAt: tweet.publishedAt,
  };
}

export function inferRiskTypeFromTweet(text: string): RiskType {
  const lower = text.toLowerCase();
  if (
    /(fed|fomc|cpi|ppi|gdp|nfp|pce|inflation|jobless|retail sales|housing starts|consumer confidence|treasury)/.test(
      lower,
    )
  )
    return "Macro";
  if (
    /(war|tariff|sanction|military|conflict|opec|nato|invasion|missile|nuclear|strait of hormuz|proxy attack)/.test(
      lower,
    )
  )
    return "Geopolitical";
  if (
    /(earnings|eps|revenue|guidance|beat|miss|quarterly|aapl|nvda|msft|amzn|goog|meta|tsla)/.test(
      lower,
    )
  )
    return "Earnings";
  if (
    /(resistance|support|breakout|volume|rsi|macd|moving average|trend)/.test(
      lower,
    )
  )
    return "Technical";
  if (
    /(credit spread|high yield|leverage|default|downgrade|junk bond)/.test(
      lower,
    )
  )
    return "Credit";
  if (
    /(repo|funding|liquidity|bank run|cash crunch|reserve|circuit breaker|flash crash)/.test(
      lower,
    )
  )
    return "Liquidity";
  return "Commentary";
}

export function extractSymbolsFromText(text: string): string[] {
  const cashtags =
    text.match(/\$[A-Z]{1,5}\b/g)?.map((s) => s.replace("$", "")) ?? [];
  const known = [
    "SPY",
    "QQQ",
    "ES",
    "NQ",
    "TLT",
    "DXY",
    "VIX",
    "CL",
    "GC",
    "BTC",
  ];
  const inferred = known.filter((t) =>
    new RegExp(`\\b${t}\\b`).test(text.toUpperCase()),
  );
  return [...new Set([...cashtags, ...inferred])];
}

export function extractTagsFromText(text: string): string[] {
  const tags: string[] = [];
  const upper = text.toUpperCase();
  if (upper.includes("CPI") || upper.includes("INFLATION"))
    tags.push("CPI", "INFLATION");
  if (upper.includes("NFP") || upper.includes("PAYROLL"))
    tags.push("NFP", "JOBS");
  if (
    upper.includes("FOMC") ||
    upper.includes("FED") ||
    upper.includes("POWELL")
  )
    tags.push("FED", "FOMC");
  if (upper.includes("GDP")) tags.push("GDP");
  if (upper.includes("PPI")) tags.push("PPI");
  if (upper.includes("PMI")) tags.push("PMI");
  if (upper.includes("RETAIL SALES")) tags.push("RETAIL");
  if (upper.includes("JOBLESS") || upper.includes("CLAIMS"))
    tags.push("JOBLESS");
  return tags;
}

/** Dedupe tweets by id, apply FJ tier filter, convert to FeedItem[] */
export function processTweetBatch(
  tweets: Array<{
    id: string;
    text: string;
    author: string;
    publishedAt: string;
  }>,
): { feedItems: FeedItem[]; uniqueTweets: typeof tweets } {
  const seenIds = new Set<string>();
  const uniqueTweets = tweets.filter((t) => {
    if (seenIds.has(t.id)) return false;
    seenIds.add(t.id);
    return true;
  });

  // Content guard — block slurs, MAGA spam, drunk text, @ mentions before scoring
  const guardedTweets = uniqueTweets.filter(
    (t) => !checkContentGuard(t.text).blocked,
  );

  const classified = filterByTier(guardedTweets, "medium");
  const feedItems = classified.map((t) =>
    tweetToFeedItem(t, t.fjClassification),
  );

  return { feedItems, uniqueTweets };
}

export { filterByTier };
