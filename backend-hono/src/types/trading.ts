/**
 * Trading Types
 * Type definitions for trading operations
 */

export type PositionSide = "long" | "short";
export type PositionStatus = "open" | "closed" | "pending";

export interface Position {
  id: string;
  userId: string;
  symbol: string;
  side: PositionSide;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  realizedPnl: number;
  status: PositionStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PositionListResponse {
  positions: Position[];
  total: number;
  totalUnrealizedPnl: number;
}

export interface AlgoStatus {
  enabled: boolean;
  lastTriggered?: Date;
  activeStrategy?: string;
}

export interface ToggleAlgoRequest {
  enabled: boolean;
  strategy?: string;
}

export interface ToggleAlgoResponse {
  success: boolean;
  algoStatus: AlgoStatus;
}

// --- Test Trade Types ---

export type StrategyModel = "40-40-club" | "flush" | "ripper";
export type FibZone = "ripper" | "strong" | "weak";
export type EventSeverity = "standard" | "significant" | "major";
export type TradingMode = "combine" | "funded";

export interface TestTradeRequest {
  strategy: StrategyModel;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  stopPrice: number;
  emaPrice?: number;
  fibLevel?: number;
  fibZone?: FibZone;
  contracts?: number;
  mode?: TradingMode;
  catalyst?: string;
  eventSeverity?: EventSeverity;
  timingWindow?: string;
}

export interface TradeTarget {
  label: string;
  price: number;
  distancePoints: number;
  pnlPerContract: number;
  totalPnl: number;
}

export interface TestTradeResult {
  id: string;
  strategy: StrategyModel;
  symbol: string;
  side: PositionSide;
  contracts: number;
  entryPrice: number;
  stopPrice: number;
  stopDistancePoints: number;
  riskPerContract: number;
  totalRisk: number;
  targets: TradeTarget[];
  riskRewardRatio: number;
  maxScaleInContracts: number;
  pdptCap: number;
  fibZone?: FibZone;
  notes: string[];
  simulatedAt: Date;
}

export interface TestTradeResponse {
  success: boolean;
  trade: TestTradeResult;
}
