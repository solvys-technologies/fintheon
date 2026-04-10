// [claude-code 2026-03-09] Added: useMicPermission, useMicArbitration, error state with auto-recovery, cancel/interrupt support
// [claude-code 2026-03-23] Replaced SpeechRecognition with getUserMedia + MediaRecorder + Whisper transcription.
//   Added greeting on first enable, mic device selection, silence-based VAD.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBackend } from "../lib/backend";
import { hermesConversationStorageKey } from "../lib/hermesAgentRouting";
import type { VoiceRuntimeState, MicPermissionState } from "../types/voice";

const VOICE_ENABLED_STORAGE_KEY = "fintheon:voice-assistant-enabled:v1";
const HARPER_CONVERSATION_STORAGE_KEY = hermesConversationStorageKey("harper");
const ERROR_AUTO_RECOVERY_MS = 5000;

// VAD (Voice Activity Detection) settings
const VAD_SILENCE_THRESHOLD = 0.015; // RMS level below this = silence
const VAD_SILENCE_DURATION_MS = 1800; // 1.8s of silence = done speaking
const VAD_MAX_RECORDING_MS = 30_000; // Max 30s recording
const VAD_CHECK_INTERVAL_MS = 100; // Check audio level every 100ms
const MIC_DEVICE_STORAGE_KEY = "fintheon:voice-mic-device:v1";

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
  const [permission, setPermission] = useState<MicPermissionState>("prompt");

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;

    navigator.permissions
      .query({ name: "microphone" as PermissionName })
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
      priority: number,
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
    [],
  );

  return { requestMic, getCurrentHolder: () => currentMicHolder };
}

// ─── Audio Recording Engine ──────────────────────────────────────────────────

interface RecordingSession {
  mediaRecorder: MediaRecorder;
  stream: MediaStream;
  audioContext: AudioContext;
  analyser: AnalyserNode;
  vadInterval: ReturnType<typeof setInterval>;
  maxTimer: ReturnType<typeof setTimeout>;
}

// ─── Voice Assistant Hook ──────────────────────────────────────────────────────

interface UseVoiceAssistantOptions {
  /** Called with every Whisper transcript before sendText — used for ER scoring */
  onTranscript?: (text: string) => void;
}

export function useVoiceAssistant(options?: UseVoiceAssistantOptions) {
  const backend = useBackend();

  const [enabled, setEnabledState] = useState(false);
  const [runtimeState, setRuntimeState] = useState<VoiceRuntimeState>("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lastUserText, setLastUserText] = useState("");
  const [lastAssistantText, setLastAssistantText] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(false);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const micReleaseRef = useRef<(() => void) | null>(null);
  const errorRecoveryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef<RecordingSession | null>(null);
  const greetedRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});
  const onTranscriptRef = useRef(options?.onTranscript);

  const { permission } = useMicPermission();
  const { requestMic } = useMicArbitration();

  // Keep onTranscript ref in sync
  onTranscriptRef.current = options?.onTranscript;

  // Always supported now — we use getUserMedia + Whisper, not SpeechRecognition
  const isSupported = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined",
    [],
  );

  const setErrorWithRecovery = useCallback(() => {
    setRuntimeState("error");
    if (errorRecoveryRef.current) clearTimeout(errorRecoveryRef.current);
    errorRecoveryRef.current = setTimeout(() => {
      errorRecoveryRef.current = null;
      setRuntimeState(enabledRef.current ? "listening" : "idle");
    }, ERROR_AUTO_RECOVERY_MS);
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const stopRecording = useCallback(() => {
    const session = recordingRef.current;
    if (!session) return;

    clearInterval(session.vadInterval);
    clearTimeout(session.maxTimer);

    try {
      session.mediaRecorder.stop();
    } catch {
      /* already stopped */
    }
    try {
      session.audioContext.close();
    } catch {
      /* ignore */
    }
    session.stream.getTracks().forEach((t) => t.stop());
    recordingRef.current = null;

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

  const playAudio = useCallback(
    async (audioBase64: string, mimeType?: string) => {
      if (typeof window === "undefined" || typeof Audio === "undefined") return;

      const source = `data:${mimeType || "audio/mpeg"};base64,${audioBase64}`;
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
    },
    [],
  );

  const playWithSpeechSynthesis = useCallback(async (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
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

  // Analyze user speech for tilt indicators, dispatch PsychAssist events
  const analyzeSpeechForTilt = useCallback(
    async (transcript: string) => {
      try {
        const result = await backend.voice.analyzeSentiment({ transcript });
        if (!result) return;

        if (typeof result.sentiment === "number") {
          window.dispatchEvent(
            new CustomEvent("psychassist:score", {
              detail: { score: result.sentiment, timestamp: Date.now() },
            }),
          );
          try {
            localStorage.setItem(
              "psychassist_current_score",
              String(result.sentiment),
            );
          } catch {}
        }

        if (result.tiltIndicators && result.tiltIndicators.length > 0) {
          window.dispatchEvent(
            new CustomEvent("psychassist:infraction", {
              detail: {
                timestamp: Date.now(),
                indicators: result.tiltIndicators,
              },
            }),
          );
        }
      } catch (err) {
        console.warn(
          "[VoiceAssistant] Sentiment analysis failed (non-critical):",
          err,
        );
      }
    },
    [backend],
  );

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopPlayback();
    stopRecording();
    busyRef.current = false;
    if (errorRecoveryRef.current) {
      clearTimeout(errorRecoveryRef.current);
      errorRecoveryRef.current = null;
    }
    setRuntimeState(enabledRef.current ? "listening" : "idle");
  }, [stopPlayback, stopRecording]);

  const sendText = useCallback(
    async (
      text: string,
      mode: "chat" | "infraction" = "chat",
    ): Promise<VoiceSendResult | null> => {
      const prompt = text.trim();
      if (!prompt || busyRef.current) return null;

      busyRef.current = true;
      setLastUserText(prompt);
      setRuntimeState("thinking");

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = (await backend.voice.speak({
          text: prompt,
          mode,
          conversationId: conversationId || undefined,
          includeAudio: true,
          agent: "harper-cao",
        })) as VoiceSendResult;

        if (controller.signal.aborted) return null;

        if (response.conversationId) {
          persistConversationId(response.conversationId);
        }

        const assistantText = response.responseText || "";
        setLastAssistantText(assistantText);

        if (assistantText) {
          setRuntimeState("speaking");
          if (controller.signal.aborted) return null;

          if (response.audioBase64) {
            await playAudio(response.audioBase64, response.audioMimeType);
          } else {
            await playWithSpeechSynthesis(assistantText);
          }
        }

        if (!controller.signal.aborted) {
          if (prompt && mode === "chat") {
            analyzeSpeechForTilt(prompt).catch(() => {});
          }

          setRuntimeState(enabledRef.current ? "listening" : "idle");

          // Restart listening after TTS playback completes
          if (enabledRef.current) {
            await new Promise((r) => setTimeout(r, 300));
            startListeningRef.current();
          }
        }
        return response;
      } catch (error) {
        if (controller.signal.aborted) return null;
        console.error("[VoiceAssistant] Failed to send text:", error);
        setErrorWithRecovery();
        return null;
      } finally {
        busyRef.current = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [
      backend,
      conversationId,
      persistConversationId,
      playAudio,
      playWithSpeechSynthesis,
      setErrorWithRecovery,
      analyzeSpeechForTilt,
    ],
  );

  const respondToInfraction = useCallback(
    async ({ erScore, infractionCount }: InfractionPromptInput = {}) => {
      if (!enabledRef.current) return null;
      const scoreText = Number.isFinite(erScore)
        ? `Current ER score is ${Number(erScore).toFixed(2)}.`
        : "Current ER score unavailable.";
      const countText = Number.isFinite(infractionCount)
        ? `Detected infractions in recent window: ${Math.max(0, Number(infractionCount))}.`
        : "Detected infractions in recent window are unavailable.";
      const prompt = `${scoreText} ${countText} Provide a short de-escalation intervention for the trader with one immediate action and one reminder.`;
      return sendText(prompt, "infraction");
    },
    [sendText],
  );

  // ─── Core: getUserMedia + MediaRecorder + Whisper VAD pipeline ───────────────

  const processRecording = useCallback(
    async (chunks: Blob[]) => {
      if (chunks.length === 0 || !enabledRef.current) return;

      // Combine chunks into a single blob
      const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });

      // Skip very short recordings (< 0.5s of audio ≈ < 8KB)
      if (blob.size < 8000) {
        console.debug("[VoiceAssistant] Recording too short, skipping");
        if (enabledRef.current && !busyRef.current) {
          startListeningRef.current();
        }
        return;
      }

      // Convert to base64 and send to Whisper
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          "",
        ),
      );

      try {
        setRuntimeState("thinking");
        busyRef.current = true;
        const result = await backend.voice.transcribe({
          audioBase64: base64,
          mimeType: "audio/webm",
        });

        const transcript = result?.text?.trim();
        if (!transcript) {
          console.debug("[VoiceAssistant] Whisper returned empty transcript");
          busyRef.current = false;
          if (enabledRef.current) {
            setRuntimeState("listening");
            startListeningRef.current();
          }
          return;
        }

        busyRef.current = false;

        // ER scoring: instant deterministic tilt detection BEFORE Claude
        onTranscriptRef.current?.(transcript);

        setLastUserText(transcript);
        void sendText(transcript, "chat");
      } catch (err) {
        console.error("[VoiceAssistant] Transcription failed:", err);
        busyRef.current = false;
        setErrorWithRecovery();
      }
    },
    [backend, sendText, setErrorWithRecovery],
  );

  const startListening = useCallback(() => {
    if (
      !enabledRef.current ||
      !isSupported ||
      recordingRef.current ||
      busyRef.current
    )
      return;

    if (permission === "denied") {
      setErrorWithRecovery();
      console.warn("[VoiceAssistant] Microphone permission denied");
      return;
    }

    // Acquire mic lock
    const { acquired, release } = requestMic("voice-assistant", 10);
    if (!acquired) {
      console.warn("[VoiceAssistant] Mic arbitration denied");
      return;
    }
    micReleaseRef.current = release;

    // Read selected mic device from localStorage
    const selectedDeviceId = safeLocalStorageGet(MIC_DEVICE_STORAGE_KEY);
    const audioConstraints: MediaTrackConstraints = selectedDeviceId
      ? {
          deviceId: { exact: selectedDeviceId },
          echoCancellation: true,
          noiseSuppression: true,
        }
      : { echoCancellation: true, noiseSuppression: true };

    // Try selected device first, fall back to system default if it fails
    const getStream = () =>
      navigator.mediaDevices
        .getUserMedia({ audio: audioConstraints })
        .catch((err) => {
          if (selectedDeviceId) {
            console.warn(
              "[VoiceAssistant] Selected mic failed, falling back to default:",
              err.message,
            );
            return navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true },
            });
          }
          throw err;
        });

    getStream()
      .then((stream) => {
        if (!enabledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        setRuntimeState("listening");

        // Set up audio analysis for VAD
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const dataArray = new Float32Array(analyser.fftSize);
        let silenceStart: number | null = null;
        let hasSpeech = false;

        // Start recording
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
            ? "audio/webm;codecs=opus"
            : "audio/webm",
        });
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          void processRecording(chunks);
        };

        mediaRecorder.start(250); // Collect chunks every 250ms

        // VAD: monitor audio level
        const vadInterval = setInterval(() => {
          analyser.getFloatTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / dataArray.length);

          if (rms > VAD_SILENCE_THRESHOLD) {
            hasSpeech = true;
            silenceStart = null;
          } else if (hasSpeech) {
            // Speech was detected, now silence
            if (!silenceStart) {
              silenceStart = Date.now();
            } else if (Date.now() - silenceStart >= VAD_SILENCE_DURATION_MS) {
              // Silence long enough — stop recording and process
              stopRecording();
            }
          }
        }, VAD_CHECK_INTERVAL_MS);

        // Max recording safety valve
        const maxTimer = setTimeout(() => {
          if (recordingRef.current) {
            console.debug("[VoiceAssistant] Max recording duration reached");
            stopRecording();
          }
        }, VAD_MAX_RECORDING_MS);

        recordingRef.current = {
          mediaRecorder,
          stream,
          audioContext,
          analyser,
          vadInterval,
          maxTimer,
        };
      })
      .catch((err) => {
        console.error("[VoiceAssistant] getUserMedia failed:", err);
        if (micReleaseRef.current) {
          micReleaseRef.current();
          micReleaseRef.current = null;
        }
        setErrorWithRecovery();
      });
  }, [
    isSupported,
    permission,
    requestMic,
    setErrorWithRecovery,
    stopRecording,
    processRecording,
  ]);

  // Keep ref in sync so sendText can restart listening without circular deps
  startListeningRef.current = startListening;

  // ─── Greeting on first enable ───────────────────────────────────────────────

  const sendGreeting = useCallback(async () => {
    // Read trader name from settings
    let name = "";
    try {
      const raw = localStorage.getItem("fintheon:settings:v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        name = parsed?.traderName || "";
      }
    } catch {
      /* ignore */
    }

    const greeting = name
      ? `The trader "${name}" just activated the voice assistant. Greet them by name — keep it casual and brief. Mention the current time and that you're ready. One or two sentences max.`
      : `The trader just activated the voice assistant. Give a brief, casual greeting. Mention the current time and that you're ready. One or two sentences max.`;

    await sendText(greeting, "chat");
  }, [sendText]);

  // ─── Enable / Disable ──────────────────────────────────────────────────────

  const setEnabled = useCallback(
    (nextEnabled: boolean) => {
      setEnabledState(nextEnabled);
      enabledRef.current = nextEnabled;
      safeLocalStorageSet(
        VOICE_ENABLED_STORAGE_KEY,
        nextEnabled ? "true" : "false",
      );

      if (!nextEnabled) {
        cancel();
        greetedRef.current = false;
        return;
      }

      // Send greeting on first enable (not on restore from localStorage)
      if (!greetedRef.current) {
        greetedRef.current = true;
        void sendGreeting();
      } else {
        startListening();
      }
    },
    [startListening, cancel, sendGreeting],
  );

  const toggleEnabled = useCallback(() => {
    setEnabled(!enabledRef.current);
  }, [setEnabled]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Restore saved state on mount
  useEffect(() => {
    const savedEnabled =
      safeLocalStorageGet(VOICE_ENABLED_STORAGE_KEY) === "true";
    const savedConversationId = safeLocalStorageGet(
      HARPER_CONVERSATION_STORAGE_KEY,
    );

    if (savedConversationId) {
      setConversationId(savedConversationId);
    }

    if (savedEnabled) {
      // On restore, skip greeting — just start listening
      greetedRef.current = true;
      setEnabledState(true);
      enabledRef.current = true;
      safeLocalStorageSet(VOICE_ENABLED_STORAGE_KEY, "true");
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-restart listening if state gets stuck
  useEffect(() => {
    if (
      enabled &&
      isSupported &&
      runtimeState === "listening" &&
      !recordingRef.current &&
      !busyRef.current
    ) {
      startListening();
    }
  }, [enabled, runtimeState, isSupported, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      stopPlayback();
      if (errorRecoveryRef.current) clearTimeout(errorRecoveryRef.current);
    };
  }, [stopPlayback, stopRecording]);

  return {
    enabled,
    runtimeState,
    conversationId,
    lastUserText,
    lastAssistantText,
    isSupported,
    micPermission: permission,
    setEnabled,
    toggleEnabled,
    sendText,
    respondToInfraction,
    cancel,
  };
}
