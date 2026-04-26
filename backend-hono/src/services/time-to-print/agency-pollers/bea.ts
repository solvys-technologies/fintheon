// [claude-code 2026-04-25] S40-P4: BEA direct-page burst poller.
// Releases:
//   gdp              https://www.bea.gov/news/glance
//   pce              https://www.bea.gov/data/income-saving/personal-income
//   personal-income  https://www.bea.gov/data/income-saving/personal-income
//
// BEA pages are less regular than BLS — fall back to "first percent number
// in the keyword window" extraction, then refine per-release as we observe
// real prints.

import { runBurst } from "./burst-runner.js";
import type {
  AgencyReleaseDescriptor,
  BurstResult,
  PrintExtraction,
} from "./types.js";

export const BEA_RELEASES: Record<string, AgencyReleaseDescriptor> = {
  gdp: {
    agency: "bea",
    eventKey: "gdp",
    url: "https://www.bea.gov/news/glance",
    description: "Gross Domestic Product",
  },
  pce: {
    agency: "bea",
    eventKey: "pce",
    url: "https://www.bea.gov/data/income-saving/personal-income",
    description: "Personal Consumption Expenditures (PCE)",
  },
  "personal-income": {
    agency: "bea",
    eventKey: "personal-income",
    url: "https://www.bea.gov/data/income-saving/personal-income",
    description: "Personal Income",
  },
};

function extract(
  html: string,
  release: AgencyReleaseDescriptor,
): PrintExtraction | null {
  const keyword = release.eventKey.replace(/-/g, " ");
  const idx = html.toLowerCase().indexOf(keyword);
  if (idx < 0) return null;
  const window = html.slice(idx, idx + 400);
  const match = window.match(
    /(increased|decreased|rose|fell|grew)\s+([\d.]+)\s*percent/i,
  );
  if (!match) return null;
  const dir = match[1].toLowerCase();
  const num = parseFloat(match[2]);
  const signed = dir === "decreased" || dir === "fell" ? -num : num;
  return {
    eventKey: release.eventKey,
    actual: signed,
    forecast: null,
    previous: null,
    commentary: window.slice(0, 160),
  };
}

export async function armBEABurst(opts: {
  release: AgencyReleaseDescriptor;
  scheduledAt: Date;
}): Promise<BurstResult> {
  return runBurst({
    release: opts.release,
    scheduledAt: opts.scheduledAt,
    extractor: extract,
  });
}
