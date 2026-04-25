// [claude-code 2026-04-19] S27-T7 (W2d): Exa collector — thin wrapper around
// existing exa-service. Graceful when EXA_API_KEY is missing (returns []).

import { createHash } from "node:crypto";
import { exaSearch, isExaAvailable } from "../../../services/exa-service.js";
import type { CollectedNewsItem, NewsTier } from "./types.js";
import { scoreHeadline } from "../score.js";

interface CollectOpts {
  query: string;
  tier: NewsTier;
  numResults?: number;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function makeItemId(url: string, title: string): string {
  return createHash("sha1")
    .update(`exa::${url}::${title}`)
    .digest("hex")
    .slice(0, 24);
}

export async function collectFromExa(
  opts: CollectOpts,
): Promise<CollectedNewsItem[]> {
  if (!isExaAvailable()) return [];
  const started = Date.now();
  const results = await exaSearch(opts.query, {
    numResults: opts.numResults ?? 10,
    type: "auto",
  });
  const fetch_latency_ms = Date.now() - started;

  const out: CollectedNewsItem[] = [];
  for (const r of results) {
    if (!r.url || !r.title) continue;
    if (!scoreHeadline(r.title)) continue;
    out.push({
      item_id: makeItemId(r.url, r.title),
      source: "exa",
      source_domain: hostnameOf(r.url),
      headline: r.title,
      body: r.text ?? "",
      url: r.url,
      image_url: null,
      tier: opts.tier,
      published_at: r.publishedDate ?? new Date().toISOString(),
      fetched_at: new Date().toISOString(),
      fetch_latency_ms,
    });
  }
  return out;
}
