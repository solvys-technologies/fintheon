/**
 * Fintheon API - Main Entry Point
 * Hono backend on Fly.io
 */
// [claude-code 2026-03-16] Added static file serving for Electron + Clerk auth
import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import path from 'path';
import fs from 'fs';
import { corsConfig } from './config/cors.js';
import { getEnvConfig, isDev } from './config/env.js';
import { registerRoutes } from './routes/index.js';
import { createHealthService } from './services/health-service.js';
import { startFeedPoller, stopFeedPoller } from './services/riskflow/feed-poller.js';
import { startNotionPoller, stopNotionPoller } from './services/notion-poller.js';
import { startEconEnricher, stopEconEnricher } from './services/cron/econ-enricher.js';
import { startEconTwitterPoller, stopEconTwitterPoller } from './services/twitter-cli/index.js';
import { startCentralScorer, stopCentralScorer } from './services/riskflow/central-scorer.js';
import { initClaudeSDK } from './services/claude-sdk/process-manager.js';
import { initHermesAgent } from './services/hermes-handler.js';
import { startAutopilotScheduler, stopAutopilotScheduler } from './services/autopilot/autopilot-scheduler.js';
import { startContextBankTicker, stopContextBankTicker } from './services/context-bank/context-bank-service.js';
import { startBoardroomScheduler, stopBoardroomScheduler } from './services/cron/boardroom-scheduler.js';
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
// Serve frontend static files (Electron loads from http://localhost:8080)
const frontendDist = path.resolve(import.meta.dirname, '..', '..', 'dist');
if (fs.existsSync(frontendDist)) {
    app.use('/*', serveStatic({ root: path.relative(process.cwd(), frontendDist) }));
    // SPA fallback: serve index.html for non-API routes (Clerk routing)
    app.notFound((c) => {
        if (c.req.path.startsWith('/api/')) {
            return c.json({ error: 'Not found' }, 404);
        }
        const indexPath = path.join(frontendDist, 'index.html');
        if (fs.existsSync(indexPath)) {
            const html = fs.readFileSync(indexPath, 'utf-8');
            return c.html(html);
        }
        return c.json({ error: 'Not found' }, 404);
    });
}
else {
    // 404 handler (no frontend build available)
    app.notFound((c) => c.json({ error: 'Not found' }, 404));
}
// Start server
serve({ fetch: app.fetch, port: config.PORT });
console.log(`[API] Server started on port ${config.PORT}`);
console.log(`[API] Environment: ${config.NODE_ENV}`);
// [claude-code 2026-03-19] Polling gated by DISABLE_AUTO_POLLING env var
let pollingActive = false;
function startAllPollers() {
    if (pollingActive)
        return;
    startFeedPoller();
    startNotionPoller();
    startEconEnricher();
    startEconTwitterPoller();
    startAutopilotScheduler();
    startContextBankTicker();
    startCentralScorer();
    startBoardroomScheduler();
    pollingActive = true;
    console.log('[API] All pollers started');
}
function stopAllPollers() {
    if (!pollingActive)
        return;
    stopFeedPoller();
    stopNotionPoller();
    stopEconEnricher();
    stopEconTwitterPoller();
    stopAutopilotScheduler();
    stopContextBankTicker();
    stopCentralScorer();
    stopBoardroomScheduler();
    pollingActive = false;
    console.log('[API] All pollers stopped');
}
// Polling toggle endpoints (no auth — local-only app)
app.get('/api/polling/status', (c) => c.json({ polling: pollingActive }));
app.post('/api/polling/start', (c) => { startAllPollers(); return c.json({ polling: true }); });
app.post('/api/polling/stop', (c) => { stopAllPollers(); return c.json({ polling: false }); });
if (process.env.DISABLE_AUTO_POLLING === 'true') {
    console.log('[API] Auto-polling disabled — POST /api/polling/start to enable');
}
else {
    startAllPollers();
}
// Initialize Hermes/OpenRouter connection (health check — non-blocking)
initHermesAgent().catch((err) => console.warn('[API] Hermes init failed (non-fatal):', err));
// Initialize Claude SDK bridge (health check — non-blocking)
initClaudeSDK().catch((err) => console.warn('[API] Claude SDK init failed (non-fatal):', err));
export default app;
//# sourceMappingURL=index.js.map