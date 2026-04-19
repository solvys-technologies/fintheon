// [claude-code 2026-04-19] S27-T5 W2c — Electron-side window-chrome hook for
// the voice rim. The rim visual itself lives in the React layer
// (frontend/components/voice/VoiceRimFrame.tsx) so the rim is identical on web
// and desktop. This module adds optional desktop-only polish: a subtle accent
// background tint + titleBarOverlay recolor on Windows/Linux during active
// voice sessions. No-op on macOS (native traffic-light chrome handles itself).
//
// Wired from electron/main.cjs — installs an ipcMain listener on
// "voice:chrome-state" with payload { active: boolean, state: "listening" |
// "speaking" | "thinking" | "error" | "idle" }.
//
// This file is CommonJS (.cjs) to match the rest of the electron/ tree —
// electron main.cjs uses require() at runtime.

const ACCENT = "#c79f4a";
const BG = "#050402";

function stateTint(state) {
  switch (state) {
    case "speaking":
      return { symbolColor: ACCENT, height: 28 };
    case "listening":
      return { symbolColor: ACCENT, height: 28 };
    case "thinking":
      return { symbolColor: ACCENT, height: 28 };
    case "error":
      return { symbolColor: "#ef4444", height: 28 };
    default:
      return null;
  }
}

let installed = false;

function installVoiceChromeHook({ ipcMain, getWindow }) {
  if (!ipcMain || typeof getWindow !== "function") return;
  if (installed) return;
  installed = true;

  ipcMain.on("voice:chrome-state", (_event, payload) => {
    try {
      const win = getWindow();
      if (!win || win.isDestroyed()) return;

      const active = !!payload?.active;
      const state = typeof payload?.state === "string" ? payload.state : "idle";

      if (!active) {
        // Restore default chrome.
        if (typeof win.setTitleBarOverlay === "function") {
          win.setTitleBarOverlay({ color: BG, symbolColor: "#f0ead6" });
        }
        win.setBackgroundColor(BG);
        return;
      }

      const tint = stateTint(state);
      if (tint && typeof win.setTitleBarOverlay === "function") {
        win.setTitleBarOverlay({ color: BG, ...tint });
      }
      // Leave BG alone — the React rim handles the inner border.
    } catch (err) {
      // Non-fatal; rim still works without desktop chrome.
      console.warn("[voice-chrome] toggle failed:", err);
    }
  });
}

module.exports = { installVoiceChromeHook };
