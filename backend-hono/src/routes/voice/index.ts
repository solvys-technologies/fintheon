// [claude-code 2026-03-11] Track 7B: Added analyze-sentiment endpoint (Claude Haiku)
// [claude-code 2026-04-19] S27-T5 W2c: mounted /session/* routes (sidecar-relayed voice)
import { Hono } from "hono";
import {
  handleSpeak,
  handleTranscribe,
  handleAnalyzeSentiment,
} from "./handlers.js";
import {
  handleSessionStart,
  handleSessionTurn,
  handleSessionInterrupt,
  handleSessionEnd,
} from "./session.js";

export function createVoiceRoutes(): Hono {
  const router = new Hono();

  router.post("/transcribe", handleTranscribe);
  router.post("/speak", handleSpeak);
  router.post("/analyze-sentiment", handleAnalyzeSentiment);

  // S27-T5 W2c: sidecar-relayed session flow.
  router.post("/session/start", handleSessionStart);
  router.post("/session/turn", handleSessionTurn);
  router.post("/session/interrupt", handleSessionInterrupt);
  router.post("/session/end", handleSessionEnd);

  return router;
}
