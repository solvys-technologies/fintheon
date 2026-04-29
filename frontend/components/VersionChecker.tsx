// [claude-code 2026-04-29] SOTA updater: unified version-check toast for web + Electron.
// Electron no longer auto-downloads/auto-installs; CTA opens the latest release page.
// [claude-code 2026-04-19] S24 unify: clicking Install Now permanently dismisses this version
//   so even if the install flow fails / user bounces, we never nag for that exact version again.
// [claude-code 2026-04-13] Version check — update-available toast with Install Now CTA
import { useEffect } from "react";
import { useToast } from "../contexts/ToastContext";
import {
  startVersionCheck,
  stopVersionCheck,
  dismissVersion,
} from "../lib/version-check";
import { isElectron } from "../lib/platform";

export function VersionChecker() {
  const { addToast } = useToast();

  useEffect(() => {
    const isE = isElectron();
    // Unified polling path; Electron now uses SOTA manual download handoff.
    startVersionCheck({
      onUpdateAvailable: (serverVersion) => {
        addToast(
          "Fintheon update available",
          "info",
          `Version ${serverVersion} is ready`,
          "system-update",
          "bottom-left",
          {
            label: isE ? "Install now" : "Reload",
            onClick: () => {
              dismissVersion(serverVersion);
              window.dispatchEvent(
                new CustomEvent("fintheon:update-installing"),
              );
              if (isE && window.electron?.installUpdate) {
                window.electron.installUpdate();
                return;
              }
              window.location.reload();
            },
          },
          isE
            ? {
                label: "Later",
                onClick: () => {
                  dismissVersion(serverVersion);
                  window.electron?.deferUpdateUntilClose?.();
                },
              }
            : undefined,
        );
      },
    });
    return () => stopVersionCheck();
  }, [addToast]);

  return null;
}
