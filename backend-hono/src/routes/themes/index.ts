import { Hono } from "hono";
import {
  handleListThemes,
  handleGetTheme,
  handleCreateTheme,
  handleUpdateTheme,
  handleGetCatalysts,
  handleGetDrift,
} from "./handlers.js";

export function createThemeRoutes(): Hono {
  const app = new Hono();

  app.get("/", handleListThemes);
  app.get("/:id", handleGetTheme);
  app.post("/", handleCreateTheme);
  app.patch("/:id", handleUpdateTheme);
  app.get("/:id/catalysts", handleGetCatalysts);
  app.get("/:id/drift", handleGetDrift);

  return app;
}
