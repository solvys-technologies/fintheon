/**
 * Notification Types
 * Type definitions for user notifications
 */

export type NotificationType =
  | "system"
  | "alert"
  | "trade"
  | "news"
  | "achievement";
export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  readAt?: Date;
}

export interface CreateNotificationRequest {
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown>;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}
