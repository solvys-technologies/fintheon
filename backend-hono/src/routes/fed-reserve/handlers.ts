// Federal Reserve route handlers

import type { Context } from 'hono';
import {
  startSession,
  getSession,
  getLatestFedSignal,
  getSessionHistory,
  shouldAutoRunFed,
  isFedReserveEnabled,
} from '../../services/fed-reserve/fed-reserve-service.js';

function checkEnabled(c: Context): Response | null {
  if (!isFedReserveEnabled()) {
    return c.json({ error: 'Federal Reserve board is disabled', code: 'FEATURE_DISABLED' }, 403);
  }
  return null;
}

/** POST /simulate — start a new FOMC simulation session */
export async function handleSimulateFed(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const result = await startSession();
  if ('error' in result) {
    return c.json({ error: result.error }, 500);
  }
  return c.json(result, 201);
}

/** GET /session/:id — get full session report */
export async function handleGetSession(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const sessionId = c.req.param('id');
  const session = getSession(sessionId);
  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }
  return c.json(session);
}

/** GET /signal — get the latest Fed Reserve signal for MiroFish integration */
export async function handleGetSignal(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const signal = getLatestFedSignal();
  return c.json({ signal: signal ?? null });
}

/** GET /history — past FOMC simulation sessions */
export async function handleGetFedHistory(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const limit = parseInt(c.req.query('limit') ?? '10', 10);
  const history = await getSessionHistory(Math.min(limit, 50));
  return c.json({ sessions: history });
}

/** GET /auto-run-check — should frontend trigger a new session? */
export async function handleAutoRunCheckFed(c: Context) {
  const blocked = checkEnabled(c);
  if (blocked) return blocked;

  const result = await shouldAutoRunFed();
  return c.json(result);
}
