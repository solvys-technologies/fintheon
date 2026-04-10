// [claude-code 2026-03-11] Track 7A: Journal route registration
import { Hono } from "hono";
import {
  handleListEntries,
  handleSaveEntry,
  handleGetSummary,
} from "./handlers.js";

export function createJournalRoutes(): Hono {
  const router = new Hono();

  router.get("/entries", handleListEntries);
  router.post("/entries", handleSaveEntry);
  router.get("/summary", handleGetSummary);

  return router;
}
