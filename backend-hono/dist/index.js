/**
 * Pulse API - Main Entry Point
 * Hono backend on Fly.io
 */
import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { corsConfig } from './config/cors.js';
import { getEnvConfig, isDev } from './config/env.js';
import { registerRoutes } from './routes/index.js';
import { createHealthService } from './services/health-service.js';
import { startFeedPoller } from './services/riskflow/feed-poller.js';
import { startNotionPoller } from './services/notion-poller.js';
import { startEconEnricher } from './services/cron/econ-enricher.js';
import { startEconTwitterPoller } from './services/twitter-cli/index.js';
import { initClaudeSDK } from './services/claude-sdk/process-manager.js';
import { initHermesAgent } from './services/hermes-handler.js';
import { startAutopilotScheduler } from './services/autopilot/autopilot-scheduler.js';
import { startContextBankTicker } from './services/context-bank/context-bank-service.js';
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
    const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 207 : 503;
    return c.json(health, statusCode);
});
// Register all API routes
registerRoutes(app);
// Global error handler
app.onError((err, c) => {
    const requestId = c.req.header('x-request-id') || 'unknown';
    const status = (err.status ?? 500);
    console.error('[API] Error:', {
        requestId,
        status,
        method: c.req.method,
        path: c.req.path,
        message: err instanceof Error ? err.message : String(err),
        stack: isDev && err instanceof Error ? err.stack : undefined,
    });
    return c.json({
        error: status >= 500 ? 'Internal server error' : err.message,
        requestId,
    }, status);
});
// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404));
// Start server
serve({ fetch: app.fetch, port: config.PORT });
console.log(`[API] Server started on port ${config.PORT}`);
console.log(`[API] Environment: ${config.NODE_ENV}`);
// Start background feed poller for real-time Level 4 detection
startFeedPoller();
// Start Notion polling (trade ideas + daily P&L)
startNotionPoller();
// Start econ calendar enricher (Notion calendar → RiskFlow feed)
startEconEnricher();
// Start econ-triggered twitter-cli poller (cookie-based, FJ emoji filtered)
startEconTwitterPoller();
// Start autopilot scheduler (30s cycle — proposal expiry, session detection)
startAutopilotScheduler();
// Start Context Bank ticker (120s — unified snapshot for all agents)
startContextBankTicker();
// Initialize Hermes/OpenRouter connection (health check — non-blocking)
initHermesAgent().catch((err) => console.warn('[API] Hermes init failed (non-fatal):', err));
// Initialize Claude SDK bridge (health check — non-blocking)
initClaudeSDK().catch((err) => console.warn('[API] Claude SDK init failed (non-fatal):', err));
export default app;
//# sourceMappingURL=index.js.map