/**
 * Type declarations for Electron API exposed via preload script
 */

export type CliOutputEvent =
  | { type: "stdout"; data: string }
  | { type: "stderr"; data: string }
  | { type: "exit"; code: number | null; signal: string | null };

export interface DesktopUpdateStatus {
  ok: boolean;
  current?: string | null;
  latest?: string | null;
  updateAvailable: boolean;
  downloadUrl?: string;
  downloaded?: boolean;
  downloading?: boolean;
  reason?: string;
}

export interface DesktopDownloadedUpdate {
  version: string;
  tag?: string;
  assetName?: string;
  dmgPath?: string;
  reason?: string;
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

  // SOTA desktop updater (manual check + manual download handoff)
  checkForUpdate: () => Promise<DesktopUpdateStatus>;
  downloadUpdate: () => Promise<{
    ok: boolean;
    version?: string;
    assetName?: string;
    dmgPath?: string;
    reason?: string;
  }>;
  installUpdate: () => Promise<{
    ok: boolean;
    opened?: boolean;
    downloadUrl?: string;
    installing?: boolean;
    target?: string;
    reason?: string;
  }>;
  deferUpdateUntilClose: () => Promise<{ ok: boolean; deferred?: boolean }>;
  onUpdateJustInstalled: (
    cb: ((payload: { version: string }) => void) | null,
  ) => void;
  onUpdateDownloaded: (
    cb: ((payload: DesktopDownloadedUpdate) => void) | null,
  ) => void;
  onUpdateDownloadFailed: (
    cb: ((payload: DesktopDownloadedUpdate) => void) | null,
  ) => void;

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

  // [claude-code 2026-04-27] S46.4 Desk Calendar — silent .ics ingest events
  // emitted by main.cjs when Electron intercepts a TV iframe .ics download.
  deskCalendar: {
    onSaving: (cb: (() => void) | null) => void;
    onSaved: (
      cb:
        | ((payload: {
            ingested: number;
            title: string | null;
            starts_at: string | null;
            queueCount?: number;
          }) => void)
        | null,
    ) => void;
    onFailed: (cb: ((payload: { reason: string }) => void) | null) => void;
  };

  // [claude-code 2026-04-23] Harper Vision — screen + audio capture bridge
  harperVision: {
    captureScreen: () => Promise<{
      ok: boolean;
      base64?: string;
      width?: number;
      height?: number;
      name?: string;
      error?: string;
    }>;
    captureWindow: (id: string) => Promise<{
      ok: boolean;
      base64?: string;
      width?: number;
      height?: number;
      name?: string;
      error?: string;
    }>;
    getSources: () => Promise<
      Array<{
        id: string;
        name: string;
        display_id?: string;
        thumbnail?: string;
      }>
    >;
    startCapture: (
      sessionId?: string,
    ) => Promise<{ ok: boolean; sessionId?: string; error?: string }>;
    stopCapture: () => Promise<{ ok: boolean }>;
    getStatus: () => Promise<{
      screen: {
        isCapturing: boolean;
        sessionId: string | null;
        frameCounter: number;
        intervalMs: number;
      };
      audio: { isRecording: boolean; sessionId: string | null; mode: string };
      privacyMode?: boolean;
    }>;
    setPrivacyMode: (
      enabled: boolean,
    ) => Promise<{ ok: boolean; privacyMode: boolean }>;
    getPrivacyMode: () => Promise<{ privacyMode: boolean }>;
  };
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
