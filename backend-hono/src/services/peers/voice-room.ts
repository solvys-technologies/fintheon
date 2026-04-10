// [claude-code 2026-04-01] LiveKit Cloud voice — real JWT tokens via livekit-server-sdk
import { AccessToken } from "livekit-server-sdk";

interface VoiceRoomRecord {
  id: string;
  name: string;
  createdAt: string;
}

interface VoiceParticipant {
  peerId: string;
  joinedAt: string;
}

export interface VoiceRoom {
  id: string;
  name: string;
  createdAt: string;
  configured: boolean;
}

const rooms = new Map<string, VoiceRoomRecord>();
const participantsByRoom = new Map<string, Map<string, VoiceParticipant>>();

function nowIso(): string {
  return new Date().toISOString();
}

function hasLiveKitConfig(): boolean {
  return Boolean(
    process.env.LIVEKIT_API_KEY &&
    process.env.LIVEKIT_API_SECRET &&
    process.env.LIVEKIT_URL,
  );
}

function toVoiceRoom(room: VoiceRoomRecord): VoiceRoom {
  return {
    ...room,
    configured: hasLiveKitConfig(),
  };
}

async function buildParticipantToken(
  peerId: string,
  roomId: string,
): Promise<string> {
  if (!hasLiveKitConfig()) {
    return `voice_stub_${roomId}_${peerId}_${Date.now()}`;
  }

  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity: peerId, name: peerId },
  );
  at.addGrant({
    roomJoin: true,
    room: roomId,
    canPublish: true,
    canSubscribe: true,
  });
  return await at.toJwt();
}

export async function createRoom(name: string): Promise<VoiceRoom> {
  const existing = Array.from(rooms.values()).find(
    (room) => room.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) return toVoiceRoom(existing);

  const room: VoiceRoomRecord = {
    id: crypto.randomUUID(),
    name,
    createdAt: nowIso(),
  };
  rooms.set(room.id, room);
  return toVoiceRoom(room);
}

export async function joinRoom(
  peerId: string,
  roomId: string,
): Promise<{
  room: VoiceRoom;
  token: string;
  configured: boolean;
  url: string | null;
}> {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      name: `Room ${roomId.slice(0, 6)}`,
      createdAt: nowIso(),
    };
    rooms.set(roomId, room);
  }

  let participants = participantsByRoom.get(roomId);
  if (!participants) {
    participants = new Map<string, VoiceParticipant>();
    participantsByRoom.set(roomId, participants);
  }

  participants.set(peerId, {
    peerId,
    joinedAt: nowIso(),
  });

  const configured = hasLiveKitConfig();
  return {
    room: toVoiceRoom(room),
    token: await buildParticipantToken(peerId, roomId),
    configured,
    url: configured ? process.env.LIVEKIT_URL! : null,
  };
}

export async function leaveRoom(
  peerId: string,
  roomId: string,
): Promise<boolean> {
  const participants = participantsByRoom.get(roomId);
  if (!participants) return false;
  const deleted = participants.delete(peerId);
  if (participants.size === 0) {
    participantsByRoom.delete(roomId);
  }
  return deleted;
}

export async function listParticipants(roomId: string): Promise<{
  roomId: string;
  participants: Array<{ peerId: string; joinedAt: string }>;
  configured: boolean;
}> {
  const participants = participantsByRoom.get(roomId);
  const list = participants ? Array.from(participants.values()) : [];
  return {
    roomId,
    participants: list,
    configured: hasLiveKitConfig(),
  };
}
