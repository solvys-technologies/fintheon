// [claude-code 2026-03-30] Claude Peers Sprint 1 — core peer/auth/desk types

export type UserRole = 'admin' | 'peer'
export type PeerStatus = 'online' | 'away' | 'offline'

export interface User {
  id: string
  displayName: string
  role: UserRole
  avatarUrl?: string | null
  settings?: Record<string, unknown>
  createdAt: string
}

export interface ClaudePeer {
  id: string
  userId: string
  deviceName: string
  platform: string
  capabilities: string[]
  deskId?: string | null
  deskName?: string | null
  assignedAgents: string[]
  status: PeerStatus
  heartbeatAt: string
  hermesAvailable: boolean
  createdAt: string
  user?: User
}

export interface Desk {
  id: string
  name: string
  description?: string | null
  sectorFocus: string[]
  createdById: string
  createdAt: string
}

export interface PeerRegistration {
  deviceName: string
  platform?: string
  capabilities?: string[]
  deskId?: string | null
  assignedAgents?: string[]
  status?: PeerStatus
  hermesAvailable?: boolean
  displayName?: string
  avatarUrl?: string | null
  settings?: Record<string, unknown>
}

export interface HeartbeatPayload {
  status?: PeerStatus
  metadata?: Record<string, unknown>
}

