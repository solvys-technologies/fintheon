// [claude-code 2026-03-23] Removed Clerk validation — auth is Supabase JWT + BYPASS_AUTH dev toggle
/**
 * Environment Configuration
 * Validates required environment variables
 */

export interface EnvConfig {
  NODE_ENV: "development" | "production";
  PORT: number;
  DATABASE_URL: string | undefined;
  SUPABASE_URL: string | undefined;
  SUPABASE_SERVICE_ROLE_KEY: string | undefined;
  BYPASS_AUTH: boolean;
  VERCEL_AI_GATEWAY_API_KEY: string | undefined;
  FRED_API_KEY: string | undefined;
  EXA_API_KEY: string | undefined;
  OPENAI_API_KEY: string | undefined;
  LIVEKIT_API_KEY: string | undefined;
  LIVEKIT_API_SECRET: string | undefined;
  LIVEKIT_URL: string | undefined;
}

export function getEnvConfig(): EnvConfig {
  return {
    NODE_ENV:
      (process.env.NODE_ENV as "development" | "production") || "development",
    PORT: Number(process.env.PORT || 8080),
    DATABASE_URL: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    BYPASS_AUTH: process.env.BYPASS_AUTH === "true",
    VERCEL_AI_GATEWAY_API_KEY: process.env.VERCEL_AI_GATEWAY_API_KEY,
    FRED_API_KEY: process.env.FRED_API_KEY,
    EXA_API_KEY: process.env.EXA_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    LIVEKIT_URL: process.env.LIVEKIT_URL,
  };
}

export function validateEnv(): string[] {
  const missing: string[] = [];
  const config = getEnvConfig();

  if (!config.DATABASE_URL) missing.push("DATABASE_URL");

  // Supabase required unless auth is bypassed (local dev / Electron)
  if (!config.BYPASS_AUTH) {
    if (!config.SUPABASE_URL) missing.push("SUPABASE_URL");
    if (!config.SUPABASE_SERVICE_ROLE_KEY)
      missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }

  return missing;
}

export const isDev = process.env.NODE_ENV !== "production";
