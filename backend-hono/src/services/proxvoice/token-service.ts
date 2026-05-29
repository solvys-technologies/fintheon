import { AccessToken } from "livekit-server-sdk";
import { getAppState, getOrCreateProfile } from "../supabase-service.js";
import { resolveProxVoiceConfig } from "./global-config.js";
import { normalizeSocialLinks } from "./social-links.js";
import { updatePresence } from "./presence-store.js";
import type { ProxVoiceProfile } from "./types.js";

export const PROXVOICE_ROOM = "fintheon-floor";
const PROFILE_LOOKUP_TIMEOUT_MS = 1500;

function fallbackProfile(req: {
  userId: string;
  email?: string;
}): ProxVoiceProfile {
  return {
    userId: req.userId,
    displayName: req.email?.split("@")[0] || "Fintheon User",
    avatarUrl: null,
    bio: null,
    position: null,
    broker: null,
    socialLinks: {},
  };
}

async function withTimeout<T>(task: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      task,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function getPublicVoiceProfile(req: {
  userId: string;
  email?: string;
}): Promise<ProxVoiceProfile> {
  const fallback = fallbackProfile(req);
  const profile = await withTimeout(
    getOrCreateProfile(req.userId, req.email),
    PROFILE_LOOKUP_TIMEOUT_MS,
  ).catch((error) => {
    console.warn("[ProxVoice] profile lookup skipped", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  });
  const appState =
    (await withTimeout(
      getAppState(req.userId),
      PROFILE_LOOKUP_TIMEOUT_MS,
    ).catch((error) => {
      console.warn("[ProxVoice] app state lookup skipped", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    })) ?? {};
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
      fallback.avatarUrl,
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
  const config = await resolveProxVoiceConfig();
  if (!config) {
    throw new Error("ProxVoice global token config is not configured");
  }
  const profile = await getPublicVoiceProfile(req);
  const metadata = JSON.stringify({ profile });
  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: req.userId,
    name: profile.displayName,
    metadata,
    ttl: "12h",
  });
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
    url: config.url,
    roomName: PROXVOICE_ROOM,
  };
}
