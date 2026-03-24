// [claude-code 2026-03-24] Persistence refactor: added GET /latest endpoint
// [claude-code 2026-03-24] Added rolling-window, auto-run-check, running-state endpoints
// [claude-code 2026-03-23] MiroFish route handlers — preset-aware, context endpoint, history
// [claude-code 2026-03-16] Switched to feature flag, local debate engine

import type { Context } from 'hono';
import {
  startPrediction,
  pollStatus,
  getPredictions,
  injectScenarioVariable,
  getRunHistory,
  getLatestReport,
  getRollingWindowData,
  shouldAutoRun,
} from '../../services/mirofish/mirofish-service.js';
import { assembleSimulationContext } from '../../services/mirofish/mirofish-context.js';
import { isSkillEnabled } from '../../config/feature-flags.js';
import type { AuditoriumPreset } from '../../services/mirofish/mirofish-types.js';
// @ts-ignore — T1 creates this file
import { getRunningState } from '../../services/mirofish/mirofish-reactive.js';

function checkEnabled(c: Context): Response | null {
  if (!isSkillEnabled('mirofish')) {
    return c.json({ error: 'MiroFish is disabled', code: 'FEATURE_DISABLED' }, 403);
  }
  return null;
}

/** POST /simulate — kick off a new prediction simulation */
export async function handleSimulate(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const body = await c.req.json<{
    preset?: AuditoriumPreset;
    narrativeState: {
      lanes: Array<{
        id: string; title: string; instruments: string[];
        directionBias: string; category: string; status: string;
        healthScore: number; dateRange: { start: string; end: string | null };
      }>;
      catalysts: Array<{
        id: string; title: string; description: string; date: string;
        sentiment: string; severity: string; narrativeIds: string[];
      }>;
      ropes: Array<{
        id: string; fromId: string; toId: string;
        polarity: string; weight: number;
      }>;
    };
    contextBank?: {
      vixLevel?: number;
      gexNet?: number;
      macroIndicators?: Record<string, number>;
    };
  }>();

  if (!body.narrativeState?.lanes) {
    return c.json({ error: 'narrativeState.lanes is required' }, 400);
  }

  const result = await startPrediction(
    body.narrativeState,
    body.contextBank,
    body.preset ?? 'full-brief',
  );
  if ('error' in result) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result, 201);
}

/** GET /status/:id — poll simulation status */
export async function handleStatus(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const simId = c.req.param('id');
  const sim = pollStatus(simId);
  if (!sim) {
    return c.json({ error: 'Simulation not found' }, 404);
  }
  return c.json(sim);
}

/** GET /report/:id — get prediction report from completed simulation */
export async function handleReport(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const simId = c.req.param('id');
  const prediction = getPredictions(simId);
  if (!prediction) {
    return c.json({ error: 'Report not available' }, 404);
  }
  return c.json(prediction);
}

/** POST /inject/:id — inject a scenario variable into a running simulation */
export async function handleInject(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const simId = c.req.param('id');
  const body = await c.req.json<{
    variable: string;
    targetNarrativeIds: string[];
    description: string;
  }>();

  if (!body.variable?.trim()) {
    return c.json({ error: 'variable is required' }, 400);
  }

  const sim = await injectScenarioVariable(simId, {
    variable: body.variable.trim(),
    targetNarrativeIds: body.targetNarrativeIds ?? [],
    description: body.description ?? `Injected: ${body.variable.trim()}`,
  });

  if (!sim) {
    return c.json({ error: 'Injection failed — simulation may not exist' }, 400);
  }
  return c.json(sim);
}

/** GET /context — fetch current market context bundle */
export async function handleGetContext(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  try {
    const context = await assembleSimulationContext('full-brief');
    return c.json(context);
  } catch (err) {
    console.error('[MiroFish] Context assembly failed:', err);
    return c.json({ error: 'Failed to assemble context' }, 500);
  }
}

/** GET /history — fetch past simulation runs */
export async function handleGetHistory(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const limit = parseInt(c.req.query('limit') ?? '20', 10);
  const history = await getRunHistory(Math.min(limit, 50));
  return c.json({ runs: history });
}

/** GET /latest — most recent persisted report (cache → Supabase fallback) */
export async function handleGetLatest(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const report = await getLatestReport();
  if (!report) {
    return c.json(null);
  }
  return c.json(report);
}

/** GET /rolling-window?days=7 — aggregated historical data over a rolling window */
export async function handleRollingWindow(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const daysParam = parseInt(c.req.query('days') ?? '7', 10);
  const validDays = [1, 7, 14, 30].includes(daysParam) ? daysParam as 1 | 7 | 14 | 30 : 7;
  const limit = parseInt(c.req.query('limit') ?? '50', 10);

  const data = await getRollingWindowData({ days: validDays, limit: Math.min(limit, 100) });
  return c.json(data);
}

/** GET /auto-run-check — should the frontend trigger a new auto-run? */
export async function handleAutoRunCheck(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const result = await shouldAutoRun();
  return c.json(result);
}

/** GET /running-state — current running analysis snapshot */
export async function handleRunningState(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const state = getRunningState();
  return c.json({ state: state ?? null });
}
