// [claude-code 2026-04-18] Unified with emit.ts schema: category/severity/body/url/fingerprint/suppressed
// [claude-code 2026-04-25] S35-Unified: clearedAt + dismissedVia for cross-device clear sync
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
  clearedAt?: Date;
  /** Endpoint of the device that dismissed/cleared this row. Receivers skip self-echo on __sync. */
  dismissedVia?: string;
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
