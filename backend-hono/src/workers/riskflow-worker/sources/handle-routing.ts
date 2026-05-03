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
  category: "wire" | "macro" | "osint" | "stock-news" | "options" | "commentary";
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

export const HANDLE_ROUTING: HandleRoutingConfig[] = [
  // ── Wire / Econ ──
  {
    handle: "financialjuice",
    displayName: "FinancialJuice",
    category: "wire",
    tier: "breaking",
    contentFilter: {
      requireAny: [
        "Actual",
        "Forecast",
        "Prelim",
        "Final",
        "Prior",
        "Revised",
        "Change",
        "Index",
        "Rate",
        "GDP",
        "CPI",
        "PPI",
        "PMI",
        "NFP",
        "Unemployment",
        "Claims",
      ],
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
      exclude: [
        "Sponsored",
        "Advert",
        "Subscribe",
        "Sign up",
        "Promoted",
      ],
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

export function getRoutingForHandle(
  handle: string,
): HandleRoutingConfig[] {
  return byHandle.get(handle.toLowerCase()) ?? [];
}

export function passesContentFilter(
  text: string,
  filter: HandleRoutingConfig["contentFilter"],
): boolean {
  const t = text.toLowerCase();

  if (filter.minLength && text.length < filter.minLength) return false;

  if (filter.requireAll) {
    if (!filter.requireAll.every((kw) => t.includes(kw.toLowerCase())))
      return false;
  }

  if (filter.requireAny) {
    if (!filter.requireAny.some((kw) => t.includes(kw.toLowerCase())))
      return false;
  }

  if (filter.exclude) {
    if (filter.exclude.some((kw) => t.includes(kw.toLowerCase()))) return false;
  }

  if (filter.personsOfInterest) {
    if (
      !filter.personsOfInterest.some((name) =>
        t.includes(name.toLowerCase()),
      )
    )
      return false;
  }

  return true;
}

export function getPostingRules(handle: string): XPostingRule[] {
  const configs = getRoutingForHandle(handle);
  const rules = new Set<XPostingRule>();
  for (const c of configs) {
    for (const r of c.posting) rules.add(r);
  }
  return Array.from(rules);
}
