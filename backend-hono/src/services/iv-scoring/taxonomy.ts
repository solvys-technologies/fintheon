// [claude-code 2026-04-16] Split from config.ts — volatility taxonomy loader
import type {
  VolatilityProfile,
  VolatilityTaxonomy,
} from "../../types/volatility-taxonomy.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EVENT_WEIGHTS, DECAY_HALF_LIVES } from "./config.js";

// ============================================================================
// VOLATILITY TAXONOMY LOADER (V3)
// ============================================================================

let _loadedTaxonomy: VolatilityTaxonomy | null = null;

export function loadVolatilityTaxonomy(): VolatilityTaxonomy {
  if (_loadedTaxonomy) return _loadedTaxonomy;

  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const configPath = resolve(
      __dirname,
      "../../config/volatility-taxonomy.json",
    );
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    _loadedTaxonomy = {
      _version: parsed._version ?? "1.0.0",
      profiles: parsed.profiles ?? {},
    };

    console.log("[IV-V3] Loaded volatility taxonomy");
  } catch (err) {
    console.warn(
      "[IV-V3] Failed to load volatility taxonomy, using defaults:",
      err,
    );
    _loadedTaxonomy = null;
  }

  return _loadedTaxonomy ?? getDefaultTaxonomy();
}

function getDefaultTaxonomy(): VolatilityTaxonomy {
  const profiles: Record<string, VolatilityProfile> = {};
  for (const [key, weight] of Object.entries(EVENT_WEIGHTS)) {
    profiles[key] = {
      velocity: 3 as const,
      persistence: "hours" as const,
      breadth: 3 as const,
      transmissionChannels: ["equities"],
      reflexivity: 0.1,
      baseWeight: weight,
      decayBaseMinutes: DECAY_HALF_LIVES[key] ?? DECAY_HALF_LIVES.default,
      decayRegimeMultipliers: {
        low: 0.8,
        normal: 1.0,
        elevated: 1.3,
        crisis: 1.5,
      },
    };
  }
  return { _version: "0.0.0", profiles };
}

export function getVolatilityProfile(eventType: string): VolatilityProfile {
  const taxonomy = loadVolatilityTaxonomy();
  return (
    taxonomy.profiles[eventType] ??
    taxonomy.profiles["default"] ?? {
      velocity: 2 as const,
      persistence: "hours" as const,
      breadth: 1 as const,
      transmissionChannels: ["equities"],
      reflexivity: 0.0,
      baseWeight: 3,
      decayBaseMinutes: 30,
      decayRegimeMultipliers: {
        low: 0.8,
        normal: 1.0,
        elevated: 1.0,
        crisis: 1.0,
      },
    }
  );
}

export function resetVolatilityTaxonomy(): void {
  _loadedTaxonomy = null;
}
