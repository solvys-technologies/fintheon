// [claude-code 2026-04-10] Extracted from useVoiceAssistant.ts
import { useCallback } from "react";

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
