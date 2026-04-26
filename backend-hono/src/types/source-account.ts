// [claude-code 2026-04-12] Source account type — curated X accounts for timeline polling

export const SOURCE_ACCOUNT_CATEGORIES = [
  "Wire",
  "OSINT",
  "Geopolitical",
  "Macro",
  "Custom",
] as const;

export type SourceAccountCategory = (typeof SOURCE_ACCOUNT_CATEGORIES)[number];

export interface SourceAccount {
  id: string;
  handle: string;
  display_name: string | null;
  category: SourceAccountCategory;
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
    active: true,
  },
  {
    handle: "DeItaone",
    display_name: "Walter Bloomberg",
    category: "Wire",
    active: true,
  },
  {
    handle: "NickTimiraos",
    display_name: "Nick Timiraos",
    category: "Macro",
    active: true,
  },
  {
    handle: "OSINTDefender",
    display_name: "OSINT Defender",
    category: "OSINT",
    active: true,
  },
  {
    handle: "SecBessent25",
    display_name: "Scott Bessent",
    category: "Geopolitical",
    active: true,
  },
  {
    handle: "realDonaldTrump",
    display_name: "Donald Trump",
    category: "Geopolitical",
    active: true,
  },
  {
    handle: "ABORNEOFFICIAL",
    display_name: "Adam Borne",
    category: "Geopolitical",
    active: true,
  },
  {
    handle: "TheSpectatorIndex",
    display_name: "The Spectator Index",
    category: "Geopolitical",
    active: true,
  },
  {
    handle: "SchizoIntel",
    display_name: "SchizoIntel",
    category: "OSINT",
    active: true,
  },
  {
    handle: "MenchOSINT",
    display_name: "MenchOSINT",
    category: "OSINT",
    active: true,
  },
  {
    handle: "ClashReport",
    display_name: "Clash Report",
    category: "OSINT",
    active: true,
  },
  // [claude-code 2026-04-25] S40-P3: 8 Macro handles promoted to breaking
  // tier. NickTimiraos already exists above; the other 7 below.
  {
    handle: "unusual_whales",
    display_name: "unusual_whales",
    category: "Macro",
    active: true,
  },
  {
    handle: "WalterBloomberg",
    display_name: "Walter Bloomberg",
    category: "Macro",
    active: true,
  },
  {
    handle: "LiveSquawk",
    display_name: "LiveSquawk",
    category: "Macro",
    active: true,
  },
  {
    handle: "FXHedge",
    display_name: "FXHedge",
    category: "Macro",
    active: true,
  },
  {
    handle: "WallStreetBets",
    display_name: "WallStreetBets",
    category: "Macro",
    active: true,
  },
  {
    handle: "SquawkCNBC",
    display_name: "Squawk CNBC",
    category: "Macro",
    active: true,
  },
  {
    handle: "zerohedge",
    display_name: "zerohedge",
    category: "Macro",
    active: true,
  },
];
