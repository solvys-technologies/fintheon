// [claude-code 2026-04-24] S34-T7: Shared fiscal speaker scrape contract.

export type FiscalSpeaker = "Trump" | "Bessent" | "Powell" | "Fed";

export type FiscalSource =
  | "fed-rss"
  | "fed-html"
  | "treasury-rss"
  | "whitehouse-rss"
  | "truth-rss";

export interface ScrapedFiscalEvent {
  speaker: FiscalSpeaker;
  venue: string;
  date: string; // YYYY-MM-DD in America/New_York
  time: string; // HH:MM 24h ET; "00:00" when unknown
  detail: string; // source URL
  source: FiscalSource;
}

export interface ScrapeResult {
  events: ScrapedFiscalEvent[];
  fetched: number;
  errored: boolean;
}
