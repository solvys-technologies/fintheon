// [claude-code 2026-03-16] Added auto-update types
/**
 * Type declarations for Electron API exposed via preload script
 */

export type CliOutputEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number | null; signal: string | null };

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
  platform: 'electron';
  isElectron: true;
  toggleMiniWidget: () => Promise<void>;
  setKeepWidgetOnClose: (value: boolean) => Promise<void>;
  getKeepWidgetOnClose: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  runShellCommand: (command: string) => Promise<{ ok: boolean; error?: string }>;
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

  // Browser Control Phase 1 — Agent View (read-only)
  agentView: {
    create: (url: string) => Promise<{ ok: boolean; error?: string }>;
    close: () => Promise<{ ok: boolean }>;
    navigate: (url: string) => Promise<{ ok: boolean; error?: string }>;
    readDOM: (selector: string) => Promise<string | null>;
    readBatch: (selectors: string[]) => Promise<Record<string, string | null>>;
    screenshot: () => Promise<string | null>;
    getInfo: () => Promise<{ title: string; url: string; loading: boolean } | null>;
    isActive: () => Promise<{ active: boolean }>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
