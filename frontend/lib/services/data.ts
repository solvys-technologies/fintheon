/**
 * EconCalendar, Data, and MarketData Services
 */

import ApiClient from "../apiClient";
import type {
  StockQuote,
  VixData,
  GammaExposure,
  OptionsWall,
  OptionsFlow,
  MarketContext,
  IVScoreResponse,
} from "../../types/market-data";

// Econ Calendar Service
export interface EconEventItem {
  id: string;
  name: string;
  date?: string;
  time?: string;
  country: string;
  importance: 1 | 2 | 3;
  forecast?: string;
  previous?: string;
  actual?: string;
  category?: string;
  definition?: string;
  aiTicker?: string;
}

export interface EconPrintItem {
  id: string;
  eventName: string;
  date: string;
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  surprise: number | null;
  direction: "beat" | "miss" | "inline" | null;
  goodBeta: boolean;
}

export class EconCalendarService {
  constructor(private client: ApiClient) {}

  async getEvents(params?: {
    from?: string;
    to?: string;
  }): Promise<EconEventItem[]> {
    try {
      const query = new URLSearchParams();
      if (params?.from) query.append("from", params.from);
      if (params?.to) query.append("to", params.to);
      const suffix = query.toString() ? `?${query.toString()}` : "";
      const res = await this.client.get<{ events: EconEventItem[] }>(
        `/api/data/econ-calendar${suffix}`,
      );
      return res.events ?? [];
    } catch {
      return [];
    }
  }

  async getPrints(eventName?: string): Promise<EconPrintItem[]> {
    try {
      const suffix = eventName ? `?event=${encodeURIComponent(eventName)}` : "";
      const res = await this.client.get<{ prints: EconPrintItem[] }>(
        `/api/data/econ-prints${suffix}`,
      );
      return res.prints ?? [];
    } catch {
      return [];
    }
  }
}

// Data Service (Supabase-backed)
export interface TradeIdeaItem {
  id: string;
  title: string;
  ticker: string;
  direction: "long" | "short" | "neutral";
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  potentialRisk?: number;
  potentialProfit?: number;
  riskRewardRatio?: number;
  confidence?: string;
  timeframe?: string;
  sourceAgent?: string;
  hermesDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceResponse {
  kpis: Array<{ label: string; value: string; meta: string }>;
  count: number;
  fetchedAt: string;
}

export class DataService {
  constructor(private client: ApiClient) {}

  async getTradeIdeas(): Promise<TradeIdeaItem[]> {
    try {
      const res = await this.client.get<{ tradeIdeas: TradeIdeaItem[] }>(
        "/api/data/trade-ideas",
      );
      return res.tradeIdeas ?? [];
    } catch {
      return [];
    }
  }

  async getPerformance(): Promise<PerformanceResponse> {
    try {
      return await this.client.get<PerformanceResponse>(
        "/api/data/performance",
      );
    } catch {
      return { kpis: [], count: 0, fetchedAt: new Date().toISOString() };
    }
  }

  async getMdbBrief(): Promise<{
    items: Array<{ title: string; detail: string }>;
    briefType?: string;
  }> {
    try {
      const res = await this.client.get<{
        items: Array<{ title: string; detail: string }>;
        briefType?: string;
      }>("/api/data/brief");
      return { items: res.items ?? [], briefType: res.briefType };
    } catch {
      return { items: [] };
    }
  }

  async getSchedule(): Promise<
    Array<{
      title: string;
      detail: string;
      forecast?: string;
      actual?: string;
      previous?: string;
      date?: string;
    }>
  > {
    try {
      const res = await this.client.get<{
        items: Array<{
          title: string;
          detail: string;
          forecast?: string;
          actual?: string;
          previous?: string;
          date?: string;
        }>;
      }>("/api/data/schedule");
      return res.items ?? [];
    } catch {
      return [];
    }
  }

  async generateMdbReport(): Promise<{
    content: string;
    briefType: string;
    generatedAt: string;
  }> {
    try {
      return await this.client.post<{
        content: string;
        briefType: string;
        generatedAt: string;
      }>("/api/data/brief/generate", {});
    } catch {
      return {
        content: "",
        briefType: "MDB",
        generatedAt: new Date().toISOString(),
      };
    }
  }

  /** Update trade idea status (Approved/Rejected/Closed) */
  async updateTradeIdeaStatus(
    pageId: string,
    status: string,
  ): Promise<boolean> {
    try {
      await this.client.patch<{ success: boolean }>(
        `/api/data/trade-ideas/${pageId}/status`,
        { status },
      );
      return true;
    } catch {
      return false;
    }
  }
}

// Market Data Service
export class MarketDataService {
  constructor(private client: ApiClient) {}

  async getQuote(symbol: string): Promise<StockQuote> {
    return this.client.get<StockQuote>(
      `/api/market-data/quote/${encodeURIComponent(symbol)}`,
    );
  }

  async getVix(): Promise<VixData> {
    return this.client.get<VixData>("/api/market-data/vix");
  }

  async getGex(symbol: string): Promise<GammaExposure> {
    return this.client.get<GammaExposure>(
      `/api/market-data/gex/${encodeURIComponent(symbol)}`,
    );
  }

  async getWalls(symbol: string): Promise<OptionsWall> {
    return this.client.get<OptionsWall>(
      `/api/market-data/walls/${encodeURIComponent(symbol)}`,
    );
  }

  async getFlow(symbol: string, limit?: number): Promise<OptionsFlow> {
    const suffix = limit ? `?limit=${limit}` : "";
    return this.client.get<OptionsFlow>(
      `/api/market-data/flow/${encodeURIComponent(symbol)}${suffix}`,
    );
  }

  async getContext(symbol: string): Promise<MarketContext> {
    return this.client.get<MarketContext>(
      `/api/market-data/context/${encodeURIComponent(symbol)}`,
    );
  }

  async getIVScore(
    instrument?: string,
    price?: number,
  ): Promise<IVScoreResponse> {
    const params = new URLSearchParams();
    if (instrument) params.append("instrument", instrument);
    if (price) params.append("price", price.toString());
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return this.client.get<IVScoreResponse>(
      `/api/market-data/iv-score${suffix}`,
    );
  }
}
