/**
 * Type declarations for Electron API exposed via preload script
 */

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

export interface ElectronAPI {
  platform: "electron";
  isElectron: true;
  toggleMiniWidget: () => Promise<void>;
  setKeepWidgetOnClose: (value: boolean) => Promise<void>;
  getKeepWidgetOnClose: () => Promise<boolean>;
  getAppVersion: () => string;
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
  onUpdateAvailable: (cb: ((info: UpdateInfo) => void) | null) => void;
  onUpdateProgress: (cb: ((progress: UpdateProgress) => void) | null) => void;
  onUpdateDownloaded: (cb: (() => void) | null) => void;
  downloadUpdate: () => Promise<{ ok: boolean }>;
  installUpdate: () => Promise<{ ok: boolean }>;

  // [claude-code 2026-03-24] Auth — deep link callback + system browser open
  onAuthCallback: (cb: ((url: string) => void) | null) => void;
  openExternal: (url: string) => Promise<{ ok: boolean }>;

  // [claude-code 2026-03-23] Browser Use Phase 2 — CLI command bridge
  browserUse: {
    runCommand: (
      args: string[],
    ) => Promise<{ ok: boolean; data?: any; error?: string; stderr?: string }>;
    getStatus: () => Promise<{ running: boolean; sessions?: string }>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
