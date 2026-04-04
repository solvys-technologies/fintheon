/**
 * Peers/Team Service
 */

import ApiClient from "../apiClient";

export interface PeerUserRecord {
  id: string;
  displayName: string;
  role: 'admin' | 'peer';
  avatarUrl?: string | null;
  settings?: Record<string, unknown>;
}

export interface PeerRecordResponse {
  id: string;
  userId: string;
  deviceName: string;
  platform: string;
  capabilities: string[];
  deskId?: string | null;
  deskName?: string | null;
  assignedAgents: string[];
  status: 'online' | 'away' | 'offline';
  heartbeatAt: string;
  hermesAvailable: boolean;
  createdAt: string;
  user?: PeerUserRecord;
}

export interface DeskRecordResponse {
  id: string;
  name: string;
  description?: string | null;
  sectorFocus: string[];
  createdById: string;
  createdAt: string;
}

export interface VoiceParticipantsResponse {
  roomId: string;
  participants: Array<{ peerId: string; joinedAt: string }>;
  configured: boolean;
}

export class PeersService {
  constructor(private client: ApiClient) {}

  async register(data: {
    deviceName: string;
    platform?: string;
    capabilities?: string[];
    deskId?: string | null;
    assignedAgents?: string[];
    hermesAvailable?: boolean;
  }): Promise<{ peer: PeerRecordResponse }> {
    return this.client.post('/api/peers/register', data);
  }

  async heartbeat(data: {
    peerId: string;
    payload?: { status?: 'online' | 'away' | 'offline'; metadata?: Record<string, unknown> };
  }): Promise<{ peer: PeerRecordResponse }> {
    return this.client.post('/api/peers/heartbeat', data);
  }

  async list(): Promise<{ peers: PeerRecordResponse[]; total: number }> {
    return this.client.get('/api/peers/list');
  }

  async get(id: string): Promise<{ peer: PeerRecordResponse }> {
    return this.client.get(`/api/peers/${id}`);
  }

  async deregister(id: string): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/peers/${id}`);
  }

  async createDesk(data: {
    name: string;
    description?: string;
    sectorFocus?: string[];
  }): Promise<{ desk: DeskRecordResponse }> {
    return this.client.post('/api/peers/desks', data);
  }

  async listDesks(): Promise<{ desks: DeskRecordResponse[]; total: number }> {
    return this.client.get('/api/peers/desks');
  }

  async assignDesk(
    deskId: string,
    peerId: string,
  ): Promise<{ assigned: boolean; deskId: string; peers: PeerRecordResponse[] }> {
    return this.client.post(`/api/peers/desks/${deskId}/assign`, { peerId });
  }

  async joinVoice(data: {
    peerId?: string;
    roomId?: string;
    roomName?: string;
  }): Promise<{ room: { id: string; name: string; createdAt: string; configured: boolean }; token: string; configured: boolean; url: string | null }> {
    return this.client.post('/api/peers/voice/join', data);
  }

  async leaveVoice(data: {
    peerId?: string;
    roomId: string;
  }): Promise<{ left: boolean }> {
    return this.client.post('/api/peers/voice/leave', data);
  }

  async listVoiceParticipants(roomId: string): Promise<VoiceParticipantsResponse> {
    return this.client.get(`/api/peers/voice/participants?roomId=${encodeURIComponent(roomId)}`);
  }
}
