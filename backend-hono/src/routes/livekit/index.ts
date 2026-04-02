// S13-T3: LiveKit route — POST /api/livekit/token
import { Hono } from 'hono';
import { generateToken } from './handlers.js';

const livekit = new Hono();

livekit.post('/token', async (c) => {
  const body = await c.req.json();
  const { roomName, participantName, participantIdentity } = body;

  if (!roomName || !participantIdentity) {
    return c.json({ error: 'roomName and participantIdentity required' }, 400);
  }

  try {
    const result = await generateToken({
      roomName,
      participantName: participantName || 'Anonymous',
      participantIdentity,
    });
    return c.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export { livekit };
