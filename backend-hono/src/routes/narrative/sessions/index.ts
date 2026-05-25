import { Hono } from "hono";
import {
  handleAddMessage,
  handleAttachCatalysts,
  handleCreateSession,
  handleDeleteSession,
  handleGetSession,
  handleGetWorkEvents,
  handleListSessions,
  handlePutArtifact,
  handleRemoveCatalyst,
  handleReplaceCatalysts,
  handleUpdateSession,
} from "./handlers.js";
import { handleAssignCatalystBank } from "../catalyst-bank.js";

export function createNarrativeSessionRoutes(): Hono {
  const app = new Hono();
  app.get("/", handleListSessions);
  app.post("/", handleCreateSession);
  app.post("/:id/catalyst-bank/assign", handleAssignCatalystBank);
  app.get("/:id", handleGetSession);
  app.patch("/:id", handleUpdateSession);
  app.delete("/:id", handleDeleteSession);
  app.post("/:id/catalysts", handleAttachCatalysts);
  app.put("/:id/catalysts", handleReplaceCatalysts);
  app.delete("/:id/catalysts/:riskflowItemId", handleRemoveCatalyst);
  app.post("/:id/messages", handleAddMessage);
  app.get("/:id/work-events", handleGetWorkEvents);
  app.put("/:id/artifacts/:type", handlePutArtifact);
  return app;
}
