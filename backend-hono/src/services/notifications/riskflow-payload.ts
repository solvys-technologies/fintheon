// [claude-code 2026-04-19] Plain-language catalyst push per TP — title "Catalyst · <Category>",
//   body is the headline. Categories collapse to 3 buckets: Econ / Geopolitical / Monetary Policy
//   (fallback "Market"). No more technical tags like "/ES · FOMC Minutes" on lock screen.
// [claude-code 2026-04-18] B3: RiskFlow push payload polish + B1 fingerprint
/**
 * RiskFlow → push payload builder
 *
 * Produces iOS-friendly title/body/url/fingerprint from a scored FeedItem.
 * Title: "Catalyst · <Category>"   (e.g. "Catalyst · Geopolitical")
 * Body:  "<headline>"              (e.g. "Iran reopens Strait of Hormuz")
 * Fingerprint: riskflow:<hash(normalizedHeadline + instrument)>:<floor(now/5min)>
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
}

export function buildRiskFlowPush(item: FeedItem): RiskFlowPushPayload {
  const instrument = pickInstrument(item);
  const category = pickCategoryLabel(item);
  const headline = (item.headline || "").trim();

  const title = `Catalyst · ${category}`;
  const body = headline;

  const normalized = normalizeHeadline(headline);
  const bucket = Math.floor(Date.now() / (5 * 60_000));
  const fingerprint = `riskflow:${hash32(`${normalized}|${instrument}`)}:${bucket}`;

  return {
    title,
    body,
    url: "/riskflow",
    fingerprint,
    eventId: item.id,
  };
}
