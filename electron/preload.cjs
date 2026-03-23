// [claude-code 2026-03-16] Added auto-update IPC bridge
// [claude-code 2026-03-22] Source of Truth fusion — agent view IPC bridge for Browser Control Phase 1
const { contextBridge, ipcRenderer } = require("electron");

let cliOutputCallback = null;
ipcRenderer.on("cli-output", (_event, data) => {
  if (typeof cliOutputCallback === "function") cliOutputCallback(data);
});

// Auto-update event forwarding
let updateAvailableCallback = null;
let updateProgressCallback = null;
let updateDownloadedCallback = null;

ipcRenderer.on("update-available", (_event, info) => {
  if (typeof updateAvailableCallback === "function") updateAvailableCallback(info);
});
ipcRenderer.on("update-download-progress", (_event, progress) => {
  if (typeof updateProgressCallback === "function") updateProgressCallback(progress);
});
ipcRenderer.on("update-downloaded", () => {
  if (typeof updateDownloadedCallback === "function") updateDownloadedCallback();
});

contextBridge.exposeInMainWorld("electron", {
  toggleMiniWidget: async () => {
    try {
      await ipcRenderer.invoke("toggle-mini-widget");
    } catch {
      // no-op fallback for renderer calls
    }
  },
  runShellCommand: (command) => ipcRenderer.invoke("run-shell-command", command),
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

  // [claude-code 2026-03-23] Browser Use Phase 2 — CLI command bridge
  browserUse: {
    runCommand: (args) => ipcRenderer.invoke("browser-use-command", args),
    getStatus: () => ipcRenderer.invoke("browser-use-status"),
  },
});
