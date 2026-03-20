/**
 * CORS Configuration
 * Allowed origins for cross-origin requests
 */

const isDev = process.env.NODE_ENV !== 'production';

const isLocalhostOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:') return false;
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

export const corsConfig = {
  origin: (origin: string) => {
    const allowlist = [
    'https://app.pricedinresearch.io',
    'https://pulse.solvys.io',
    'https://pulse-solvys.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:7777',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:7777',
    ];

    if (!origin) return null;
    if (allowlist.includes(origin)) return origin;
    // Dev convenience: Vite may hop ports; allow any localhost origin.
    if (isDev && isLocalhostOrigin(origin)) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-Conversation-Id'],
  exposeHeaders: ['X-Request-Id', 'X-Conversation-Id', 'X-Model', 'X-Provider'],
  credentials: true,
  maxAge: 86400,
};
