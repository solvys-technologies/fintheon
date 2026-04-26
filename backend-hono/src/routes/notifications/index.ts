// [claude-code 2026-04-18] Added /history and /history/mark-read for mobile NotificationBell
// [claude-code 2026-04-25] S35-Unified: clear-one + clear-all endpoints for cross-device sync
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
  handleClearOne,
  handleClearAll,
} from "./handlers.js";

export function createNotificationRoutes(): Hono {
  const router = new Hono();

  router.get("/", handleGetNotifications);
  router.get("/history", handleGetNotifications);
  router.post("/history/mark-read", handleMarkReadBulk);

  // Clear-all must be registered BEFORE /:id/* parametric routes so Hono picks
  // the literal handler — otherwise "clear-all" would be matched as an id.
  router.post("/clear-all", handleClearAll);
  router.post("/read-all", handleMarkAllAsRead);

  router.post("/:id/read", handleMarkAsRead);
  router.post("/:id/clear", handleClearOne);

  return router;
}
