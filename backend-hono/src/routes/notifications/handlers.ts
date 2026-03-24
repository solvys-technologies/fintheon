/**
 * Notification Handlers
 * Request handlers for notification endpoints
 */

import type { Context } from 'hono';
import * as notificationService from '../../services/notification-service.js';
import { isDatabaseAvailable } from '../../config/database.js';

/**
 * GET /api/notifications
 * Get user notifications
 */
export async function handleGetNotifications(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    // If DB not available, return mock data
    if (!isDatabaseAvailable()) {
      const mockData = notificationService.getMockNotifications(userId);
      return c.json(mockData);
    }

    const limit = Number(c.req.query('limit')) || 50;
    const notifications = await notificationService.getNotifications(userId, limit);
    return c.json(notifications);
  } catch (error) {
    console.error('[Notifications] Get error:', error);
    return c.json({ error: 'Failed to fetch notifications' }, 500);
  }
}

/**
 * POST /api/notifications/:id/read
 * Mark a specific notification as read
 */
export async function handleMarkAsRead(c: Context) {
  const userId = c.get('userId') as string | undefined;
  const notificationId = c.req.param('id');

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!notificationId) {
    return c.json({ error: 'Notification ID is required' }, 400);
  }

  try {
    const notification = await notificationService.markAsRead(userId, notificationId);

    if (!notification) {
      return c.json({ error: 'Notification not found' }, 404);
    }

    return c.json({ success: true, notification });
  } catch (error) {
    console.error('[Notifications] Mark read error:', error);
    return c.json({ error: 'Failed to mark notification as read' }, 500);
  }
}

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read
 */
export async function handleMarkAllAsRead(c: Context) {
  const userId = c.get('userId') as string | undefined;

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const result = await notificationService.markAllAsRead(userId);
    return c.json({ success: true, markedCount: result.markedCount });
  } catch (error) {
    console.error('[Notifications] Mark all read error:', error);
    return c.json({ error: 'Failed to mark all notifications as read' }, 500);
  }
}
