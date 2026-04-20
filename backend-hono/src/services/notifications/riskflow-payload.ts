// [claude-code 2026-04-20] Notifications dedup + header polish:
//   Title → "Fintheon · <Category>" (iOS shows this as the big header, drops redundant "from Fintheon").
//   Fingerprint → content-only (no 5-min bucket) so dedup window actually suppresses repeats.
// [claude-code 2026-04-19] S25: item-scoped URL (`/riskflow?item={id}`) so the mobile detail
//   modal can open the exact headline on notification tap. Image passthrough supports rich
//   push (hero media). Old SW versions ignore both gracefully.
// [claude-code 2026-04-18] B3: RiskFlow push payload polish + B1 fingerprint
/**
 * RiskFlow → push payload builder
 *
 * Produces iOS-friendly title/body/url/fingerprint from a scored FeedItem.
 * Title: "Fintheon · <Category>"   (e.g. "Fintheon · Geopolitical")
 * Body:  "<headline>"              (e.g. "Iran reopens Strait of Hormuz")
 * Fingerprint: riskflow:<hash(normalizedHeadline + instrument)>
 *   — content-only; the 30-min dedup window (emit.ts) is what blocks repeats.
 */

import type { FeedItem } from "../../types/riskflow.js";

function pickInstrument(item: FeedItem): string {
  const sym = item.symbols?.[0];
  return sym && sym.trim().length > 0 ? sym : "Market";
}

/**
 * Map the raw riskType/tags salad to one of three plain-English buckets that
 * TP asked to see on the lock screen: Econ, Geopolitical, Monetary Policy.
 * Falls back to "Market" when nothing fits.
 */
function pickCategoryLabel(item: FeedItem): string {
  const haystack = [
    item.riskType ?? "",
    ...(item.tags ?? []),
    item.headline ?? "",
  ]
    .join(" ")
    .toLowerCase();

  if (
    /\bfomc\b|\bfed\b|rate|dot\s*plot|powell|bessent|monetary|policy|hike|cut\b|dovish|hawkish/i.test(
      haystack,
    )
  ) {
    return "Monetary Policy";
  }
  if (
    /geopol|geopolitical|conflict|war|strait|hormuz|ceasefire|tariff|sanction|missile|invasion|hezbollah|iran|israel|ukraine|russia|china|taiwan|osint/i.test(
      haystack,
    )
  ) {
    return "Geopolitical";
  }
  if (
    /cpi|ppi|nfp|jobless|gdp|pce|ism|retail\s*sales|housing|econ|jolts|unemployment|payroll|inflation/i.test(
      haystack,
    )
  ) {
    return "Econ";
  }
  return "Market";
}

function normalizeHeadline(h: string): string {
  return (h || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 8)
    .join(" ");
}

/** Stable 32-bit hash for fingerprinting — not cryptographic, just collision-resistant for short text. */
function hash32(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

export interface RiskFlowPushPayload {
  title: string;
  body: string;
  url: string;
  fingerprint: string;
  eventId: string;
  itemId: string;
  image?: string;
}

export function buildRiskFlowPush(item: FeedItem): RiskFlowPushPayload {
  const instrument = pickInstrument(item);
  const category = pickCategoryLabel(item);
  const headline = (item.headline || "").trim();

  const title = `Fintheon · ${category}`;
  const body = headline;

  const normalized = normalizeHeadline(headline);
  const fingerprint = `riskflow:${hash32(`${normalized}|${instrument}`)}`;

  return {
    title,
    body,
    // [S25] Item-scoped deep link — SW maps this to DetailSheet modal open for the exact item.
    url: `/riskflow?item=${encodeURIComponent(item.id)}`,
    fingerprint,
    eventId: item.id,
    itemId: item.id,
  };
}
