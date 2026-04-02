// backend/src/boot/index.ts
// ---------------------------------------------------------------------------
// Boot-time environment variable validation.
// Call validateEnv() before any other initialization.
// ---------------------------------------------------------------------------

type VarSpec = {
  name: string;
  critical?: boolean;
  /** Custom validation beyond presence check */
  validate?: (value: string) => string | null; // returns error message or null
};

const CRITICAL_VARS: VarSpec[] = [
  {
    name: 'DATABASE_URL',
    critical: true,
    validate: (v) =>
      v.startsWith('postgresql://') || v.startsWith('postgres://')
        ? null
        : 'must be a valid postgresql:// connection string',
  },
  {
    name: 'SUPABASE_URL',
    critical: true,
    validate: (v) =>
      v.startsWith('https://') ? null : 'must be a valid https:// URL',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    critical: true,
    validate: (v) =>
      v.length > 20 ? null : 'value appears too short to be a valid key',
  },
  {
    name: 'OPENROUTER_API_KEY',
    critical: true,
    validate: (v) =>
      v.length > 10 ? null : 'value appears too short to be a valid API key',
  },
  {
    name: 'ENABLE_CENTRAL_SCORING',
    critical: true,
    validate: (v) =>
      v === 'true'
        ? null
        : `must be exactly 'true' — current value '${v}' will disable the scoring pipeline`,
  },
];

const REQUIRED_VARS: VarSpec[] = [
  { name: 'EXA_API_KEY' },
  { name: 'FRED_API_KEY' },
  { name: 'CRON_SECRET_TOKEN' },
];

const DANGEROUS_DEV_VARS: Array<{ name: string; reason: string }> = [
  {
    name: 'BYPASS_AUTH',
    reason: 'disables all authentication — must not be set in production',
  },
  {
    name: 'RISKFLOW_ALLOW_MOCK_FALLBACK',
    reason: 'enables mock data — may silently contaminate production signals',
  },
];

// ---------------------------------------------------------------------------

type ValidationResult = {
  ok: boolean;
  criticalErrors: string[];
  warnings: string[];
};

export function validateEnv(): ValidationResult {
  const criticalErrors: string[] = [];
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  // --- Critical vars ---
  for (const spec of CRITICAL_VARS) {
    const value = process.env[spec.name];

    if (!value || value.trim() === '') {
      criticalErrors.push(`[CRITICAL] ${spec.name} is not set`);
      continue;
    }

    if (spec.validate) {
      const err = spec.validate(value);
      if (err) {
        criticalErrors.push(`[CRITICAL] ${spec.name}: ${err}`);
      }
    }
  }

  // DATABASE_URL / NEON_DATABASE_URL aliasing
  if (
    !process.env.DATABASE_URL &&
    process.env.NEON_DATABASE_URL
  ) {
    // Promote alias — remove from critical errors if only DATABASE_URL was flagged
    const idx = criticalErrors.findIndex((e) => e.includes('DATABASE_URL'));
    if (idx !== -1) criticalErrors.splice(idx, 1);
    process.env.DATABASE_URL = process.env.NEON_DATABASE_URL;
    warnings.push(
      '[INFO] DATABASE_URL not set — using NEON_DATABASE_URL as fallback'
    );
  }

  // --- Required vars (warnings, not fatal) ---
  for (const spec of REQUIRED_VARS) {
    const value = process.env[spec.name];
    if (!value || value.trim() === '') {
      warnings.push(`[WARNING] ${spec.name} is not set — dependent features will degrade`);
    }
  }

  // --- Dangerous dev vars in production ---
  if (isProd) {
    for (const { name, reason } of DANGEROUS_DEV_VARS) {
      if (process.env[name]) {
        criticalErrors.push(`[CRITICAL] ${name} is set in production: ${reason}`);
      }
    }
  }

  // --- LiveKit — inform but do not error ---
  const livekitVars = ['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_URL'];
  const livekitMissing = livekitVars.filter((v) => !process.env[v]);
  if (livekitMissing.length > 0 && livekitMissing.length < 3) {
    warnings.push(
      `[WARNING] Partial LiveKit config detected — missing: ${livekitMissing.join(', ')}. Either set all three or none.`
    );
  } else if (livekitMissing.length === 3) {
    warnings.push('[INFO] LiveKit vars not set — voice/video features will be disabled (graceful degradation)');
  }

  // --- Emit output ---
  const ok = criticalErrors.length === 0;

  for (const msg of warnings) {
    console.warn(`[boot] ${msg}`);
  }

  if (!ok) {
    console.error('\n[boot] ====================================================');
    console.error('[boot]  STARTUP ABORTED — critical env var errors:');
    console.error('[boot] ====================================================');
    for (const err of criticalErrors) {
      console.error(`[boot]  ${err}`);
    }
    console.error('[boot] ====================================================\n');
    console.error('[boot] Copy backend/.env.template to backend/.env and fill in all [CRITICAL] vars.\n');
    process.exit(1);
  }

  console.info('[boot] Environment validation passed.');
  return { ok, criticalErrors, warnings };
}

// ---------------------------------------------------------------------------
// Re-export a pre-validated subset of env vars with proper types
// for use throughout the codebase.  Import from here instead of
// reaching for process.env directly.
// ---------------------------------------------------------------------------

export const env = {
  NODE_ENV: (process.env.NODE_ENV ?? 'development') as 'development' | 'production',
  PORT: parseInt(process.env.PORT ?? '8080', 10),
  DATABASE_URL: process.env.DATABASE_URL!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
  OPENROUTER_APP_URL: process.env.OPENROUTER_APP_URL ?? 'https://fintheon-solvys.vercel.app',
  OPENROUTER_APP_NAME: process.env.OPENROUTER_APP_NAME ?? 'Fintheon-AI-Gateway',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  VERCEL_AI_GATEWAY_API_KEY: process.env.VERCEL_AI_GATEWAY_API_KEY,
  EXA_API_KEY: process.env.EXA_API_KEY,
  FRED_API_KEY: process.env.FRED_API_KEY,
  ENABLE_CENTRAL_SCORING: process.env.ENABLE_CENTRAL_SCORING === 'true',
  ENABLE_AI_ANALYSIS: process.env.ENABLE_AI_ANALYSIS !== 'false',
  RISKFLOW_ALLOW_MOCK_FALLBACK: process.env.RISKFLOW_ALLOW_MOCK_FALLBACK === 'true',
  FINTHEON_FEATURE_FLAGS: process.env.FINTHEON_FEATURE_FLAGS
    ? JSON.parse(process.env.FINTHEON_FEATURE_FLAGS)
    : {},
  DISPATCH_SCHEDULER_ENABLED: process.env.DISPATCH_SCHEDULER_ENABLED !== 'false',
  FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  CLAUDE_BINARY_PATH: process.env.CLAUDE_BINARY_PATH ?? 'claude',
  CLAUDE_SDK_MODEL: process.env.CLAUDE_SDK_MODEL ?? 'opus',
  CLAUDE_SDK_EFFORT: (process.env.CLAUDE_SDK_EFFORT ?? 'high') as 'low' | 'medium' | 'high',
  CLAUDE_SDK_MAX_TURNS: parseInt(process.env.CLAUDE_SDK_MAX_TURNS ?? '3', 10),
  CLAUDE_SDK_TIMEOUT_MS: parseInt(process.env.CLAUDE_SDK_TIMEOUT_MS ?? '300000', 10),
  CLAUDE_SDK_CWD: process.env.CLAUDE_SDK_CWD,
  CLAUDE_SDK_SYSTEM_PROMPT: process.env.CLAUDE_SDK_SYSTEM_PROMPT,
  CLAUDE_SDK_SKIP_PERMISSIONS: process.env.CLAUDE_SDK_SKIP_PERMISSIONS === 'true',
  CLAUDE_SDK_MAX_CONCURRENT: parseInt(process.env.CLAUDE_SDK_MAX_CONCURRENT ?? '2', 10),
  PRIMARY_INSTRUMENT: process.env.PRIMARY_INSTRUMENT ?? '/ES',
  HERMES_PREMARKET_CRON: process.env.HERMES_PREMARKET_CRON ?? '0 7 * * 1-5',
  HERMES_POSTMARKET_CRON: process.env.HERMES_POSTMARKET_CRON ?? '30 16 * * 1-5',
  HERMES_BOARDROOM_CRON: process.env.HERMES_BOARDROOM_CRON,
  HERMES_BOARDROOM_TZ: process.env.HERMES_BOARDROOM_TZ,
  HERMES_BINARY_PATH: process.env.HERMES_BINARY_PATH,
  HERMES_STREAM_CHUNK_DELAY_MS: parseInt(process.env.HERMES_STREAM_CHUNK_DELAY_MS ?? '18', 10),
  HERMES_REASONING_CHUNK_DELAY_MS: parseInt(process.env.HERMES_REASONING_CHUNK_DELAY_MS ?? '14', 10),
  USE_LOCAL_HERMES: process.env.USE_LOCAL_HERMES !== 'false',
  BOARDROOM_MEETING_HOUR_LOCAL: process.env.BOARDROOM_MEETING_HOUR_LOCAL
    ? parseInt(process.env.BOARDROOM_MEETING_HOUR_LOCAL, 10)
    : undefined,
  BOARDROOM_MEETING_WINDOW_MINUTES: process.env.BOARDROOM_MEETING_WINDOW_MINUTES
    ? parseInt(process.env.BOARDROOM_MEETING_WINDOW_MINUTES, 10)
    : undefined,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  LIVEKIT_URL: process.env.LIVEKIT_URL,
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
  DB_IDLE_TIMEOUT_MS: parseInt(process.env.DB_IDLE_TIMEOUT_MS ?? '30000', 10),
  DB_CONNECT_TIMEOUT_MS: parseInt(process.env.DB_CONNECT_TIMEOUT_MS ?? '5000', 10),
  PRIMARY_BROKER: (process.env.PRIMARY_BROKER ?? 'rithmic') as 'rithmic' | 'projectx' | 'hyperliquid',
  BRIDGE_URL: process.env.BRIDGE_URL ?? 'http://localhost:8001',
  CRON_SECRET_TOKEN: process.env.CRON_SECRET_TOKEN,
  FINTHEON_VERSION: process.env.FINTHEON_VERSION,
} as const;
