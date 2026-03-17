/**
 * Type declarations for Electron API exposed via preload script
 */

export type CliOutputEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'exit'; code: number | null; signal: string | null };

export interface ElectronAPI {
  platform: 'electron';
  isElectron: true;
  toggleMiniWidget: () => Promise<void>;
  setKeepWidgetOnClose: (value: boolean) => Promise<void>;
  getKeepWidgetOnClose: () => Promise<boolean>;
  getAppVersion: () => string;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  runShellCommand: (command: string) => Promise<{ ok: boolean; error?: string }>;
  setCliOutputCallback: (cb: ((event: CliOutputEvent) => void) | null) => void;
  onUpdateAvailable: (cb: ((info: any) => void) | null) => () => void;
  onUpdateProgress: (cb: ((progress: any) => void) | null) => () => void;
  onUpdateDownloaded: (cb: (() => void) | null) => () => void;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => void;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
