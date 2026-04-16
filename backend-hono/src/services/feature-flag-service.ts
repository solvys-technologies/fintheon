// [claude-code 2026-04-16] S20-T9: Unified feature flag service — single getFlag() replacing 3 systems
// Reads: env vars (ENABLE_*) → JSON blob (FINTHEON_FEATURE_FLAGS) → code defaults

import { createLogger } from "../lib/logger.js";

const log = createLogger("FeatureFlags");

interface FlagDef {
  envVar?: string;
  envInverse?: boolean; // true = enabled unless "false" (opt-out); default = enabled only if "true" (opt-in)
  default: boolean;
}

const FLAG_REGISTRY: Record<string, FlagDef> = {
  // Service gates
  central_scoring: { envVar: "ENABLE_CENTRAL_SCORING", default: false },
  ai_analysis: {
    envVar: "ENABLE_AI_ANALYSIS",
    envInverse: true,
    default: true,
  },
  computer_use: { envVar: "ENABLE_COMPUTER_USE", default: false },
  reflect: { envVar: "ENABLE_REFLECT", default: false },
  harper_autonomous: { envVar: "HARPER_AUTONOMOUS_ENABLED", default: false },
  oracle_research: { envVar: "ORACLE_RESEARCH_ENABLED", default: false },
  relay: { envVar: "RELAY_ENABLED", default: false },

  // Skill flags (from FINTHEON_FEATURE_FLAGS JSON blob)
  brief: { default: true },
  validate: { default: true },
  report: { default: true },
  track: { default: true },
  psych_assist: { default: true },
  maintenance: { default: true },
  quick_fintheon: { default: true },
  miroshark: { default: true },
  chart_levels: { default: true },
};

let jsonBlobCache: Record<string, { enabled: boolean }> | null = null;

function loadJsonBlob(): Record<string, { enabled: boolean }> {
  if (jsonBlobCache) return jsonBlobCache;

  const raw = process.env.FINTHEON_FEATURE_FLAGS;
  if (!raw) {
    jsonBlobCache = {};
    return jsonBlobCache;
  }

  try {
    jsonBlobCache = JSON.parse(raw);
    log.info(
      `Loaded ${Object.keys(jsonBlobCache!).length} flags from FINTHEON_FEATURE_FLAGS`,
    );
  } catch (err) {
    log.error("Failed to parse FINTHEON_FEATURE_FLAGS:", {
      error: String(err),
    });
    jsonBlobCache = {};
  }

  return jsonBlobCache!;
}

/**
 * Single entry point for all feature flag checks.
 * Resolution order: env var → JSON blob → code default
 */
export function getFlag(name: string): boolean {
  const def = FLAG_REGISTRY[name];

  // 1. Check env var (if defined in registry)
  if (def?.envVar) {
    const envVal = process.env[def.envVar];
    if (envVal !== undefined) {
      return def.envInverse ? envVal !== "false" : envVal === "true";
    }
  }

  // 2. Check JSON blob
  const blob = loadJsonBlob();
  if (name in blob) {
    return blob[name].enabled;
  }

  // 3. Code default
  return def?.default ?? true;
}

/**
 * Get all flags and their current values (for diagnostics)
 */
export function getAllFlags(): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const name of Object.keys(FLAG_REGISTRY)) {
    result[name] = getFlag(name);
  }
  return result;
}

/**
 * Reset JSON blob cache (for testing or hot-reload)
 */
export function resetFlagCache(): void {
  jsonBlobCache = null;
}
