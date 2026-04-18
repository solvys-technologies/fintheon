// [claude-code 2026-04-11] Renamed twitter fields → rettiwt/riskflow for X CLI removal
// [claude-code 2026-04-18] S25-T4: Added unified newsfeedHealthy signal, per-source detail,
//                          and per-user lastSuccessAt (for "Polled Nm ago" on team cards)

export type UserStatus = "online" | "away" | "busy" | "dnd" | "offline";

export interface ServiceStatus {
  rettiwt: boolean;
  rettiwtRateLimited: boolean;
  rettiwtNoKeys: boolean;
  riskflowKilled: boolean;
  aiRuntime: boolean;
  newsfeedPolling: { active: boolean; lastUpdate: string };
  backendConnection: boolean;
  // S25-T4
  newsfeedHealthy: boolean;
  newsfeedDegraded: boolean;
  agentReachActive: boolean;
  /** ISO of this user's last successful poll contribution (ingest+score). Null if never. */
  lastSuccessAt: string | null;
  /** Total successful polling contributions for this user. */
  totalContributions: number;
}

export interface DeviceStatus {
  userId: string;
  displayName: string;
  caoName: string;
  caoOnline: boolean;
  riskflowPolling: boolean;
  riskflowKilled: boolean;
  online: boolean;
  lastSeen: string;
  inCall: boolean;
  userStatus: UserStatus;
  services: ServiceStatus;
}

export interface TeamMember {
  userId: string;
  displayName: string;
  caoName: string;
  presence: DeviceStatus;
}

export interface PresencePayload {
  userId: string;
  displayName: string;
  caoName: string;
  caoOnline: boolean;
  riskflowPolling: boolean;
  riskflowKilled: boolean;
  inCall: boolean;
  userStatus: UserStatus;
  services: ServiceStatus;
}

/** Returns true if the given ISO timestamp is older than `thresholdMinutes`. */
export function isStale(lastUpdate: string, thresholdMinutes: number): boolean {
  const diff = Date.now() - new Date(lastUpdate).getTime();
  return diff > thresholdMinutes * 60 * 1000;
}

/** Human-friendly relative time string. */
export { timeAgo } from "../lib/time-utils";
