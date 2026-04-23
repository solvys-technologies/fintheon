// Harper Vision Audio Capture Service
// Inspired by OMI's AudioCaptureService.swift + AudioMixer.swift
// Captures microphone audio, encodes to Opus/WebM, streams to backend for STT.

class HarperVisionAudio {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.stream = null;
    this.sessionId = null;
    this.backendUrl = "http://localhost:8080";
    this.chunks = [];
    this.sendIntervalMs = 5000;
    this.sendTimer = null;
  }

  async start(sessionId) {
    if (this.isRecording) return { ok: true, detail: "already recording" };
    this.sessionId = sessionId || `hv-audio-${Date.now()}`;

    try {
      // Note: In Electron main process, we don't have direct getUserMedia.
      // The renderer will handle mic capture via existing useVoiceAssistant.
      // This service is a placeholder for future system-audio capture via
      // desktopCapturer or a native bridge.
      //
      // For now, Harper Vision audio flows through the existing voice pipeline:
      //   frontend getUserMedia -> /api/voice/transcribe -> backend
      //
      // This module will be expanded when we add system-audio capture.

      this.isRecording = true;
      console.log(`[HarperVision] Audio placeholder started — session ${this.sessionId}`);
      return { ok: true, sessionId: this.sessionId, mode: "placeholder" };
    } catch (err) {
      console.error("[HarperVision] Audio start error:", err.message);
      return { ok: false, error: err.message };
    }
  }

  stop() {
    if (!this.isRecording) return { ok: true, detail: "not recording" };
    this.isRecording = false;
    if (this.sendTimer) {
      clearInterval(this.sendTimer);
      this.sendTimer = null;
    }
    console.log("[HarperVision] Audio stopped");
    return { ok: true };
  }

  status() {
    return {
      isRecording: this.isRecording,
      sessionId: this.sessionId,
      mode: "placeholder",
    };
  }
}

module.exports = { HarperVisionAudio };
