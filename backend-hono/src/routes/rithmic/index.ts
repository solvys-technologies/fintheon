/**
 * Rithmic Routes
 * Route registration for /api/rithmic endpoints
 */

import { Hono } from "hono";
import { handleGetStatus } from "./handlers.js";

export function createRithmicRoutes(): Hono {
  const router = new Hono();
  router.get("/status", handleGetStatus);
  return router;
}
