// [claude-code 2026-04-24] S34-T1: /api/econ-filters route registration.

import { Hono } from "hono";
import {
  handleGetFilters,
  handleAddFilter,
  handleUpdateFilter,
  handleDeleteFilter,
} from "./handlers.js";

export function createEconFiltersRoutes(): Hono {
  const app = new Hono();

  app.get("/", handleGetFilters);
  app.post("/", handleAddFilter);
  app.patch("/:id", handleUpdateFilter);
  app.put("/:id", handleUpdateFilter);
  app.delete("/:id", handleDeleteFilter);

  return app;
}
