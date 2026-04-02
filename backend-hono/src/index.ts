// [claude-code 2026-03-20] Overhauled: structured errors, JSON logging, boot consolidation
/**
 * Fintheon API - Main Entry Point
 * Hono backend on Fly.io
 */

import 'dotenv/config';
import { validateEnv } from './boot/index.js';
validateEnv();

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { corsConfig } from './config/cors.js';
import { getEnvConfig, isDev } from './config/env.js';
import { registerRoutes } from './routes/index.js';
import { createHealthService } from './services/health-service.js';
import { AppError } from './errors/index.js';
import { createLogger } from './lib/logger.js';
import { bootServices } from './boot/services.js';

const log = createLogger('API');
const app = new Hono();
const healthService = createHealthService();
const config = getEnvConfig();

// CORS middleware
app.use('*', cors(corsConfig));

// Request ID middleware
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') || crypto.randomUUID();
  c.header('X-Request-Id', requestId);
  await next();
});

// Health check endpoint
app.get('/health', async (c) => {
  const health = await healthService.checkAll();
  const statusCode: ContentfulStatusCode =
    health.status === 'ok' ? 200 : health.status === 'degraded' ? 207 : 503;
  return c.json(health, statusCode);
});

// Register all API routes
registerRoutes(app);

// Global error handler
app.onError((err, c) => {
  const requestId = c.req.header('x-request-id') || 'unknown';

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
      err.statusCode as ContentfulStatusCode
    );
  }

  const status = ((err as { status?: number }).status ?? 500) as ContentfulStatusCode;
  log.error(err instanceof Error ? err.message : String(err), {
    requestId,
    status,
    method: c.req.method,
    path: c.req.path,
    stack: isDev && err instanceof Error ? err.stack : undefined,
  });

  return c.json(
    {
      error: status >= 500 ? 'Internal server error' : err.message,
      code: 'INTERNAL_ERROR',
      requestId,
    },
    status
  );
});

// 404 handler
app.notFound((c) => {
  const requestId = c.req.header('x-request-id') || 'unknown';
  return c.json({ error: 'Not found', code: 'NOT_FOUND', requestId }, 404);
});

// Start server
serve({ fetch: app.fetch, port: config.PORT });

log.info('Server started', { port: config.PORT, env: config.NODE_ENV });

// Boot background services
bootServices();

export default app;
