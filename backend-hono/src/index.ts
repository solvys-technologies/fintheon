// [claude-code 2026-04-04] Secrets vault: loads env from Supabase before validateEnv so fresh devices work without .env
// [claude-code 2026-03-20] Overhauled: structured errors, JSON logging, boot consolidation
/**
 * Fintheon API - Main Entry Point
 * Hono backend on Fly.io
 */

import "dotenv/config";
import { loadSecretsFromVault } from "./config/secrets-vault.js";
import { validateEnv } from "./boot/index.js";

// Vault loads async (reads Supabase), then validateEnv checks the merged result.
// Local .env values take precedence — vault only fills gaps.
await loadSecretsFromVault().catch((err) => {
  console.warn(
    "[boot] Secrets vault unavailable, using local .env only:",
    err.message ?? err,
  );
});
validateEnv();

import { Hono } from "hono";
import { cors } from "hono/cors";
// serve import removed — Bun auto-serves via default export
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { corsConfig } from "./config/cors.js";
import { getEnvConfig, isDev } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import { createHealthService } from "./services/health-service.js";
import { AppError } from "./errors/index.js";
import { createLogger } from "./lib/logger.js";
import { bootCritical, bootBackground } from "./boot/services.js";
import {
  markActivity,
  armIdleShutdown,
  disarmIdleShutdown,
  getLifecycleState,
} from "./services/lifecycle.js";

const log = createLogger("API");
const app = new Hono();
const healthService = createHealthService();
const config = getEnvConfig();

// CORS middleware
app.use("*", cors(corsConfig));

// Activity tracking middleware (for idle shutdown)
app.use("*", async (c, next) => {
  markActivity();
  await next();
});

// Request ID middleware
app.use("*", async (c, next) => {
  const requestId = c.req.header("x-request-id") || crypto.randomUUID();
  c.header("X-Request-Id", requestId);
  await next();
});

// Health check endpoint (includes service registry data)
app.get("/health", async (c) => {
  const health = await healthService.checkAll();
  const { getStatus } = await import("./services/health-registry.js");
  const registry = getStatus();
  const statusCode: ContentfulStatusCode =
    health.status === "ok" ? 200 : health.status === "degraded" ? 207 : 503;
  return c.json({ ...health, serviceRegistry: registry }, statusCode);
});

// Lifecycle endpoints — idle shutdown management
// [claude-code 2026-04-16] Used by Electron to arm/disarm idle timeout on app close/open
app.post("/api/lifecycle/arm-idle-shutdown", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const timeoutMs =
    typeof body.timeoutMs === "number" ? body.timeoutMs : 3600_000; // default 1h
  armIdleShutdown(timeoutMs);
  return c.json({ armed: true, timeoutMs });
});

app.post("/api/lifecycle/disarm-idle-shutdown", async (c) => {
  disarmIdleShutdown();
  return c.json({ armed: false });
});

app.get("/api/lifecycle/status", (c) => {
  return c.json(getLifecycleState());
});

// Register all API routes
registerRoutes(app);

// Global error handler
app.onError((err, c) => {
  const requestId = c.req.header("x-request-id") || "unknown";

  if (err instanceof AppError) {
    log.error(err.message, {
      code: err.code,
      statusCode: err.statusCode,
      requestId,
      method: c.req.method,
      path: c.req.path,
      ...err.context,
    });
    return c.json(
      { error: err.message, code: err.code, context: err.context, requestId },
      err.statusCode as ContentfulStatusCode,
    );
  }

  const status = ((err as { status?: number }).status ??
    500) as ContentfulStatusCode;
  log.error(err instanceof Error ? err.message : String(err), {
    requestId,
    status,
    method: c.req.method,
    path: c.req.path,
    stack: isDev && err instanceof Error ? err.stack : undefined,
  });

  return c.json(
    {
      error: status >= 500 ? "Internal server error" : err.message,
      code: "INTERNAL_ERROR",
      requestId,
    },
    status,
  );
});

// 404 handler
app.notFound((c) => {
  const requestId = c.req.header("x-request-id") || "unknown";
  return c.json({ error: "Not found", code: "NOT_FOUND", requestId }, 404);
});

log.info("Server starting", { port: config.PORT, env: config.NODE_ENV });

// Two-phase boot: critical services before listen, background after
bootCritical().then(() => {
  log.info("Critical services ready — server accepting requests");
  // Background services boot after listen via queueMicrotask
  queueMicrotask(() => {
    bootBackground().catch((err) =>
      log.error("Background boot failed", { error: String(err) }),
    );
  });
});

// Bun auto-serves via default export. Node needs @hono/node-server.
if (typeof globalThis.Bun === "undefined") {
  import("@hono/node-server").then(async ({ serve }) => {
    const server = serve({
      fetch: app.fetch,
      port: config.PORT,
      hostname: "0.0.0.0",
    }) as any;
    // SSE streams (Harper chat, cognition) can run 10+ minutes during tool-call loops.
    // Disable ALL Node HTTP server timeouts to prevent mid-stream kills.
    server.requestTimeout = 0; // Node 18+ (default 300s)
    server.headersTimeout = 0; // Header receive timeout (default 60s)
    server.timeout = 0; // Legacy socket idle timeout (default 0 but some envs set it)
    server.keepAliveTimeout = 0; // Keep-alive idle timeout
    log.info("Server listening (Node, no timeouts)", { port: config.PORT });

    // Attach relay WebSocket server for mobile↔local backend bridge (T6)
    const { attachRelayWebSocket } = await import("./boot/relay-ws.js");
    attachRelayWebSocket(server);
  });
}

// SSE streams (Harper chat, cognition) go silent for 30s+ during tool calls.
// Bun's default idleTimeout (10s) kills these connections → ERR_INCOMPLETE_CHUNKED_ENCODING.
export default {
  fetch: app.fetch,
  port: config.PORT,
  idleTimeout: 0,
};
