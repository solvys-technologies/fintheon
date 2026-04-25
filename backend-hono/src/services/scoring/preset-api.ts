// [claude-code 2026-04-24] S37: backend for the S24-T3 group-sensitivity fuses.
// CRUD layer over scoring_user_sensitivity + scoring_presets. Degrades to in-memory
// values when Supabase isn't configured so the Refinement Engine never deadlocks
// waiting for a service that can't write.

import { createHash, randomUUID } from "node:crypto";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("ScoringPresetAPI");

export type SensitivityGroup =
  | "macro"
  | "geopolitical"
  | "corporate"
  | "technical"
  | "speaker";

export type SensitivityValues = Record<SensitivityGroup, number>;

export interface ScoringPreset {
  id: string;
  name: string;
  sensitivities: SensitivityValues;
  builtin: boolean;
  createdAt?: string;
}

export const SENSITIVITY_DEFAULTS: SensitivityValues = {
  macro: 0,
  geopolitical: 0,
  corporate: 0,
  technical: 0,
  speaker: 0,
};

const BUILTIN_PRESETS: ScoringPreset[] = [
  {
    id: "builtin:neutral",
    name: "Neutral (Default)",
    sensitivities: { ...SENSITIVITY_DEFAULTS },
    builtin: true,
  },
  {
    id: "builtin:conservative",
    name: "Conservative",
    sensitivities: {
      macro: -0.3,
      geopolitical: -0.5,
      corporate: -0.2,
      technical: -0.2,
      speaker: -0.5,
    },
    builtin: true,
  },
  {
    id: "builtin:aggressive",
    name: "Aggressive",
    sensitivities: {
      macro: 0.3,
      geopolitical: 0.2,
      corporate: 0.4,
      technical: 0.3,
      speaker: 0.1,
    },
    builtin: true,
  },
  {
    id: "builtin:geo-focused",
    name: "Geo-focused",
    sensitivities: {
      macro: 0,
      geopolitical: 0.6,
      corporate: -0.2,
      technical: -0.1,
      speaker: 0.3,
    },
    builtin: true,
  },
];

// In-memory fallback when Supabase is absent. Keyed by userId.
const memorySensitivity = new Map<string, SensitivityValues>();
const memoryPresets = new Map<string, ScoringPreset[]>();

function clampSensitivity(input: unknown): SensitivityValues {
  const base = { ...SENSITIVITY_DEFAULTS };
  if (!input || typeof input !== "object") return base;
  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(base) as SensitivityGroup[]) {
    const v = Number(raw[key]);
    base[key] = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  }
  return base;
}

function presetIdFor(userId: string, name: string): string {
  const trimmed = name.trim().slice(0, 60) || "preset";
  const hash = createHash("sha1")
    .update(`${userId}::${trimmed}::${Date.now()}::${randomUUID()}`)
    .digest("hex")
    .slice(0, 12);
  return `user:${hash}`;
}

// ── Sensitivities ──────────────────────────────────────────────────────────

export async function getUserSensitivity(
  userId: string,
): Promise<SensitivityValues> {
  const sb = getSupabaseClient();
  if (!sb) {
    return memorySensitivity.get(userId) ?? { ...SENSITIVITY_DEFAULTS };
  }
  try {
    const { data, error } = await sb
      .from("scoring_user_sensitivity")
      .select("macro,geopolitical,corporate,technical,speaker")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return { ...SENSITIVITY_DEFAULTS };
    return clampSensitivity(data);
  } catch (err) {
    log.warn("getUserSensitivity supabase read failed", { error: String(err) });
    return memorySensitivity.get(userId) ?? { ...SENSITIVITY_DEFAULTS };
  }
}

export async function setUserSensitivity(
  userId: string,
  sensitivities: unknown,
): Promise<SensitivityValues> {
  const clamped = clampSensitivity(sensitivities);
  const sb = getSupabaseClient();
  if (!sb) {
    memorySensitivity.set(userId, clamped);
    return clamped;
  }
  try {
    const { error } = await sb
      .from("scoring_user_sensitivity")
      .upsert(
        { user_id: userId, ...clamped, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) throw error;
    return clamped;
  } catch (err) {
    log.warn("setUserSensitivity supabase write failed — writing to memory", {
      error: String(err),
    });
    memorySensitivity.set(userId, clamped);
    return clamped;
  }
}

// ── Presets ────────────────────────────────────────────────────────────────

export async function listPresets(userId: string): Promise<ScoringPreset[]> {
  const sb = getSupabaseClient();
  if (!sb) {
    return [...BUILTIN_PRESETS, ...(memoryPresets.get(userId) ?? [])];
  }
  try {
    const { data, error } = await sb
      .from("scoring_presets")
      .select("id,name,sensitivities,is_builtin,created_at,user_id")
      .or(`is_builtin.eq.true,user_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error || !data) return [...BUILTIN_PRESETS];
    const fromDb: ScoringPreset[] = data.map(
      (r: {
        id: string;
        name: string;
        sensitivities: unknown;
        is_builtin: boolean;
        created_at: string;
      }) => ({
        id: r.id,
        name: r.name,
        sensitivities: clampSensitivity(r.sensitivities),
        builtin: r.is_builtin === true,
        createdAt: r.created_at,
      }),
    );
    // Always include the canonical builtins even if the table is empty
    const hasBuiltins = fromDb.some((p) => p.builtin);
    return hasBuiltins ? fromDb : [...BUILTIN_PRESETS, ...fromDb];
  } catch (err) {
    log.warn("listPresets supabase read failed", { error: String(err) });
    return [...BUILTIN_PRESETS, ...(memoryPresets.get(userId) ?? [])];
  }
}

export async function savePreset(
  userId: string,
  name: string,
  sensitivities: unknown,
): Promise<ScoringPreset> {
  const clamped = clampSensitivity(sensitivities);
  const cleanName = String(name ?? "")
    .trim()
    .slice(0, 120);
  if (!cleanName) throw new Error("preset name required");
  const preset: ScoringPreset = {
    id: presetIdFor(userId, cleanName),
    name: cleanName,
    sensitivities: clamped,
    builtin: false,
    createdAt: new Date().toISOString(),
  };
  const sb = getSupabaseClient();
  if (!sb) {
    const arr = memoryPresets.get(userId) ?? [];
    arr.unshift(preset);
    memoryPresets.set(userId, arr.slice(0, 20));
    return preset;
  }
  try {
    const { error } = await sb.from("scoring_presets").insert({
      id: preset.id,
      user_id: userId,
      name: preset.name,
      sensitivities: clamped,
      is_builtin: false,
    });
    if (error) throw error;
    return preset;
  } catch (err) {
    log.warn("savePreset supabase write failed — writing to memory", {
      error: String(err),
    });
    const arr = memoryPresets.get(userId) ?? [];
    arr.unshift(preset);
    memoryPresets.set(userId, arr.slice(0, 20));
    return preset;
  }
}
