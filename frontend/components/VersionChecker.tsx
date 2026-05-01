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
} from "../lib/version-check";
import { isElectron } from "../lib/platform";

export function VersionChecker() {
  const { addToast } = useToast();

  useEffect(() => {
    const isE = isElectron();

    startVersionCheck({
      onUpdateAvailable: (serverVersion) => {
        addToast(
          `A new epoch was released. (${serverVersion})`,
          "info",
          undefined,
          "system-update",
          "bottom-left",
          {
            label: "Update",
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
