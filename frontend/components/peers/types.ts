export type PeerStatus = "online" | "away" | "offline";
export type PeerRole = "admin" | "peer";

export interface PeerUser {
  id: string;
  displayName: string;
  role: PeerRole;
  avatarUrl?: string | null;
  settings?: Record<string, unknown>;
}

export interface PeerRecord {
  id: string;
  userId: string;
  deviceName: string;
  platform: string;
  capabilities: string[];
  deskId?: string | null;
  deskName?: string | null;
  assignedAgents: string[];
  status: PeerStatus;
  heartbeatAt: string;
  hermesAvailable: boolean;
  createdAt: string;
  user?: PeerUser;
}

export interface DeskRecord {
  id: string;
  name: string;
  description?: string | null;
  sectorFocus: string[];
  createdById: string;
  createdAt: string;
}

export interface VoiceParticipantRecord {
  peerId: string;
  joinedAt: string;
}
