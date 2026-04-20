// [claude-code 2026-03-28] S8-T8: Browser STT stub — S9 full implementation
// [claude-code 2026-04-20] S28-T1: speechSynthesis TTS removed. All agent speech
// routes through Omi's Notifications API via the backend /api/omi/notify path.
// STT still uses Web Speech API (SpeechRecognition) for legacy callers.

type SpeechCallback = (transcript: string) => void;
type ErrorCallback = (error: string) => void;

// Web Speech API types — not all browsers export these globally
type SpeechRecognitionType = typeof window extends {
  SpeechRecognition: infer T;
}
  ? T
  : any;

interface SpeechServiceState {
  isListening: boolean;
  recognition: any | null;
}

const state: SpeechServiceState = {
  isListening: false,
  recognition: null,
};

/** Check if Web Speech API is available (Chrome/Electron) */
export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
}

/** TTS is served through Omi — no browser TTS surface exists in-app. */
export function isTTSSupported(): boolean {
  return false;
}

/** Start listening via Web Speech API — returns transcript via callback */
export function startListening(
  onResult: SpeechCallback,
  onError?: ErrorCallback,
): void {
  if (!isSpeechSupported()) {
    onError?.("Speech recognition not supported in this browser");
    return;
  }

  if (state.isListening) return;

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionClass) {
    onError?.("SpeechRecognition constructor not available");
    return;
  }
  state.recognition = new SpeechRecognitionClass();
  state.recognition.continuous = false;
  state.recognition.interimResults = false;
  state.recognition.lang = "en-US";

  state.recognition.onresult = (event: any) => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? "";
    onResult(transcript);
  };

  state.recognition.onerror = (event: any) => {
    state.isListening = false;
    onError?.(event.error);
  };

  state.recognition.onend = () => {
    state.isListening = false;
  };

  state.recognition.start();
  state.isListening = true;
}

/** Stop listening */
export function stopListening(): void {
  if (state.recognition && state.isListening) {
    state.recognition.stop();
    state.isListening = false;
  }
}

/** No-op: browser TTS removed; agent speech goes through Omi via /api/omi/notify. */
export function speak(_text: string, onEnd?: () => void): void {
  onEnd?.();
}

/** No-op: browser TTS removed. */
export function stopSpeaking(): void {}

/** Get current state */
export function getSpeechState(): Readonly<{
  isListening: boolean;
  isSpeaking: boolean;
}> {
  return { isListening: state.isListening, isSpeaking: false };
}
