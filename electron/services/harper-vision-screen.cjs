// Harper Vision Screen Capture Service
// Inspired by OMI's ScreenCaptureManager.swift — adapted for Electron desktopCapturer
// Captures screen frames, encodes to WebP-quality PNG, and streams to backend.

const { desktopCapturer, powerMonitor } = require("electron");

class HarperVisionScreen {
  constructor() {
    this.isCapturing = false;
    this.captureIntervalMs = 5000;
    this.timer = null;
    this.sessionId = null;
    this.backendUrl = "http://localhost:8080";
    this.lastFrameHash = null;
    this.frameCounter = 0;
    this.activeWindowTitle = "";
    this.activeAppName = "";
  }

  async start(sessionId, options = {}) {
    if (this.isCapturing) return { ok: true, detail: "already capturing" };
    this.sessionId = sessionId || `hv-${Date.now()}`;
    this.captureIntervalMs = options.intervalMs || 5000;
    this.isCapturing = true;
    this.frameCounter = 0;

    console.log(`[HarperVision] Screen capture started — session ${this.sessionId}`);

    // Immediate first capture
    await this._captureAndSend();

    // Periodic capture
    this.timer = setInterval(() => this._captureAndSend(), this.captureIntervalMs);

    return { ok: true, sessionId: this.sessionId };
  }

  stop() {
    if (!this.isCapturing) return { ok: true, detail: "not capturing" };
    this.isCapturing = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log("[HarperVision] Screen capture stopped");
    return { ok: true };
  }

  status() {
    return {
      isCapturing: this.isCapturing,
      sessionId: this.sessionId,
      frameCounter: this.frameCounter,
      intervalMs: this.captureIntervalMs,
    };
  }

  async captureOnce() {
    return this._captureAndSend();
  }

  async getSources() {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 200 },
      fetchWindowIcons: false,
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      display_id: s.display_id,
      appIcon: s.appIcon?.toDataURL(),
      thumbnail: s.thumbnail?.toDataURL(),
    }));
  }

  async captureSource(sourceId) {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return { ok: false, error: "Source not found" };

    const thumbnail = source.thumbnail;
    if (!thumbnail || thumbnail.isEmpty()) {
      return { ok: false, error: "Empty thumbnail" };
    }

    const base64 = thumbnail.toDataURL().replace(/^data:image\/png;base64,/, "");
    return {
      ok: true,
      base64,
      width: thumbnail.getSize().width,
      height: thumbnail.getSize().height,
      name: source.name,
    };
  }

  async _captureAndSend() {
    try {
      // Skip if system is idle (no mouse/keyboard activity for 60s)
      if (powerMonitor.getSystemIdleState && powerMonitor.getSystemIdleState(60) === "locked") {
        return;
      }

      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1920, height: 1080 },
      });

      if (!sources.length) return;

      const primary = sources[0];
      const thumbnail = primary.thumbnail;
      if (!thumbnail || thumbnail.isEmpty()) return;

      // Simple perceptual hash to skip near-duplicate frames
      const base64 = thumbnail.toDataURL().replace(/^data:image\/png;base64,/, "");
      const currentHash = this._quickHash(base64.slice(0, 1024));
      if (currentHash === this.lastFrameHash) {
        return; // No significant change
      }
      this.lastFrameHash = currentHash;
      this.frameCounter++;

      const frame = {
        timestamp: new Date().toISOString(),
        base64,
        width: thumbnail.getSize().width,
        height: thumbnail.getSize().height,
        displayId: primary.display_id || primary.id,
        appName: this.activeAppName,
        windowTitle: this.activeWindowTitle,
        frameIndex: this.frameCounter,
      };

      // Fire-and-forget to backend
      this._postFrame(frame).catch(() => {});

      return { ok: true, frameIndex: this.frameCounter };
    } catch (err) {
      console.error("[HarperVision] Capture error:", err.message);
      return { ok: false, error: err.message };
    }
  }

  async _postFrame(frame) {
    const http = require("http");
    const payload = JSON.stringify({
      sessionId: this.sessionId,
      frames: [frame],
    });

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: 8080,
          path: "/api/harper-vision/frames",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
          timeout: 8000,
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

  _quickHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return h;
  }
}

module.exports = { HarperVisionScreen };
