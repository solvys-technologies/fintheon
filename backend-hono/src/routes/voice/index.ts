// [claude-code 2026-03-11] Track 7B: Added analyze-sentiment endpoint (Claude Haiku)
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
