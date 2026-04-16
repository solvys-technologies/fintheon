// [claude-code 2026-04-16] Data constants for sentiment enforcement + instrument flipper

// ============================================================================
// FORCED SENTIMENT KEYWORDS
// ============================================================================

export const FORCED_BEARISH = [
  "bomb",
  "bombing",
  "drone strike",
  "drone attack",
  "airstrike",
  "missile",
  "nuclear",
  "invasion",
  "invade",
  "destroy",
  "destruction",
  "devastat",
  "war crime",
  "genocide",
  "massacre",
  "blockade",
  "siege",
  "crash",
  "collapse",
  "meltdown",
  "default",
  "insolvency",
  "bankruptcy",
  "government shutdown",
  "contagion",
  "bank run",
  "liquidity crisis",
  "panic sell",
  "flash crash",
];

export const FORCED_BULLISH = [
  "ceasefire",
  "cease fire",
  "peace deal",
  "peace agreement",
  "peace treaty",
  "de-escalat",
  "deescalat",
  "truce",
  "hostage release",
  "prisoner exchange",
  "diplomatic breakthrough",
  "diplomatic resolution",
  "stimulus package",
  "stimulus plan",
  "record high",
  "all-time high",
  "recession averted",
  "soft landing confirmed",
];

// ============================================================================
// CONTEXT RULES
// ============================================================================

export interface ContextRule {
  trigger: string;
  bullishModifiers: string[];
  bearishModifiers: string[];
}

export const CONTEXT_RULES: ContextRule[] = [
  {
    trigger: "sanction",
    bullishModifiers: [
      "lift",
      "ease",
      "remov",
      "suspend",
      "waiv",
      "relax",
      "roll back",
    ],
    bearishModifiers: [
      "new",
      "impose",
      "expand",
      "escalat",
      "tighten",
      "additional",
      "sweeping",
    ],
  },
  {
    trigger: "rate",
    bullishModifiers: ["cut", "lower", "reduc", "ease", "dovish", "pause"],
    bearishModifiers: [
      "hike",
      "raise",
      "increas",
      "hawk",
      "tighten",
      "higher for longer",
    ],
  },
  {
    trigger: "tariff",
    bullishModifiers: [
      "remov",
      "reduc",
      "exempt",
      "rollback",
      "repeal",
      "suspen",
      "delay",
      "pause",
    ],
    bearishModifiers: [
      "new",
      "impose",
      "increas",
      "escalat",
      "retaliatory",
      "additional",
      "raise",
      "hike",
    ],
  },
  {
    trigger: "strike",
    bullishModifiers: ["end", "settle", "resolution", "averted"],
    bearishModifiers: [
      "military",
      "air",
      "drone",
      "missile",
      "target",
      "retaliat",
      "launch",
      "bomb",
    ],
  },
  {
    trigger: "conflict",
    bullishModifiers: [
      "resolv",
      "de-escalat",
      "peace",
      "end",
      "wind down",
      "ceasefire",
    ],
    bearishModifiers: [
      "escalat",
      "intensif",
      "spread",
      "widen",
      "new front",
      "expand",
    ],
  },
  {
    trigger: "war",
    bullishModifiers: [
      "end",
      "ceasefire",
      "peace",
      "truce",
      "withdraw",
      "retreat",
    ],
    bearishModifiers: [
      "declar",
      "escalat",
      "expand",
      "new",
      "threaten",
      "mobiliz",
    ],
  },
  {
    trigger: "trade",
    bullishModifiers: ["deal", "agreement", "pact", "cooperat", "open"],
    bearishModifiers: ["war", "disput", "restrict", "ban", "block", "retali"],
  },
  {
    trigger: "recession",
    bullishModifiers: ["averted", "avoid", "exit", "over", "end", "unlikely"],
    bearishModifiers: [
      "enter",
      "confirm",
      "fear",
      "risk",
      "deepen",
      "loom",
      "imminent",
      "warn",
    ],
  },
  {
    trigger: "shutdown",
    bullishModifiers: ["averted", "avoid", "deal", "fund", "reopen"],
    bearishModifiers: [
      "loom",
      "begin",
      "start",
      "partial",
      "full",
      "extend",
      "no deal",
    ],
  },
];

// ============================================================================
// INSTRUMENT FLIPPER DATA
// ============================================================================

export const ASSET_CLASS_MAP: Record<string, string> = {
  "/ES": "equities",
  "/MES": "equities",
  "/NQ": "equities",
  "/MNQ": "equities",
  "/YM": "equities",
  "/MYM": "equities",
  "/RTY": "equities",
  "/M2K": "equities",
  "/GC": "safe-haven",
  "/MGC": "safe-haven",
  "/SI": "precious",
  "/SIL": "precious",
  "/CL": "energy",
  "/MCL": "energy",
  "/NG": "energy",
  "/ZB": "bonds",
  "/ZN": "bonds",
  "/6E": "fx-major",
  "/6J": "fx-major",
  "/6B": "fx-major",
};

export type FlipperCategory =
  | "geopolitical"
  | "monetary"
  | "economic"
  | "default";

export const EVENT_TYPE_TO_FLIPPER: Record<string, FlipperCategory> = {
  fedDecision: "monetary",
  fomc: "monetary",
  powellSpeak: "monetary",
  cpiPrint: "economic",
  pcePrint: "economic",
  nfpPrint: "economic",
  gdpPrint: "economic",
  ismPrint: "economic",
  jolts: "economic",
  retailSales: "economic",
  creditSpreadWidening: "economic",
  yieldCurveSignal: "economic",
  liquidityStress: "economic",
  bankStress: "economic",
  leverageWarning: "economic",
  geopolitical: "geopolitical",
  conflict: "geopolitical",
  tariffs: "geopolitical",
  chinaTrade: "geopolitical",
  governmentShutdown: "geopolitical",
  earningsHighImpact: "default",
  earningsMidCap: "default",
  merger: "default",
  sectorNews: "default",
  politicalCommentary: "default",
  datacenterHalt: "default",
  majorCrisis: "geopolitical",
  blackSwan: "geopolitical",
  other: "default",
};

type Reaction = "same" | "inverse" | null;

export const EVENT_SENTIMENT_REACTIONS: Record<
  FlipperCategory,
  Record<string, Reaction>
> = {
  geopolitical: {
    equities: "same",
    "safe-haven": "inverse",
    precious: "inverse",
    bonds: "inverse",
    energy: "inverse",
    "fx-major": null,
  },
  monetary: {
    equities: "same",
    "safe-haven": "same",
    precious: "same",
    bonds: "same",
    energy: "same",
    "fx-major": "inverse",
  },
  economic: {
    equities: "same",
    "safe-haven": "inverse",
    precious: "inverse",
    bonds: "inverse",
    energy: "same",
    "fx-major": null,
  },
  default: {
    equities: "same",
    "safe-haven": null,
    precious: null,
    bonds: null,
    energy: null,
    "fx-major": null,
  },
};

export const RISK_TYPE_TO_FLIPPER: Record<string, FlipperCategory> = {
  Geopolitical: "geopolitical",
  Macro: "economic",
  Credit: "economic",
  Liquidity: "economic",
  Earnings: "default",
  Technical: "default",
  Commentary: "default",
};
