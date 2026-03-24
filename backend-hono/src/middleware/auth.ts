// [claude-code 2026-03-24] Supabase JWT auth middleware — sets supabaseUid for profile lookups
import type { Context, Next } from 'hono';
import { verifySupabaseToken } from '../services/supabase-auth.js';

const BYPASS_AUTH = process.env.BYPASS_AUTH === 'true';

/**
 * Auth Middleware — Supabase JWT verification
 * When BYPASS_AUTH=true: sets local-user (dev/electron mode)
 * Otherwise: extracts Bearer token, verifies with Supabase auth.getUser(), sets userId/email/supabaseUid
 */
export const authMiddleware = async (c: Context, next: Next) => {
  if (BYPASS_AUTH) {
    c.set('auth', { userId: 'local-user', email: 'user@local' });
    c.set('userId', 'local-user');
    c.set('supabaseUid', 'local-user');
    c.set('email', 'user@local');
    return await next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifySupabaseToken(token);
    const userId = payload.sub;
    const email = payload.email;

    c.set('auth', { userId, email });
    c.set('userId', userId);
    c.set('supabaseUid', userId);
    c.set('email', email);

    return await next();
  } catch (error) {
    console.error('[auth] Token verification failed:', error);
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
};
