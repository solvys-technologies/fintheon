// [claude-code 2026-03-16] MiroFish route handlers
// [claude-code 2026-03-16] Switched to feature flag, local debate engine

import type { Context } from 'hono';
import {
  startPrediction,
  pollStatus,
  getPredictions,
  injectScenarioVariable,
} from '../../services/mirofish/mirofish-service.js';
import { isSkillEnabled } from '../../config/feature-flags.js';

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

  const result = await startPrediction(body.narrativeState, body.contextBank);
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
