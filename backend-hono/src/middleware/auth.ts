// [claude-code 2026-03-16] Clerk JWT verification with dev fallback
import type { Context, Next } from 'hono';
import { verifyClerkToken } from '../services/clerk-auth.js';

const isDev = process.env.NODE_ENV !== 'production';
const hasClerkSecret = Boolean(process.env.CLERK_SECRET_KEY);

/**
 * Auth Middleware — Clerk JWT verification
 * Falls back to local-user in dev mode when Clerk is not configured
 */
export const authMiddleware = async (c: Context, next: Next) => {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    // Dev fallback: allow unauthenticated requests when Clerk isn't configured
    if (isDev && !hasClerkSecret) {
      c.set('auth', { userId: 'local-user', email: 'user@local' });
      c.set('userId', 'local-user');
      c.set('email', 'user@local');
      return await next();
    }
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const payload = await verifyClerkToken(token);
    const userId = payload.sub || (payload as any).userId || 'clerk-user';
    c.set('auth', payload);
    c.set('userId', userId);
    c.set('email', (payload as any).email || '');
    return await next();
  } catch (error) {
    console.warn('[Auth] Token verification failed:', (error as Error).message);
    return c.json({ error: 'Invalid token' }, 401);
  }
};
