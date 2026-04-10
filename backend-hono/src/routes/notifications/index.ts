/**
 * Notification Routes
 * Route registration for /api/notifications endpoints
 */

import { Hono } from "hono";
import {
  handleGetNotifications,
  handleMarkAsRead,
  handleMarkAllAsRead,
} from "./handlers.js";

export function createNotificationRoutes(): Hono {
  const router = new Hono();

  // GET /api/notifications - List user notifications
  router.get("/", handleGetNotifications);

  // POST /api/notifications/:id/read - Mark notification as read
  router.post("/:id/read", handleMarkAsRead);

  // POST /api/notifications/read-all - Mark all as read
  router.post("/read-all", handleMarkAllAsRead);

  return router;
}
