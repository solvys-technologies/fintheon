/**
 * useHarperVision
 * Frontend hook for controlling Harper Vision screen/audio capture
 * Integrates with Electron IPC bridge
 */

import { useState, useCallback, useEffect, useRef } from "react";

interface VisionStatus {
  screen: {
    isCapturing: boolean;
    sessionId: string | null;
    frameCounter: number;
    intervalMs: number;
  };
  audio: {
    isRecording: boolean;
    sessionId: string | null;
    mode: string;
  };
}

interface VisionSource {
  id: string;
  name: string;
  display_id?: string;
  thumbnail?: string;
}

const isElectron = typeof window !== "undefined" && !!window.electron?.isElectron;

export function useHarperVision() {
  const [status, setStatus] = useState<VisionStatus>({
    screen: { isCapturing: false, sessionId: null, frameCounter: 0, intervalMs: 5000 },
    audio: { isRecording: false, sessionId: null, mode: "placeholder" },
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isElectron) return;
    try {
      const s = await window.electron!.harperVision.getStatus();
      setStatus(s);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    pollRef.current = setInterval(refreshStatus, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshStatus]);

  const startCapture = useCallback(async () => {
    if (!isElectron) return { ok: false, error: "Not in Electron" };
    setIsLoading(true);
    try {
      const result = await window.electron!.harperVision.startCapture();
      await refreshStatus();
      return result;
    } catch (err: any) {
      return { ok: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const stopCapture = useCallback(async () => {
    if (!isElectron) return { ok: false, error: "Not in Electron" };
    setIsLoading(true);
    try {
      const result = await window.electron!.harperVision.stopCapture();
      await refreshStatus();
      return result;
    } catch (err: any) {
      return { ok: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const captureOnce = useCallback(async () => {
    if (!isElectron) return { ok: false, error: "Not in Electron" };
    setIsLoading(true);
    try {
      const result = await window.electron!.harperVision.captureScreen();
      if (result.ok && result.base64) {
        setLastFrame(`data:image/png;base64,${result.base64}`);
      }
      return result;
    } catch (err: any) {
      return { ok: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getSources = useCallback(async (): Promise<VisionSource[]> => {
    if (!isElectron) return [];
    try {
      return await window.electron!.harperVision.getSources();
    } catch {
      return [];
    }
  }, []);

  return {
    status,
    isLoading,
    lastFrame,
    isElectron,
    startCapture,
    stopCapture,
    captureOnce,
    getSources,
    refreshStatus,
  };
}
