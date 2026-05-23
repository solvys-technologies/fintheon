import type { ProxVoicePresence, ProxVoiceProfile } from "./types.js";

const presenceByUser = new Map<string, ProxVoicePresence>();
const STALE_MS = 45_000;

function nowIso() {
  return new Date().toISOString();
}

function prune() {
  const cutoff = Date.now() - STALE_MS;
  for (const [userId, presence] of presenceByUser) {
    if (new Date(presence.updatedAt).getTime() < cutoff) {
      presenceByUser.delete(userId);
    }
  }
}

export function updatePresence(input: {
  profile: ProxVoiceProfile;
  surface?: string;
  ticker?: string | null;
  sessionId?: string | null;
  muted?: boolean;
  deafened?: boolean;
}) {
  const existing = presenceByUser.get(input.profile.userId);
  const next: ProxVoicePresence = {
    userId: input.profile.userId,
    surface: input.surface ?? existing?.surface ?? "fintheon",
    ticker: input.ticker ?? existing?.ticker ?? null,
    sessionId: input.sessionId ?? existing?.sessionId ?? null,
    muted: input.muted ?? existing?.muted ?? false,
    deafened: input.deafened ?? existing?.deafened ?? false,
    updatedAt: nowIso(),
    profile: input.profile,
  };
  presenceByUser.set(next.userId, next);
  return next;
}

export function listPresence() {
  prune();
  return Array.from(presenceByUser.values()).sort((a, b) =>
    a.profile.displayName.localeCompare(b.profile.displayName),
  );
}
