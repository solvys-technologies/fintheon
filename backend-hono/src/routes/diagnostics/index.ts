// [claude-code 2026-03-20] Diagnostics endpoint — service status, missing env vars, suggested fixes
// [claude-code 2026-03-22] Add POST /hermes/restart for frontend-triggered Hermes re-initialization

import { Hono } from 'hono';
import { pingDb } from '../../db/optimized.js';
import { clerkHealth } from '../../services/clerk-auth.js';
import { isPollingActive } from '../../services/riskflow/feed-poller.js';
import { isTwitterCliInstalled } from '../../services/twitter-cli/index.js';
import { initHermesAgent } from '../../services/hermes-handler.js';
import { createLogger } from '../../lib/logger.js';

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
      name: 'Supabase',
      status: 'error',
      detail: 'DATABASE_URL not set',
      fix: 'Add DATABASE_URL (Neon/Supabase connection string) to backend-hono/.env',
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

function checkClerkAuth(): ServiceDiagnostic {
  const health = clerkHealth();
  if (health.hasSecret) {
    return { name: 'Clerk Auth', status: 'ok', detail: 'Secret configured' };
  }
  if (health.mockMode) {
    return { name: 'Clerk Auth', status: 'degraded', detail: 'Dev mock mode (no CLERK_SECRET_KEY)' };
  }
  return {
    name: 'Clerk Auth',
    status: 'error',
    detail: 'CLERK_SECRET_KEY missing in production',
    fix: 'Add CLERK_SECRET_KEY to backend-hono/.env or Fly secrets',
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
  'DATABASE_URL',
];

const RECOMMENDED_ENV_VARS = [
  'OPENAI_API_KEY',
  'CLERK_SECRET_KEY',
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
      Promise.resolve(checkClerkAuth()),
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

  return router;
}
