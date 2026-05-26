import type { Theme, ThemeStatus, ThemeTrajectoryPoint } from "./types.js";
import * as store from "./persistence.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("ThemeTracker");

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 0.9,
  high: 0.6,
  medium: 0.3,
  low: 0.1,
};

const DECAY_IPV_THRESHOLD = 0.25;
const RESOLVE_IPV_THRESHOLD = 0.05;
const DECAY_RATE_PER_HOUR = 0.1;
const DECAY_GRACE_PERIOD_HOURS = 24;

export function createTheme(
  name: string,
  catalystIds: string[] = [],
  initialIvp = 0.5,
): Theme {
  const now = new Date().toISOString();
  const theme: Theme = {
    id: `theme-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    ipv: initialIvp,
    status: "Active",
    catalystIds,
    createdAt: now,
    updatedAt: now,
    trajectory: [{ timestamp: now, ipv: initialIvp }],
  };
  return store.createTheme(theme);
}

export function computeIPV(catalystSeverities: string[]): number {
  if (catalystSeverities.length === 0) return 0;
  const scores = catalystSeverities.map(
    (s) => SEVERITY_WEIGHTS[s.toLowerCase()] ?? 0.2,
  );
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores, 0);
  const boost = maxScore * 0.3;
  return Math.min(avg + boost, 1);
}

export function transitionStatus(theme: Theme, now = Date.now()): ThemeStatus {
  const lastCatalystTime =
    theme.catalystIds.length > 0
      ? new Date(theme.updatedAt).getTime()
      : new Date(theme.createdAt).getTime();
  const hoursSinceLastCatalyst = (now - lastCatalystTime) / (1000 * 60 * 60);

  if (hoursSinceLastCatalyst < DECAY_GRACE_PERIOD_HOURS) {
    return theme.status === "Resolved" ? "Resolved" : "Active";
  }

  const decayHours = hoursSinceLastCatalyst - DECAY_GRACE_PERIOD_HOURS;
  const decayedIvp = Math.max(theme.ipv - decayHours * DECAY_RATE_PER_HOUR, 0);

  if (decayedIvp <= RESOLVE_IPV_THRESHOLD) return "Resolved";
  if (decayedIvp <= DECAY_IPV_THRESHOLD) return "Decaying";
  return "Active";
}

export function getTrajectory(
  theme: Theme,
  since?: string,
): ThemeTrajectoryPoint[] {
  if (!since) return theme.trajectory;
  const sinceTime = new Date(since).getTime();
  return theme.trajectory.filter(
    (p) => new Date(p.timestamp).getTime() >= sinceTime,
  );
}

export function recomputeIPV(
  theme: Theme,
  catalystSeverities: string[],
): number {
  const ipv = computeIPV(catalystSeverities);
  const now = new Date().toISOString();
  const trajectoryPoint: ThemeTrajectoryPoint = { timestamp: now, ipv };
  store.updateTheme(theme.id, {
    ipv,
    trajectory: [...theme.trajectory, trajectoryPoint],
  });
  return ipv;
}

export function decayAllThemes(): number {
  const now = Date.now();
  const allThemes = store.listThemes();
  let changed = 0;
  for (const theme of allThemes) {
    const newStatus = transitionStatus(theme, now);
    if (newStatus !== theme.status) {
      store.updateTheme(theme.id, { status: newStatus });
      log.info("Theme status changed", {
        id: theme.id,
        name: theme.name,
        from: theme.status,
        to: newStatus,
      });
      changed++;
    }
  }
  return changed;
}
