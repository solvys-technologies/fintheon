// S13-T1: Team presence and device status types

export interface DeviceStatus {
  userId: string;
  displayName: string;       // User's chosen nametag from settings
  caoName: string;           // User's CAO name (renamed Harper-Opus)
  caoOnline: boolean;        // Whether their CAO agent is running
  twitterCliPolling: boolean; // Whether their Twitter CLI is actively polling
  online: boolean;           // Whether the user's app is open
  lastSeen: string;          // ISO timestamp
  inCall: boolean;           // Whether they're in a LiveKit voice room
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
}
