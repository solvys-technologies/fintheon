// [claude-code 2026-03-20] Terminal routes: local-dev shell execution via SSE
import { Hono } from "hono";
import { handleRun, handleStream, handleKill } from "./handlers.js";

export function createTerminalRoutes(): Hono {
  const router = new Hono();
  router.post("/run", handleRun);
  router.get("/stream/:processId", handleStream);
  router.post("/kill/:processId", handleKill);
  return router;
}
