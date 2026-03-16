// [claude-code 2026-03-16] MiroFish route handlers

import type { Context } from 'hono';
import {
  startPrediction,
  pollStatus,
  getPredictions,
  injectScenarioVariable,
} from '../../services/mirofish/mirofish-service.js';
import { isMiroFishEnabled } from '../../services/mirofish/mirofish-client.js';

/** POST /simulate — kick off a new prediction simulation */
export async function handleSimulate(c: Context) {
  if (!isMiroFishEnabled()) return c.json({ error: 'MiroFish is not enabled' }, 503);

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
  if (!isMiroFishEnabled()) return c.json({ error: 'MiroFish is not enabled' }, 503);

  const simId = c.req.param('id');
  const sim = await pollStatus(simId);
  if (!sim) {
    return c.json({ error: 'Simulation not found' }, 404);
  }
  return c.json(sim);
}

/** GET /report/:id — get prediction report from completed simulation */
export async function handleReport(c: Context) {
  if (!isMiroFishEnabled()) return c.json({ error: 'MiroFish is not enabled' }, 503);

  const simId = c.req.param('id');
  const prediction = await getPredictions(simId);
  if (!prediction) {
    return c.json({ error: 'Report not available' }, 404);
  }
  return c.json(prediction);
}

/** POST /inject/:id — inject a scenario variable into a running simulation */
export async function handleInject(c: Context) {
  if (!isMiroFishEnabled()) return c.json({ error: 'MiroFish is not enabled' }, 503);

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
    return c.json({ error: 'Injection failed — simulation may not exist or be running' }, 400);
  }
  return c.json(sim);
}
