// [claude-code 2026-04-23] S32-T2 Harper Vision — privacy-mode gate on _sendChunk
// Harper Vision Audio Capture Service
// Inspired by OMI's AudioCaptureService.swift + AudioMixer.swift
// Continuous microphone capture → PCM chunks → backend transcription
// Electron main process spawns a hidden renderer for Web Audio API access.

const { BrowserWindow } = require("electron");
const path = require("path");

class HarperVisionAudio {
  constructor() {
    this.isRecording = false;
    this.sessionId = null;
    this.hiddenWindow = null;
    this.backendUrl = "http://localhost:8080";
    this.privacyMode = false;
  }

  setPrivacyMode(enabled) {
    this.privacyMode = !!enabled;
    console.log(
      `[HarperVision] Audio privacy mode: ${this.privacyMode ? "ON" : "OFF"}`,
    );
  }

  async start(sessionId) {
    if (this.isRecording) return { ok: true, detail: "already recording" };
    this.sessionId = sessionId || `hv-audio-${Date.now()}`;

    // Create hidden window for Web Audio API access (main process has no getUserMedia)
    this.hiddenWindow = new BrowserWindow({
      width: 1,
      height: 1,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "harper-vision-audio-preload.cjs"),
      },
    });

    // Load a data URI with the capture script
    this.hiddenWindow.loadURL(`data:text/html,<html><body><script>
      // This runs in the hidden renderer — has full Web Audio / getUserMedia access
      const { ipcRenderer } = require('electron');

      let mediaRecorder = null;
      let stream = null;
      let chunks = [];
      let sendInterval = null;

      async function startCapture() {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });

          mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };

          mediaRecorder.start(1000); // 1s chunks

          // Send accumulated chunks every 5s
          sendInterval = setInterval(() => {
            if (chunks.length === 0) return;
            const blob = new Blob(chunks, { type: 'audio/webm' });
            chunks = [];
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result.split(',')[1];
              ipcRenderer.send('harper-vision:audio-chunk', base64);
            };
            reader.readAsDataURL(blob);
          }, 5000);

          ipcRenderer.send('harper-vision:audio-started');
        } catch (err) {
          ipcRenderer.send('harper-vision:audio-error', err.message);
        }
      }

      function stopCapture() {
        if (sendInterval) clearInterval(sendInterval);
        if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        if (stream) stream.getTracks().forEach(t => t.stop());
      }

      ipcRenderer.on('harper-vision:start-recording', startCapture);
      ipcRenderer.on('harper-vision:stop-recording', stopCapture);
    </script></body></html>`);

    // Wait for window to load then start recording
    this.hiddenWindow.webContents.on("did-finish-load", () => {
      this.hiddenWindow.webContents.send("harper-vision:start-recording");
    });

    // Listen for audio chunks from the hidden renderer
    const { ipcMain } = require("electron");
    this._chunkHandler = (_event, base64) => {
      if (this.privacyMode) return;
      this._sendChunk(base64).catch(() => {});
    };
    this._startedHandler = () => {
      console.log(
        `[HarperVision] Audio recording started — session ${this.sessionId}`,
      );
    };
    this._errorHandler = (_event, msg) => {
      console.error("[HarperVision] Audio error:", msg);
    };

    ipcMain.on("harper-vision:audio-chunk", this._chunkHandler);
    ipcMain.on("harper-vision:audio-started", this._startedHandler);
    ipcMain.on("harper-vision:audio-error", this._errorHandler);

    this.isRecording = true;
    return { ok: true, sessionId: this.sessionId };
  }

  stop() {
    if (!this.isRecording) return { ok: true, detail: "not recording" };
    this.isRecording = false;

    if (this.hiddenWindow) {
      this.hiddenWindow.webContents.send("harper-vision:stop-recording");
      setTimeout(() => {
        this.hiddenWindow?.close();
        this.hiddenWindow = null;
      }, 500);
    }

    const { ipcMain } = require("electron");
    if (this._chunkHandler)
      ipcMain.removeListener("harper-vision:audio-chunk", this._chunkHandler);
    if (this._startedHandler)
      ipcMain.removeListener(
        "harper-vision:audio-started",
        this._startedHandler,
      );
    if (this._errorHandler)
      ipcMain.removeListener("harper-vision:audio-error", this._errorHandler);

    console.log("[HarperVision] Audio recording stopped");
    return { ok: true };
  }

  status() {
    return {
      isRecording: this.isRecording,
      sessionId: this.sessionId,
      mode: "continuous-webm",
    };
  }

  async _sendChunk(base64) {
    const http = require("http");
    const payload = JSON.stringify({
      sessionId: this.sessionId,
      audioBase64: base64,
      mimeType: "audio/webm;codecs=opus",
      timestamp: new Date().toISOString(),
    });

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: 8080,
          path: "/api/harper-vision/audio-chunk",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          timeout: 15000,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({ ok: true });
            }
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("timeout"));
      });
      req.write(payload);
      req.end();
    });
  }
}

module.exports = { HarperVisionAudio };
