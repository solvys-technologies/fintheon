// [claude-code 2026-03-11] T5: Voice memory hook — persists mic device selection and voice transcript history
import { useCallback, useEffect, useState } from "react";

const VOICE_MIC_DEVICE_KEY = "fintheon:voice-mic-device:v1";
const VOICE_TRANSCRIPT_KEY = "fintheon:voice-transcripts:v1";
const MAX_TRANSCRIPTS = 50;

export interface VoiceTranscript {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface VoiceMemory {
  /** Selected microphone device ID */
  micDeviceId: string | null;
  setMicDeviceId: (id: string | null) => void;
  /** Available audio input devices */
  devices: MediaDeviceInfo[];
  refreshDevices: () => Promise<void>;
  /** Recent voice transcripts */
  transcripts: VoiceTranscript[];
  addTranscript: (role: "user" | "assistant", text: string) => void;
  clearTranscripts: () => void;
}

function loadTranscripts(): VoiceTranscript[] {
  try {
    const raw = localStorage.getItem(VOICE_TRANSCRIPT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTranscripts(transcripts: VoiceTranscript[]) {
  try {
    localStorage.setItem(
      VOICE_TRANSCRIPT_KEY,
      JSON.stringify(transcripts.slice(0, MAX_TRANSCRIPTS)),
    );
  } catch {
    // storage full — ignore
  }
}

/**
 * useVoiceMemory — persists microphone device preference and transcript history.
 *
 * Usage:
 *   const { micDeviceId, setMicDeviceId, devices, transcripts } = useVoiceMemory()
 */
export function useVoiceMemory(): VoiceMemory {
  const [micDeviceId, setMicDeviceIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(VOICE_MIC_DEVICE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [transcripts, setTranscripts] = useState<VoiceTranscript[]>(() =>
    loadTranscripts(),
  );

  const refreshDevices = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    )
      return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter((d) => d.kind === "audioinput"));
    } catch {
      // permission denied or not available
    }
  }, []);

  // Enumerate devices on mount
  useEffect(() => {
    void refreshDevices();

    // Listen for device changes (plugged in / removed)
    if (typeof navigator !== "undefined" && navigator.mediaDevices) {
      const handler = () => void refreshDevices();
      navigator.mediaDevices.addEventListener("devicechange", handler);
      return () =>
        navigator.mediaDevices.removeEventListener("devicechange", handler);
    }
  }, [refreshDevices]);

  const setMicDeviceId = useCallback((id: string | null) => {
    setMicDeviceIdState(id);
    try {
      if (id) {
        localStorage.setItem(VOICE_MIC_DEVICE_KEY, id);
      } else {
        localStorage.removeItem(VOICE_MIC_DEVICE_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const addTranscript = useCallback(
    (role: "user" | "assistant", text: string) => {
      const entry: VoiceTranscript = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role,
        text,
        timestamp: Date.now(),
      };
      setTranscripts((prev) => {
        const next = [entry, ...prev].slice(0, MAX_TRANSCRIPTS);
        saveTranscripts(next);
        return next;
      });
    },
    [],
  );

  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
    try {
      localStorage.removeItem(VOICE_TRANSCRIPT_KEY);
    } catch {
      // ignore
    }
  }, []);

  return {
    micDeviceId,
    setMicDeviceId,
    devices,
    refreshDevices,
    transcripts,
    addTranscript,
    clearTranscripts,
  };
}
