// [claude-code 2026-04-25] S40-P1: Piper TTS synthesis via local binary.
// Harper's voice (en_GB-cori-medium) — British, middle-aged, measured. The
// ElevenLabs "Rachel" default sounded like a 20-something Californian, which
// breaks the senior-PM persona Harper is meant to project.
//
// Implementation:
//   - We shell out to the `piper` binary (path configurable via PIPER_BINARY).
//   - Model + config are loaded from backend-hono/assets/voices/<voice>.onnx.
//   - Output is 22050Hz mono WAV piped on stdout, wrapped in audio/wav.
//
// If the binary or model file is missing, this returns null and the router
// falls back to ElevenLabs. We never throw — Piper failures shouldn't kill
// Harper's voice path.
//
// Configure:
//   PIPER_BINARY        — defaults to "piper" (assumes it's on PATH)
//   PIPER_VOICES_DIR    — defaults to backend-hono/assets/voices
//   PIPER_DEFAULT_VOICE — defaults to "cori" (alt: "jenny_dioco")

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve as pathResolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "../../lib/logger.js";
import type { PiperVoice, SynthesizedAudio } from "./types.js";

const log = createLogger("VoiceTTS:Piper");

const VOICE_FILES: Record<PiperVoice, string> = {
  cori: "en_GB-cori-medium.onnx",
  jenny_dioco: "en_GB-jenny_dioco-medium.onnx",
};

const VOICE_IDS: Record<PiperVoice, string> = {
  cori: "en_GB-cori-medium",
  jenny_dioco: "en_GB-jenny_dioco-medium",
};

function getVoicesDir(): string {
  if (process.env.PIPER_VOICES_DIR) return process.env.PIPER_VOICES_DIR;
  // Resolve relative to this compiled module so it works in dist/ and src/.
  const here = dirname(fileURLToPath(import.meta.url));
  // From dist/services/voice-tts/piper.js or src/services/voice-tts/piper.ts:
  // ../../../assets/voices
  return pathResolve(here, "..", "..", "..", "assets", "voices");
}

export function isPiperAvailable(voice: PiperVoice = "cori"): boolean {
  const file = VOICE_FILES[voice];
  if (!file) return false;
  const modelPath = pathResolve(getVoicesDir(), file);
  return existsSync(modelPath);
}

export async function synthesizeWithPiper(
  text: string,
  voice: PiperVoice = (process.env.PIPER_DEFAULT_VOICE as PiperVoice) || "cori",
): Promise<SynthesizedAudio | null> {
  const message = text.trim();
  if (!message) return null;

  const voiceFile = VOICE_FILES[voice];
  if (!voiceFile) {
    log.warn("Unknown piper voice", { voice });
    return null;
  }

  const modelPath = pathResolve(getVoicesDir(), voiceFile);
  if (!existsSync(modelPath)) {
    log.warn("Piper model missing", { modelPath });
    return null;
  }

  const binary = process.env.PIPER_BINARY || "piper";

  return new Promise<SynthesizedAudio | null>((resolveFn) => {
    let proc: ReturnType<typeof spawn>;
    try {
      proc = spawn(binary, ["--model", modelPath, "--output_raw"], {
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (err) {
      log.warn("Piper spawn threw", {
        error: err instanceof Error ? err.message : String(err),
      });
      resolveFn(null);
      return;
    }

    const chunks: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr?.on("data", (chunk: Buffer) => stderr.push(chunk));

    proc.on("error", (err) => {
      log.warn("Piper process error", { error: err.message });
      resolveFn(null);
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        log.warn("Piper exited non-zero", {
          code,
          stderr: Buffer.concat(stderr).toString("utf8").slice(0, 240),
        });
        resolveFn(null);
        return;
      }
      const raw = Buffer.concat(chunks);
      if (raw.length === 0) {
        log.warn("Piper produced empty output");
        resolveFn(null);
        return;
      }
      // --output_raw emits 22050Hz s16le mono PCM. Wrap it in a WAV header so
      // browsers can play it without an extra decode step.
      const wav = wrapPcmAsWav(raw, { sampleRate: 22050, channels: 1, bits: 16 });
      resolveFn({
        audioBase64: wav.toString("base64"),
        audioMimeType: "audio/wav",
        provider: "piper",
        voiceId: VOICE_IDS[voice],
      });
    });

    proc.stdin?.write(message);
    proc.stdin?.end();
  });
}

function wrapPcmAsWav(
  pcm: Buffer,
  opts: { sampleRate: number; channels: number; bits: number },
): Buffer {
  const { sampleRate, channels, bits } = opts;
  const byteRate = (sampleRate * channels * bits) / 8;
  const blockAlign = (channels * bits) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bits, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
