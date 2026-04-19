// [claude-code 2026-04-18] S24-T4: Scoring preset / sensitivity API — graceful when T3 endpoints not yet live
// [claude-code 2026-04-20] S27 final-sanitation fix: thread auth tokens through GET fetches + treat 401/403 as notReady so the Refinement Engine doesn't deadlock on an unauthenticated boot.
import type { SensitivityValues } from "../components/refinement/GroupSensitivityDial";
import type { ScoringPreset } from "../components/refinement/PresetSelector";
import type { ScoreBucketDelta } from "../components/ui/InlineDiff";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

export type NotReady = { notReady: true; status: number | null };

function isNotReady<T>(v: T | NotReady): v is NotReady {
  return typeof v === "object" && v !== null && "notReady" in v;
}

async function safeFetch<T>(
  url: string,
  init?: RequestInit,
): Promise<T | NotReady> {
  try {
    const res = await fetch(url, init);
    // 401/403 mean the session isn't authenticated (or token lapsed);
    // 404/501 mean the route isn't live yet. All four degrade the UI
    // to the built-in preset set rather than crashing the loader.
    if (
      res.status === 401 ||
      res.status === 403 ||
      res.status === 404 ||
      res.status === 501
    ) {
      return { notReady: true, status: res.status };
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof TypeError) {
      return { notReady: true, status: null };
    }
    throw err;
  }
}

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchPresets(
  token?: string,
): Promise<ScoringPreset[] | NotReady> {
  const res = await safeFetch<{ presets: ScoringPreset[] }>(
    `${API_BASE}/api/scoring/presets`,
    { headers: authHeaders(token) },
  );
  if (isNotReady(res)) return res;
  return res.presets ?? [];
}

export async function fetchCurrentSensitivities(
  token?: string,
): Promise<SensitivityValues | NotReady> {
  const res = await safeFetch<{ sensitivities: SensitivityValues }>(
    `${API_BASE}/api/scoring/sensitivities`,
    { headers: authHeaders(token) },
  );
  if (isNotReady(res)) return res;
  return res.sensitivities;
}

export async function applySensitivities(
  sensitivities: SensitivityValues,
  token?: string,
): Promise<{ ok: true } | NotReady> {
  const res = await safeFetch<{ ok: true }>(
    `${API_BASE}/api/scoring/sensitivities`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ sensitivities }),
    },
  );
  return res;
}

export async function savePresetAs(
  name: string,
  sensitivities: SensitivityValues,
  token?: string,
): Promise<ScoringPreset | NotReady> {
  const res = await safeFetch<{ preset: ScoringPreset }>(
    `${API_BASE}/api/scoring/presets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ name, sensitivities }),
    },
  );
  if (isNotReady(res)) return res;
  return res.preset;
}

export interface RescorePreview {
  itemsAffected: number;
  bucketDeltas: ScoreBucketDelta[];
}

export async function previewRescore(
  sensitivities: SensitivityValues,
): Promise<RescorePreview | NotReady> {
  const res = await safeFetch<RescorePreview>(
    `${API_BASE}/api/riskflow/rescore?dryRun=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensitivities }),
    },
  );
  return res;
}

export async function triggerRescore(
  token?: string,
): Promise<{ ok: true } | NotReady> {
  const res = await safeFetch<{ ok: true }>(
    `${API_BASE}/api/riskflow/rescore-all`,
    {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  return res;
}

export { isNotReady };
