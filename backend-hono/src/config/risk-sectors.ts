// [claude-code 2026-04-25] S40-P7: Sector-of-Risk routing config. Each
// catalyst classifies into one of these five buckets; the bucket determines
// which agent persona owns the boardroom dispatch.
//
// Persona owners:
//   Singularity   → Herald (Singularity is the new headline category for
//                    AI-led volatility — Herald owns chip / compute / model
//                    deals)
//   Geopolitical  → Feucht (sanctions, tariffs, troop, energy supply)
//   Macro         → Oracle (CPI, FOMC, GDP, rates)
//   Earnings      → Consul (megacap fundamentals)
//   Liquidity     → Oracle (Treasury auctions, balance sheet, QT)

export type RiskSector =
  | "Singularity"
  | "Geopolitical"
  | "Macro"
  | "Earnings"
  | "Liquidity";

export type PersonaId = "harper" | "oracle" | "feucht" | "consul" | "herald";

interface RiskSectorConfig {
  keywords: string[];
  owner: PersonaId;
  secondaryOwners: PersonaId[];
}

export const RISK_SECTORS: Record<RiskSector, RiskSectorConfig> = {
  Singularity: {
    keywords: [
      "ai",
      "gpu",
      "h100",
      "b200",
      "compute",
      "anthropic",
      "openai",
      "xai",
      "deepmind",
      "mistral",
      "foundation model",
      "training cluster",
      "compute deal",
      "chip deal",
      "tpu",
    ],
    owner: "herald",
    secondaryOwners: ["consul"],
  },
  Geopolitical: {
    keywords: [
      "sanctions",
      "iran",
      "tariff",
      "war",
      "taiwan",
      "russia",
      "china",
      "hostage",
      "strike",
      "missile",
      "north korea",
      "venezuela",
      "iran retaliates",
    ],
    owner: "feucht",
    secondaryOwners: [],
  },
  Macro: {
    keywords: [
      "cpi",
      "ppi",
      "fomc",
      "fed",
      "rates",
      "inflation",
      "gdp",
      "nfp",
      "powell",
      "dot plot",
      "rate cut",
      "rate hike",
    ],
    owner: "oracle",
    secondaryOwners: ["feucht"],
  },
  Earnings: {
    keywords: [
      "eps",
      "revenue",
      "guidance",
      "earnings beat",
      "earnings miss",
      "operating margin",
      "free cash flow",
      "buyback",
    ],
    owner: "consul",
    secondaryOwners: ["herald"],
  },
  Liquidity: {
    keywords: [
      "treasury",
      "auction",
      "balance sheet",
      "qt",
      "qe",
      "repo",
      "reverse repo",
      "tga",
      "rrp",
      "drain",
    ],
    owner: "oracle",
    secondaryOwners: ["feucht"],
  },
};

export function classifyToSector(input: {
  headline: string;
  riskType?: string | null;
  tags?: string[] | null;
}): RiskSector {
  const text = [
    input.headline ?? "",
    ...(input.tags ?? []),
    input.riskType ?? "",
  ]
    .join(" ")
    .toLowerCase();

  // Score each sector by keyword hits; tie-break by config order.
  const scores: Array<{ sector: RiskSector; score: number }> = [];
  for (const [sector, cfg] of Object.entries(RISK_SECTORS) as Array<
    [RiskSector, RiskSectorConfig]
  >) {
    const score = cfg.keywords.reduce(
      (acc, kw) => acc + (text.includes(kw) ? 1 : 0),
      0,
    );
    scores.push({ sector, score });
  }
  scores.sort((a, b) => b.score - a.score);
  if (scores[0].score === 0) return "Macro";
  return scores[0].sector;
}

export function ownerForSector(sector: RiskSector): PersonaId {
  return RISK_SECTORS[sector].owner;
}
