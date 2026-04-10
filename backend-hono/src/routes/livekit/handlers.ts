// S13-T3: LiveKit token generation for group voice calls
import { AccessToken } from "livekit-server-sdk";

export async function generateToken(req: {
  roomName: string;
  participantName: string;
  participantIdentity: string;
}): Promise<{ token: string; url: string }> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    throw new Error(
      "LiveKit not configured — set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL",
    );
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: req.participantIdentity,
    name: req.participantName,
  });

  at.addGrant({
    room: req.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return {
    token: await at.toJwt(),
    url: livekitUrl,
  };
}
