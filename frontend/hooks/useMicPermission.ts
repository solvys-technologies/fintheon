// [claude-code 2026-04-10] Extracted from useVoiceAssistant.ts
import { useState, useEffect } from "react";
import type { MicPermissionState } from "../types/voice";

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
