// [claude-code 2026-03-16] Added auto-update types
// [claude-code 2026-04-23] Harper Vision — screen capture IPC types

export type CliOutputEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; code: number | null; signal: string | null };

export interface UpdateInfo {
  version: string;
  releaseNotes: string;
  releaseDate: string;
}

export interface UpdateProgress {
  percent: number;
  transferred: number;
  total: number;
}

export interface StartupConfig {
  backendAutostart: boolean;
  launchOnLogin: boolean;
}

export interface HarperVisionSource {
  id: string;
  name: string;
  display_id?: string;
  appIcon?: string;
  thumbnail?: string;
}

export interface HarperVisionCaptureResult {
  ok: boolean;
  base64?: string;
  width?: number;
  height?: number;
  name?: string;
  error?: string;
}

export interface HarperVisionStatus {
  isCapturing: boolean;
  sessionId: string | null;
  frameCounter: number;
  intervalMs: number;
}

export interface HarperVisionAPI {
  captureScreen: () => Promise<HarperVisionCaptureResult>;
  captureWindow: (id: string) => Promise<HarperVisionCaptureResult>;
  getSources: () => Promise<HarperVisionSource[]>;
  startCapture: (sessionId?: string) => Promise<{ ok: boolean; sessionId?: string; error?: string }>;
  stopCapture: () => Promise<{ ok: boolean }>;
  getStatus: () => Promise<HarperVisionStatus>;
}

export interface ElectronAPI {
  platform: "electron";
  isElectron: true;
  toggleMiniWidget: () => Promise<void>;
  setKeepWidgetOnClose: (value: boolean) => Promise<void>;
  getKeepWidgetOnClose: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  runShellCommand: (
    command: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  setCliOutputCallback: (cb: ((event: CliOutputEvent) => void) | null) => void;

  // Startup config
  getStartupConfig: () => Promise<StartupConfig>;
  setStartupConfig: (patch: Partial<StartupConfig>) => Promise<StartupConfig>;
  startBackend: () => Promise<{ ok: boolean; detail?: string }>;
  stopBackend: () => Promise<{ ok: boolean }>;
  isBackendAlive: () => Promise<{ alive: boolean }>;

  // Auto-update
  checkForUpdate: () => Promise<{ ok: boolean }>;
  downloadUpdate: () => Promise<{ ok: boolean }>;
  installUpdate: () => Promise<{ ok: boolean }>;
  onUpdateAvailable: (cb: ((info: UpdateInfo) => void) | null) => void;
  onUpdateProgress: (cb: ((progress: UpdateProgress) => void) | null) => void;
  onUpdateDownloaded: (cb: (() => void) | null) => void;

  // [claude-code 2026-03-23] Browser Use Phase 2 — CLI command bridge
  browserUse: {
    runCommand: (
      args: string[],
    ) => Promise<{ ok: boolean; data?: any; error?: string; stderr?: string }>;
    getStatus: () => Promise<{ running: boolean; sessions?: string }>;
  };

  // [claude-code 2026-04-23] Harper Vision — screen + audio capture
  harperVision: HarperVisionAPI;
}

export interface SystemPermissionsAPI {
  query: (name: "microphone" | "camera") => Promise<"granted" | "denied" | "prompt" | "unknown">;
  request: (name: "microphone" | "camera") => Promise<"granted" | "denied">;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
    systemPermissions?: SystemPermissionsAPI;
  }
}

export {};
