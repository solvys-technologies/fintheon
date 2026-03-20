// [claude-code 2026-03-20] Re-implement Clerk JWT auth middleware with BYPASS_AUTH fallback
import type { Context, Next } from 'hono';
import { verifyClerkToken } from '../services/clerk-auth.js';

const BYPASS_AUTH = process.env.BYPASS_AUTH === 'true';

/**
 * Auth Middleware — Clerk JWT verification
 * When BYPASS_AUTH=true: sets local-user (dev/electron mode)
 * Otherwise: extracts Bearer token, verifies with Clerk, sets userId/email
 */
export const authMiddleware = async (c: Context, next: Next) => {
  if (BYPASS_AUTH) {
    c.set('auth', { userId: 'local-user', email: 'user@local' });
    c.set('userId', 'local-user');
    c.set('email', 'user@local');
    return await next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyClerkToken(token);
    const userId = payload.sub || (payload as any).userId || '';
    const email = (payload as any).email || '';

    c.set('auth', { userId, email });
    c.set('userId', userId);
    c.set('email', email);

    return await next();
  } catch (error) {
    console.error('[auth] Token verification failed:', error);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};
