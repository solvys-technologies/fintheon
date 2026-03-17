/**
 * Notification Service
 * Business logic for notification operations
 */

import * as notificationQueries from '../db/queries/notifications.js';
import type { Notification, NotificationListResponse } from '../types/notifications.js';

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  limit = 50
): Promise<NotificationListResponse> {
  const notifications = await notificationQueries.getNotificationsByUserId(userId, limit);
  const unreadCount = await notificationQueries.getUnreadCount(userId);

  return {
    notifications,
    total: notifications.length,
    unreadCount,
  };
}

/**
 * Mark a specific notification as read
 */
export async function markAsRead(
  userId: string,
  notificationId: string
): Promise<Notification | null> {
  return notificationQueries.markAsRead(userId, notificationId);
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<{ markedCount: number }> {
  const count = await notificationQueries.markAllAsRead(userId);
  return { markedCount: count };
}

/**
 * Generate mock notifications for development/demo
 */
export function getMockNotifications(userId: string): NotificationListResponse {
  const now = new Date();
  const mockNotifications: Notification[] = [
    {
      id: '1',
      userId,
      type: 'alert',
      title: 'VIX Spike Detected',
      message: 'VIX increased by 15% in the last hour. Consider adjusting positions.',
      priority: 'high',
      isRead: false,
      createdAt: new Date(now.getTime() - 5 * 60_000),
    },
    {
      id: '2',
      userId,
      type: 'trade',
      title: 'Order Filled',
      message: 'Your limit order for ES 5200.00 has been filled.',
      priority: 'medium',
      isRead: false,
      createdAt: new Date(now.getTime() - 30 * 60_000),
    },
    {
      id: '3',
      userId,
      type: 'news',
      title: 'Fed Minutes Released',
      message: 'FOMC meeting minutes show hawkish stance on inflation.',
      priority: 'high',
      isRead: true,
      createdAt: new Date(now.getTime() - 2 * 60 * 60_000),
      readAt: new Date(now.getTime() - 60 * 60_000),
    },
    {
      id: '4',
      userId,
      type: 'system',
      title: 'Welcome to Fintheon',
      message: 'Your account has been activated. Start trading with confidence.',
      priority: 'low',
      isRead: true,
      createdAt: new Date(now.getTime() - 24 * 60 * 60_000),
      readAt: new Date(now.getTime() - 23 * 60 * 60_000),
    },
  ];

  return {
    notifications: mockNotifications,
    total: mockNotifications.length,
    unreadCount: mockNotifications.filter((n) => !n.isRead).length,
  };
}
