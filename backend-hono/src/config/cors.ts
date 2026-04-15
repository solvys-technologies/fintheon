/**
 * CORS Configuration
 * Allowed origins for cross-origin requests
 */

const isDev = process.env.NODE_ENV !== "production";

const isLocalhostOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

export const corsConfig = {
  origin: (origin: string) => {
    const allowlist = [
      "https://app.pricedinresearch.io",
      "https://fintheon.pricedinresearch.io",
      "https://fintheon.solvys.io",
      "https://fintheon-solvys.vercel.app",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:7777",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5174",
      "http://127.0.0.1:7777",
    ];

    // Electron sends null/empty origin (file:// protocol) — allow it
    if (!origin) return "*";
    if (allowlist.includes(origin)) return origin;
    // Allow any localhost origin (Electron, Vite dev, port hopping)
    if (isLocalhostOrigin(origin)) return origin;
    return null;
  },
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-Id",
    "X-Conversation-Id",
  ],
  exposeHeaders: ["X-Request-Id", "X-Conversation-Id", "X-Model", "X-Provider"],
  credentials: true,
  maxAge: 86400,
};
