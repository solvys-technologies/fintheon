/**
 * Narrative Scoring Service
 */

import ApiClient from "../apiClient";

export interface ScoredCandidate {
  sourceId: string;
  sourceType: "riskflow" | "mdb-brief";
  notabilityScore: number;
  sentiment: "bullish" | "bearish";
  severity: "high" | "medium" | "low";
  tickers: string[];
  themes: string[];
  suggestedTitle: string;
  suggestedDescription: string;
  originalHeadline?: string;
}

export interface NarrativeThreadRow {
  slug: string;
  title: string;
  description: string | null;
  color: string;
  status: string;
  sort_order: number;
  keywords: string[] | null;
}

export interface NarrativeCardLink {
  card_id: string;
  thread_slug: string;
  confidence: number;
}

export class NarrativeService {
  constructor(private client: ApiClient) {}

  async getThreads(): Promise<{ threads: NarrativeThreadRow[] }> {
    return this.client.get("/api/narrative/threads");
  }

  async getCardLinks(
    cardIds?: string[],
  ): Promise<{ links: NarrativeCardLink[] }> {
    const params = cardIds?.length ? `?card_ids=${cardIds.join(",")}` : "";
    return this.client.get(`/api/narrative/card-links${params}`);
  }

  async scoreRiskflow(
    items: Array<{
      id: string;
      headline: string;
      summary: string;
      source: string;
      severity: string;
      tags: string[];
      publishedAt: string;
    }>,
  ): Promise<{ scored: ScoredCandidate[]; provider: string }> {
    return this.client.post("/api/narrative/score-riskflow", { items });
  }

  async scoreBrief(
    briefText: string,
  ): Promise<{ scored: ScoredCandidate[]; provider: string }> {
    return this.client.post("/api/narrative/score-brief", { briefText });
  }

  async getCatalysts(since?: string): Promise<{ catalysts: DbCatalyst[] }> {
    const params = since ? `?since=${encodeURIComponent(since)}` : "";
    return this.client.get(`/api/narrative/catalysts${params}`);
  }
}

/** Shape returned by GET /api/narrative/catalysts — maps to CatalystCard */
export interface DbCatalyst {
  id: string;
  title: string;
  description: string;
  date: string;
  sentiment: "bullish" | "bearish";
  severity: "high" | "medium" | "low";
  source: "riskflow";
  narrativeIds: string[];
  narrativeThreads: string[];
  isGhost: boolean;
  templateType: null;
  position: null;
  tags: string[];
  category: string;
  riskflowItemId: string;
  marketImpact: Record<string, unknown> | null;
  narrative: string | null;
  status: string;
  drillDepth: number;
  createdAt: string;
  updatedAt: string;
}
