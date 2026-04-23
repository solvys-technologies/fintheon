/**
 * ProjectX Types
 * Type definitions for TopStepX integration
 */

// Enums
export enum OrderStatus {
  None = 0,
  Open = 1,
  Filled = 2,
  Cancelled = 3,
  Expired = 4,
  Rejected = 5,
  Pending = 6,
}

export enum OrderType {
  Unknown = 0,
  Limit = 1,
  Market = 2,
  StopLimit = 3,
  Stop = 4,
  TrailingStop = 5,
  JoinBid = 6,
  JoinAsk = 7,
}

export enum OrderSide {
  Buy = 0,
  Sell = 1,
}

export enum PositionType {
  Undefined = 0,
  Long = 1,
  Short = 2,
}

// API Response Types
export interface ProjectXAuthResponse {
  token: string;
  success: boolean;
  errorCode: number;
  errorMessage: string | null;
}

export interface ProjectXAccount {
  id: number;
  name: string;
  balance: number;
  canTrade: boolean;
  isVisible: boolean;
}

export interface ProjectXContract {
  id: string;
  name: string;
  description: string;
  tickSize: number;
  tickValue: number;
  activeContract: boolean;
  symbolId: string;
}

export interface ProjectXPosition {
  id: number;
  accountId: number;
  contractId: string;
  creationTimestamp: string;
  type: PositionType;
  size: number;
  averagePrice: number;
}

export interface ProjectXOrder {
  id: number;
  accountId: number;
  contractId: string;
  status: OrderStatus;
  type: OrderType;
  side: OrderSide;
  size: number;
  filledSize: number;
  limitPrice?: number | null;
  stopPrice?: number | null;
  trailPrice?: number | null;
  averagePrice?: number | null;
  creationTimestamp: string;
  lastUpdateTimestamp: string;
  customTag?: string | null;
}

// Credential Types
export interface ProjectXCredentials {
  username: string;
  apiKey: string;
}

// Request Types
export interface SyncCredentialsRequest {
  username: string;
  apiKey: string;
}

// Response Types
export interface AccountsResponse {
  accounts: ProjectXAccount[];
  syncedAt: string;
}

export interface PositionsResponse {
  positions: ProjectXPosition[];
  accountId: number;
}

export interface SyncResponse {
  success: boolean;
  accountCount: number;
  syncedAt: string;
}

// ── Bridge Order Types (used by execution bridge → ProjectX) ──

export interface PlaceOrderRequest {
  accountId: number;
  contractId: string;
  type: OrderType;
  side: OrderSide;
  size: number;
  limitPrice?: number;
  stopPrice?: number;
  customTag?: string;
}

export interface PlaceOrderResponse {
  success: boolean;
  orderId?: number;
  errorCode?: number;
  errorMessage?: string;
}

// ── S29-T1: Trade history types ──

import { z } from "zod";

export const ProjectXTradeSchema = z.object({
  id: z.string(),
  contract: z.string(),
  entryAt: z.string().datetime(),
  exitAt: z.string().datetime().nullable(),
  side: z.enum(["long", "short"]),
  qty: z.number().int().positive(),
  entryPrice: z.number(),
  exitPrice: z.number().nullable(),
  realizedPnL: z.number(),
});

export type ProjectXTrade = z.infer<typeof ProjectXTradeSchema>;

export const ProjectXTradesResponseSchema = z.object({
  trades: z.array(ProjectXTradeSchema),
});
