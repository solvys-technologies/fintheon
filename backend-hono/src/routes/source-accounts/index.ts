// [claude-code 2026-04-12] Source accounts route registration

import { Hono } from "hono";
import {
  handleGetAccounts,
  handleAddAccount,
  handleUpdateAccount,
  handleDeleteAccount,
} from "./handlers.js";

export function createSourceAccountRoutes(): Hono {
  const app = new Hono();

  app.get("/", handleGetAccounts);
  app.post("/", handleAddAccount);
  app.put("/:id", handleUpdateAccount);
  app.delete("/:id", handleDeleteAccount);

  return app;
}
