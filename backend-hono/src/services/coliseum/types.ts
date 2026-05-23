export const DESK_ARCHETYPES = [
  "narrative trader",
  "thematic investor",
  "nothing-happens",
  "macro",
  "doomer",
  "technician",
  "contrarian",
  "vol trader",
  "policy watcher",
  "fundamentalist",
] as const;

export const FORECAST_STATUSES = [
  "draft",
  "published",
  "watching",
  "gaining_support",
  "thesis_proven",
  "invalidated",
  "expired",
] as const;

export const FORECAST_DIRECTIONS = [
  "bullish",
  "bearish",
  "neutral",
  "range",
  "event",
] as const;

export interface DeskProfile {
  deskId: string;
  displayName: string;
  bio: string;
  archetypes: string[];
  brokerClassification: string | null;
  propFirmClassification: string | null;
  affiliateUrl: string | null;
  affiliateDisclosure: string | null;
  affiliateRelationship: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeskAgentStyle {
  deskId: string;
  archetypeMix: string[];
  houseBias: string | null;
  preferredEvidenceSources: string[];
  riskPosture: string | null;
  timeHorizon: string | null;
  forbiddenClaims: string[];
  customInstruction: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketReferenceInput {
  venue: string;
  marketTitle: string;
  marketUrl: string;
  priceOrOdds?: string | null;
  expiry?: string | null;
  fetchedAt?: string | null;
}

export interface DeskForecastInput {
  deskId?: string | null;
  narrativeSessionId?: string | null;
  title: string;
  thesis: string;
  probability?: number | null;
  direction?: string | null;
  timeframe: string;
  validationRule: string;
  expiresAt?: string | null;
  catalystIds?: string[];
  marketReferences?: MarketReferenceInput[];
}

export interface DeskForecast {
  id: string;
  deskId: string;
  narrativeSessionId: string | null;
  title: string;
  thesis: string;
  probability: number | null;
  direction: string | null;
  timeframe: string;
  validationRule: string;
  status: string;
  createdBy: string;
  publisherId: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
  catalysts: ForecastCatalyst[];
  marketReferences: ForecastMarketReference[];
}

export interface ForecastCatalyst {
  riskflowItemId: string;
  evidenceLabel: string | null;
  createdAt: string;
}

export interface ForecastMarketReference {
  id: string;
  venue: string;
  marketTitle: string;
  marketUrl: string;
  priceOrOdds: string | null;
  expiry: string | null;
  fetchedAt: string;
  createdAt: string;
}

export interface PermissionResult {
  role: string | null;
  canDraft: boolean;
  canPublish: boolean;
}
