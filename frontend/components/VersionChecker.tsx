// [claude-code 2026-04-26] v5.32.1: SOTA auto-update flow.
//   1. electron-updater autoDownload=true silently pulls the new DMG/EXE
//      from the GitHub release in the background.
//   2. When download finishes, electron emits `update-downloaded` →
//      preload bridge fires onUpdateDownloaded → toast "Update ready —
//      Relaunch to apply" with a Relaunch button.
//   3. User clicks Relaunch → window.electron.installUpdate() →
//      autoUpdater.quitAndInstall() restarts on the new version.
//   The legacy polling-based toast (startVersionCheck) is the web-only
//   fallback — kept so PWA/web users still get notified when prod
//   ships a new version.
// [claude-code 2026-04-19] S24 unify: clicking the install CTA permanently
//   dismisses this version so even if the install flow fails / user bounces,
//   we never nag for that exact version again.
// [claude-code 2026-04-13] Version check — update-available toast with CTA
import { useEffect } from "react";
import { useToast } from "../contexts/ToastContext";
import {
  startVersionCheck,
  stopVersionCheck,
  dismissVersion,
} from "../lib/version-check";

export function VersionChecker() {
  const { addToast } = useToast();

  useEffect(() => {
    const isElectron = Boolean(window.electron?.onUpdateDownloaded);

    // Electron path: subscribe to the auto-updater's update-downloaded event.
    // The background download already happened silently — we only show the
    // toast when the new version is staged on disk and ready to install.
    if (isElectron) {
      window.electron!.onUpdateDownloaded?.(() => {
        addToast(
          "Fintheon update ready",
          "info",
          "Relaunch to apply the latest version",
          "system-update",
          "bottom-left",
          {
            label: "Relaunch",
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent("fintheon:update-installing"),
              );
              window.electron?.installUpdate?.();
            },
          },
        );
      });
      return () => {
        // No cleanup hook for the IPC listener (preload owns the binding).
      };
    }

    // Web/PWA path: poll the backend version endpoint for updates and prompt
    // a hard reload when a newer build is detected.
    startVersionCheck({
      onUpdateAvailable: (serverVersion) => {
        addToast(
          "Fintheon update available",
          "info",
          `Version ${serverVersion} is ready — reload to apply`,
          "system-update",
          "bottom-left",
          {
            label: "Reload",
            onClick: () => {
              dismissVersion(serverVersion);
              window.dispatchEvent(
                new CustomEvent("fintheon:update-installing"),
              );
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
