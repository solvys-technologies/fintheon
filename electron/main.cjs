// [claude-code 2026-04-16] Lifecycle v2: token refresh on open, smart kill on close, idle shutdown for routine-started backends
// [claude-code 2026-02-26] Ensure OAuth popups work for embedded webviews.
// [claude-code 2026-03-11] Auto-start backend on app init.
// [claude-code 2026-03-16] Backend build fallback dialog, Discord OAuth popup support
// [claude-code 2026-03-16] Auto-updater via electron-updater + IPC for renderer update modal
// [claude-code 2026-03-20] Configurable backend autostart + launch-on-login toggles (stored in userData)
// [claude-code 2026-03-23] Browser Use Phase 2 — CDP + browser-use CLI bridge
// [claude-code 2026-03-24] Supabase Google OAuth deep link: fintheon:// protocol + open-url handler
// [claude-code 2026-04-19] S27-T5 W2c: voice window chrome hook for active voice sessions
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { installVoiceChromeHook } = require("./window-chrome-voice.cjs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let backendProcess = null;
let pendingAuthUrl = null;
let backendStopInFlight = null;

// [claude-code 2026-04-16] Track whether WE spawned the backend or found it already running
let backendOwnedByApp = false;

/* ------------------------------------------------------------------ */
/*  Startup config — persisted to userData/fintheon-startup.json       */
/* ------------------------------------------------------------------ */

const CONFIG_PATH = path.join(app.getPath("userData"), "fintheon-startup.json");
const DEFAULT_CONFIG = { backendAutostart: true, launchOnLogin: false };

function readStartupConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return {
        ...DEFAULT_CONFIG,
        ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")),
      };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function writeStartupConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), "utf8");
  } catch (err) {
    console.error("[Config] Failed to write startup config:", err.message);
  }
}

// [claude-code 2026-03-20] Check if backend is already running (LaunchAgent or manual)
async function isBackendAlive() {
  try {
    const http = require("http");
    return new Promise((resolve) => {
      const req = http.get("http://localhost:8080/health", (res) => {
        resolve(res.statusCode < 500);
      });
      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackendHealthy(timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isBackendAlive()) return true;
    await wait(350);
  }
  return false;
}

async function startBackend() {
  // If backend is already running (via LaunchAgent, routine, or manually), skip spawn
  const alive = await isBackendAlive();
  if (alive) {
    console.log("[Electron] Backend already running on :8080 — skipping spawn");
    backendOwnedByApp = false;
    // Disarm any idle shutdown from a previous routine session
    postToBackend("/api/lifecycle/disarm-idle-shutdown").catch(() => {});
    return { ok: true, detail: "already running" };
  }

  const backendDir = path.join(__dirname, "..", "backend-hono");
  const distEntry = path.join(backendDir, "dist", "index.js");

  if (!fs.existsSync(distEntry)) {
    console.warn("[Electron] Backend dist not found — attempting build...");
    try {
      execFileSync("bun", ["run", "build"], {
        cwd: backendDir,
        stdio: "inherit",
      });
      console.log("[Electron] Backend build succeeded");
    } catch (buildErr) {
      console.error("[Electron] Backend build failed:", buildErr.message);
      dialog.showErrorBox(
        "Backend Not Built",
        "The backend could not be compiled.\n\nRun manually:\n  cd backend-hono && bun run build\n\nThen relaunch the app.",
      );
      return { ok: false, detail: "build failed" };
    }
  }

  const envPath = path.join(backendDir, ".env");
  const runtimeNodeEnv = app.isPackaged ? "production" : "development";
  console.log(
    `[Electron] Starting backend server... (cwd: ${backendDir}, env: ${envPath})`,
  );
  backendProcess = spawn("node", [distEntry], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: runtimeNodeEnv,
      DOTENV_CONFIG_PATH: envPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  backendProcess.stdout.on("data", (data) => {
    console.log("[Backend]", data.toString().trim());
  });

  backendProcess.stderr.on("data", (data) => {
    console.error("[Backend]", data.toString().trim());
  });

  backendProcess.on("exit", (code) => {
    console.log("[Electron] Backend exited with code", code);
    backendProcess = null;
    backendStopInFlight = null;
    backendOwnedByApp = false;
  });

  backendOwnedByApp = true;
  return { ok: true, detail: "spawned" };
}

async function stopBackend() {
  if (!backendProcess) return { ok: true, detail: "not running" };
  if (backendStopInFlight) return backendStopInFlight;

  const proc = backendProcess;
  console.log("[Electron] Stopping backend...");

  backendStopInFlight = new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (backendProcess === proc) backendProcess = null;
      backendStopInFlight = null;
      backendOwnedByApp = false;
      resolve(result);
    };

    const hardKillTimer = setTimeout(() => {
      if (!proc.killed) {
        console.warn(
          "[Electron] Backend did not exit after SIGTERM; sending SIGKILL",
        );
        try {
          proc.kill("SIGKILL");
        } catch (error) {
          finish({
            ok: false,
            detail: `sigkill failed: ${error?.message ?? "unknown error"}`,
          });
        }
      }
    }, 6000);

    proc.once("exit", (code, signal) => {
      clearTimeout(hardKillTimer);
      finish({
        ok: true,
        detail: `exited (${code ?? "null"}${signal ? `, ${signal}` : ""})`,
      });
    });

    try {
      proc.kill("SIGTERM");
    } catch (error) {
      clearTimeout(hardKillTimer);
      finish({
        ok: false,
        detail: `sigterm failed: ${error?.message ?? "unknown error"}`,
      });
    }
  });

  return backendStopInFlight;
}

/* ------------------------------------------------------------------ */
/*  Backend HTTP helpers                                               */
/* ------------------------------------------------------------------ */

/** Fire-and-forget POST to backend */
function postToBackend(path, body) {
  const http = require("http");
  const payload = body ? JSON.stringify(body) : "{}";
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: 8080,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 5000,
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
    req.on("error", () => resolve({ ok: false }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false });
    });
    req.write(payload);
    req.end();
  });
}

/**
 * Called after backend is healthy — refreshes Rettiwt tokens and disarms idle shutdown.
 * [claude-code 2026-04-16]
 */
async function onBackendReady() {
  // Refresh Rettiwt key pool (reset cooldowns, reload from DB)
  const refreshResult = await postToBackend(
    "/api/riskflow/rettiwt-refresh",
  ).catch(() => null);
  if (refreshResult) {
    console.log(
      `[Electron] Rettiwt pool refreshed: ${refreshResult.totalKeys ?? "?"} keys, ${refreshResult.resetCount ?? 0} cooldowns reset`,
    );
  }

  // Disarm any idle shutdown timer from a prior routine session
  await postToBackend("/api/lifecycle/disarm-idle-shutdown").catch(() => {});
}

/**
 * Smart backend shutdown — kills if app-owned, arms idle timeout if routine-owned.
 * [claude-code 2026-04-16]
 */
async function smartShutdownBackend() {
  if (backendOwnedByApp) {
    // We spawned it — kill it
    console.log("[Electron] App-owned backend — stopping");
    return stopBackend();
  }

  // Routine/external backend — don't kill, arm 1h idle shutdown
  console.log(
    "[Electron] External backend — arming 1h idle shutdown instead of killing",
  );
  await postToBackend("/api/lifecycle/arm-idle-shutdown", {
    timeoutMs: 3600_000,
  }).catch((err) => {
    console.warn("[Electron] Failed to arm idle shutdown:", err?.message);
  });
  return { ok: true, detail: "idle shutdown armed" };
}

/* ------------------------------------------------------------------ */
/*  Auto-Updater (electron-updater)                                    */
/* ------------------------------------------------------------------ */

function setupAutoUpdater() {
  // Auto-download in background — toast appears when ready to install
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    console.log("[Updater] Update available:", info.version);
    if (mainWindow) {
      mainWindow.webContents.send("update-available", {
        version: info.version,
        releaseNotes: info.releaseNotes || "",
        releaseDate: info.releaseDate || "",
      });
    }
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[Updater] App is up to date");
  });

  autoUpdater.on("download-progress", (progress) => {
    console.log(`[Updater] Download: ${Math.round(progress.percent)}%`);
    if (mainWindow) {
      mainWindow.webContents.send("update-download-progress", {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
      });
    }
  });

  autoUpdater.on("update-downloaded", () => {
    console.log("[Updater] Update downloaded, ready to install");
    if (mainWindow) {
      mainWindow.webContents.send("update-downloaded");
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[Updater] Error:", err.message);
  });

  // Check immediately, then every 30 minutes
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(
    () => {
      autoUpdater.checkForUpdates().catch(() => {});
    },
    30 * 60 * 1000,
  );
}

const shouldAllowInAppPopup = (urlString) => {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();

    // OAuth providers commonly used by Notion / external platforms.
    if (host === "accounts.google.com") return true;
    if (host.endsWith(".accounts.google.com")) return true;
    if (host === "appleid.apple.com") return true;
    if (host.endsWith(".notion.so")) return true;
    if (host.endsWith(".notion.site")) return true;

    // TradeSea iframe login
    if (host === "app.tradesea.ai") return true;
    if (host === "tradesea.ai") return true;

    // GitHub OAuth (GitHub Models — Kimi K2)
    if (host === "github.com") return true;
    if (host.endsWith(".github.com")) return true;

    // Discord (Boardroom)
    if (host === "discord.com") return true;
    if (host.endsWith(".discord.com")) return true;
    if (host === "discordapp.com") return true;
    if (host.endsWith(".discordapp.com")) return true;

    // TopStepX (trading platform)
    if (host === "topstepx.com") return true;
    if (host.endsWith(".topstepx.com")) return true;

    // TradingView (charting)
    if (host === "tradingview.com") return true;
    if (host.endsWith(".tradingview.com")) return true;

    // YouTube (miniplayer)
    if (host === "youtube.com") return true;
    if (host.endsWith(".youtube.com")) return true;
    if (host === "youtu.be") return true;

    // Google auth relay domains
    if (host.endsWith(".google.com")) return true;
    if (host.endsWith(".gstatic.com")) return true;
    if (host.endsWith(".googleapis.com")) return true;

    return false;
  } catch {
    return false;
  }
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    title: "Fintheon",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      nativeWindowOpen: true,
    },
  });

  // [claude-code 2026-04-17] Auto-grant mic/speaker + related media permissions
  // to the persist:fintheon partition so the hidden Fluxer webview can wire
  // system audio without a permission prompt.
  try {
    const { session: electronSession } = require("electron");
    const fluxerSession = electronSession.fromPartition("persist:fintheon");
    fluxerSession.setPermissionRequestHandler((_wc, permission, cb) => {
      const allowed = new Set([
        "media",
        "audioCapture",
        "videoCapture",
        "display-capture",
        "mediaKeySystem",
      ]);
      cb(allowed.has(permission));
    });
    fluxerSession.setPermissionCheckHandler((_wc, permission) => {
      const allowed = new Set([
        "media",
        "audioCapture",
        "videoCapture",
        "display-capture",
        "mediaKeySystem",
      ]);
      return allowed.has(permission);
    });
  } catch (err) {
    console.warn("[Electron] Failed to install media permission handler:", err);
  }

  const rendererPath = path.join(
    __dirname,
    "..",
    "frontend",
    "dist",
    "index.html",
  );
  win.loadFile(rendererPath);
  mainWindow = win;

  // [claude-code 2026-04-19] S27-T5 W2c: install voice-chrome ipc hook once the
  // window exists. Idempotent — installVoiceChromeHook only registers the
  // listener on first call because ipcMain.on is additive.
  installVoiceChromeHook({ ipcMain, getWindow: () => mainWindow });
}

// [claude-code 2026-03-23] Browser Use Phase 2 — enable CDP for browser-use CLI
app.commandLine.appendSwitch("remote-debugging-port", "9222");

// macOS: handle fintheon:// URLs when app is already running
app.on("open-url", (event, url) => {
  event.preventDefault();
  console.log("[Electron] open-url received:", url);
  if (mainWindow) {
    mainWindow.webContents.send("auth-callback", url);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } else {
    pendingAuthUrl = url;
  }
});

// Windows/Linux: second-instance receives the deep link URL in argv
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const url = argv.find((arg) => arg.startsWith("fintheon://"));
    if (url && mainWindow) {
      mainWindow.webContents.send("auth-callback", url);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  // Register fintheon:// as a custom protocol for OAuth callbacks
  app.setAsDefaultProtocolClient("fintheon");

  const cfg = readStartupConfig();
  if (cfg.backendAutostart) {
    const startResult = await startBackend();
    if (!startResult.ok) {
      console.error("[Electron] Backend failed to start:", startResult.detail);
    } else {
      const healthy = await waitForBackendHealthy(15000);
      if (!healthy) {
        console.warn("[Electron] Backend did not become healthy within 15s");
      } else {
        // [claude-code 2026-04-16] Refresh tokens + disarm idle shutdown on app open
        await onBackendReady();
      }
    }
  } else {
    console.log("[Electron] Backend autostart disabled — skipping");
  }
  createWindow();
  setupAutoUpdater();

  // Forward any pending auth URL AFTER the renderer finishes loading
  // (sending before did-finish-load means the IPC message is lost)
  if (mainWindow) {
    mainWindow.webContents.on("did-finish-load", () => {
      if (pendingAuthUrl) {
        console.log("[Electron] Forwarding pending auth URL:", pendingAuthUrl);
        mainWindow.webContents.send("auth-callback", pendingAuthUrl);
        pendingAuthUrl = null;
      }
    });
  }
  // Browser Use Phase 2 — CDP enabled via commandLine switch, no in-process handlers needed

  // Chrome-like user-agent so Google doesn't block sign-in in Electron popups
  const CHROME_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  // Open Google OAuth in a standalone popup with Chrome UA so Google allows it.
  // Shares the persist:fintheon partition so session cookies carry back to the webview.
  const openGooglePopup = (navUrl) => {
    try {
      const parsed = new URL(navUrl);
      if (
        parsed.hostname !== "accounts.google.com" &&
        !parsed.hostname.endsWith(".accounts.google.com")
      )
        return false;
      const popup = new BrowserWindow({
        width: 520,
        height: 760,
        parent: mainWindow ?? undefined,
        modal: false,
        alwaysOnTop: true,
        title: "Sign in with Google",
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          nativeWindowOpen: true,
          partition: "persist:fintheon",
        },
      });
      popup.webContents.setUserAgent(CHROME_UA);
      popup.loadURL(navUrl);
      popup.focus();
      // When Google redirects back to the service, close the popup
      popup.webContents.on("will-redirect", (_rEvent, redirectUrl) => {
        try {
          const rParsed = new URL(redirectUrl);
          if (
            rParsed.hostname !== "accounts.google.com" &&
            !rParsed.hostname.endsWith(".google.com")
          ) {
            setTimeout(() => popup.close(), 1500);
          }
        } catch {}
      });
      // Also close on did-navigate to non-Google domains (catches JS redirects)
      popup.webContents.on("did-navigate", (_navEvent, doneUrl) => {
        try {
          const doneParsed = new URL(doneUrl);
          if (
            doneParsed.hostname !== "accounts.google.com" &&
            !doneParsed.hostname.endsWith(".google.com") &&
            !doneParsed.hostname.endsWith(".gstatic.com")
          ) {
            setTimeout(() => popup.close(), 1500);
          }
        } catch {}
      });
      return true;
    } catch {
      return false;
    }
  };

  // Handle window.open and Google OAuth across ALL web contents (webviews + popups).
  app.on("web-contents-created", (_event, contents) => {
    try {
      // setWindowOpenHandler — only for webview tags (handles window.open calls)
      if (contents.getType && contents.getType() === "webview") {
        contents.setWindowOpenHandler(({ url }) => {
          // Google OAuth — always intercept and open our custom popup
          if (openGooglePopup(url)) return { action: "deny" };

          if (shouldAllowInAppPopup(url)) {
            return {
              action: "allow",
              overrideBrowserWindowOptions: {
                width: 520,
                height: 760,
                parent: mainWindow ?? undefined,
                modal: false,
                title: "Sign in",
                webPreferences: {
                  contextIsolation: true,
                  nodeIntegration: false,
                  nativeWindowOpen: true,
                  partition: "persist:fintheon",
                },
              },
            };
          }

          shell.openExternal(url).catch(() => {});
          return { action: "deny" };
        });
      }

      // Google OAuth navigation intercept — applies to ALL contents (webviews,
      // popup windows, child frames) so OAuth works from any iframe or popup.
      contents.on("will-navigate", (navEvent, navUrl) => {
        if (openGooglePopup(navUrl)) navEvent.preventDefault();
      });

      contents.on(
        "did-start-navigation",
        (_navEvent, navUrl, isInPlace, isMainFrame) => {
          if (isMainFrame && openGooglePopup(navUrl)) {
            try {
              contents.goBack();
            } catch {}
          }
        },
      );
    } catch {
      // Best-effort only.
    }
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const cfg = readStartupConfig();
      if (cfg.backendAutostart) {
        const startResult = await startBackend();
        if (startResult.ok) {
          const healthy = await waitForBackendHealthy(15000);
          if (healthy) await onBackendReady();
        }
      }
      createWindow();
    }
  });
});

// [claude-code 2026-04-16] Smart shutdown: kill if app-owned, arm idle timeout if routine-owned
app.on("window-all-closed", () => {
  void smartShutdownBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void smartShutdownBackend();
});

ipcMain.handle("toggle-mini-widget", () => {
  // Placeholder for widget toggle behavior.
  return { ok: true };
});

// [claude-code 2026-03-24] Open URL in system browser (for OAuth flows)
ipcMain.handle("open-external", (_event, url) => {
  if (
    typeof url === "string" &&
    (url.startsWith("https://") || url.startsWith("http://"))
  ) {
    shell.openExternal(url);
  }
  return { ok: true };
});

// Auto-update IPC handlers
ipcMain.handle("update-download", () => {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error("[Updater] Download failed:", err.message);
  });
  return { ok: true };
});

// [claude-code 2026-04-16] Fix: await stopBackend() before quitAndInstall to prevent hang
ipcMain.handle("update-install", async () => {
  console.log("[Updater] Installing update — stopping backend first...");
  await stopBackend();
  console.log("[Updater] Backend stopped — calling quitAndInstall");
  setImmediate(() => {
    autoUpdater.quitAndInstall(false, true);
  });
  return { ok: true };
});

ipcMain.handle("update-check", () => {
  autoUpdater.checkForUpdates().catch(() => {});
  return { ok: true };
});

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// Startup config IPC
ipcMain.handle("get-startup-config", () => {
  const cfg = readStartupConfig();
  // Also read actual login-item state from OS
  const loginSettings = app.getLoginItemSettings();
  cfg.launchOnLogin = loginSettings.openAtLogin;
  return cfg;
});

ipcMain.handle("set-startup-config", (_event, patch) => {
  const cfg = readStartupConfig();
  if (typeof patch.backendAutostart === "boolean")
    cfg.backendAutostart = patch.backendAutostart;
  if (typeof patch.launchOnLogin === "boolean") {
    cfg.launchOnLogin = patch.launchOnLogin;
    app.setLoginItemSettings({ openAtLogin: patch.launchOnLogin });
  }
  writeStartupConfig(cfg);
  return cfg;
});

// Manual backend start/stop from renderer
ipcMain.handle("start-backend", async () => {
  if (backendProcess) return { ok: true, detail: "already running" };
  const startResult = await startBackend();
  if (!startResult.ok) return startResult;
  const healthy = await waitForBackendHealthy(15000);
  if (healthy) await onBackendReady();
  return {
    ok: healthy,
    detail: healthy ? "healthy" : "started but not healthy yet",
  };
});

ipcMain.handle("stop-backend", async () => {
  return await stopBackend();
});

ipcMain.handle("is-backend-alive", async () => {
  return { alive: await isBackendAlive() };
});

// Fintheon CLI: run shell command from project root and stream output to renderer
const projectRoot = path.join(__dirname, "..");
ipcMain.handle("run-shell-command", (event, command) => {
  if (typeof command !== "string" || !command.trim()) {
    return { ok: false, error: "Empty command" };
  }
  const sender = event.sender;
  const child = spawn(command.trim(), {
    shell: true,
    cwd: projectRoot,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (data) => {
    try {
      sender.send("cli-output", { type: "stdout", data: String(data) });
    } catch (_) {}
  });
  child.stderr.on("data", (data) => {
    try {
      sender.send("cli-output", { type: "stderr", data: String(data) });
    } catch (_) {}
  });
  child.on("exit", (code, signal) => {
    try {
      sender.send("cli-output", {
        type: "exit",
        code: code ?? null,
        signal: signal ?? null,
      });
    } catch (_) {}
  });
  child.on("error", (err) => {
    try {
      sender.send("cli-output", { type: "stderr", data: err.message + "\n" });
      sender.send("cli-output", { type: "exit", code: null, signal: null });
    } catch (_) {}
  });
  return { ok: true };
});

// [claude-code 2026-03-23] Browser Use Phase 2 — CLI command bridge
ipcMain.handle("browser-use-command", async (_event, args) => {
  const { execFile } = require("child_process");
  return new Promise((resolve) => {
    execFile(
      "browser-use",
      ["--cdp-url", "http://localhost:9222", "--json", ...args],
      {
        timeout: 30000,
        env: { ...process.env },
      },
      (error, stdout, stderr) => {
        if (error) resolve({ ok: false, error: error.message, stderr });
        else {
          try {
            resolve({ ok: true, data: JSON.parse(stdout) });
          } catch {
            resolve({ ok: true, data: stdout.trim() });
          }
        }
      },
    );
  });
});

ipcMain.handle("browser-use-status", async () => {
  const { execFile } = require("child_process");
  return new Promise((resolve) => {
    execFile(
      "browser-use",
      ["--json", "sessions"],
      { timeout: 5000 },
      (error, stdout) => {
        if (error) resolve({ running: false });
        else resolve({ running: true, sessions: stdout.trim() });
      },
    );
  });
});

// [claude-code 2026-04-20] S21: System permissions bridge for the Omi voice layer.
//   query + request mirror the minimal surface used by frontend/lib/system-permissions.ts.
//   Onboarding flow (separate sprint) will call request("microphone") at first run.
const { systemPreferences } = require("electron");

function mapMacStatus(status) {
  // systemPreferences.getMediaAccessStatus returns: 'not-determined'|'granted'|'denied'|'restricted'|'unknown'
  if (status === "granted") return "granted";
  if (status === "denied" || status === "restricted") return "denied";
  if (status === "not-determined") return "prompt";
  return "unknown";
}

ipcMain.handle("system-permissions:query", (_event, name) => {
  if (process.platform !== "darwin") return "granted";
  const mediaType = name === "camera" ? "camera" : "microphone";
  try {
    return mapMacStatus(systemPreferences.getMediaAccessStatus(mediaType));
  } catch {
    return "unknown";
  }
});

ipcMain.handle("system-permissions:request", async (_event, name) => {
  if (process.platform !== "darwin") return "granted";
  const mediaType = name === "camera" ? "camera" : "microphone";
  try {
    const granted = await systemPreferences.askForMediaAccess(mediaType);
    return granted ? "granted" : "denied";
  } catch {
    return "denied";
  }
});
