// [claude-code 2026-05-01] Per-handle routing config for X intake. Each handle
// has its own content filter, category assignment, and posting rules. The home
// timeline collector uses this to decide what enters RiskFlow and how it's tagged.
// Posting rules are consumed by the future X posting service.

export type XPostingRule =
  | "repost-only" // repost via X retweet, never copy-paste
  | "credit-required" // must credit source in post
  | "drop-images" // strip images before posting (keep in RiskFlow)
  | "econ-data" // economic data release (Actual + Forecast)
  | "commentary" // person-of-interest commentary
  | "breaking-only"; // only breaking/market-moving events

export interface HandleRoutingConfig {
  handle: string;
  displayName: string;
  category:
    | "wire"
    | "macro"
    | "osint"
    | "stock-news"
    | "options"
    | "commentary";
  tier: "breaking" | "standard" | "commentary";
  /** Content filter: include only if headline/body passes these checks */
  contentFilter: {
    /** Include only if text matches ALL of these (case-insensitive) */
    requireAll?: string[];
    /** Include only if text matches ANY of these (case-insensitive) */
    requireAny?: string[];
    /** Exclude if text matches ANY of these (case-insensitive) */
    exclude?: string[];
    /** Persons of interest — if present, at least one last name must appear */
    personsOfInterest?: string[];
    /** Minimum text length to consider */
    minLength?: number;
  };
  /** Posting behavior for the X posting service */
  posting: XPostingRule[];
}

const CATEGORY_KEYWORDS: Record<HandleRoutingConfig["category"], string[]> = {
  wire: [
    "breaking",
    "fed",
    "fomc",
    "cpi",
    "ppi",
    "nfp",
    "rates",
    "yield",
    "treasury",
    "inflation",
    "gdp",
    "policy",
    "tariff",
    "sanction",
    "opec",
    "earnings",
  ],
  macro: [
    "fed",
    "ecb",
    "boj",
    "rates",
    "inflation",
    "growth",
    "recession",
    "yield curve",
    "liquidity",
    "fiscal",
    "treasury",
    "dollar",
    "fx",
  ],
  osint: [
    "strike",
    "missile",
    "drone",
    "airstrike",
    "ceasefire",
    "escalation",
    "mobilization",
    "sanctions",
    "iran",
    "israel",
    "gaza",
    "ukraine",
    "russia",
    "taiwan",
    "red sea",
    "hormuz",
    "nato",
  ],
  "stock-news": [
    "earnings",
    "guidance",
    "revenue",
    "eps",
    "outlook",
    "upgrade",
    "downgrade",
    "buyback",
    "ipo",
    "merger",
    "acquisition",
    "sec",
    // [claude-code 2026-05-05] User-provided stock-news ticker set
    "NVDA",
    "GOOGL",
    "GOOG",
    "AAPL",
    "MSFT",
    "AVGO",
    "META",
    "TSLA",
    "LLY",
    "MU",
    "AMD",
    "JNJ",
    "ASML",
    "ORCL",
    "ABBV",
    "PLTR",
    "UNH",
    "PG",
    "GE",
    "MRK",
    "PM",
    "TXN",
    "RTX",
    "KLAC",
    "ANET",
    "ARM",
    "IBM",
    "PEP",
    "TSM",
    "TMUS",
  ],
  options: [
    "options",
    "gamma",
    "vanna",
    "delta",
    "dealer",
    "put",
    "call",
    "open interest",
    "volatility",
    "skew",
    "iv",
    "flow",
  ],
  commentary: [
    "fed",
    "fomc",
    "rates",
    "inflation",
    "policy",
    "treasury",
    "tariff",
    "geopolitical",
    "macro",
    "risk",
    "equity",
    "market",
  ],
};

function includesKeyword(text: string, keyword: string): boolean {
  const t = text.toLowerCase();
  const k = keyword.toLowerCase().trim();
  if (!k) return false;
  return t.includes(k);
}

export const HANDLE_ROUTING: HandleRoutingConfig[] = [
  // ── Walter Bloomberg / DeItaone (wire) ──
  {
    handle: "DeItaone",
    displayName: "Walter Bloomberg",
    category: "wire",
    tier: "breaking",
    contentFilter: {
      // Keep almost all wire flow; only obvious promo/noise is filtered.
      minLength: 12,
      exclude: ["Promoted", "Sponsored", "Sign up", "Subscribe"],
    },
    posting: ["breaking-only"],
  },
  // ── Wire / Econ ──
  {
    handle: "financialjuice",
    displayName: "FinancialJuice",
    category: "wire",
    tier: "breaking",
    contentFilter: {
      // Keep most of Following-feed posts; downstream scorer will classify.
      minLength: 12,
      exclude: ["Promoted", "Sponsored", "Sign up", "Subscribe"],
    },
    posting: ["econ-data"],
  },
  // ── Commentary (FinancialJuice as commentary source too) ──
  {
    handle: "financialjuice",
    displayName: "FinancialJuice",
    category: "commentary",
    tier: "commentary",
    contentFilter: {
      personsOfInterest: [
        "Powell",
        "Bessent",
        "Trump",
        "Waller",
        "Bowman",
        "Barr",
        "Jefferson",
        "Miran",
        "Atkins",
        "Woodcock",
        "Ryan",
        "Lagarde",
        "Bessent",
        "Xi",
        "Putin",
        "Netanyahu",
        "Khamenei",
        "Sheinbaum",
        "Starmer",
        "Macron",
        "Scholz",
        "Meloni",
        "Milei",
        "Habeck",
        "Nagel",
        "Knot",
        "Villeroy",
        "Kazaks",
        "Simkus",
        "Vujcic",
        "Holzmann",
        "Muller",
        "Centeno",
        "Rehn",
        "Makhlouf",
        "Vasle",
        "Scicluna",
        "Kazimir",
        "Stournaras",
        "Lane",
        "Schnabel",
        "Guindos",
      ],
      minLength: 30,
      exclude: ["Sponsored", "Advert", "Subscribe", "Sign up", "Promoted"],
    },
    posting: ["commentary"],
  },
  // ── Stock News ──
  {
    handle: "TrendSpider",
    displayName: "TrendSpider",
    category: "stock-news",
    tier: "standard",
    contentFilter: {
      minLength: 20,
      exclude: ["Sponsored", "Advert", "Subscribe", "Sign up", "Promoted"],
    },
    posting: ["drop-images"],
  },
  // ── Nick Timiraos ──
  {
    handle: "NickTimiraos",
    displayName: "Nick Timiraos",
    category: "macro",
    tier: "standard",
    contentFilter: {
      minLength: 20,
    },
    posting: ["repost-only"],
  },
  // ── Macro Edge ──
  {
    handle: "MacroEdge",
    displayName: "Macro Edge",
    category: "macro",
    tier: "standard",
    contentFilter: {
      minLength: 20,
      exclude: ["Promoted", "Sponsored", "Sign up", "Subscribe"],
    },
    posting: ["credit-required"],
  },
  // ── realDonaldTrump (geopolitical/policy) ──
  {
    handle: "realDonaldTrump",
    displayName: "Donald Trump",
    category: "osint",
    tier: "standard",
    contentFilter: {
      requireAny: [
        "tariff",
        "trade",
        "china",
        "iran",
        "israel",
        "gaza",
        "ukraine",
        "russia",
        "nato",
        "sanction",
        "policy",
        "fed",
        "rate",
        "treasury",
        "middle east",
      ],
      minLength: 30,
      exclude: ["Promoted", "Sponsored", "Sign up", "Subscribe"],
    },
    posting: ["credit-required"],
  },
  // ── OSINTtechnical ──
  {
    handle: "OSINTtechnical",
    displayName: "OSINTtechnical",
    category: "osint",
    tier: "standard",
    contentFilter: {
      requireAny: [
        "strike",
        "missile",
        "drone",
        "military",
        "conflict",
        "war",
        "Middle East",
        "Iran",
        "Israel",
        "Gaza",
        "Lebanon",
        "Yemen",
        "Houthi",
        "Hezbollah",
        "Hamas",
        "Ukraine",
        "Russia",
        "NATO",
        "Taiwan",
        "South China Sea",
        "Strait",
        "Hormuz",
        "Red Sea",
        "deployment",
        "mobilization",
        "escalation",
        "ceasefire",
        "sanctions",
        "embargo",
      ],
      minLength: 40,
    },
    posting: ["breaking-only"],
  },
  // ── SpotGamma ──
  {
    handle: "SpotGamma",
    displayName: "SpotGamma",
    category: "options",
    tier: "standard",
    contentFilter: {
      minLength: 20,
      exclude: ["Sponsored", "Advert", "Subscribe", "Sign up", "Promoted"],
    },
    posting: ["credit-required"],
  },
];

// ── Lookup helpers ──

const byHandle = new Map<string, HandleRoutingConfig[]>();

for (const entry of HANDLE_ROUTING) {
  const lower = entry.handle.toLowerCase();
  const existing = byHandle.get(lower) ?? [];
  existing.push(entry);
  byHandle.set(lower, existing);
}

export function getRoutingForHandle(handle: string): HandleRoutingConfig[] {
  return byHandle.get(handle.toLowerCase()) ?? [];
}

export function passesContentFilter(
  text: string,
  filter: HandleRoutingConfig["contentFilter"],
): boolean {
  if (filter.minLength && text.length < filter.minLength) return false;

  if (filter.requireAll) {
    if (!filter.requireAll.every((kw) => includesKeyword(text, kw)))
      return false;
  }

  if (filter.requireAny) {
    if (!filter.requireAny.some((kw) => includesKeyword(text, kw)))
      return false;
  }

  if (filter.exclude) {
    if (filter.exclude.some((kw) => includesKeyword(text, kw))) return false;
  }

  if (filter.personsOfInterest) {
    if (!filter.personsOfInterest.some((name) => includesKeyword(text, name)))
      return false;
  }

  return true;
}

export function passesCategoryKeywordFilter(
  category: HandleRoutingConfig["category"],
  text: string,
): boolean {
  const keywords = CATEGORY_KEYWORDS[category];
  if (!keywords || keywords.length === 0) return true;
  return keywords.some((kw) => includesKeyword(text, kw));
}

function extractReferencedHandle(text: string): string | null {
  const patterns = [
    /\brt\s+@([A-Za-z0-9_]{1,20})\b/i,
    /\bvia\s+@([A-Za-z0-9_]{1,20})\b/i,
    /\bfrom\s+@([A-Za-z0-9_]{1,20})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const handle = m?.[1]?.replace(/^@/, "").trim();
    if (handle) return handle.toLowerCase();
  }
  return null;
}

export function isDisallowedRepostOrRetweet(
  text: string,
  approvedHandles: Set<string>,
): boolean {
  if (!/\b(rt\s+@|retweet(?:ed|ing)?|repost(?:ed|ing)?)\b/i.test(text)) {
    return false;
  }
  const referenced = extractReferencedHandle(text);
  if (!referenced) return true;
  return !approvedHandles.has(referenced);
}

export function getPostingRules(handle: string): XPostingRule[] {
  const configs = getRoutingForHandle(handle);
  const rules = new Set<XPostingRule>();
  for (const c of configs) {
    for (const r of c.posting) rules.add(r);
  }
  return Array.from(rules);
}
