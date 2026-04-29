// [claude-code 2026-04-28] S48-T2: Treasury auction RSS scraper.
// Polls home.treasury.gov RSS for auction announcements and results.
// Post-filters for auction-related content only (Notes, Bonds, Bills,
// TIPS, FRNs, CMBs). RSS summary is sufficient — no HTML enrichment needed.

export const TREASURY_RSS_FEED =
  "https://home.treasury.gov/news/press-releases/feed";

const AUCTION_PATTERNS: RegExp[] = [
  /\bTreasury\s+Announces?\b/i,
  /\bTreasury\s+Auctions?\b/i,
  /\b(?:2|3|5|7|10|20|30)[- ]?Year\b/i,
  /\b(?:4|8|13|17|26|52)[- ]?Week\b/i,
  /\bTIPS\b/i,
  /\bFRN\b/i,
  /\bCMB\b/i,
  /\bCash\s+Management\s+Bill\b/i,
  /\bNotes?\s+Auction\b/i,
  /\bBonds?\s+Auction\b/i,
  /\bBills?\s+Auction\b/i,
  /\bAuction\s+Results?\b/i,
  /\bAuction\s+Announcement\b/i,
  /\b(?:Reopen|Re-open|Additional)\s+Auction\b/i,
];

export function isAuctionHeadline(headline: string): boolean {
  return AUCTION_PATTERNS.some((p) => p.test(headline));
}
