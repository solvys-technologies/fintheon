import type {
  CatalystCard,
  CatalystSentiment,
  CatalystSeverity,
  NarrativeCategory,
} from "../../lib/narrative-types";
import type {
  SensemakingCatalyst,
  SensemakingResponse,
} from "./sensemaking-types";

const categoryMap: Record<string, NarrativeCategory> = {
  geopolitical: "geopolitical",
  macroeconomic: "macroeconomic",
  macro: "macroeconomic",
  monetary: "monetary",
  "monetary-policy": "monetary",
  earnings: "earnings",
  "earnings-corporate": "earnings",
  "market-structure": "market-structure",
  supply: "supply-chain",
  "supply-chain": "supply-chain",
  "black-swan": "black-swan",
};

export function allSensemakingCatalysts(response: SensemakingResponse | null) {
  if (!response) return [];
  return [...response.anchorCatalysts, ...response.relatedCatalysts];
}

export function findNodeIdForCatalyst(
  response: SensemakingResponse | null,
  catalystId: string,
) {
  if (!response) return null;
  return (
    response.timelineNodes.find((node) => node.catalystId === catalystId)?.id ??
    null
  );
}

export function toNarrativeCatalystCard(
  catalyst: SensemakingCatalyst,
): CatalystCard {
  return {
    id: catalyst.id,
    title: catalyst.headline,
    description: catalyst.summary,
    date: catalyst.publishedAt,
    sentiment: getSentiment(catalyst),
    severity: getSeverity(catalyst.ivScore),
    source: "riskflow",
    narrativeIds: catalyst.narrativeThreads,
    isGhost: false,
    templateType: null,
    position: null,
    tags: catalyst.tags,
    category: getCategory(catalyst.category),
    marketImpact: getMarketImpact(catalyst),
    narrative: catalyst.narrativeThreads[0],
    narrativeThreads: catalyst.narrativeThreads,
    directionBias: getSentiment(catalyst),
    status: "active",
    researchBullets: [],
    drillDepth: 0,
    createdAt: catalyst.promotedAt ?? catalyst.publishedAt,
    updatedAt: catalyst.promotedAt ?? catalyst.publishedAt,
  };
}

function getSentiment(catalyst: SensemakingCatalyst): CatalystSentiment {
  const value = catalyst.sentiment.toLowerCase();
  if (value.includes("bear") || value.includes("short")) return "bearish";
  return "bullish";
}

function getSeverity(score: number): CatalystSeverity {
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function getCategory(value: string): NarrativeCategory {
  return categoryMap[value.toLowerCase()] ?? "market-structure";
}

function getMarketImpact(catalyst: SensemakingCatalyst) {
  if (typeof catalyst.marketImpact !== "object" || !catalyst.marketImpact) {
    return undefined;
  }
  return catalyst.marketImpact as CatalystCard["marketImpact"];
}
