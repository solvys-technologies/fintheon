/**
 * Account Routes
 * Route registration for /api/account endpoints
 */

import { Hono } from "hono";
import {
  handleGetAccount,
  handleCreateAccount,
  handleUpdateSettings,
  handleGetTier,
  handleUpdateTier,
  handleSelectTier,
  handleGetFeatures,
} from "./handlers.js";

export function createAccountRoutes(): Hono {
  const router = new Hono();

  // GET /api/account - Get current user account
  router.get("/", handleGetAccount);

  // POST /api/account - Create new account
  router.post("/", handleCreateAccount);

  // PATCH /api/account/settings - Update account settings
  router.patch("/settings", handleUpdateSettings);

  // GET /api/account/tier - Get user tier
  router.get("/tier", handleGetTier);

  // PATCH /api/account/tier - Update user tier (idempotent)
  router.patch("/tier", handleUpdateTier);

  // POST /api/account/select-tier - Select tier
  router.post("/select-tier", handleSelectTier);

  // GET /api/account/features - Get feature access
  router.get("/features", handleGetFeatures);

  return router;
}
