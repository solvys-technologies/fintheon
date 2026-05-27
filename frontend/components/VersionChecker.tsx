// [claude-code 2026-05-01] Epoch updater: bottom-left toast prompt → one-click
// in-app DMG swap → reopen → "Epoch X has risen" success toast on next launch.
// [claude-code 2026-04-29] SOTA updater: unified version-check toast for web + Electron.
// [claude-code 2026-04-19] S24 unify: per-version dismissal + 24h cooldown.
// [claude-code 2026-04-13] Version check — update-available toast with Install CTA
import { useEffect } from "react";
import { useToast } from "../contexts/ToastContext";
import {
  startVersionCheck,
  stopVersionCheck,
  dismissVersion,
  recordVersionNag,
  shouldPromptForVersion,
} from "../lib/version-check";
import { isElectron } from "../lib/platform";

const ELECTRON_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function VersionChecker() {
  const { addToast } = useToast();

  useEffect(() => {
    const isE = isElectron();
    const electron = window.electron;

    if (isE && electron?.checkForUpdate) {
      let active = true;
      const shownVersions = new Set<string>();
      const showDownloadedUpdate = (payload: { version: string }) => {
        const version = payload.version?.replace(/^v/, "");
        if (!active || !version || shownVersions.has(version)) return;
        if (!shouldPromptForVersion(version)) return;
        shownVersions.add(version);
        recordVersionNag();
        addToast(
          "One update is available",
          "info",
          undefined,
          undefined,
          "bottom-left",
          {
            label: "Update now",
            onClick: async () => {
              window.dispatchEvent(
                new CustomEvent("fintheon:update-installing"),
              );
              const result = await electron.installUpdate?.();
              if (result?.ok) return;
              addToast(
                "Update install failed",
                "error",
                result?.reason ?? "Try the CLI fallback: fintheon update",
                "system-update",
                "bottom-left",
              );
            },
          },
          {
            label: "Later",
            onClick: () => {
              recordVersionNag();
              electron.deferUpdateUntilClose?.();
            },
          },
        );
      };

      electron.onUpdateDownloaded?.(showDownloadedUpdate);
      electron.onUpdateDownloadFailed?.(({ reason }) => {
        if (!active) return;
        addToast(
          "Update download failed",
          "error",
          reason ?? "Try the CLI fallback: fintheon update",
          "system-update",
          "bottom-left",
        );
      });

      const check = () => {
        electron
          .checkForUpdate()
          .then((result) => {
            if (result.downloaded && result.latest) {
              showDownloadedUpdate({ version: result.latest });
            }
          })
          .catch(() => undefined);
      };
      const timeoutId = window.setTimeout(check, 10_000);
      const intervalId = window.setInterval(check, ELECTRON_CHECK_INTERVAL_MS);

      if (electron.onUpdateJustInstalled) {
        electron.onUpdateJustInstalled(({ version }) => {
          addToast(
            `Epoch ${version} has risen.`,
            "success",
            undefined,
            "system-update",
            "bottom-left",
          );
        });
      }

      return () => {
        active = false;
        window.clearTimeout(timeoutId);
        window.clearInterval(intervalId);
        electron.onUpdateDownloaded?.(null);
        electron.onUpdateDownloadFailed?.(null);
        electron.onUpdateJustInstalled?.(null);
      };
    }

    startVersionCheck({
      onUpdateAvailable: (serverVersion) => {
        addToast(
          "One update is available",
          "info",
          undefined,
          undefined,
          "bottom-left",
          {
            label: "Update now",
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
          {
            label: "Later",
            onClick: () => dismissVersion(serverVersion),
          },
        );
      },
    });

    // First-launch-after-install success toast.
    if (isE && window.electron?.onUpdateJustInstalled) {
      window.electron.onUpdateJustInstalled(({ version }) => {
        addToast(
          `Epoch ${version} has risen.`,
          "success",
          undefined,
          "system-update",
          "bottom-left",
        );
      });
    }

    return () => stopVersionCheck();
  }, [addToast]);

  return null;
}
