// [claude-code 2026-04-03] S14-T6: Extended with service status lights + status dropdown + staleness util

export type UserStatus = "online" | "away" | "busy" | "dnd" | "offline";

export interface ServiceStatus {
  twitterCli: boolean;
  twitterRateLimited: boolean;
  aiRuntime: boolean;
  newsfeedPolling: { active: boolean; lastUpdate: string };
  backendConnection: boolean;
}

export interface DeviceStatus {
  userId: string;
  displayName: string;
  caoName: string;
  caoOnline: boolean;
  twitterCliPolling: boolean;
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
  twitterCliPolling: boolean;
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
