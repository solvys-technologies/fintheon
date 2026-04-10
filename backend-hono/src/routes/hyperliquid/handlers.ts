// [claude-code 2026-03-13] Hyperliquid route handlers
/**
 * Hyperliquid route handlers
 */

import type { Context } from "hono";
import * as hyperliquidService from "../../services/hyperliquid-service.js";

/**
 * GET /api/hyperliquid/status
 */
export async function handleGetStatus(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const status = await hyperliquidService.getConnectionStatus(userId);
  return c.json(status);
}

/**
 * GET /api/hyperliquid/positions
 */
export async function handleGetPositions(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const positions = await hyperliquidService.getPositions(userId);
  return c.json({ positions });
}

/**
 * GET /api/hyperliquid/account
 */
export async function handleGetAccountInfo(c: Context) {
  const userId = c.get("userId") as string | undefined;
  if (!userId) return c.json({ error: "Unauthorized" }, 401);

  const info = await hyperliquidService.getAccountInfo(userId);
  return c.json(info);
}
