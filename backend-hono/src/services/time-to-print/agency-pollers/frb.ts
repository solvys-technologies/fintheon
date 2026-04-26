// [claude-code 2026-04-25] S40-P4: Federal Reserve Board press-release index
// poller. Watches the FOMC press release page and surfaces the new-statement
// link as the print signal.
//
// FOMC statements are the canonical macro tape-bomb event. Extraction here
// returns the first sentence as commentary; downstream the boardroom + Harper
// CAO chat synthesize the full read.

import { runBurst } from "./burst-runner.js";
import type {
  AgencyReleaseDescriptor,
  BurstResult,
  PrintExtraction,
} from "./types.js";

export const FRB_RELEASES: Record<string, AgencyReleaseDescriptor> = {
  fomc: {
    agency: "frb",
    eventKey: "fomc",
    url: "https://www.federalreserve.gov/newsevents/pressreleases.htm",
    description: "FOMC press release index",
  },
};

function extract(
  html: string,
  release: AgencyReleaseDescriptor,
): PrintExtraction | null {
  // FOMC statements link out — match the first /monetary/<date>a.htm link.
  const linkMatch = html.match(
    /href="(\/monetary\/\d{8}a\.htm)"[^>]*>([^<]+)</i,
  );
  if (!linkMatch) return null;
  const summary = linkMatch[2].trim();
  return {
    eventKey: release.eventKey,
    actual: null,
    forecast: null,
    previous: null,
    commentary: summary,
  };
}

export async function armFRBBurst(opts: {
  release: AgencyReleaseDescriptor;
  scheduledAt: Date;
}): Promise<BurstResult> {
  return runBurst({
    release: opts.release,
    scheduledAt: opts.scheduledAt,
    extractor: extract,
  });
}
