// [claude-code 2026-04-26] Exa now constrained to the gov + bank-research
// allowlist (`ALLOWED_WEB_DOMAINS_LIST`). Mainstream media is blocked at the
// search layer and again at persist via `isAllowedWebDomain`. Per TP, the
// only acceptable web sources are .gov + bank research desks; everything
// else flows through TP-designated Twitter handles.
// [claude-code 2026-04-19] S27-T7 (W2d): Exa collector — thin wrapper around
// existing exa-service. Graceful when EXA_API_KEY is missing (returns []).

import { createHash } from "node:crypto";
import { exaSearch, isExaAvailable } from "../../../services/exa-service.js";
import type { CollectedNewsItem, NewsTier } from "./types.js";
import { scoreHeadline } from "../score.js";
import {
  ALLOWED_WEB_DOMAINS_LIST,
  isAllowedWebDomain,
} from "./web-allowlist.js";

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
    includeDomains: ALLOWED_WEB_DOMAINS_LIST,
  });
  const fetch_latency_ms = Date.now() - started;

  const out: CollectedNewsItem[] = [];
  for (const r of results) {
    if (!r.url || !r.title) continue;
    if (!scoreHeadline(r.title)) continue;
    // Defense in depth — Exa occasionally returns rehosts/redirects whose
    // final URL slips outside includeDomains. Drop anything off-allowlist.
    if (!isAllowedWebDomain(hostnameOf(r.url))) continue;
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
