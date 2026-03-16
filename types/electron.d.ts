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

  // Auto-update
  checkForUpdate: () => Promise<{ ok: boolean }>;
  downloadUpdate: () => Promise<{ ok: boolean }>;
  installUpdate: () => Promise<{ ok: boolean }>;
  onUpdateAvailable: (cb: ((info: UpdateInfo) => void) | null) => void;
  onUpdateProgress: (cb: ((progress: UpdateProgress) => void) | null) => void;
  onUpdateDownloaded: (cb: (() => void) | null) => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
