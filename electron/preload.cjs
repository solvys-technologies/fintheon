// [claude-code 2026-03-16] Added auto-update IPC bridge
// [claude-code 2026-03-23] Browser Use Phase 2 — browserUse IPC bridge
// [claude-code 2026-03-24] Auth deep link callback bridge for Supabase OAuth
// [claude-code 2026-04-23] Harper Vision — screen capture IPC bridge
// [claude-code 2026-04-23] Windows build — expose platform + api base so renderer can branch chrome + guards
const { contextBridge, ipcRenderer } = require("electron");

// Read --fintheon-api-base / --fintheon-platform switches injected by main.cjs
// via BrowserWindow.webPreferences.additionalArguments. The renderer can read
// these synchronously at module load without awaiting an IPC round-trip.
function readAdditionalArg(flag) {
  const prefix = `--${flag}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}
const API_BASE =
  readAdditionalArg("fintheon-api-base") || "http://localhost:8080";
const PLATFORM = readAdditionalArg("fintheon-platform") || process.platform;

let cliOutputCallback = null;
ipcRenderer.on("cli-output", (_event, data) => {
  if (typeof cliOutputCallback === "function") cliOutputCallback(data);
});

// Auth deep link callback (fintheon://auth/callback?code=...)
let authCallbackHandler = null;
ipcRenderer.on("auth-callback", (_event, url) => {
  if (typeof authCallbackHandler === "function") authCallbackHandler(url);
});

// [claude-code 2026-04-27] S46.4 Desk Calendar IPC bridge — TV iframe .ics
// downloads are intercepted in main.cjs and emitted as saving/saved/failed
// events. The renderer listens via electron.deskCalendar.on*Status to drive
// the green status text + success toast in TradingViewCalendar.
let deskCalendarSavingCallback = null;
let deskCalendarSavedCallback = null;
let deskCalendarFailedCallback = null;
ipcRenderer.on("desk-calendar:saving", (_event, payload) => {
  if (typeof deskCalendarSavingCallback === "function")
    deskCalendarSavingCallback(payload);
});
ipcRenderer.on("desk-calendar:saved", (_event, payload) => {
  if (typeof deskCalendarSavedCallback === "function")
    deskCalendarSavedCallback(payload);
});
ipcRenderer.on("desk-calendar:failed", (_event, payload) => {
  if (typeof deskCalendarFailedCallback === "function")
    deskCalendarFailedCallback(payload);
});

// Auto-update event forwarding
let updateAvailableCallback = null;
let updateProgressCallback = null;
let updateDownloadedCallback = null;

ipcRenderer.on("update-available", (_event, info) => {
  if (typeof updateAvailableCallback === "function")
    updateAvailableCallback(info);
});
ipcRenderer.on("update-download-progress", (_event, progress) => {
  if (typeof updateProgressCallback === "function")
    updateProgressCallback(progress);
});
ipcRenderer.on("update-downloaded", () => {
  if (typeof updateDownloadedCallback === "function")
    updateDownloadedCallback();
});

contextBridge.exposeInMainWorld("electron", {
  // [claude-code 2026-04-23] Platform info for renderer chrome branching + remote-backend detection
  platform: PLATFORM,
  apiBase: API_BASE,
  isWindows: PLATFORM === "win32",
  isMac: PLATFORM === "darwin",

  toggleMiniWidget: async () => {
    try {
      await ipcRenderer.invoke("toggle-mini-widget");
    } catch {
      // no-op fallback for renderer calls
    }
  },
  runShellCommand: (command) =>
    ipcRenderer.invoke("run-shell-command", command),
  setCliOutputCallback: (cb) => {
    cliOutputCallback = typeof cb === "function" ? cb : null;
  },

  // Startup config API
  getStartupConfig: () => ipcRenderer.invoke("get-startup-config"),
  setStartupConfig: (patch) => ipcRenderer.invoke("set-startup-config", patch),
  startBackend: () => ipcRenderer.invoke("start-backend"),
  stopBackend: () => ipcRenderer.invoke("stop-backend"),
  isBackendAlive: () => ipcRenderer.invoke("is-backend-alive"),

  // Auto-update API
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  checkForUpdate: () => ipcRenderer.invoke("update-check"),
  downloadUpdate: () => ipcRenderer.invoke("update-download"),
  installUpdate: () => ipcRenderer.invoke("update-install"),
  onUpdateAvailable: (cb) => {
    updateAvailableCallback = typeof cb === "function" ? cb : null;
  },
  onUpdateProgress: (cb) => {
    updateProgressCallback = typeof cb === "function" ? cb : null;
  },
  onUpdateDownloaded: (cb) => {
    updateDownloadedCallback = typeof cb === "function" ? cb : null;
  },

  // Auth — deep link callback + open URL in system browser
  onAuthCallback: (cb) => {
    authCallbackHandler = typeof cb === "function" ? cb : null;
  },
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // [claude-code 2026-03-23] Browser Use Phase 2 — CLI command bridge
  browserUse: {
    runCommand: (args) => ipcRenderer.invoke("browser-use-command", args),
    getStatus: () => ipcRenderer.invoke("browser-use-status"),
  },

  // [claude-code 2026-04-27] S46.4 Desk Calendar — silent .ics ingest events.
  deskCalendar: {
    onSaving: (cb) => {
      deskCalendarSavingCallback = typeof cb === "function" ? cb : null;
    },
    onSaved: (cb) => {
      deskCalendarSavedCallback = typeof cb === "function" ? cb : null;
    },
    onFailed: (cb) => {
      deskCalendarFailedCallback = typeof cb === "function" ? cb : null;
    },
  },

  // [claude-code 2026-04-23] Harper Vision — screen + audio capture bridge
  harperVision: {
    captureScreen: () => ipcRenderer.invoke("harper-vision:capture-screen"),
    captureWindow: (id) =>
      ipcRenderer.invoke("harper-vision:capture-window", id),
    getSources: () => ipcRenderer.invoke("harper-vision:get-sources"),
    startCapture: (sessionId) =>
      ipcRenderer.invoke("harper-vision:start-capture", sessionId),
    stopCapture: () => ipcRenderer.invoke("harper-vision:stop-capture"),
    getStatus: () => ipcRenderer.invoke("harper-vision:get-status"),
    setPrivacyMode: (enabled) =>
      ipcRenderer.invoke("harper-vision:set-privacy-mode", enabled),
    getPrivacyMode: () => ipcRenderer.invoke("harper-vision:get-privacy-mode"),
  },
});

// [claude-code 2026-04-20] S21: System permissions bridge for the Omi voice layer.
//   Consumed by frontend/lib/system-permissions.ts. The onboarding flow
//   (TP's follow-up sprint) calls request() once at first run; the runtime
//   calls query() before starting a voice session.
contextBridge.exposeInMainWorld("systemPermissions", {
  query: (name) => ipcRenderer.invoke("system-permissions:query", name),
  request: (name) => ipcRenderer.invoke("system-permissions:request", name),
});

// [claude-code 2026-04-23] Runtime API-base global — matches AutopilotDashboard's
// existing __FINTHEON_API_BASE__ convention. Build-time VITE_API_URL is authoritative;
// this is a belt-and-suspenders fallback for any code that reads at runtime.
contextBridge.exposeInMainWorld("__FINTHEON_API_BASE__", API_BASE);
