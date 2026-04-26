// [claude-code 2026-04-25] S40-P4: SEC EDGAR 8-K Atom feed poller. EDGAR
// updates within 1-2s of filing — we just keep the connection warm and watch
// for new <entry> elements appended to the feed.
//
// The eligibility scheduler arms one of these per known issuer ahead of an
// expected 8-K (M&A close, guidance update, etc). New entry → emit print.

import { runBurst } from "./burst-runner.js";
import type {
  AgencyReleaseDescriptor,
  BurstResult,
  PrintExtraction,
} from "./types.js";

export const EDGAR_RELEASES: Record<string, AgencyReleaseDescriptor> = {
  "edgar-8k": {
    agency: "edgar",
    eventKey: "edgar-8k",
    url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&output=atom",
    description: "EDGAR 8-K Atom feed",
  },
};

function edgarRelease(symbol?: string): AgencyReleaseDescriptor {
  if (!symbol) return EDGAR_RELEASES["edgar-8k"];
  return {
    agency: "edgar",
    eventKey: "edgar-8k",
    url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(
      symbol,
    )}&type=8-K&dateb=&owner=include&count=10&output=atom`,
    description: `EDGAR 8-K — ${symbol}`,
  };
}

function extract(
  html: string,
  release: AgencyReleaseDescriptor,
): PrintExtraction | null {
  // Atom feed — pull the first <entry><title>.
  const match = html.match(/<entry[\s\S]*?<title[^>]*>([^<]+)<\/title>/i);
  if (!match) return null;
  return {
    eventKey: release.eventKey,
    actual: null,
    forecast: null,
    previous: null,
    commentary: match[1].trim(),
  };
}

export async function armEDGARBurst(opts: {
  release?: AgencyReleaseDescriptor;
  symbol?: string;
  scheduledAt: Date;
}): Promise<BurstResult> {
  const release = opts.release ?? edgarRelease(opts.symbol);
  return runBurst({
    release,
    scheduledAt: opts.scheduledAt,
    extractor: extract,
    pollIntervalMs: 750,
  });
}

export { edgarRelease };
