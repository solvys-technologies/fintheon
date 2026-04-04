// [claude-code 2026-02-26] Ensure OAuth popups work for embedded webviews.
// [claude-code 2026-03-11] Auto-start backend on app init.

// [claude-code 2026-03-16] Backend build fallback dialog, Discord OAuth popup support
// [claude-code 2026-03-16] Auto-updater via electron-updater + IPC for renderer update modal
// [claude-code 2026-03-20] Configurable backend autostart + launch-on-login toggles (stored in userData)
// [claude-code 2026-03-23] Browser Use Phase 2 — CDP + browser-use CLI bridge
// [claude-code 2026-03-24] Supabase Google OAuth deep link: fintheon:// protocol + open-url handler
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let backendProcess = null;
let pendingAuthUrl = null;
let backendStopInFlight = null;

/* ------------------------------------------------------------------ */
/*  Startup config — persisted to userData/fintheon-startup.json       */
/* ------------------------------------------------------------------ */

const CONFIG_PATH = path.join(app.getPath("userData"), "fintheon-startup.json");
const DEFAULT_CONFIG = { backendAutostart: true, launchOnLogin: false };

function readStartupConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
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
      req.setTimeout(2000, () => { req.destroy(); resolve(false); });
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
  // If backend is already running (via LaunchAgent or manually), skip spawn
  const alive = await isBackendAlive();
  if (alive) {
    console.log("[Electron] Backend already running on :8080 — skipping spawn");
    return { ok: true, detail: "already running" };
  }

  const backendDir = path.join(__dirname, "..", "backend-hono");
  const distEntry = path.join(backendDir, "dist", "index.js");

  if (!fs.existsSync(distEntry)) {
    console.warn("[Electron] Backend dist not found — attempting build...");
    try {
      execFileSync("bun", ["run", "build"], { cwd: backendDir, stdio: "inherit" });
      console.log("[Electron] Backend build succeeded");
    } catch (buildErr) {
      console.error("[Electron] Backend build failed:", buildErr.message);
      dialog.showErrorBox(
        "Backend Not Built",
        "The backend could not be compiled.\n\nRun manually:\n  cd backend-hono && bun run build\n\nThen relaunch the app."
      );
      return { ok: false, detail: "build failed" };
    }
  }

  const envPath = path.join(backendDir, ".env");
  const runtimeNodeEnv = app.isPackaged ? "production" : "development";
  console.log(`[Electron] Starting backend server... (cwd: ${backendDir}, env: ${envPath})`);
  backendProcess = spawn("node", [distEntry], {
    cwd: backendDir,
    env: { ...process.env, NODE_ENV: runtimeNodeEnv, DOTENV_CONFIG_PATH: envPath },
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
  });

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
      resolve(result);
    };

    const hardKillTimer = setTimeout(() => {
      if (!proc.killed) {
        console.warn("[Electron] Backend did not exit after SIGTERM; sending SIGKILL");
        try {
          proc.kill("SIGKILL");
        } catch (error) {
          finish({ ok: false, detail: `sigkill failed: ${error?.message ?? "unknown error"}` });
        }
      }
    }, 6000);

    proc.once("exit", (code, signal) => {
      clearTimeout(hardKillTimer);
      finish({ ok: true, detail: `exited (${code ?? "null"}${signal ? `, ${signal}` : ""})` });
    });

    try {
      proc.kill("SIGTERM");
    } catch (error) {
      clearTimeout(hardKillTimer);
      finish({ ok: false, detail: `sigterm failed: ${error?.message ?? "unknown error"}` });
    }
  });

  return backendStopInFlight;
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
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30 * 60 * 1000);
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

  const rendererPath = path.join(__dirname, "..", "frontend", "dist", "index.html");
  win.loadFile(rendererPath);
  mainWindow = win;
}

// [claude-code 2026-03-23] Browser Use Phase 2 — enable CDP for browser-use CLI
app.commandLine.appendSwitch('remote-debugging-port', '9222');

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

  // Handle window.open from embedded <webview> tags.
  app.on("web-contents-created", (_event, contents) => {
    try {
      if (contents.getType && contents.getType() === "webview") {
        contents.setWindowOpenHandler(({ url }) => {
          if (shouldAllowInAppPopup(url)) {
            // Allow an in-app popup — share the webview's partition so the
            // auth session cookies carry over (fixes Google OAuth in iframes).
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

          // For non-auth links, open externally to avoid popup spam.
          shell.openExternal(url).catch(() => {});
          return { action: "deny" };
        });

        // Intercept in-page navigations to Google OAuth inside webviews —
        // Google blocks sign-in in embedded frames. Open in a popup instead.
        contents.on("will-navigate", (navEvent, navUrl) => {
          try {
            const parsed = new URL(navUrl);
            if (parsed.hostname === "accounts.google.com") {
              navEvent.preventDefault();
              const popup = new BrowserWindow({
                width: 520,
                height: 760,
                parent: mainWindow ?? undefined,
                modal: false,
                title: "Sign in with Google",
                webPreferences: {
                  contextIsolation: true,
                  nodeIntegration: false,
                  nativeWindowOpen: true,
                  partition: "persist:fintheon",
                },
              });
              popup.loadURL(navUrl);
              // When Google redirects back to the service, close the popup
              popup.webContents.on("will-redirect", (_rEvent, redirectUrl) => {
                try {
                  const rParsed = new URL(redirectUrl);
                  if (rParsed.hostname !== "accounts.google.com" &&
                      !rParsed.hostname.endsWith(".google.com")) {
                    // Auth complete — redirect happened back to the service
                    setTimeout(() => popup.close(), 1500);
                  }
                } catch {}
              });
            }
          } catch {}
        });
      }
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
          await waitForBackendHealthy(15000);
        }
      }
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  void stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  void stopBackend();
});

ipcMain.handle("toggle-mini-widget", () => {
  // Placeholder for widget toggle behavior.
  return { ok: true };
});

// [claude-code 2026-03-24] Open URL in system browser (for OAuth flows)
ipcMain.handle("open-external", (_event, url) => {
  if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
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

ipcMain.handle("update-install", () => {
  void stopBackend();
  autoUpdater.quitAndInstall(false, true);
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
  if (typeof patch.backendAutostart === "boolean") cfg.backendAutostart = patch.backendAutostart;
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
  return { ok: healthy, detail: healthy ? "healthy" : "started but not healthy yet" };
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
      sender.send("cli-output", { type: "exit", code: code ?? null, signal: signal ?? null });
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
    execFile("browser-use", ["--cdp-url", "http://localhost:9222", "--json", ...args], {
      timeout: 30000,
      env: { ...process.env },
    }, (error, stdout, stderr) => {
      if (error) resolve({ ok: false, error: error.message, stderr });
      else {
        try { resolve({ ok: true, data: JSON.parse(stdout) }); }
        catch { resolve({ ok: true, data: stdout.trim() }); }
      }
    });
  });
});

ipcMain.handle("browser-use-status", async () => {
  const { execFile } = require("child_process");
  return new Promise((resolve) => {
    execFile("browser-use", ["--json", "sessions"], { timeout: 5000 }, (error, stdout) => {
      if (error) resolve({ running: false });
      else resolve({ running: true, sessions: stdout.trim() });
    });
  });
});
