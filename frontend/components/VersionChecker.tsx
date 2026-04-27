// [claude-code 2026-04-27] v5.33.5: Two-path update notification per TP:
//   - Electron: subscribe to onUpdateDownloaded so the "Install Now" toast
//     ONLY fires when the DMG is fully on disk and quitAndInstall will
//     actually relaunch. Polling-version-check is silenced in Electron so
//     we don't double-notify (and don't show the CTA before the binary is
//     ready, which previously made the click a no-op).
//   - Web: polling version-check still fires the toast; CTA hard-reloads
//     to pick up new assets.
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

    // Electron path: only show the toast when electron-updater has FINISHED
    // downloading the DMG. Until then, autoDownload=true (set in main.cjs)
    // pulls the binary in the background silently.
    if (isE && window.electron?.onUpdateDownloaded) {
      const handler = () => {
        addToast(
          "Fintheon update ready",
          "info",
          "New version downloaded — relaunch to install",
          "system-update",
          "bottom-left",
          {
            label: "Install Now",
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent("fintheon:update-installing"),
              );
              window.electron?.installUpdate();
            },
          },
        );
      };
      window.electron.onUpdateDownloaded(handler);
      return () => window.electron?.onUpdateDownloaded(null);
    }

    // Web path: polling check + reload CTA. Skipped in Electron so we don't
    // race the auto-updater download.
    startVersionCheck({
      onUpdateAvailable: (serverVersion) => {
        addToast(
          "Fintheon update available",
          "info",
          `Version ${serverVersion} is ready`,
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
