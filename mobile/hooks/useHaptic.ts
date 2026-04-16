// [claude-code 2026-04-16] Haptic gate hook — respects hapticEnabled setting
import { useCallback } from "react";
import { useSettings } from "../contexts/SettingsContext";

export function useHaptic() {
  const { settings } = useSettings();
  return useCallback(
    (ms: number = 10) => {
      if (settings.hapticEnabled) navigator.vibrate?.(ms);
    },
    [settings.hapticEnabled],
  );
}
