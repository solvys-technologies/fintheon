// [claude-code 2026-03-20] Diagnostics endpoint — service status, missing env vars, suggested fixes
// [claude-code 2026-03-22] Add POST /hermes/restart for frontend-triggered Hermes re-initialization

import { Hono } from 'hono';
import { pingDb } from '../../db/optimized.js';
import { supabaseAuthHealth } from '../../services/supabase-auth.js';
import { isPollingActive } from '../../services/riskflow/feed-poller.js';
import { isTwitterCliInstalled } from '../../services/twitter-cli/index.js';
import { initHermesAgent } from '../../services/hermes-handler.js';
import { createLogger } from '../../lib/logger.js';
import { triggerReflect, isReflectRunning } from '../../services/autoresearch/reflect-scheduler.js';
import { getLatestReflectReport } from '../../services/autoresearch/reflect-engine.js';

const log = createLogger('Diagnostics');

type ServiceStatus = 'ok' | 'error' | 'degraded' | 'unavailable';

interface ServiceDiagnostic {
  name: string;
  status: ServiceStatus;
  detail?: string;
  fix?: string;
}

interface DiagnosticsResponse {
  timestamp: string;
  overall: ServiceStatus;
  services: ServiceDiagnostic[];
  missingEnvVars: string[];
}

/* ------------------------------------------------------------------ */
/*  Individual service checks                                          */
/* ------------------------------------------------------------------ */

async function checkHermesAI(): Promise<ServiceDiagnostic> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      name: 'Hermes AI (OpenRouter)',
      status: 'error',
      detail: 'OPENROUTER_API_KEY not set',
      fix: 'Add OPENROUTER_API_KEY to backend-hono/.env',
    };
  }

  try {
    const start = Date.now();
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    const latency = Date.now() - start;

    if (res.ok) {
      return { name: 'Hermes AI (OpenRouter)', status: 'ok', detail: `${latency}ms response` };
    }
    return {
      name: 'Hermes AI (OpenRouter)',
      status: 'degraded',
      detail: `HTTP ${res.status} — ${latency}ms`,
      fix: 'Check OpenRouter API key validity at openrouter.ai/settings/keys',
    };
  } catch (err) {
    return {
      name: 'Hermes AI (OpenRouter)',
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
      fix: 'Check network connectivity to openrouter.ai',
    };
  }
}

async function checkDatabase(): Promise<ServiceDiagnostic> {
  if (!process.env.DATABASE_URL) {
    return {
      name: 'Database',
      status: 'unavailable',
      detail: 'No DATABASE_URL — using cloud backend (fintheon.fly.dev)',
    };
  }

  try {
    const start = Date.now();
    await pingDb();
    const latency = Date.now() - start;
    return { name: 'Supabase', status: 'ok', detail: `Connected — ${latency}ms ping` };
  } catch (err) {
    return {
      name: 'Supabase',
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
      fix: 'Check DATABASE_URL in backend-hono/.env — ensure Neon/Supabase is reachable',
    };
  }
}

function checkRiskFlowPoller(): ServiceDiagnostic {
  const running = isPollingActive();
  return {
    name: 'RiskFlow Feed Poller',
    status: running ? 'ok' : 'error',
    detail: running ? 'Running — 15s poll interval' : 'Stopped',
    fix: running ? undefined : 'Restart the backend server (bun run dev) to re-start the feed poller',
  };
}

async function checkTwitterCli(): Promise<ServiceDiagnostic> {
  try {
    const installed = await isTwitterCliInstalled();
    return {
      name: 'Twitter CLI',
      status: installed ? 'ok' : 'unavailable',
      detail: installed ? 'Installed' : 'Not installed',
      fix: installed ? undefined : 'Install twitter-cli: go install github.com/solvys/twitter-cli@latest',
    };
  } catch {
    return {
      name: 'Twitter CLI',
      status: 'unavailable',
      detail: 'Check failed',
      fix: 'Install twitter-cli binary and ensure it is on PATH',
    };
  }
}

function checkSupabaseAuth(): ServiceDiagnostic {
  const health = supabaseAuthHealth();
  if (health.hasCredentials) {
    return { name: 'Supabase Auth', status: 'ok', detail: 'Credentials configured' };
  }
  if (health.mockMode) {
    return { name: 'Supabase Auth', status: 'degraded', detail: 'Dev mock mode (no SUPABASE_URL)' };
  }
  return {
    name: 'Supabase Auth',
    status: 'error',
    detail: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in production',
    fix: 'Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to backend-hono/.env',
  };
}

function checkTradingView(): ServiceDiagnostic {
  return {
    name: 'TradingView',
    status: 'ok',
    detail: 'Frontend widget — check browser console for load errors',
  };
}

/* ------------------------------------------------------------------ */
/*  Env var audit                                                       */
/* ------------------------------------------------------------------ */

const REQUIRED_ENV_VARS = [
  'OPENROUTER_API_KEY',
];

const RECOMMENDED_ENV_VARS = [
  'DATABASE_URL',
  'OPENAI_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'EXA_API_KEY',
  'FRED_API_KEY',
];

function auditEnvVars(): string[] {
  const missing: string[] = [];
  for (const key of [...REQUIRED_ENV_VARS, ...RECOMMENDED_ENV_VARS]) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }
  return missing;
}

/* ------------------------------------------------------------------ */
/*  Route                                                               */
/* ------------------------------------------------------------------ */

export function createDiagnosticsRoutes(): Hono {
  const router = new Hono();

  router.get('/', async (c) => {
    const start = Date.now();

    const services = await Promise.all([
      checkHermesAI(),
      checkDatabase(),
      Promise.resolve(checkRiskFlowPoller()),
      checkTwitterCli(),
      Promise.resolve(checkSupabaseAuth()),
      Promise.resolve(checkTradingView()),
    ]);

    const missingEnvVars = auditEnvVars();

    const hasError = services.some((s) => s.status === 'error');
    const hasDegraded = services.some((s) => s.status === 'degraded');
    const overall: ServiceStatus = hasError ? 'error' : hasDegraded ? 'degraded' : 'ok';

    const response: DiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      overall,
      services,
      missingEnvVars,
    };

    log.info('Diagnostics check', { overall, elapsed: Date.now() - start });

    const statusCode = overall === 'ok' ? 200 : overall === 'degraded' ? 207 : 503;
    return c.json(response, statusCode);
  });

  /* ------------------------------------------------------------------ */
  /*  Hermes restart — rate-limited to once per 30s                      */
  /* ------------------------------------------------------------------ */

  let lastRestartAt = 0;

  router.post('/hermes/restart', async (c) => {
    const now = Date.now();
    if (now - lastRestartAt < 30_000) {
      return c.json({
        success: false,
        message: 'Rate limited — wait 30s between restart attempts',
      }, 429);
    }

    lastRestartAt = now;
    log.info('Hermes restart requested by frontend');

    try {
      await initHermesAgent();
      return c.json({ success: true, message: 'Hermes re-initialization complete' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      log.warn('Hermes restart failed', { error: detail });
      return c.json({ success: false, message: detail }, 500);
    }
  });

  /* ------------------------------------------------------------------ */
  /*  REFLECT — news analysis quality self-improvement                   */
  /* ------------------------------------------------------------------ */

  router.get('/reflect/latest', async (c) => {
    const report = await getLatestReflectReport();
    if (!report) {
      return c.json({ error: 'No REFLECT report available yet' }, 404);
    }
    return c.json(report);
  });

  router.post('/reflect/run', async (c) => {
    if (isReflectRunning()) {
      return c.json({ error: 'REFLECT is already running' }, 429);
    }

    const body = await c.req.json<{ daysBack?: number }>().catch(() => ({ daysBack: 7 }));
    const daysBack = body.daysBack ?? 7;

    log.info(`Manual REFLECT trigger — ${daysBack} days`);

    // Run async, return immediately
    triggerReflect(daysBack).catch(err =>
      log.error('Manual REFLECT failed:', { error: String(err) })
    );

    return c.json({ status: 'started', daysBack });
  });

  return router;
}
