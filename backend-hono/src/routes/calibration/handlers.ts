// [claude-code 2026-03-27] S2-T4: Calibration API handlers — weights, annotations, observations, bulk parse/ingest

import type { Context } from 'hono';
import {
  getCalibrationWeights,
  updateCalibrationWeight,
  seedCalibrationFromDefaults,
  addAnnotation,
  getAnnotationsForItem,
  addObservation,
  getObservations,
  addObservationsBatch,
} from '../../services/calibration/calibration-service.js';
import { parseBulkText, bulkItemsToObservations } from '../../services/calibration/bulk-parser.js';
import type { ParsedBulkItem } from '../../services/calibration/bulk-parser.js';
import { addCalibrationContext } from '../../services/miroshark/miroshark-context.js';
import type { MarketRegime } from '../../types/regime.js';

// GET /api/calibration/weights
export async function handleGetWeights(c: Context) {
  const weights = await getCalibrationWeights();
  return c.json({ weights });
}

// PUT /api/calibration/weight/:eventType
export async function handleUpdateWeight(c: Context) {
  const eventType = c.req.param('eventType');
  const body = await c.req.json<{
    baseWeight: number;
    regimeOverrides?: Record<string, number>;
  }>();

  if (typeof body.baseWeight !== 'number') {
    return c.json({ error: 'baseWeight is required and must be a number' }, 400);
  }

  await updateCalibrationWeight(
    eventType,
    body.baseWeight,
    body.regimeOverrides as Partial<Record<MarketRegime, number>>,
    'api'
  );
  return c.json({ ok: true, eventType, baseWeight: body.baseWeight });
}

// POST /api/calibration/seed
export async function handleSeed(c: Context) {
  const seeded = await seedCalibrationFromDefaults();
  return c.json({ ok: true, seeded });
}

// POST /api/calibration/annotate
export async function handleAnnotate(c: Context) {
  const body = await c.req.json<{
    riskflowItemId: string;
    comment?: string;
    flawTag?: string;
    suggestedScore?: number;
  }>();

  if (!body.riskflowItemId) {
    return c.json({ error: 'riskflowItemId is required' }, 400);
  }

  const id = await addAnnotation({
    riskflowItemId: body.riskflowItemId,
    comment: body.comment,
    flawTag: body.flawTag as any,
    suggestedScore: body.suggestedScore,
    createdBy: 'tp',
  });

  return c.json({ ok: true, id });
}

// GET /api/calibration/annotations/:itemId
export async function handleGetAnnotations(c: Context) {
  const itemId = c.req.param('itemId');
  const annotations = await getAnnotationsForItem(itemId);
  return c.json({ annotations });
}

// POST /api/calibration/observe
export async function handleObserve(c: Context) {
  const body = await c.req.json<{
    headline: string;
    eventType?: string;
    predictedIVScore?: number;
    actualPointsMove?: number;
    instrument?: string;
    regimeAtTime?: string;
    vixAtTime?: number;
    observedAt?: string;
    notes?: string;
    source?: string;
  }>();

  if (!body.headline) {
    return c.json({ error: 'headline is required' }, 400);
  }

  const id = await addObservation({
    headline: body.headline,
    eventType: body.eventType,
    predictedIVScore: body.predictedIVScore,
    actualPointsMove: body.actualPointsMove,
    instrument: body.instrument ?? '/ES',
    regimeAtTime: body.regimeAtTime as MarketRegime | undefined,
    vixAtTime: body.vixAtTime,
    observedAt: body.observedAt,
    notes: body.notes,
    source: (body.source as 'manual' | 'backfill' | 'live_correlation') ?? 'manual',
  });

  return c.json({ ok: true, id });
}

// GET /api/calibration/observations?limit=50
export async function handleGetObservations(c: Context) {
  const limit = parseInt(c.req.query('limit') ?? '50', 10);
  const observations = await getObservations(limit);
  return c.json({ observations });
}

// POST /api/calibration/bulk-parse
export async function handleBulkParse(c: Context) {
  const body = await c.req.json<{ rawText: string; instrument?: string }>();

  if (!body.rawText) {
    return c.json({ error: 'rawText is required' }, 400);
  }

  const result = parseBulkText(body.rawText);
  return c.json(result);
}

// POST /api/calibration/bulk-ingest
export async function handleBulkIngest(c: Context) {
  const body = await c.req.json<{
    rawText: string;
    instrument?: string;
    regime?: string;
    source?: string;
  }>();

  if (!body.rawText) {
    return c.json({ error: 'rawText is required' }, 400);
  }

  const result = parseBulkText(body.rawText);
  const instrument = body.instrument ?? '/ES';
  const regime = body.regime as MarketRegime | undefined;

  const observations = bulkItemsToObservations(result.parsed, instrument, regime);

  // Override source if provided
  if (body.source) {
    for (const obs of observations) {
      (obs as any).source = body.source;
    }
  }

  const stored = await addObservationsBatch(observations);

  return c.json({
    ok: true,
    total: result.total,
    parsed: result.parsed.length,
    skipped: result.skipped,
    stored,
    errors: result.errors,
  });
}

// POST /api/calibration/upload-context
export async function handleUploadContext(c: Context) {
  const body = await c.req.json<{ items: ParsedBulkItem[] }>();

  if (!body.items || !Array.isArray(body.items)) {
    return c.json({ error: 'items array is required' }, 400);
  }

  addCalibrationContext(body.items);
  return c.json({ ok: true, count: body.items.length });
}
