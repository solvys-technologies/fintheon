import type { Context, Next } from 'hono';

/**
 * Auth Middleware - Local Single-User Mode
 * No authentication required - company internal use only
 * Always authenticates as local-user with full access
 */
export const authMiddleware = async (c: Context, next: Next) => {
  // Set local user context - no auth verification needed
  c.set('auth', { userId: 'local-user', email: 'user@local' });
  c.set('userId', 'local-user');
  c.set('email', 'user@local');

  return await next();
};
