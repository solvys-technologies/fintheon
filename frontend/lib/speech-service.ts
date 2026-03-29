// [claude-code 2026-03-28] S8-T8: Browser STT/TTS stub — S9 full implementation
// Web Speech API: SpeechRecognition for STT, speechSynthesis for TTS
// These are free, built into Chrome/Electron — replaces OpenAI Whisper dependency

type SpeechCallback = (transcript: string) => void;
type ErrorCallback = (error: string) => void;

// Web Speech API types — not all browsers export these globally
type SpeechRecognitionType = typeof window extends { SpeechRecognition: infer T } ? T : any;

interface SpeechServiceState {
  isListening: boolean;
  isSpeaking: boolean;
  recognition: any | null;
}

const state: SpeechServiceState = {
  isListening: false,
  isSpeaking: false,
  recognition: null,
};

/** Check if Web Speech API is available (Chrome/Electron) */
export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

/** Check if TTS is available */
export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Start listening via Web Speech API — returns transcript via callback */
export function startListening(onResult: SpeechCallback, onError?: ErrorCallback): void {
  if (!isSpeechSupported()) {
    onError?.('Speech recognition not supported in this browser');
    return;
  }

  if (state.isListening) return;

  const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionClass) {
    onError?.('SpeechRecognition constructor not available');
    return;
  }
  state.recognition = new SpeechRecognitionClass();
  state.recognition.continuous = false;
  state.recognition.interimResults = false;
  state.recognition.lang = 'en-US';

  state.recognition.onresult = (event: any) => {
    const transcript = event.results?.[0]?.[0]?.transcript ?? '';
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

/** Speak text via Web Speech API TTS */
export function speak(text: string, onEnd?: () => void): void {
  if (!isTTSSupported()) return;

  // Cancel any current speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  utterance.onstart = () => {
    state.isSpeaking = true;
  };
  utterance.onend = () => {
    state.isSpeaking = false;
    onEnd?.();
  };

  window.speechSynthesis.speak(utterance);
}

/** Stop speaking */
export function stopSpeaking(): void {
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
    state.isSpeaking = false;
  }
}

/** Get current state */
export function getSpeechState(): Readonly<Pick<SpeechServiceState, 'isListening' | 'isSpeaking'>> {
  return { isListening: state.isListening, isSpeaking: state.isSpeaking };
}
