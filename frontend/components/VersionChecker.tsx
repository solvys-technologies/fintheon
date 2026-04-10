// [claude-code 2026-04-01] Version check — shows update-available toast when server version differs
import { useEffect } from "react";
import { useToast } from "../contexts/ToastContext";
import { startVersionCheck, stopVersionCheck } from "../lib/version-check";

export function VersionChecker() {
  const { addToast } = useToast();

  useEffect(() => {
    startVersionCheck({
      onUpdateAvailable: (serverVersion) => {
        const id = `toast-update-${Date.now()}`;
        addToast(
          "Fintheon update available",
          "info",
          `Version ${serverVersion} is ready`,
          "system-update",
          "bottom-left",
        );
      },
    });
    return () => stopVersionCheck();
  }, [addToast]);

  return null;
}
