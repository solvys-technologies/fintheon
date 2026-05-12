// [claude-code 2026-05-12] Peer-chat types added — agent-to-agent messaging protocol
// [claude-code 2026-03-30] Claude Peers Sprint 1 — core peer/auth/desk types

export type UserRole = "admin" | "peer";
export type PeerStatus = "online" | "away" | "offline";

export interface User {
  id: string;
  displayName: string;
  role: UserRole;
  avatarUrl?: string | null;
  settings?: Record<string, unknown>;
  createdAt: string;
}

export interface ClaudePeer {
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
  user?: User;
}

export interface Desk {
  id: string;
  name: string;
  description?: string | null;
  sectorFocus: string[];
  createdById: string;
  createdAt: string;
}

export interface PeerRegistration {
  deviceName: string;
  platform?: string;
  capabilities?: string[];
  deskId?: string | null;
  assignedAgents?: string[];
  status?: PeerStatus;
  hermesAvailable?: boolean;
  displayName?: string;
  avatarUrl?: string | null;
  settings?: Record<string, unknown>;
}

export interface HeartbeatPayload {
  status?: PeerStatus;
  metadata?: Record<string, unknown>;
}

// ── Peer Chat Types ──────────────────────────────────────────────────────────
// Agent-to-agent structured messaging protocol for Claude Peers.
// Messages are stored in peer_shared_memory under the "peer-chat" category,
// keyed by conversationId. Each conversation is an ordered array of messages.

export type PeerMessageRole = "agent" | "system";

export type PeerChatMessageType =
  | "text" // Free-form agent message
  | "handoff" // Structured handoff request
  | "handoff_ack" // Handoff accepted
  | "handoff_decline" // Handoff rejected
  | "status" // Status update (online/away/working/blocked)
  | "request" // Request for information or action
  | "response" // Response to a prior request
  | "ack" // Acknowledgment of receipt
  | "error"; // Error notification

export interface PeerChatMessage {
  id: string;
  conversationId: string;
  senderPeerId: string;
  senderAgentName: string; // e.g. "codi", "harper", "francine"
  recipientPeerId: string; // target peer — or "*" for broadcast to desk/all
  recipientAgentName: string; // target agent name — or "*" for any agent on target peer
  type: PeerChatMessageType;
  role: PeerMessageRole;
  body: string;
  /** Structured payload for handoff/request types */
  payload?: Record<string, unknown>;
  /** Conversation context: parent message id this is in reply to */
  inReplyTo?: string;
  /** Set to true when the recipient has read/processed this message */
  read: boolean;
  createdAt: string;
}

export interface PeerConversation {
  id: string;
  /** Human-readable label for the conversation thread */
  title: string;
  /** Peer IDs participating */
  participantPeerIds: string[];
  /** Agent names participating */
  participantAgentNames: string[];
  /** Last message timestamp (for sorting) */
  lastActivityAt: string;
  /** Unread count per participant peerId → count */
  unreadByPeer: Record<string, number>;
  createdAt: string;
}

/** Handoff payload for agent-to-agent delegation */
export interface PeerHandoffPayload {
  task: string;
  context: string;
  priority: "low" | "medium" | "high" | "critical";
  deadline?: string;
  attachments?: string[]; // file paths or URLs
}

/** Status payload for agent status updates */
export interface PeerStatusPayload {
  status: "working" | "idle" | "blocked" | "completed";
  currentTask?: string;
  progress?: string;
  blocker?: string;
}

/** Request payload for structured information requests */
export interface PeerRequestPayload {
  action: string;
  params: Record<string, unknown>;
}
