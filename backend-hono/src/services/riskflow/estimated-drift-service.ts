// [claude-code 2026-05-16] S67: Estimated Drift KPI service — maps risk signal event types
// to volatility taxonomy decay data, produces persistence categories.
import { getVolatilityProfile } from "../iv-scoring/taxonomy.js";

export type PersistenceCategory =
  | "1_session"
  | "2_sessions"
  | "1_day"
  | "2_days"
  | "1_week";

export interface EstimatedDriftResult {
  signalId: string;
  persistenceCategory: PersistenceCategory;
  label: string;
  decayBaseMinutes: number;
}

function minutesToCategory(minutes: number): {
  category: PersistenceCategory;
  label: string;
} {
  if (minutes <= 180) return { category: "1_session", label: "1 session" };
  if (minutes <= 540) return { category: "2_sessions", label: "2 sessions" };
  if (minutes <= 1440) return { category: "1_day", label: "1 day" };
  if (minutes <= 2880) return { category: "2_days", label: "2 days" };
  return { category: "1_week", label: "1 week" };
}

export function estimateDrift(
  signalId: string,
  eventType: string,
): EstimatedDriftResult {
  const profile = getVolatilityProfile(eventType);
  const decayBaseMinutes = profile.decayBaseMinutes ?? 30;
  const { category, label } = minutesToCategory(decayBaseMinutes);

  return {
    signalId,
    persistenceCategory: category,
    label,
    decayBaseMinutes,
  };
}
