// [claude-code 2026-03-19] T1: Development event types for Consilium Intelligence Layer

import type { BoardroomAgent } from "./boardroom.js";

export type DevelopmentCategory =
  | "risk_alert"
  | "trade_idea"
  | "regime_shift"
  | "standup"
  | "briefing"
  | "insight"
  | "market_event"
  | "huddle";

export type DevelopmentSeverity = "info" | "warning" | "critical";

export interface DevelopmentEvent {
  id: string;
  agent: BoardroomAgent;
  title: string;
  detail: string;
  category: DevelopmentCategory;
  severity: DevelopmentSeverity;
  timestamp: string;
  relatedInstruments?: string[];
}
