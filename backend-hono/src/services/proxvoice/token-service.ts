import { AccessToken } from "livekit-server-sdk";
import { getAppState, getOrCreateProfile } from "../supabase-service.js";
import { normalizeSocialLinks } from "./social-links.js";
import { updatePresence } from "./presence-store.js";
import type { ProxVoiceProfile } from "./types.js";

export const PROXVOICE_ROOM = "fintheon-floor";

function resolveLiveKitUrl() {
  return process.env.LIVEKIT_URL || "wss://fintheon-livekit.fly.dev";
}

function assertLiveKitConfig() {
  if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
    throw new Error("LiveKit not configured");
  }
}

export async function getPublicVoiceProfile(req: {
  userId: string;
  email?: string;
}): Promise<ProxVoiceProfile> {
  const profile = await getOrCreateProfile(req.userId, req.email);
  const appState = (await getAppState(req.userId)) ?? {};
  const socialLinks = normalizeSocialLinks(appState.socialLinks);
  const bio =
    typeof appState.bio === "string" ? appState.bio.slice(0, 180) : null;
  const position =
    typeof appState.position === "string"
      ? appState.position.slice(0, 48)
      : null;
  const broker =
    typeof appState.broker === "string" ? appState.broker.slice(0, 48) : null;
  return {
    userId: req.userId,
    displayName:
      profile?.display_name || req.email?.split("@")[0] || "Fintheon User",
    avatarUrl:
      (typeof appState.avatarUrl === "string" ? appState.avatarUrl : null) ??
      profile?.avatar_url ??
      null,
    bio,
    position,
    broker,
    socialLinks,
  };
}

export async function createProxVoiceToken(req: {
  userId: string;
  email?: string;
}) {
  assertLiveKitConfig();
  const profile = await getPublicVoiceProfile(req);
  const metadata = JSON.stringify({ profile });
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: req.userId,
      name: profile.displayName,
      metadata,
      ttl: "12h",
    },
  );
  token.addGrant({
    room: PROXVOICE_ROOM,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  updatePresence({ profile, surface: "fintheon" });
  return {
    token: await token.toJwt(),
    url: resolveLiveKitUrl(),
    roomName: PROXVOICE_ROOM,
  };
}
