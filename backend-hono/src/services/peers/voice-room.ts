// [claude-code 2026-03-30] Claude Peers Sprint 1 — optional group voice room service

interface VoiceRoomRecord {
  id: string
  name: string
  createdAt: string
}

interface VoiceParticipant {
  peerId: string
  joinedAt: string
}

export interface VoiceRoom {
  id: string
  name: string
  createdAt: string
  configured: boolean
}

const rooms = new Map<string, VoiceRoomRecord>()
const participantsByRoom = new Map<string, Map<string, VoiceParticipant>>()

function nowIso(): string {
  return new Date().toISOString()
}

function hasLiveKitConfig(): boolean {
  return Boolean(
    process.env.LIVEKIT_API_KEY &&
      process.env.LIVEKIT_API_SECRET &&
      process.env.LIVEKIT_URL,
  )
}

function toVoiceRoom(room: VoiceRoomRecord): VoiceRoom {
  return {
    ...room,
    configured: hasLiveKitConfig(),
  }
}

function buildParticipantToken(peerId: string, roomId: string): string {
  // Graceful stub token when LiveKit is not configured.
  if (!hasLiveKitConfig()) {
    return `voice_stub_${roomId}_${peerId}_${Date.now()}`
  }

  const payload = {
    peerId,
    roomId,
    iat: Math.floor(Date.now() / 1000),
    iss: process.env.LIVEKIT_API_KEY,
  }
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

export async function createRoom(name: string): Promise<VoiceRoom> {
  const existing = Array.from(rooms.values()).find(
    (room) => room.name.toLowerCase() === name.toLowerCase(),
  )
  if (existing) return toVoiceRoom(existing)

  const room: VoiceRoomRecord = {
    id: crypto.randomUUID(),
    name,
    createdAt: nowIso(),
  }
  rooms.set(room.id, room)
  return toVoiceRoom(room)
}

export async function joinRoom(
  peerId: string,
  roomId: string,
): Promise<{
  room: VoiceRoom
  token: string
  configured: boolean
}> {
  let room = rooms.get(roomId)
  if (!room) {
    room = {
      id: roomId,
      name: `Room ${roomId.slice(0, 6)}`,
      createdAt: nowIso(),
    }
    rooms.set(roomId, room)
  }

  let participants = participantsByRoom.get(roomId)
  if (!participants) {
    participants = new Map<string, VoiceParticipant>()
    participantsByRoom.set(roomId, participants)
  }

  participants.set(peerId, {
    peerId,
    joinedAt: nowIso(),
  })

  const configured = hasLiveKitConfig()
  return {
    room: toVoiceRoom(room),
    token: buildParticipantToken(peerId, roomId),
    configured,
  }
}

export async function leaveRoom(peerId: string, roomId: string): Promise<boolean> {
  const participants = participantsByRoom.get(roomId)
  if (!participants) return false
  const deleted = participants.delete(peerId)
  if (participants.size === 0) {
    participantsByRoom.delete(roomId)
  }
  return deleted
}

export async function listParticipants(roomId: string): Promise<{
  roomId: string
  participants: Array<{ peerId: string; joinedAt: string }>
  configured: boolean
}> {
  const participants = participantsByRoom.get(roomId)
  const list = participants ? Array.from(participants.values()) : []
  return {
    roomId,
    participants: list,
    configured: hasLiveKitConfig(),
  }
}

