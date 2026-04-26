// [claude-code 2026-04-19] S27-T7 (W2d): browser-harness collector — wraps the
// W1c shared primitives (browseReadWithFallback) so the worker reuses the same
// self-healing pool and circuit breaker that backend-hono uses.

import { createHash } from "node:crypto";
import {
  browseReadWithFallback,
  hostname,
} from "../../../services/browser/index.js";
import type { CollectedNewsItem, NewsTier } from "./types.js";
import { scoreHeadline } from "../score.js";

interface CollectOpts {
  urls: string[];
  tier: NewsTier;
}

const HEADLINE_MAX = 200;
const BODY_MAX = 4_000;

function makeItemId(url: string, headline: string): string {
  return createHash("sha1")
    .update(`browser-harness::${url}::${headline}`)
    .digest("hex")
    .slice(0, 24);
}

function extractHeadlineFromBody(
  title: string | undefined,
  body: string,
): string {
  if (title && title.trim().length > 0) return title.slice(0, HEADLINE_MAX);
  const firstLine = body
    .split(/\n|\. /)
    .map((l) => l.trim())
    .find((l) => l.length > 15);
  return (firstLine ?? "untitled").slice(0, HEADLINE_MAX);
}

export async function collectFromBrowserHarness(
  opts: CollectOpts,
): Promise<CollectedNewsItem[]> {
  const out: CollectedNewsItem[] = [];
  for (const url of opts.urls) {
    const started = Date.now();
    const result = await browseReadWithFallback({ url, mode: "allowlist" });
    const fetch_latency_ms = Date.now() - started;
    if (!result) continue;
    const body = (result.body ?? "").slice(0, BODY_MAX);
    if (body.length < 40) continue;
    const headline = extractHeadlineFromBody(result.title, body);
    if (!scoreHeadline(headline)) continue;

    out.push({
      item_id: makeItemId(url, headline),
      source: "browser-harness",
      source_domain: hostname(url),
      headline,
      body,
      url,
      image_url: result.image_url ?? null,
      tier: opts.tier,
      published_at: result.rendered_at ?? new Date().toISOString(),
      fetched_at: new Date().toISOString(),
      fetch_latency_ms,
    });
  }
  return out;
}
