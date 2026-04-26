// [claude-code 2026-04-25] S40-P4: TreasuryDirect Offering Announcements RSS
// poller. Watches for new auction announcements (notes, bonds, bills) — these
// move the curve fast and feed the Liquidity sector.

import { runBurst } from "./burst-runner.js";
import type {
  AgencyReleaseDescriptor,
  BurstResult,
  PrintExtraction,
} from "./types.js";

export const TREASURY_RELEASES: Record<string, AgencyReleaseDescriptor> = {
  "treasury-offering": {
    agency: "treasury",
    eventKey: "treasury-offering",
    url: "https://www.treasurydirect.gov/TA_WS/securities/announced/rss",
    description: "TreasuryDirect Offering Announcements RSS",
  },
};

function extract(
  html: string,
  release: AgencyReleaseDescriptor,
): PrintExtraction | null {
  // RSS — first <item><title>.
  const match = html.match(/<item[\s\S]*?<title[^>]*>([^<]+)<\/title>/i);
  if (!match) return null;
  return {
    eventKey: release.eventKey,
    actual: null,
    forecast: null,
    previous: null,
    commentary: match[1].trim(),
  };
}

export async function armTreasuryBurst(opts: {
  release: AgencyReleaseDescriptor;
  scheduledAt: Date;
}): Promise<BurstResult> {
  return runBurst({
    release: opts.release,
    scheduledAt: opts.scheduledAt,
    extractor: extract,
    pollIntervalMs: 1_000,
  });
}
