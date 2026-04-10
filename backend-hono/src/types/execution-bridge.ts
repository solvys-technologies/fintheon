// [claude-code 2026-03-28] S5-T1: Foundation types for execution bridge, reconciler, and trade runs

// ── Bridge HTTP Interface Types ──

export interface BridgeHealthResponse {
  connected: boolean;
  system: string;
  account: string;
  message: string;
}

export interface BridgeExecuteRequest {
  model: string; // 'flush' | 'ripper' | '40_40_club'
  direction: "long" | "short";
  symbol: string; // 'MNQ', 'ES', etc.
  confluence_score: number;
  position_size: number;
  entry_price: number | null; // null = market order
  stop_loss_ticks: number;
  take_profit_ticks: number;
  hour_fib_context?: HourFibContext;
  signal_metadata?: SignalMetadata;
}

export interface BridgeExecuteResponse {
  status: "filled" | "rejected" | "pending" | "error";
  order_id: string;
  fill_price: number | null;
  timestamp: string;
  message: string;
}

export interface BridgePositionResponse {
  positions: BridgePosition[];
  account_id: string;
}

export interface BridgePosition {
  contract_id: string;
  symbol: string;
  direction: "long" | "short";
  size: number;
  average_price: number;
  unrealized_pnl: number;
}

export interface BridgeAccountResponse {
  account_id: string;
  balance: number;
  buying_power: number;
  can_trade: boolean;
  pdpt_remaining: number;
}

// ── Algo Playbook Types ──

export interface HourFibContext {
  hour: number;
  sweep_occurred: "high" | "low" | "none";
  fib_1_41_probability: number;
  fib_1_68_probability: number;
  post_sweep_retrace_probability: number;
}

export interface SignalMetadata {
  pmi_chain_active: boolean;
  narrative_bias: "bullish" | "bearish" | "neutral";
  session: "premarket" | "NY_open" | "lunch" | "PM" | "after_hours";
}

// ── Reconciler Types ──

export enum ReconcilerState {
  IDLE = "IDLE",
  ORDER_SENT = "ORDER_SENT",
  PENDING_CONFIRM = "PENDING_CONFIRM",
  FILLED = "FILLED",
  REJECTED = "REJECTED",
  TIMEOUT = "TIMEOUT",
  RECONCILING = "RECONCILING",
  CORRECTED = "CORRECTED",
  ALERT = "ALERT",
}

export interface ReconcilerRules {
  maxOrdersPerMinute: number; // 2
  confirmationTimeoutSec: number; // 8
  duplicateWindowSec: number; // 30
  hardStopTime: string; // '11:30' ET
  maxConcurrentPositions: number; // 1
  pdptBufferUsd: number; // 50 ($1,550 - $50 = $1,500 actual floor)
  reconnectBackoffSec: number[]; // [2, 4, 8, 16, 32]
}

export interface ReconcilerOrder {
  id: string;
  state: ReconcilerState;
  symbol: string;
  direction: "long" | "short";
  bridgeOrderId?: string;
  sentAt: number;
  confirmedAt?: number;
  retryCount: number;
  lastError?: string;
}

// ── Trade Run Types ──

export interface TradeRun {
  id: string;
  timestamp: string;
  model: string;
  symbol: string;
  direction: "long" | "short";
  confluenceScore: number;
  entryPrice: number | null;
  fillPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  exitPrice: number | null;
  pnl: number | null;
  hourOfDay: number;
  session: string;
  fibContext: HourFibContext | null;
  signalMetadata: SignalMetadata | null;
  reconcilerStatus: ReconcilerState;
  featuresFired: Record<string, unknown> | null;
  modelPrediction: Record<string, unknown> | null;
  proposalId?: string;
}
