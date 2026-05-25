// [claude-code 2026-04-24] S36 ClusterBeam — added POST /cluster-summary (auth stacked at mount point)
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
import { clusterSummary } from "./cluster-summary.js";
import { createNarrativeSensemaking } from "./sensemaking.js";
import { createNarrativeClassificationRoutes } from "./classification.js";
import { handleSearchCatalystBank } from "./catalyst-bank.js";
import { createDeskMapRoutes } from "./desk-map.js";
import { createNarrativeSessionRoutes } from "./sessions/index.js";
import {
  acceptNarrativeHypothesis,
  createNarrativeResearchTask,
  getNarrativeOrchestra,
  pinNarrativeHypothesis,
  rejectNarrativeHypothesis,
  researchNarrativeHypothesis,
} from "./orchestra.js";

export function createNarrativeRoutes(): Hono {
  const app = new Hono();
  app.get("/threads", getThreads);
  app.get("/card-links", getCardLinks);
  app.route("/sessions", createNarrativeSessionRoutes());
  app.route("/desk-map", createDeskMapRoutes());
  app.route("/classification", createNarrativeClassificationRoutes());
  app.get("/catalyst-bank", handleSearchCatalystBank);
  app.get("/orchestra", getNarrativeOrchestra);
  app.post("/sensemaking", createNarrativeSensemaking);
  app.post("/orchestra/:hypothesisId/accept", acceptNarrativeHypothesis);
  app.post("/orchestra/:hypothesisId/research", researchNarrativeHypothesis);
  app.post("/orchestra/:hypothesisId/reject", rejectNarrativeHypothesis);
  app.post("/orchestra/:hypothesisId/pin", pinNarrativeHypothesis);
  app.post("/orchestra/:hypothesisId/task", createNarrativeResearchTask);
  app.get("/catalysts", getCatalysts);
  // [S25] Single-catalyst lookup for mobile DetailSheet. Param last so `/catalysts/:id` wins after `/catalysts`.
  app.get("/catalysts/:id", getCatalystById);
  app.post("/score-riskflow", scoreRiskflow);
  app.post("/score-brief", scoreBrief);
  app.post("/research-drill", researchDrill);
  // [S36] Cluster summary — auth stacked at /api/narrative/cluster-summary mount in routes/index.ts
  app.post("/cluster-summary", clusterSummary);
  return app;
}
