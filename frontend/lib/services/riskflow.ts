/**
 * RiskFlow Service
 */

import ApiClient from "../apiClient";
import { decodeHtmlEntities } from "../html-entities";
import type { RiskFlowItem } from "../../types/api";

export interface RiskFlowListResponse {
  items: RiskFlowItem[];
  total?: number;
  hasMore?: boolean;
}

function sanitizeXBodyForDisplay(input: string): string {
  return input
    .replace(/(^|\s)@[A-Za-z0-9_]{1,20}\b/g, " ")
    .replace(
      /\b\d+(\.\d+)?\s*(k|m)?\s*(views?|likes?|repl(?:y|ies)|reposts?|bookmarks?)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

// RiskFlow Service
export class RiskFlowService {
  constructor(private client: ApiClient) {}

  async list(params?: {
    limit?: number;
    offset?: number;
    symbol?: string;
    minMacroLevel?: number;
    instrument?: string;
  }): Promise<RiskFlowListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.append("limit", params.limit.toString());
    if (params?.offset) query.append("offset", params.offset.toString());
    if (params?.symbol) query.append("symbols", params.symbol); // Backend expects 'symbols' not 'symbol'
    if (params?.instrument) query.append("instrument", params.instrument);
    // Allow frontend to override minMacroLevel for debugging (default is 3)
    if (params?.minMacroLevel !== undefined) {
      query.append("minMacroLevel", params.minMacroLevel.toString());
    }

    const queryString = query.toString();
    const endpoint = `/api/riskflow/feed${queryString ? `?${queryString}` : ""}`;
    try {
      const response = await this.client.get<{
        items?: any[];
        total?: number;
        hasMore?: boolean;
        fetchedAt?: string;
        error?: string;
      }>(endpoint);

      if (
        !response ||
        typeof response !== "object" ||
        Object.keys(response).length === 0
      ) {
        return { items: [], total: 0 };
      }

      const items = Array.isArray(response.items) ? response.items : [];

      // Transform backend FeedItem to frontend RiskFlowItem format
      return {
        items: items.map((item: any) => {
          // Backend uses 'headline', frontend expects 'title'
          // Backend uses 'body', frontend expects 'content'
          // Backend uses 'ivScore', frontend expects 'ivScore' (same)
          // Backend uses 'macroLevel', frontend expects 'macroLevel' (same)
          const ivScore = item.ivScore ?? 0;
          const macroLevel = item.macroLevel ?? 1;
          const priceBrainScore = item.priceBrainScore ?? undefined;
          const pointRange =
            typeof item.pointRange === "number"
              ? item.pointRange
              : typeof priceBrainScore?.impliedPoints === "number"
                ? priceBrainScore.impliedPoints
                : null;
          const direction =
            item.direction === "Bullish" ||
            item.direction === "Bearish" ||
            item.direction === "Neutral"
              ? item.direction
              : priceBrainScore?.sentiment === "Bullish" ||
                  priceBrainScore?.sentiment === "Bearish" ||
                  priceBrainScore?.sentiment === "Neutral"
                ? priceBrainScore.sentiment
                : null;

          const isTwitterSource =
            typeof item.source === "string" &&
            item.source.toLowerCase().startsWith("twitter:");
          const rawBody = decodeHtmlEntities(item.body || item.content || "");
          const body = isTwitterSource
            ? sanitizeXBodyForDisplay(rawBody)
            : rawBody;

          return {
            id: item.id?.toString() || "",
            title: decodeHtmlEntities(item.headline || item.title || ""), // Map headline to title
            content: body, // Map body to content
            summary: body, // Also set summary for compatibility
            source: isTwitterSource ? "X" : item.source || "",
            url: item.url,
            imageUrl: item.imageUrl ?? null,
            video_url: item.videoUrl ?? item.video_url ?? null,
            publishedAt:
              item.publishedAt || item.published_at || new Date().toISOString(),
            impact: ivScore > 7 ? "high" : ivScore > 4 ? "medium" : "low",
            symbols: item.symbols || [],
            sentiment: item.sentiment || "neutral",
            ivScore: ivScore,
            ivImpact: ivScore, // Also set ivImpact for backward compatibility
            pointRange,
            direction,
            macroLevel: macroLevel,
            isBreaking: item.isBreaking || false,
            category: isTwitterSource ? "X" : item.source || "",
            tags: item.tags || [],
            urgency: item.urgency || "normal",
            priceBrainScore,
            authorHandle: isTwitterSource
              ? undefined
              : (item.authorHandle ?? undefined),
          };
        }),
        total: response.total ?? items.length,
        hasMore: response.hasMore ?? false,
      };
    } catch (error: any) {
      // RiskFlow fetch failed — rethrow
      // Return empty response on error
      return {
        items: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  async seed(): Promise<void> {
    try {
      await this.client.post("/api/riskflow/seed", {});
    } catch (error) {
      // Seed failed — swallow
      throw error;
    }
  }

  /**
   * Re-fetch latest scored items from the backend cache.
   * [claude-code 2026-04-18] S25-T3: Manual poll trigger removed from user-facing UI. This
   * method no longer tells the backend to poll — it only re-reads the scored cache.
   * The only user-facing poll trigger is the Doctor button on the self Team Card.
   */
  async fetchLatest(): Promise<{ success: boolean; refreshedAt: string }> {
    const res = await this.list({ limit: 100 });
    return {
      success: true,
      refreshedAt: new Date().toISOString(),
    };
  }

  /** @deprecated use fetchLatest — preserved for one release during UI migration */
  async refresh(): Promise<{ success: boolean; refreshedAt: string }> {
    return this.fetchLatest();
  }

  /**
   * Self-service polling "doctor" — reloads Rettiwt pool, runs catchup, triggers a poll.
   * Server-enforced 60s cooldown per user. Invoked from the Team Card stethoscope button.
   * [claude-code 2026-04-18] S25-T3
   */
  async runDoctor(): Promise<{
    ok: boolean;
    scored: number;
    wroteItems: number;
    sourcesHealthy: boolean;
    newLastSuccessAt: string | null;
    cooldownSec?: number;
  }> {
    return this.client.post("/api/riskflow/doctor", {});
  }

  async fetchVIX(): Promise<{ value: number }> {
    return this.client.get<{ value: number }>("/api/market/vix");
  }

  async generateNote(itemId: string): Promise<{ note: string }> {
    return this.client.post<{ note: string }>(
      `/api/riskflow/${itemId}/generate-note`,
      {},
    );
  }

  // Catalyst Watch — watchlist phrase CRUD
  async getPhrases(): Promise<{ phrases: WatchlistPhrase[] }> {
    return this.client.get("/api/riskflow/phrases");
  }

  async addPhrase(data: {
    phrase: string;
    matchType?: "contains" | "exact";
    repeating?: boolean;
  }): Promise<{ phrase: WatchlistPhrase; removedBias: string[] }> {
    return this.client.post("/api/riskflow/phrases", data);
  }

  async refinePhrase(data: {
    phrase: string;
    intelligenceLevel?: string;
  }): Promise<{ phrase: string; degraded?: boolean }> {
    return this.client.post("/api/riskflow/phrases/refine", data);
  }

  async updatePhrase(
    id: number,
    data: {
      phrase: string;
      matchType?: "contains" | "exact";
      repeating?: boolean;
    },
  ): Promise<{ phrase: WatchlistPhrase; removedBias: string[] }> {
    return this.client.patch(`/api/riskflow/phrases/${id}`, data);
  }

  async deletePhrase(id: number): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/riskflow/phrases/${id}`);
  }
}

export interface WatchlistPhrase {
  id: number;
  userId: string;
  phrase: string;
  phraseLower: string;
  isActive: boolean;
  matchType: "contains" | "exact";
  repeating: boolean;
  matchCount: number;
  lastMatchedAt: string | null;
  createdAt: string;
}
