// [claude-code 2026-04-20] S21: System permissions plumbing.
// Prepared for the onboarding flow TP is building in a follow-up sprint.
// Works in both Electron (via preload.systemPermissions.*) and the PWA
// (navigator.mediaDevices.getUserMedia + Permissions API).
//
// Onboarding UI is explicitly OUT OF SCOPE for this sprint — this module
// only exports the primitives the onboarding screen will call.

export type PermissionName = "microphone" | "camera";
export type PermissionState = "granted" | "denied" | "prompt" | "unknown";

interface ElectronPermissionBridge {
  query?: (name: PermissionName) => Promise<PermissionState>;
  request?: (name: PermissionName) => Promise<PermissionState>;
}

function electronBridge(): ElectronPermissionBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    systemPermissions?: ElectronPermissionBridge;
  };
  return w.systemPermissions ?? null;
}

export async function queryPermission(
  name: PermissionName,
): Promise<PermissionState> {
  const bridge = electronBridge();
  if (bridge?.query) {
    try {
      return await bridge.query(name);
    } catch {
      /* fall through */
    }
  }

  if (typeof navigator !== "undefined" && "permissions" in navigator) {
    try {
      const kind =
        name === "microphone"
          ? ("microphone" as PermissionName)
          : ("camera" as PermissionName);
      const status = await navigator.permissions.query({
        name: kind as PermissionDescriptor["name"],
      });
      return (status.state as PermissionState) ?? "unknown";
    } catch {
      /* fall through */
    }
  }

  return "unknown";
}

export async function requestPermission(
  name: PermissionName,
): Promise<PermissionState> {
  const bridge = electronBridge();
  if (bridge?.request) {
    try {
      return await bridge.request(name);
    } catch {
      /* fall through */
    }
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.mediaDevices?.getUserMedia
  ) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        name === "microphone" ? { audio: true } : { video: true },
      );
      stream.getTracks().forEach((t) => t.stop());
      return "granted";
    } catch {
      return "denied";
    }
  }

  return "unknown";
}

export async function ensureVoicePermissions(): Promise<{
  microphone: PermissionState;
}> {
  const mic = await queryPermission("microphone");
  if (mic === "granted") return { microphone: "granted" };
  const requested = await requestPermission("microphone");
  return { microphone: requested };
}
