// Preload for the hidden audio capture renderer window
// Minimal exposure — only ipcRenderer for signalling

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("audioCapture", {
  onStart: (cb) => ipcRenderer.on("harper-vision:start-recording", cb),
  onStop: (cb) => ipcRenderer.on("harper-vision:stop-recording", cb),
  sendChunk: (base64) => ipcRenderer.send("harper-vision:audio-chunk", base64),
  sendStarted: () => ipcRenderer.send("harper-vision:audio-started"),
  sendError: (msg) => ipcRenderer.send("harper-vision:audio-error", msg),
});
