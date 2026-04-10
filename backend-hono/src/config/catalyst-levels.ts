// PENDING TP VALIDATION:
// Qualifying event keyword seeds are provisional until TP sign-off.

export const CATALYST_LEVEL_CRITERIA = {
  4: {
    label: "Critical",
    description:
      "Instant alert. SSE broadcast. Consilium push. Oracle notes. MiroShark adjustment. narrativePressureCap uncapped for Macro/Geopolitical.",
    ivThreshold: 90, // normalized IV score floor (inclusive)
    fjEmojiTiers: ["tier1"], // maps to 🚨 and equivalents
    riskTypes: ["Macro", "Geopolitical"], // riskTypes where this level is most expected
    keywords: [
      "fed rate decision",
      "rate cut",
      "rate hike",
      "fomc decision",
      "circuit breaker",
      "flash crash",
      "nuclear",
      "strait of hormuz",
      "ceasefire",
      "emergency declaration",
      "presidential emergency",
      "cpi surprise",
      "nfp surprise",
      "gdp surprise",
    ],
    sdSurpriseThreshold: 2, // standard deviations above/below consensus for econ data
  },
  3: {
    label: "High",
    description: "Consilium push. Oracle notes. MiroShark adjustment.",
    ivThreshold: 70,
    fjEmojiTiers: ["tier2"], // maps to ⚠️ and equivalents
    riskTypes: ["Macro", "Geopolitical", "Earnings"],
    keywords: [
      "fomc minutes",
      "fed speaker",
      "timiraos",
      "tariff",
      "sanction",
      "troop movement",
      "oil supply",
      "treasury secretary",
      "aapl earnings",
      "nvda earnings",
      "msft earnings",
      "amzn earnings",
      "goog earnings",
      "meta earnings",
      "tsla earnings",
      "opec",
      "pipeline closure",
      "proxy attack",
    ],
  },
  2: {
    label: "Medium",
    description: "Standard feed display. No push. No broadcast.",
    ivThreshold: 40,
    fjEmojiTiers: ["tier3"],
    riskTypes: ["Macro", "Geopolitical", "Commentary", "Earnings", "Technical"],
    keywords: [
      "housing starts",
      "consumer confidence",
      "retail sales",
      "durable goods",
      "presidential tweet",
      "trump post",
      "diplomatic",
      "sector news",
      "deltone",
      "fj commentary",
    ],
  },
  1: {
    label: "Low",
    description: "Filtered by default. Visible if user lowers feed threshold.",
    ivThreshold: 0,
    fjEmojiTiers: ["tier4", "none"],
    riskTypes: ["Commentary", "Technical", "Credit", "Liquidity"],
    keywords: [
      "analyst upgrade",
      "analyst downgrade",
      "price target",
      "non-us",
      "political",
      "corporate news",
      "product launch",
    ],
  },
} as const;

export const CATALYST_IV_THRESHOLDS = {
  level4: CATALYST_LEVEL_CRITERIA[4].ivThreshold,
  level3: CATALYST_LEVEL_CRITERIA[3].ivThreshold,
  level2: CATALYST_LEVEL_CRITERIA[2].ivThreshold,
  level1: CATALYST_LEVEL_CRITERIA[1].ivThreshold,
} as const;

export const CATALYST_RISKTYPE_CROSS_REFERENCE = {
  4: CATALYST_LEVEL_CRITERIA[4].riskTypes,
  3: CATALYST_LEVEL_CRITERIA[3].riskTypes,
  2: CATALYST_LEVEL_CRITERIA[2].riskTypes,
  1: CATALYST_LEVEL_CRITERIA[1].riskTypes,
} as const;

export type MacroLevelLabel =
  (typeof CATALYST_LEVEL_CRITERIA)[keyof typeof CATALYST_LEVEL_CRITERIA]["label"];
