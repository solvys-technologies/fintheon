// [claude-code 2026-03-11] Track 7B: Added analyze-sentiment endpoint (Claude Haiku)
// [claude-code 2026-04-20] S28-T1: Removed /session/* sidecar routes — browser-side
//   greeting playback is redundant now that all agent-to-user speech routes through
//   Harper Voice Notifications API (see services/harper-voice/speak.ts).
import { Hono } from "hono";
import {
  handleSpeak,
  handleTranscribe,
  handleAnalyzeSentiment,
} from "./handlers.js";

export function createVoiceRoutes(): Hono {
  const router = new Hono();

  router.post("/transcribe", handleTranscribe);
  router.post("/speak", handleSpeak);
  router.post("/analyze-sentiment", handleAnalyzeSentiment);

  return router;
}
