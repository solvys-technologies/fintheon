/**
 * RiskFlow Service
 */

import ApiClient from "../apiClient";
import { decodeHtmlEntities } from '../html-entities';
import type { RiskFlowItem } from '../../types/api';

export interface RiskFlowListResponse {
  items: RiskFlowItem[];
  total?: number;
  hasMore?: boolean;
}

// RiskFlow Service
export class RiskFlowService {
  constructor(private client: ApiClient) { }

  async list(params?: { limit?: number; offset?: number; symbol?: string; minMacroLevel?: number; instrument?: string }): Promise<RiskFlowListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());
    if (params?.symbol) query.append('symbols', params.symbol); // Backend expects 'symbols' not 'symbol'
    if (params?.instrument) query.append('instrument', params.instrument);
    // Allow frontend to override minMacroLevel for debugging (default is 3)
    if (params?.minMacroLevel !== undefined) {
      query.append('minMacroLevel', params.minMacroLevel.toString());
    }

    const queryString = query.toString();
    const endpoint = `/api/riskflow/feed${queryString ? `?${queryString}` : ''}`;
    try {
      const response = await this.client.get<{ items?: any[]; total?: number; hasMore?: boolean; fetchedAt?: string; error?: string }>(endpoint);

      if (!response || typeof response !== 'object' || Object.keys(response).length === 0) {
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
            typeof item.pointRange === 'number'
              ? item.pointRange
              : typeof priceBrainScore?.impliedPoints === 'number'
              ? priceBrainScore.impliedPoints
              : null;
          const direction =
            item.direction === 'Bullish' || item.direction === 'Bearish' || item.direction === 'Neutral'
              ? item.direction
              : priceBrainScore?.sentiment === 'Bullish' || priceBrainScore?.sentiment === 'Bearish' || priceBrainScore?.sentiment === 'Neutral'
              ? priceBrainScore.sentiment
              : null;

          return {
            id: item.id?.toString() || '',
            title: decodeHtmlEntities(item.headline || item.title || ''), // Map headline to title
            content: decodeHtmlEntities(item.body || item.content || ''), // Map body to content
            summary: decodeHtmlEntities(item.body || item.content || ''), // Also set summary for compatibility
            source: item.source || '',
            url: item.url,
            publishedAt: item.publishedAt || item.published_at || new Date().toISOString(),
            impact: ivScore > 7 ? 'high' : ivScore > 4 ? 'medium' : 'low',
            symbols: item.symbols || [],
            sentiment: item.sentiment || 'neutral',
            ivScore: ivScore,
            ivImpact: ivScore, // Also set ivImpact for backward compatibility
            pointRange,
            direction,
            macroLevel: macroLevel,
            isBreaking: item.isBreaking || false,
            category: item.source || '',
            tags: item.tags || [],
            urgency: item.urgency || 'normal',
            priceBrainScore,
            authorHandle: item.authorHandle ?? undefined,
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
      await this.client.post('/api/riskflow/seed', {});
    } catch (error) {
      // Seed failed — swallow
      throw error;
    }
  }

  async refresh(): Promise<{ success: boolean; refreshedAt: string }> {
    return this.client.post<{ success: boolean; refreshedAt: string }>('/api/riskflow/refresh', {});
  }

  async fetchVIX(): Promise<{ value: number }> {
    return this.client.get<{ value: number }>('/api/market/vix');
  }

  async generateNote(itemId: string): Promise<{ note: string }> {
    return this.client.post<{ note: string }>(`/api/riskflow/${itemId}/generate-note`, {});
  }
}
