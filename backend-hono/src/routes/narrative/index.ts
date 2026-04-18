// [claude-code 2026-03-30] Narrative routes — threads, card-links, LLM scoring
import { Hono } from "hono";
import {
  scoreRiskflow,
  scoreBrief,
  researchDrill,
  getThreads,
  getCardLinks,
  getCatalysts,
  getCatalystById,
} from "./handlers.js";

export function createNarrativeRoutes(): Hono {
  const app = new Hono();
  app.get("/threads", getThreads);
  app.get("/card-links", getCardLinks);
  app.get("/catalysts", getCatalysts);
  // [S25] Single-catalyst lookup for mobile DetailSheet. Param last so `/catalysts/:id` wins after `/catalysts`.
  app.get("/catalysts/:id", getCatalystById);
  app.post("/score-riskflow", scoreRiskflow);
  app.post("/score-brief", scoreBrief);
  app.post("/research-drill", researchDrill);
  return app;
}
