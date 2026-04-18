// [claude-code 2026-04-18] Unified with emit.ts schema: category/severity/body/url/fingerprint/suppressed
/**
 * Notification Types
 * Type definitions for user notifications (in-app history + push log)
 */

export type PushCategory =
  | "riskflow"
  | "dailyBrief"
  | "regimeActivations"
  | "toolApprovals"
  | "chat_relay"
  | "test"
  | "system";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Notification {
  id: string;
  userId: string;
  category: string;
  severity: Severity;
  title: string;
  body: string;
  url?: string;
  fingerprint?: string;
  eventId?: string;
  suppressed: boolean;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface NotificationInsert {
  userId: string;
  category: string;
  severity: Severity;
  title: string;
  body: string;
  url?: string;
  fingerprint?: string;
  eventId?: string;
  suppressed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}
