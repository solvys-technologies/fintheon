// [claude-code 2026-04-13] Version check — update-available toast with Install Now CTA
import { useEffect } from "react";
import { useToast } from "../contexts/ToastContext";
import { startVersionCheck, stopVersionCheck } from "../lib/version-check";

export function VersionChecker() {
  const { addToast } = useToast();

  useEffect(() => {
    startVersionCheck({
      onUpdateAvailable: (serverVersion) => {
        addToast(
          "Fintheon update available",
          "info",
          `Version ${serverVersion} is ready`,
          "system-update",
          "bottom-left",
          {
            label: "Install Now",
            onClick: () => {
              // Electron: trigger auto-updater install
              if (window.electron?.installUpdate) {
                window.electron.installUpdate();
                return;
              }
              // Web: hard reload to pick up new assets
              window.location.reload();
            },
          },
        );
      },
    });
    return () => stopVersionCheck();
  }, [addToast]);

  return null;
}
