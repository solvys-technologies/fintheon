// [claude-code 2026-03-23] Trade ideas route — merged proposals + Supabase trade ideas
import { Hono } from "hono";
import { handleGetTradeIdeas } from "./handlers.js";

export function createTradeIdeasRoutes(): Hono {
  const router = new Hono();

  // GET /api/trade-ideas — unified, deduplicated trade idea cards
  router.get("/", handleGetTradeIdeas);

  return router;
}
