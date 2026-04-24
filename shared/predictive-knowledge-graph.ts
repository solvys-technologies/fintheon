// [claude-code 2026-04-23] S31-T9 predictive knowledge graph + feature proposals — shared types

export interface UsageEvent {
  surface: string;
  action: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

export type FeatureProposalStatus =
  | "proposed"
  | "accepted"
  | "dismissed"
  | "scaffolded";

export interface FeatureProposal {
  id: string;
  userId: string;
  proposedAt: string;
  anchorSurface: string;
  title: string;
  description: string;
  status: FeatureProposalStatus;
  decidedAt: string | null;
}

export interface IntentSurfaceRow {
  surface: string;
  events: number;
  distinctActions: number;
  trend: "up" | "down" | "flat";
  trendDelta: number;
}

export interface IntentResponse {
  windowDays: number;
  surfaces: IntentSurfaceRow[];
  totalEvents: number;
}
