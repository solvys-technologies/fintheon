// [claude-code 2026-04-26] S46.1: Universal publisher block-list applied at the
// raw-persist boundary (writeRawItems). Blocks mainstream-media noise
// regardless of which poller submitted the item — Twitter, RSS, Exa, browser.
//
// Per TP: "no Bloomberg, no Reuters, no Fox News, no MSNBC, no CNN, no CNBC"
// across the entire RiskFlow pipeline. Approved off-Internet sources are FRED,
// BLS, and Federal Reserve; Twitter ingest is governed by riskflow_source_accounts.
//
// Filter checks: URL host suffix, headline ILIKE, body ILIKE, submitted_by tag.
// NOTE per memory: scored_riskflow_items.source = ingest channel, not publisher.
// Filter on headline+body+url, never on the `source` column.

import type { RawRiskFlowItem } from "../supabase-service.js";

const BLOCKED_HOSTS = [
  "reuters.com",
  "bloomberg.com",
  "cnbc.com",
  "foxnews.com",
  "foxbusiness.com",
  "msnbc.com",
  "cnn.com",
  "edition.cnn.com",
  "money.cnn.com",
  "marketwatch.com",
  "ft.com",
  "wsj.com",
  "barrons.com",
  "nbcnews.com",
  "abcnews.go.com",
  "cbsnews.com",
  "usatoday.com",
  "businessinsider.com",
  "yahoo.com",
  "finance.yahoo.com",
  "seekingalpha.com",
  "zerohedge.com",
];

// Headline prefixes / inline-attribution patterns mainstream wire reposts use.
// Twitter relays often include "Reuters:", "BLOOMBERG —", "via @business" etc.
const BLOCKED_PATTERNS: RegExp[] = [
  /\b(reuters|bloomberg|cnbc|fox\s?news|fox\s?business|msnbc|cnn|marketwatch|wsj|wall\s+street\s+journal|financial\s+times|barron'?s|nbc\s+news|abc\s+news|cbs\s+news|usa\s+today|business\s+insider|seeking\s+alpha|zero\s+hedge)\b/i,
];

// Twitter handle relays for the blocked publishers (with or without @).
const BLOCKED_HANDLES = new Set(
  [
    "Reuters",
    "ReutersBiz",
    "ReutersWorld",
    "business", // @business is Bloomberg
    "markets", // @markets is Bloomberg
    "BloombergTV",
    "BloombergRadio",
    "BloombergPolitics",
    "CNBC",
    "CNBCnow",
    "SquawkCNBC",
    "FoxNews",
    "FoxBusiness",
    "MSNBC",
    "CNN",
    "CNNBusiness",
    "MarketWatch",
    "WSJ",
    "FT",
    "ft",
    "FinancialTimes",
    "Barronsonline",
    "NBCNews",
    "ABC",
    "ABCNews",
    "CBSNews",
    "USATODAY",
    "BusinessInsider",
    "YahooFinance",
    "SeekingAlpha",
    "zerohedge",
  ].map((h) => h.toLowerCase()),
);

function hostnameOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(host: string, blocked: string): boolean {
  return host === blocked || host.endsWith(`.${blocked}`);
}

export interface BlockReason {
  reason:
    | "blocked_host"
    | "blocked_pattern"
    | "blocked_handle"
    | "blocked_submitted_by";
  detail: string;
}

export function shouldBlockItem(item: RawRiskFlowItem): BlockReason | null {
  // 1. URL host check
  const host = hostnameOf(item.url);
  if (host) {
    for (const blocked of BLOCKED_HOSTS) {
      if (hostMatches(host, blocked)) {
        return { reason: "blocked_host", detail: blocked };
      }
    }
  }

  // 2. Twitter handle check via submitted_by (e.g. "rettiwt:CNBC", "agent-reach:rss:reuters")
  const submittedBy = (item.submitted_by ?? "").toLowerCase();
  for (const handle of BLOCKED_HANDLES) {
    if (
      submittedBy.includes(`:${handle}`) ||
      submittedBy.endsWith(`:${handle}`) ||
      submittedBy.includes(`:rss:${handle}`) ||
      submittedBy.includes(`:html:${handle}`) ||
      submittedBy === handle ||
      submittedBy === `@${handle}`
    ) {
      return { reason: "blocked_submitted_by", detail: handle };
    }
  }

  // 3. Headline + body pattern check (catches Twitter relays like "Reuters: ...")
  const haystack = `${item.headline ?? ""} ${item.body ?? ""}`;
  for (const re of BLOCKED_PATTERNS) {
    const match = re.exec(haystack);
    if (match) {
      return { reason: "blocked_pattern", detail: match[0] };
    }
  }

  return null;
}

export function filterBlockedPublishers<T extends RawRiskFlowItem>(
  items: T[],
): { kept: T[]; dropped: Array<{ item: T; reason: BlockReason }> } {
  const kept: T[] = [];
  const dropped: Array<{ item: T; reason: BlockReason }> = [];
  for (const item of items) {
    const reason = shouldBlockItem(item);
    if (reason) {
      dropped.push({ item, reason });
    } else {
      kept.push(item);
    }
  }
  return { kept, dropped };
}

export const BLOCKED_HOST_LIST = BLOCKED_HOSTS;
export const BLOCKED_HANDLE_LIST = Array.from(BLOCKED_HANDLES);
