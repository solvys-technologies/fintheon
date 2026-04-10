/**
 * Rithmic route handlers
 */

import type { Context } from "hono";
import * as rithmicService from "../../services/rithmic-service.js";

/**
 * GET /api/rithmic/status
 */
export async function handleGetStatus(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const status = rithmicService.getConnectionStatus(userId);
  return c.json(status);
}
