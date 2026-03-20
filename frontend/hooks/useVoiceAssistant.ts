// [claude-code 2026-03-13] Hermes migration: openclawAgentRouting -> hermesAgentRouting
// [claude-code 2026-03-09] Added: useMicPermission, useMicArbitration, error state with auto-recovery, cancel/interrupt support
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBackend } from '../lib/backend';
import { hermesConversationStorageKey } from '../lib/hermesAgentRouting';
import type { VoiceRuntimeState, MicPermissionState } from '../types/voice';

const VOICE_ENABLED_STORAGE_KEY = 'fintheon:voice-assistant-enabled:v1';
const HARPER_CONVERSATION_STORAGE_KEY = hermesConversationStorageKey('harper');
const ERROR_AUTO_RECOVERY_MS = 5000;

interface VoiceSendResult {
  conversationId?: string;
  responseText?: string;
  audioBase64?: string;
  audioMimeType?: string;
}

interface InfractionPromptInput {
  erScore?: number;
  infractionCount?: number;
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

// ─── Mic Permission Hook ───────────────────────────────────────────────────────

export function useMicPermission() {
  const [permission, setPermission] = useState<MicPermissionState>('prompt');

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions) return;

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((status) => {
        setPermission(status.state as MicPermissionState);
        status.onchange = () => {
          setPermission(status.state as MicPermissionState);
        };
      })
      .catch(() => {
        // Older browsers or permission API not available — remain 'prompt'
      });
  }, []);

  return { permission };
}

// ─── Mic Arbitration ───────────────────────────────────────────────────────────

interface MicHolder {
  id: string;
  priority: number;
  release: () => void;
}

let currentMicHolder: MicHolder | null = null;

export function useMicArbitration() {
  const requestMic = useCallback(
    (
      id: string,
      priority: number
    ): { acquired: boolean; release: () => void } => {
      // If no one holds the mic, grant immediately
      if (!currentMicHolder) {
        const release = () => {
          if (currentMicHolder?.id === id) {
            currentMicHolder = null;
          }
        };
        currentMicHolder = { id, priority, release };
        return { acquired: true, release };
      }

      // If same consumer, just return
      if (currentMicHolder.id === id) {
        return { acquired: true, release: currentMicHolder.release };
      }

      // If requesting with higher priority, preempt
      if (priority > currentMicHolder.priority) {
        currentMicHolder.release();
        const release = () => {
          if (currentMicHolder?.id === id) {
            currentMicHolder = null;
          }
        };
        currentMicHolder = { id, priority, release };
        return { acquired: true, release };
      }

      // Lower priority — denied
      return { acquired: false, release: () => {} };
    },
    []
  );

  return { requestMic, getCurrentHolder: () => currentMicHolder };
}

// ─── Voice Assistant Hook ──────────────────────────────────────────────────────

export function useVoiceAssistant() {
  const backend = useBackend();

  const [enabled, setEnabledState] = useState(false);
  const [runtimeState, setRuntimeState] = useState<VoiceRuntimeState>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastUserText, setLastUserText] = useState('');
  const [lastAssistantText, setLastAssistantText] = useState('');

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(false);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const micReleaseRef = useRef<(() => void) | null>(null);
  const errorRecoveryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRecognitionRef = useRef<() => void>(() => {});

  const { permission } = useMicPermission();
  const { requestMic } = useMicArbitration();

  const speechRecognitionSupported = useMemo(
    () =>
      typeof window !== 'undefined' &&
      (typeof (window as any).webkitSpeechRecognition !== 'undefined' ||
        typeof (window as any).SpeechRecognition !== 'undefined'),
    []
  );

  // [claude-code 2026-03-14] Guard: don't fire error when speechRecognition is simply absent (expected in Electron)
  const setErrorWithRecovery = useCallback(() => {
    if (!speechRecognitionSupported) return; // not an error — expected in Electron
    setRuntimeState('error');
    // Clear any existing recovery timer
    if (errorRecoveryRef.current) clearTimeout(errorRecoveryRef.current);
    errorRecoveryRef.current = setTimeout(() => {
      errorRecoveryRef.current = null;
      setRuntimeState(enabledRef.current ? 'listening' : 'idle');
    }, ERROR_AUTO_RECOVERY_MS);
  }, [speechRecognitionSupported]);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopRecognition = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch {
      // ignore
    }
    recognitionRef.current = null;

    // Release mic lock
    if (micReleaseRef.current) {
      micReleaseRef.current();
      micReleaseRef.current = null;
    }
  }, []);

  const persistConversationId = useCallback((id: string | null) => {
    setConversationId(id);
    if (id) {
      safeLocalStorageSet(HARPER_CONVERSATION_STORAGE_KEY, id);
    }
  }, []);

  const playAudio = useCallback(async (audioBase64: string, mimeType?: string) => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

    const source = `data:${mimeType || 'audio/mpeg'};base64,${audioBase64}`;
    await new Promise<void>((resolve) => {
      const audio = new Audio(source);
      audioRef.current = audio;

      const cleanup = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        resolve();
      };

      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.play().catch(cleanup);
    });
  }, []);

  const playWithSpeechSynthesis = useCallback(async (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    await new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text.slice(0, 800));
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // [claude-code 2026-03-13] Analyze user speech for tilt indicators, dispatch PsychAssist events
  const analyzeSpeechForTilt = useCallback(async (transcript: string) => {
    try {
      const result = await backend.voice.analyzeSentiment({ transcript });
      if (!result) return;

      // Dispatch score update
      if (typeof result.sentiment === 'number') {
        window.dispatchEvent(new CustomEvent('psychassist:score', {
          detail: { score: result.sentiment, timestamp: Date.now() }
        }));
        try { localStorage.setItem('psychassist_current_score', String(result.sentiment)); } catch {}
      }

      // If tilt indicators found, dispatch infraction
      if (result.tiltIndicators && result.tiltIndicators.length > 0) {
        window.dispatchEvent(new CustomEvent('psychassist:infraction', {
          detail: { timestamp: Date.now(), indicators: result.tiltIndicators }
        }));
      }
    } catch (err) {
      console.warn('[VoiceAssistant] Sentiment analysis failed (non-critical):', err);
    }
  }, [backend]);

  const cancel = useCallback(() => {
    // Abort any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    // Stop playback and recognition
    stopPlayback();
    stopRecognition();
    busyRef.current = false;
    // Clear error recovery timer
    if (errorRecoveryRef.current) {
      clearTimeout(errorRecoveryRef.current);
      errorRecoveryRef.current = null;
    }
    setRuntimeState(enabledRef.current ? 'listening' : 'idle');
  }, [stopPlayback, stopRecognition]);

  const sendText = useCallback(
    async (text: string, mode: 'chat' | 'infraction' = 'chat'): Promise<VoiceSendResult | null> => {
      const prompt = text.trim();
      if (!prompt || busyRef.current) return null;

      busyRef.current = true;
      setLastUserText(prompt);
      setRuntimeState('thinking');

      // Create abort controller for this request
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = (await backend.voice.speak({
          text: prompt,
          mode,
          conversationId: conversationId || undefined,
          includeAudio: true,
          agent: 'harper-cao',
        })) as VoiceSendResult;

        // Check if cancelled during the request
        if (controller.signal.aborted) return null;

        if (response.conversationId) {
          persistConversationId(response.conversationId);
        }

        const assistantText = response.responseText || '';
        setLastAssistantText(assistantText);

        if (assistantText) {
          setRuntimeState('speaking');
          if (controller.signal.aborted) return null;

          if (response.audioBase64) {
            await playAudio(response.audioBase64, response.audioMimeType);
          } else {
            await playWithSpeechSynthesis(assistantText);
          }
        }

        if (!controller.signal.aborted) {
          // Analyze user's speech for tilt indicators (non-blocking)
          if (prompt && mode === 'chat') {
            analyzeSpeechForTilt(prompt).catch(() => {});
          }

          setRuntimeState(enabledRef.current ? 'listening' : 'idle');

          // Restart recognition after TTS playback completes
          if (enabledRef.current) {
            await new Promise(r => setTimeout(r, 300));
            startRecognitionRef.current();
          }
        }
        return response;
      } catch (error) {
        if (controller.signal.aborted) return null;
        console.error('[VoiceAssistant] Failed to send text:', error);
        setErrorWithRecovery();
        return null;
      } finally {
        busyRef.current = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [backend, conversationId, persistConversationId, playAudio, playWithSpeechSynthesis, setErrorWithRecovery, analyzeSpeechForTilt]
  );

  const respondToInfraction = useCallback(
    async ({ erScore, infractionCount }: InfractionPromptInput = {}) => {
      if (!enabledRef.current) return null;
      const scoreText = Number.isFinite(erScore) ? `Current ER score is ${Number(erScore).toFixed(2)}.` : 'Current ER score unavailable.';
      const countText = Number.isFinite(infractionCount)
        ? `Detected infractions in recent window: ${Math.max(0, Number(infractionCount))}.`
        : 'Detected infractions in recent window are unavailable.';
      const prompt = `${scoreText} ${countText} Provide a short de-escalation intervention for the trader with one immediate action and one reminder.`;
      return sendText(prompt, 'infraction');
    },
    [sendText]
  );

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || !speechRecognitionSupported || recognitionRef.current) return;

    // Check mic permission — if denied, show error state
    if (permission === 'denied') {
      setErrorWithRecovery();
      console.warn('[VoiceAssistant] Microphone permission denied');
      return;
    }

    // Acquire mic lock via arbitration (priority 10 = high for voice assistant)
    const { acquired, release } = requestMic('voice-assistant', 10);
    if (!acquired) {
      console.warn('[VoiceAssistant] Mic arbitration denied — another consumer has priority');
      return;
    }
    micReleaseRef.current = release;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      if (enabledRef.current && !busyRef.current) {
        setRuntimeState('listening');
      }
    };

    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result?.isFinal) {
          finalText += `${result[0]?.transcript ?? ''} `;
        }
      }

      const trimmed = finalText.trim();
      if (!trimmed) return;

      stopRecognition();
      void sendText(trimmed, 'chat');
    };

    recognition.onerror = (event: any) => {
      const errorType = event?.error;
      // 'not-allowed' means mic denied, 'aborted' is intentional stop — don't error on those
      if (errorType === 'not-allowed') {
        setErrorWithRecovery();
        return;
      }
      if (enabledRef.current && !busyRef.current) {
        setRuntimeState('listening');
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;

      if (!enabledRef.current) {
        setRuntimeState('idle');
        // Release mic lock
        if (micReleaseRef.current) {
          micReleaseRef.current();
          micReleaseRef.current = null;
        }
        return;
      }

      if (busyRef.current) {
        return;
      }

      window.setTimeout(() => {
        if (enabledRef.current && !busyRef.current) {
          startRecognition();
        }
      }, 220);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [sendText, speechRecognitionSupported, stopRecognition, permission, requestMic, setErrorWithRecovery]);

  // Keep ref in sync so sendText can restart recognition without circular deps
  startRecognitionRef.current = startRecognition;

  const setEnabled = useCallback(
    (nextEnabled: boolean) => {
      setEnabledState(nextEnabled);
      enabledRef.current = nextEnabled;
      safeLocalStorageSet(VOICE_ENABLED_STORAGE_KEY, nextEnabled ? 'true' : 'false');

      if (!nextEnabled) {
        cancel();
        return;
      }

      startRecognition();
    },
    [startRecognition, cancel]
  );

  const toggleEnabled = useCallback(() => {
    setEnabled(!enabledRef.current);
  }, [setEnabled]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const savedEnabled = safeLocalStorageGet(VOICE_ENABLED_STORAGE_KEY) === 'true';
    const savedConversationId = safeLocalStorageGet(HARPER_CONVERSATION_STORAGE_KEY);

    if (savedConversationId) {
      setConversationId(savedConversationId);
    }

    if (savedEnabled) {
      setEnabled(savedEnabled);
    }
  }, [setEnabled]);

  useEffect(() => {
    if (
      enabled &&
      speechRecognitionSupported &&
      runtimeState === 'listening' &&
      !recognitionRef.current &&
      !busyRef.current
    ) {
      startRecognition();
    }
  }, [enabled, runtimeState, speechRecognitionSupported, startRecognition]);

  useEffect(() => {
    return () => {
      stopRecognition();
      stopPlayback();
      if (errorRecoveryRef.current) clearTimeout(errorRecoveryRef.current);
    };
  }, [stopPlayback, stopRecognition]);

  return {
    enabled,
    runtimeState,
    conversationId,
    lastUserText,
    lastAssistantText,
    isSupported: speechRecognitionSupported,
    micPermission: permission,
    setEnabled,
    toggleEnabled,
    sendText,
    respondToInfraction,
    cancel,
  };
}
