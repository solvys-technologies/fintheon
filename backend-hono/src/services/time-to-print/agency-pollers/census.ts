// [claude-code 2026-04-25] S40-P4: Census Bureau direct-page burst poller.
//   retail-sales    https://www.census.gov/retail/marts/www/marts_current.html
//   housing-starts  https://www.census.gov/construction/nrc/index.html
//   durable-goods   https://www.census.gov/manufacturing/m3/index.html

import { runBurst } from "./burst-runner.js";
import type {
  AgencyReleaseDescriptor,
  BurstResult,
  PrintExtraction,
} from "./types.js";

export const CENSUS_RELEASES: Record<string, AgencyReleaseDescriptor> = {
  "retail-sales": {
    agency: "census",
    eventKey: "retail-sales",
    url: "https://www.census.gov/retail/marts/www/marts_current.html",
    description: "Advance Monthly Retail Trade",
  },
  "housing-starts": {
    agency: "census",
    eventKey: "housing-starts",
    url: "https://www.census.gov/construction/nrc/index.html",
    description: "New Residential Construction",
  },
  "durable-goods": {
    agency: "census",
    eventKey: "durable-goods",
    url: "https://www.census.gov/manufacturing/m3/index.html",
    description: "Manufacturers' Shipments, Inventories, and Orders",
  },
};

function extract(
  html: string,
  release: AgencyReleaseDescriptor,
): PrintExtraction | null {
  // Census release language: "increased N.N percent" or "decreased N.N percent"
  const match = html.match(
    /(increased|decreased|rose|fell|virtually unchanged)[^.]{0,120}?([\d.]+)\s*percent/i,
  );
  if (!match) return null;
  const dir = match[1].toLowerCase();
  const num = parseFloat(match[2] ?? "0");
  const signed = dir === "decreased" || dir === "fell" ? -num : num;
  return {
    eventKey: release.eventKey,
    actual: signed,
    forecast: null,
    previous: null,
    commentary: match[0],
  };
}

export async function armCensusBurst(opts: {
  release: AgencyReleaseDescriptor;
  scheduledAt: Date;
}): Promise<BurstResult> {
  return runBurst({
    release: opts.release,
    scheduledAt: opts.scheduledAt,
    extractor: extract,
  });
}
