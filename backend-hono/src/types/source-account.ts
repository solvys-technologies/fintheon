// [claude-code 2026-04-29] Rettiwt stripped from source-account methods; X
// sources are browser/browser-harness controlled.
// [claude-code 2026-04-28] S47-T1: Added method field; removed General category.
// Source account type — curated X accounts for timeline polling + official RSS feeds.

export const SOURCE_ACCOUNT_CATEGORIES = [
  "Wire",
  "OSINT",
  "Geopolitical",
  "Macro",
  "Commentary",
  "Custom",
  "Official",
] as const;

export type SourceAccountCategory = (typeof SOURCE_ACCOUNT_CATEGORIES)[number];

export const SOURCE_ACCOUNT_METHODS = ["rss", "browser", "api"] as const;

export type SourceAccountMethod = (typeof SOURCE_ACCOUNT_METHODS)[number];

export interface SourceAccount {
  id: string;
  handle: string;
  display_name: string | null;
  category: SourceAccountCategory;
  method: SourceAccountMethod;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_SOURCE_ACCOUNTS: Omit<
  SourceAccount,
  "id" | "created_at" | "updated_at"
>[] = [
  {
    handle: "financialjuice",
    display_name: "FinancialJuice",
    category: "Wire",
    method: "browser",
    active: true,
  },
  {
    handle: "DeItaone",
    display_name: "Walter Bloomberg",
    category: "Wire",
    method: "browser",
    active: true,
  },
  {
    handle: "NickTimiraos",
    display_name: "Nick Timiraos",
    category: "Macro",
    method: "browser",
    active: true,
  },
  {
    handle: "OSINTDefender",
    display_name: "OSINT Defender",
    category: "OSINT",
    method: "browser",
    active: true,
  },
  {
    handle: "SecBessent25",
    display_name: "Scott Bessent",
    category: "Geopolitical",
    method: "browser",
    active: true,
  },
  {
    handle: "realDonaldTrump",
    display_name: "Donald Trump",
    category: "Geopolitical",
    method: "browser",
    active: true,
  },
  {
    handle: "ABORNEOFFICIAL",
    display_name: "Adam Borne",
    category: "Geopolitical",
    method: "browser",
    active: true,
  },
  {
    handle: "TheSpectatorIndex",
    display_name: "The Spectator Index",
    category: "Geopolitical",
    method: "browser",
    active: true,
  },
  {
    handle: "SchizoIntel",
    display_name: "SchizoIntel",
    category: "OSINT",
    method: "browser",
    active: true,
  },
  {
    handle: "MenchOSINT",
    display_name: "MenchOSINT",
    category: "OSINT",
    method: "browser",
    active: true,
  },
  {
    handle: "ClashReport",
    display_name: "Clash Report",
    category: "OSINT",
    method: "browser",
    active: true,
  },
  // Official RSS feeds — tracked economic publishers only (S47-T1)
  {
    handle: "bls.gov",
    display_name: "Bureau of Labor Statistics",
    category: "Official",
    method: "rss",
    active: true,
  },
  {
    handle: "federalreserve.gov",
    display_name: "Federal Reserve",
    category: "Official",
    method: "rss",
    active: true,
  },
  {
    handle: "newyorkfed.org",
    display_name: "New York Fed",
    category: "Official",
    method: "rss",
    active: true,
  },
  {
    handle: "atlantafed.org",
    display_name: "Atlanta Fed",
    category: "Official",
    method: "rss",
    active: true,
  },
];
