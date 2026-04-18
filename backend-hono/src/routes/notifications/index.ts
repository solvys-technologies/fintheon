// [claude-code 2026-04-18] Added /history and /history/mark-read for mobile NotificationBell
/**
 * Notification Routes
 * Route registration for /api/notifications endpoints
 */

import { Hono } from "hono";
import {
  handleGetNotifications,
  handleMarkAsRead,
  handleMarkAllAsRead,
  handleMarkReadBulk,
} from "./handlers.js";

export function createNotificationRoutes(): Hono {
  const router = new Hono();

  router.get("/", handleGetNotifications);
  router.get("/history", handleGetNotifications);
  router.post("/history/mark-read", handleMarkReadBulk);

  router.post("/:id/read", handleMarkAsRead);
  router.post("/read-all", handleMarkAllAsRead);

  return router;
}
