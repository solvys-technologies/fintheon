// [claude-code 2026-05-12] TopStepX PWA Blocker — /etc/hosts IPC + webRequest guard
// [claude-code 2026-04-25] S35: window-close + app-quit instrumentation. The S35 crash.log
// captured render-process-gone cascades but never WHY — macOS log show revealed AppKit
// `windowShouldClose:` events at every crash timestamp, so the closes were either
// programmatic, accessibility-driven, or a stray Cmd+W. Hook BrowserWindow `close` /
// `closed`, `app.before-quit`, `app.quit`, and process SIGTERM/SIGINT so the next
// reproduction lands the trigger in crash.log instead of silence.
// [claude-code 2026-04-23] Rollback: drop github.com OAuth popup allowlist (provider retired)
// [claude-code 2026-04-16] Lifecycle v2: token refresh on open, smart kill on close, idle shutdown for routine-started backends
// [claude-code 2026-02-26] Ensure OAuth popups work for embedded webviews.
// [claude-code 2026-03-11] Auto-start backend on app init.
// [claude-code 2026-03-16] Backend build fallback dialog, Discord OAuth popup support
// [claude-code 2026-05-14] In-app updater: explicit check, background DMG
// download, downloaded CTA, then install from the prepared artifact.
// [claude-code 2026-03-20] Configurable backend autostart + launch-on-login toggles (stored in userData)
// [claude-code 2026-03-23] Browser Use Phase 2 — CDP + browser-use CLI bridge
// [claude-code 2026-03-24] Supabase Google OAuth deep link: fintheon:// protocol + open-url handler
// [claude-code 2026-04-19] S27-T5 W2c: voice window chrome hook for active voice sessions
// [claude-code 2026-04-23] Windows build support — remote-backend mode, platform gating, titleBarOverlay chrome
const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  Menu,
  Notification,
  Tray,
  nativeImage,
} = require("electron");
const { installVoiceChromeHook } = require("./window-chrome-voice.cjs");
const { createUpdateManager } = require("./update-manager.cjs");
const {
  installDeskCalendarClickCapture,
} = require("./desk-calendar-click-capture.cjs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");

const IS_MAC = process.platform === "darwin";
const IS_WIN = process.platform === "win32";

// [claude-code 2026-05-13] Default blocked domains. Clean-slate blocker policy:
// only the selected dropdown platform plus user-added domains should be blocked.
const DEFAULT_BLOCKED_DOMAINS = ["topstepx.com", "www.topstepx.com"];
const BLOCKED_DOMAINS_PATH = "fintheon-blocked-domains.json";
const BLOCKED_DOMAINS_VERSION = 2;
const BLOCKED_PAGE_URL =
  "data:text/html;charset=utf-8," +
  encodeURIComponent(
    "<!doctype html><html><head><meta charset='utf-8'><style>html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}</style></head><body></body></html>",
  );
let fastBlockerEnabled = false;

/** Load blocked domains from userData, falling back to defaults */
function loadBlockedDomains() {
  try {
    const p = path.join(app.getPath("userData"), BLOCKED_DOMAINS_PATH);
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, "utf8");
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.version === BLOCKED_DOMAINS_VERSION &&
        Array.isArray(parsed.domains) &&
        parsed.domains.length > 0
      ) {
        return parsed.domains;
      }
      // Legacy array shape carried broad hidden defaults. Migrate once to the
      // new clean slate: TopStepX only until the renderer saves explicit domains.
      if (Array.isArray(parsed)) {
        saveBlockedDomains(DEFAULT_BLOCKED_DOMAINS);
        return [...DEFAULT_BLOCKED_DOMAINS];
      }
    }
  } catch {}
  return [...DEFAULT_BLOCKED_DOMAINS];
}

/** Save blocked domains to userData */
function saveBlockedDomains(domains) {
  try {
    const p = path.join(app.getPath("userData"), BLOCKED_DOMAINS_PATH);
    fs.writeFileSync(
      p,
      JSON.stringify({ version: BLOCKED_DOMAINS_VERSION, domains }, null, 2),
      "utf8",
    );
    return true;
  } catch {
    return false;
  }
}

// [claude-code 2026-04-23] Windows runs in remote-backend mode: no local spawn,
// no launchd, frontend hits fintheon.fly.dev directly. macOS keeps the localhost
// sidecar via launchd + app-owned spawn (lifecycle v2).
const REMOTE_BACKEND_URL = "https://fintheon.fly.dev";
const RELEASES_LATEST_URL =
  "https://github.com/solvys-technologies/fintheon/releases/latest";
let currentApiBase = REMOTE_BACKEND_URL;
const updateManager = createUpdateManager({
  app,
  getCurrentApiBase: () => currentApiBase,
  getMainWindow: () => mainWindow,
  releasesLatestUrl: RELEASES_LATEST_URL,
  remoteBackendUrl: REMOTE_BACKEND_URL,
});

// [claude-code 2026-04-23] Harper Vision — macOS-only (uses ScreenCaptureKit under the hood).
// Windows build stubs these out and returns { ok: false } from the IPC handlers.
let harperVisionScreen = null;
let harperVisionAudio = null;
if (IS_MAC) {
  const { HarperVisionScreen } = require("./services/harper-vision-screen.cjs");
  const { HarperVisionAudio } = require("./services/harper-vision-audio.cjs");
  harperVisionScreen = new HarperVisionScreen();
  harperVisionAudio = new HarperVisionAudio();
}

let mainWindow = null;
let backendProcess = null;
let backendTray = null;
let pendingAuthUrl = null;
let backendStopInFlight = null;
let deferredUpdateOnClose = false;

// [claude-code 2026-05-13] S63 T3: Dock menu state + notification tracking
let dockQuickAccessUrl = "";
let lastDockLockState = null; // Track transitions for expiry notification
let notifiedHighIvIds = new Set(); // Track notified RiskFlow items
let dockMenuPollInterval = null;
let riskflowPollInterval = null;

// [claude-code 2026-04-16] Track whether WE spawned the backend or found it already running
let backendOwnedByApp = false;
const BACKEND_LABEL = "io.solvys.fintheon-backend";
const BACKEND_HEALTH_URL = "http://localhost:8080/health";
const BACKEND_LOGS_PATH = "/tmp/fintheon-backend.log";
const BACKEND_PLIST_PATH = path.join(
  require("os").homedir(),
  "Library",
  "LaunchAgents",
  `${BACKEND_LABEL}.plist`,
);

/* ------------------------------------------------------------------ */
/*  [claude-code 2026-04-25] S35: Crash diagnostics                     */
/*  TP reported app auto-closes after a few minutes with no obvious     */
/*  cause. Without crash output, the next reproduction is a black box.  */
/*  Log: render-process-gone, child-process-gone, uncaughtException,    */
/*  unhandledRejection, GPU crashes, and unexpected backend exits.      */
/*  Lands in userData/crash.log so it survives across restarts.         */
/* ------------------------------------------------------------------ */

const CRASH_LOG_PATH = path.join(app.getPath("userData"), "crash.log");

function logCrash(event, detail) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ...detail,
  });
  try {
    fs.appendFileSync(CRASH_LOG_PATH, line + "\n", "utf8");
  } catch {
    /* best-effort */
  }
  // Also surface to stderr so launchd / Console.app picks it up.
  console.error("[Crash]", line);
}

process.on("uncaughtException", (err) => {
  logCrash("uncaughtException", {
    message: err?.message,
    stack: (err?.stack || "").slice(0, 2000),
  });
});

process.on("unhandledRejection", (reason) => {
  logCrash("unhandledRejection", {
    reason: typeof reason === "string" ? reason : String(reason),
  });
});

app.on("render-process-gone", (_event, _wc, details) => {
  logCrash("render-process-gone", details);
});

app.on("child-process-gone", (_event, details) => {
  logCrash("child-process-gone", details);
});

app.on("gpu-process-crashed", (_event, killed) => {
  logCrash("gpu-process-crashed", { killed });
});

// [claude-code 2026-04-25] S35: capture every close/quit pathway so the next
// repro of "fintheon error-closes after 5 minutes" lands a definitive trigger
// in crash.log. The existing render-process-gone cascade only fires AFTER the
// decision to quit has been made — we need to know WHO made it.

let closeReason = null; // Set by the listener that fires first; read by quit hooks

app.on("before-quit", (_event) => {
  deferredUpdateOnClose = false;
  logCrash("app-before-quit", { reason: closeReason ?? "unknown" });
});

app.on("will-quit", (_event) => {
  logCrash("app-will-quit", { reason: closeReason ?? "unknown" });
});

app.on("quit", (_event, exitCode) => {
  logCrash("app-quit", { exitCode, reason: closeReason ?? "unknown" });
});

const sigHandler = (signal) => {
  logCrash("process-signal", { signal });
  closeReason = closeReason ?? `signal:${signal}`;
};
process.on("SIGTERM", () => sigHandler("SIGTERM"));
process.on("SIGINT", () => sigHandler("SIGINT"));
process.on("SIGHUP", () => sigHandler("SIGHUP"));

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
      const req = http.get(BACKEND_HEALTH_URL, (res) => {
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

function notifyBackendEngineStatus() {
  backendEngineStatus().then((status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("backend-engine:status", status);
    }
    updateBackendTray(status);
  });
}

function runLaunchctl(args) {
  if (!IS_MAC) return { ok: false, detail: "launchd unavailable" };
  try {
    execFileSync("/bin/launchctl", args, { stdio: "pipe" });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail:
        err?.stderr?.toString()?.trim() ||
        err?.stdout?.toString()?.trim() ||
        err?.message ||
        "launchctl failed",
    };
  }
}

function ensureBackendLaunchAgent() {
  if (!IS_MAC || !fs.existsSync(BACKEND_PLIST_PATH)) {
    return { ok: false, detail: "backend LaunchAgent not installed" };
  }
  const uid = process.getuid ? process.getuid() : null;
  if (uid == null) return { ok: false, detail: "missing uid" };
  const target = `gui/${uid}`;
  const bootstrap = runLaunchctl(["bootstrap", target, BACKEND_PLIST_PATH]);
  if (bootstrap.ok || bootstrap.detail?.includes("service already loaded")) {
    return { ok: true };
  }
  const load = runLaunchctl(["load", "-w", BACKEND_PLIST_PATH]);
  return load.ok ? { ok: true } : bootstrap;
}

function kickstartBackendLaunchAgent() {
  if (!IS_MAC) return { ok: false, detail: "launchd unavailable" };
  const ensured = ensureBackendLaunchAgent();
  if (!ensured.ok) return ensured;
  const uid = process.getuid ? process.getuid() : null;
  if (uid == null) return { ok: false, detail: "missing uid" };
  const kicked = runLaunchctl([
    "kickstart",
    "-k",
    `gui/${uid}/${BACKEND_LABEL}`,
  ]);
  return kicked.ok ? { ok: true } : kicked;
}

async function backendEngineStatus() {
  const alive = await isBackendAlive();
  const healthCheckedAt = new Date().toISOString();
  return {
    state: alive ? "connected" : backendProcess ? "starting" : "offline",
    alive,
    url: BACKEND_HEALTH_URL,
    logsPath: BACKEND_LOGS_PATH,
    checkedAt: healthCheckedAt,
    detail: alive
      ? "Backend health check passed"
      : backendProcess
        ? "Backend process is starting"
        : "Backend health check failed",
  };
}

async function restartBackendEngine() {
  let detail = "";
  if (IS_MAC) {
    const result = kickstartBackendLaunchAgent();
    detail = result.detail ?? "launchd restart requested";
  } else if (backendProcess) {
    await stopBackend();
    detail = "app-owned backend restarted";
  }
  if (!(await isBackendAlive())) {
    const started = await startBackend();
    detail = started.detail ?? detail;
  }
  const healthy = await waitForBackendHealthy(15000);
  if (healthy) await onBackendReady();
  const status = await backendEngineStatus();
  updateBackendTray(status);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("backend-engine:status", status);
  }
  return { ok: healthy, detail, status };
}

/* ------------------------------------------------------------------ */
/*  S63 T3: Dock menu + notification polling (macOS)                  */
/* ------------------------------------------------------------------ */

/** Fetch lockout status from backend */
async function fetchLockoutStatus() {
  try {
    const http = require("http");
    return new Promise((resolve) => {
      const req = http.get(
        "http://localhost:8080/api/lockout/status",
        { timeout: 3000 },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on("error", () => resolve(null));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

/** Fetch RiskFlow feed items for high-IV notification check */
async function fetchRiskFlowFeed() {
  try {
    const http = require("http");
    return new Promise((resolve) => {
      const req = http.get(
        "http://localhost:8080/api/riskflow/feed?limit=20&breaking=true",
        { timeout: 5000 },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on("error", () => resolve(null));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(null);
      });
    });
  } catch {
    return null;
  }
}

/** Build and set the macOS dock menu from current state */
function updateDockMenu(lockStatus) {
  if (!IS_MAC || !app.dock) return;

  const menuItems = [];

  // Status label
  if (lockStatus && lockStatus.locked) {
    const minutes = lockStatus.remaining
      ? Math.round(lockStatus.remaining / 60)
      : "?";
    menuItems.push({
      label: `Trading Locked \u2014 ${minutes}m remaining`,
      enabled: false,
    });
  } else {
    menuItems.push({ label: "Trading Unlocked", enabled: false });
  }

  menuItems.push({ type: "separator" });

  // Lock/unlock action
  if (lockStatus && lockStatus.locked) {
    menuItems.push({
      label: "Unlock Trading",
      click: () => {
        postToBackend("/api/lockout/toggle", { locked: false }).catch(() => {});
      },
    });
  } else {
    menuItems.push({
      label: "Lock Trading (30m)",
      click: () => {
        postToBackend("/api/lockout/toggle", {
          locked: true,
          durationMinutes: 30,
        }).catch(() => {});
      },
    });
  }

  menuItems.push({ type: "separator" });

  // Quick access
  menuItems.push({
    label: "Quick Access",
    click: () => {
      if (dockQuickAccessUrl && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("dock:quick-access", dockQuickAccessUrl);
      }
    },
  });

  menuItems.push({ type: "separator" });

  menuItems.push({
    label: "Quit",
    click: () => {
      closeReason = "dock-menu-quit";
      app.quit();
    },
  });

  const dockMenu = Menu.buildFromTemplate(menuItems);
  try {
    app.dock.setMenu(dockMenu);
  } catch (err) {
    console.error("[DockMenu] Failed to set menu:", err.message);
  }
}

function statusLabel(state) {
  if (state === "connected") return "Connected";
  if (state === "starting") return "Starting";
  if (state === "degraded") return "Degraded";
  return "Offline";
}

function updateBackendTray(status) {
  if (!IS_MAC || !backendTray) return;
  backendTray.setToolTip(`Fintheon Backend: ${statusLabel(status.state)}`);
  backendTray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Backend: ${statusLabel(status.state)}`, enabled: false },
      { label: `URL: ${status.url}`, enabled: false },
      { label: `Last check: ${status.checkedAt}`, enabled: false },
      { label: `Logs: ${status.logsPath}`, enabled: false },
      { type: "separator" },
      {
        label: "Restart Backend",
        click: () => {
          updateBackendTray({
            ...status,
            state: "starting",
            detail: "Restart requested",
            checkedAt: new Date().toISOString(),
          });
          restartBackendEngine().catch((err) => {
            console.error("[BackendEngine] Restart failed:", err?.message);
            notifyBackendEngineStatus();
          });
        },
      },
      {
        label: "Open Logs",
        click: () => shell.openPath(status.logsPath).catch(() => {}),
      },
      {
        label: "Open Fintheon",
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow(currentApiBase);
          }
        },
      },
    ]),
  );
}

function installBackendTray() {
  if (!IS_MAC || backendTray) return;
  backendTray = new Tray(nativeImage.createEmpty());
  backendTray.setTitle("FT");
  backendTray.on("click", () => notifyBackendEngineStatus());
  notifyBackendEngineStatus();
  setInterval(() => notifyBackendEngineStatus(), 15000);
}

/** Poll lockout + RiskFlow and update dock menu / fire notifications */
function startPolling() {
  if (dockMenuPollInterval) clearInterval(dockMenuPollInterval);
  if (riskflowPollInterval) clearInterval(riskflowPollInterval);

  // Lockout poll — 5s interval
  dockMenuPollInterval = setInterval(async () => {
    const status = await fetchLockoutStatus();
    if (!status) return;

    updateDockMenu(status);

    // Lockout expiry notification + lock-screen broadcast
    const currentLocked = !!status.locked;
    if (lastDockLockState === true && currentLocked === false) {
      try {
        const n = new Notification({
          title: "Trading Lockout Expired",
          body: "Your trading lockout has expired. Trading is now enabled.",
        });
        n.show();
      } catch (err) {
        console.error("[DockMenu] Expiry notification failed:", err.message);
      }
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("lock-screen:hide");
        }
      } catch {}
    }
    if (lastDockLockState === false && currentLocked === true) {
      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("lock-screen:show");
        }
      } catch {}
    }
    lastDockLockState = currentLocked;
  }, 5000);

  // RiskFlow high-IV poll — 60s interval
  riskflowPollInterval = setInterval(async () => {
    try {
      const feed = await fetchRiskFlowFeed();
      if (!feed || !Array.isArray(feed.items)) return;

      for (const item of feed.items) {
        const ivScore = item.ivScore ?? item.iv_score ?? 0;
        if (ivScore >= 8.5 && !notifiedHighIvIds.has(item.id)) {
          notifiedHighIvIds.add(item.id);
          const headline = item.headline ?? item.title ?? "High-IV alert";
          const symbol = item.symbols
            ? Array.isArray(item.symbols)
              ? item.symbols.slice(0, 3).join(", ")
              : String(item.symbols)
            : "";
          const prefix = symbol ? `[${symbol}] ` : "";
          try {
            const n = new Notification({
              title: `High-IV Alert (${ivScore.toFixed(1)})`,
              body: `${prefix}${headline}`,
            });
            n.show();
          } catch (err) {
            console.error("[RiskFlowNotify] Notification failed:", err.message);
          }
        }
      }

      // Prune set to last 200 to avoid unbounded growth
      if (notifiedHighIvIds.size > 200) {
        const arr = Array.from(notifiedHighIvIds);
        notifiedHighIvIds = new Set(arr.slice(arr.length - 200));
      }
    } catch (err) {
      console.error("[RiskFlowNotify] Poll failed:", err.message);
    }
  }, 60000);
}

function stopPolling() {
  if (dockMenuPollInterval) {
    clearInterval(dockMenuPollInterval);
    dockMenuPollInterval = null;
  }
  if (riskflowPollInterval) {
    clearInterval(riskflowPollInterval);
    riskflowPollInterval = null;
  }
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

  if (IS_MAC) {
    const launched = ensureBackendLaunchAgent();
    if (launched.ok) {
      console.log("[Electron] Backend LaunchAgent loaded");
      if (await waitForBackendHealthy(12000)) {
        backendOwnedByApp = false;
        return { ok: true, detail: "launchd" };
      }
      console.warn("[Electron] LaunchAgent loaded but backend is not healthy");
    } else {
      console.warn(
        "[Electron] Backend LaunchAgent unavailable:",
        launched.detail,
      );
    }
  }

  const repoRoot = app.isPackaged
    ? path.join(require("os").homedir(), "Documents", "Fintheon")
    : path.join(__dirname, "..");
  const backendDir = path.join(repoRoot, "backend-hono");
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
  const nodeBin = app.isPackaged ? "/opt/homebrew/bin/node" : "node";
  backendProcess = spawn(nodeBin, [distEntry], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: runtimeNodeEnv,
      FINTHEON_DESKTOP: "true",
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

  backendProcess.on("exit", (code, signal) => {
    console.log("[Electron] Backend exited with code", code, "signal", signal);
    // [claude-code 2026-04-25] S35: log unexpected backend exits to crash.log so
    // the auto-close diagnostic has the upstream cause if it was the backend dying.
    if (code !== 0 || signal) {
      logCrash("backend-exit", {
        code,
        signal,
        ownedByApp: backendOwnedByApp,
      });
    }
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
/*  In-app updater: check -> background download -> installed asset     */
/* ------------------------------------------------------------------ */

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

    // Plane (project management)
    if (host === "app.plane.so") return true;
    if (host.endsWith(".plane.so")) return true;

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

function createWindow(apiBase) {
  // [claude-code 2026-04-23] Windows: use titleBarOverlay for Win 11 frameless chrome
  // that inherits Solvys palette (BG #050402, accent #c79f4a). macOS keeps the
  // native traffic-light chrome — no override needed.
  const windowsChrome = IS_WIN
    ? {
        titleBarStyle: "hidden",
        titleBarOverlay: {
          color: "#050402",
          symbolColor: "#f0ead6",
          height: 28,
        },
        backgroundColor: "#050402",
        autoHideMenuBar: true,
      }
    : {};

  // [claude-code 2026-04-24] apiBase is resolved by the caller in app.whenReady().
  // Mac defaults to localhost:8080 when a local backend is healthy, falls back
  // to fintheon.fly.dev when it isn't. Windows always hits Fly. The prior
  // behavior of unconditionally pinning Mac to localhost left the chat UI
  // hanging on "Model inference · 121ms" whenever launchd was down.
  const resolvedApiBase =
    apiBase || (IS_WIN ? REMOTE_BACKEND_URL : "http://localhost:8080");
  currentApiBase = resolvedApiBase;

  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    title: "Fintheon",
    ...windowsChrome,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      nativeWindowOpen: true,
      additionalArguments: [
        `--fintheon-api-base=${resolvedApiBase}`,
        `--fintheon-platform=${process.platform}`,
      ],
    },
  });

  // Auto-grant mic/speaker + related media permissions to the shared Fintheon
  // partition so app-native voice can start without repeated prompts.
  try {
    const { session: electronSession } = require("electron");
    const voiceSession = electronSession.fromPartition("persist:fintheon");
    voiceSession.setPermissionRequestHandler((_wc, permission, cb) => {
      const allowed = new Set([
        "media",
        "audioCapture",
        "videoCapture",
        "display-capture",
        "mediaKeySystem",
      ]);
      cb(allowed.has(permission));
    });
    voiceSession.setPermissionCheckHandler((_wc, permission) => {
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

  // [claude-code 2026-05-12] TopStepX PWA Blocker — session-level webRequest guard.
  // Blocks navigation to blocked domains in ALL Electron sessions (default + persist:fintheon).
  // Uses a callback filter so domain list changes take effect without re-registration.
  // This catches PWAs loaded inside the app, iframes, and webviews.
  try {
    const { session: electronSession } = require("electron");
    const blockTargets = [
      electronSession.defaultSession,
      electronSession.fromPartition("persist:fintheon"),
    ];
    const isBlocked = loadBlockedDomains();
    for (const sess of blockTargets) {
      sess.webRequest.onBeforeRequest(
        { urls: ["*://*/*"] },
        (details, callback) => {
          if (
            !fastBlockerEnabled &&
            !(readHostsBlocked() || readResolverBlocked())
          ) {
            callback({ cancel: false });
            return;
          }
          const domains = loadBlockedDomains();
          if (domains.length === 0) {
            callback({ cancel: false });
            return;
          }
          let host;
          try {
            host = new URL(details.url).hostname.toLowerCase();
          } catch {
            callback({ cancel: false });
            return;
          }
          const blocked = domains.some(
            (d) => host === d || host.endsWith("." + d),
          );
          callback(
            blocked ? { redirectURL: BLOCKED_PAGE_URL } : { cancel: false },
          );
        },
      );
    }
    console.log(
      "[Blocker] webRequest filter installed (callback-based, dynamic domain list).",
    );
  } catch (err) {
    console.warn("[Blocker] Failed to install webRequest filter:", err);
  }

  // [claude-code 2026-04-26] S46: TV Calendar Final Integration.
  // Intercept .ics downloads from tradingview.com (any path/suffix), POST the
  // body to our Desk Calendar ingest endpoint, then delete the temp file.
  // Cross-origin DOM access is blocked, but download interception is not —
  // session.on('will-download') fires regardless of which iframe triggered it.
  try {
    const { session: electronSession } = require("electron");
    const targets = [
      electronSession.defaultSession,
      electronSession.fromPartition("persist:fintheon"),
    ];
    const apiBase = process.env.FINTHEON_API_BASE || "http://127.0.0.1:8080";
    for (const sess of targets) {
      sess.on("will-download", (_evt, item) => {
        let host = "";
        let pathname = "";
        try {
          const u = new URL(item.getURL());
          host = u.hostname;
          pathname = u.pathname.toLowerCase();
        } catch {
          return;
        }
        const isTV = host.endsWith("tradingview.com");
        const looksLikeIcs =
          pathname.includes("/calendar") ||
          pathname.endsWith(".ics") ||
          item.getMimeType() === "text/calendar" ||
          item.getFilename().toLowerCase().endsWith(".ics");
        if (!isTV || !looksLikeIcs) return;
        const tmpFile = path.join(
          require("os").tmpdir(),
          `fintheon-tv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ics`,
        );
        try {
          item.setSavePath(tmpFile);
        } catch (err) {
          console.warn("[DeskCal] setSavePath failed:", err);
          return;
        }
        // [claude-code 2026-04-27] S46.4: emit IPC events to the renderer so
        // the TradingViewCalendar surface can show a green "Saving event…"
        // status and a success toast — no Google Calendar window, no chooser
        // dialog, no app-leaving navigation. The .ics is captured silently
        // by setSavePath above.
        const sendStatus = (channel, payload) => {
          try {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send(channel, payload ?? {});
            }
          } catch {
            /* renderer torn down; nothing to send */
          }
        };
        sendStatus("desk-calendar:saving");
        item.once("done", async (_e, state) => {
          if (state !== "completed") {
            sendStatus("desk-calendar:failed", { reason: state });
            fs.promises.unlink(tmpFile).catch(() => {});
            return;
          }
          try {
            const ics = await fs.promises.readFile(tmpFile, "utf8");
            const res = await fetch(`${apiBase}/api/desk/calendar/ingest-ics`, {
              method: "POST",
              headers: { "Content-Type": "text/calendar" },
              body: ics,
            });
            if (res.ok) {
              const body = await res.json().catch(() => ({}));
              const ingested = Number(body.ingested ?? 0);
              const first = Array.isArray(body.events) ? body.events[0] : null;
              console.log(
                `[DeskCal] Ingested ${ingested} TV event(s) into desk queue.`,
              );
              sendStatus("desk-calendar:saved", {
                ingested,
                title: first?.title ?? null,
                starts_at: first?.starts_at ?? null,
                queueCount: Number(body.queueCount ?? 0),
              });
            } else {
              console.warn(
                `[DeskCal] Ingest failed: ${res.status} ${res.statusText}`,
              );
              sendStatus("desk-calendar:failed", {
                reason: `${res.status} ${res.statusText}`,
              });
            }
          } catch (err) {
            console.warn("[DeskCal] Ingest error:", err);
            sendStatus("desk-calendar:failed", {
              reason: err instanceof Error ? err.message : String(err),
            });
          } finally {
            fs.promises.unlink(tmpFile).catch(() => {});
          }
        });
      });
    }
    console.log(
      "[DeskCal] TV .ics download interceptor armed (defaultSession + persist:fintheon).",
    );
  } catch (err) {
    console.warn("[DeskCal] Failed to arm download interceptor:", err);
  }

  installDeskCalendarClickCapture({
    win,
    getApiBase: () => currentApiBase || resolvedApiBase,
  });

  const rendererPath = path.join(
    __dirname,
    "..",
    "frontend",
    "dist",
    "index.html",
  );
  win.loadFile(rendererPath);
  mainWindow = win;

  // [claude-code 2026-04-25] S35: log the BrowserWindow close trigger so a
  // user-clicked X, a Cmd+W, an IPC-driven close, or a renderer-initiated
  // window.close() are all distinguishable in crash.log.
  win.on("close", (_event) => {
    closeReason = closeReason ?? "browserwindow-close";
    logCrash("browserwindow-close", {
      isFocused: win.isFocused?.() ?? null,
      isVisible: win.isVisible?.() ?? null,
    });
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    closeReason =
      closeReason ?? `renderer-gone:${details?.reason ?? "unknown"}`;
  });

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

  // [claude-code 2026-04-24] Decide the API base *after* we try to bring the
  // local backend up. If it never goes healthy (e.g. launchd boot-assert on
  // BYPASS_AUTH, or the user's ~/Documents/Fintheon tree doesn't exist), fall
  // back to fintheon.fly.dev so the chat UI still works. Windows already
  // always uses the remote.
  let localBackendHealthy = false;
  const cfg = readStartupConfig();
  if (cfg.backendAutostart) {
    const startResult = await startBackend();
    if (!startResult.ok) {
      console.error("[Electron] Backend failed to start:", startResult.detail);
    } else {
      localBackendHealthy = await waitForBackendHealthy(15000);
      if (!localBackendHealthy) {
        console.warn("[Electron] Backend did not become healthy within 15s");
      } else {
        // [claude-code 2026-04-16] Refresh tokens + disarm idle shutdown on app open
        await onBackendReady();
      }
    }
  } else {
    console.log("[Electron] Backend autostart disabled — skipping");
    localBackendHealthy = await isBackendAlive();
  }

  const apiBase = IS_WIN
    ? REMOTE_BACKEND_URL
    : localBackendHealthy
      ? "http://localhost:8080"
      : REMOTE_BACKEND_URL;
  console.log(
    `[Electron] Renderer api-base resolved to ${apiBase} (local healthy: ${localBackendHealthy})`,
  );
  createWindow(apiBase);
  installBackendTray();

  // [claude-code 2026-05-13] S63 T3: Start dock menu + notification polling
  if (IS_MAC && localBackendHealthy) {
    // Do an initial dock menu build even before the first poll fires
    fetchLockoutStatus().then((status) => {
      if (status) updateDockMenu(status);
    });
    startPolling();
    console.log("[DockMenu] Polling started (lockout 5s, RiskFlow 60s)");
  }

  // Forward any pending auth URL AFTER the renderer finishes loading
  // (sending before did-finish-load means the IPC message is lost)
  if (mainWindow) {
    mainWindow.webContents.on("did-finish-load", () => {
      if (pendingAuthUrl) {
        console.log("[Electron] Forwarding pending auth URL:", pendingAuthUrl);
        mainWindow.webContents.send("auth-callback", pendingAuthUrl);
        pendingAuthUrl = null;
      }
      // [claude-code 2026-05-01] Post-update success toast: install script
      // drops just-updated.json before reopening; consume + delete it here.
      try {
        const marker = path.join(app.getPath("userData"), "just-updated.json");
        if (fs.existsSync(marker)) {
          const payload = JSON.parse(fs.readFileSync(marker, "utf8"));
          mainWindow.webContents.send("update-just-installed", {
            version: payload.version ?? app.getVersion(),
          });
          fs.unlinkSync(marker);
        }
      } catch (err) {
        console.warn("[Updater] marker consume failed:", err?.message);
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
      let localHealthy = false;
      if (cfg.backendAutostart) {
        const startResult = await startBackend();
        if (startResult.ok) {
          localHealthy = await waitForBackendHealthy(15000);
          if (localHealthy) await onBackendReady();
        }
      } else {
        localHealthy = await isBackendAlive();
      }
      const apiBase = IS_WIN
        ? REMOTE_BACKEND_URL
        : localHealthy
          ? "http://localhost:8080"
          : REMOTE_BACKEND_URL;
      createWindow(apiBase);
    }
  });
});

// [claude-code 2026-04-16] Smart shutdown: kill if app-owned, arm idle timeout if routine-owned
app.on("window-all-closed", () => {
  stopPolling();
  console.log("[Electron] All windows closed; backend engine remains running");
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  console.log(
    "[Electron] App quitting; backend engine remains managed by launchd",
  );
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

// In-app updater IPC handlers (background download flow)
ipcMain.handle("update-check", async () => {
  return await updateManager.checkForDesktopUpdate();
});

ipcMain.handle("update-download", async () => {
  const info = await updateManager.checkForDesktopUpdate();
  if (!info.ok || !info.updateAvailable || !info.latest) {
    return { ok: false, reason: info.reason ?? "no update available" };
  }
  return await updateManager.downloadUpdate(info.latest);
});

ipcMain.handle("update-install", async () => {
  deferredUpdateOnClose = false;
  return await updateManager.installUpdate();
});

ipcMain.handle("update-defer-until-close", async () => {
  deferredUpdateOnClose = false;
  return { ok: true, deferred: true };
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
  if (backendOwnedByApp) return await stopBackend();
  return { ok: true, detail: "persistent backend engine left running" };
});

ipcMain.handle("is-backend-alive", async () => {
  return { alive: await isBackendAlive() };
});

ipcMain.handle("backend-engine:status", async () => {
  return await backendEngineStatus();
});

ipcMain.handle("backend-engine:restart", async () => {
  return await restartBackendEngine();
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

/* ------------------------------------------------------------------ */
/*  S66 T2: Lockout accessibility + lock screen IPC                  */
/* ------------------------------------------------------------------ */

ipcMain.handle("lockout:check-accessibility", () => {
  if (!app.isPackaged) return { granted: false, reason: "dev-mode" };
  if (!IS_MAC) return { granted: true };
  try {
    const granted = systemPreferences.isTrustedAccessibilityClient(false);
    return { granted };
  } catch {
    return { granted: false };
  }
});

ipcMain.handle("lockout:request-accessibility", () => {
  if (!app.isPackaged) return { granted: false, reason: "dev-mode" };
  if (!IS_MAC) return { granted: true };
  try {
    const granted = systemPreferences.isTrustedAccessibilityClient(true);
    return { granted };
  } catch {
    return { granted: false };
  }
});

/* ------------------------------------------------------------------ */
/*  S63 T3: Dock menu + notification IPC handlers                    */
/* ------------------------------------------------------------------ */

// Renderer sends system toast notifications (RiskFlow, lockout, etc.)
ipcMain.handle("system-notification:show", (_event, { title, body }) => {
  try {
    const n = new Notification({ title, body });
    n.show();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// [claude-code 2026-05-13] S64 T3: Lockout OS notification — "touch grass, kid."
ipcMain.on("show-lockout-notification", () => {
  try {
    const n = new Notification({
      title: "touch grass, kid.",
      body: "this app has been blocked by the agentic desk. see you next session!",
    });
    n.show();
  } catch (err) {
    console.error("[Lockout] Notification failed:", err.message);
  }
});

// Renderer persists the quick access URL to main process for dock menu
ipcMain.on("quick-access:set-url", (_event, url) => {
  dockQuickAccessUrl = typeof url === "string" ? url : "";
});

/* ------------------------------------------------------------------ */
/*  Harper Vision IPC handlers [claude-code 2026-04-23]              */
/* ------------------------------------------------------------------ */

ipcMain.handle("harper-vision:capture-screen", async () => {
  if (!harperVisionScreen) {
    return { ok: false, error: "Harper Vision is macOS-only" };
  }
  try {
    const result = await harperVisionScreen.captureOnce();
    return result || { ok: false, error: "Capture failed" };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("harper-vision:capture-window", async (_event, sourceId) => {
  if (!harperVisionScreen) {
    return { ok: false, error: "Harper Vision is macOS-only" };
  }
  try {
    return await harperVisionScreen.captureSource(sourceId);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("harper-vision:get-sources", async () => {
  if (!harperVisionScreen) return [];
  try {
    return await harperVisionScreen.getSources();
  } catch (err) {
    return [];
  }
});

ipcMain.handle("harper-vision:start-capture", async (_event, sessionId) => {
  if (!harperVisionScreen || !harperVisionAudio) {
    return { ok: false, error: "Harper Vision is macOS-only" };
  }
  try {
    const result = await harperVisionScreen.start(sessionId);
    await harperVisionAudio.start(sessionId);
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("harper-vision:stop-capture", async () => {
  if (!harperVisionScreen || !harperVisionAudio) {
    return { ok: true, screen: null, audio: null, unsupported: true };
  }
  try {
    const screenResult = harperVisionScreen.stop();
    const audioResult = harperVisionAudio.stop();
    return { ok: true, screen: screenResult, audio: audioResult };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("harper-vision:get-status", async () => {
  if (!harperVisionScreen || !harperVisionAudio) {
    return {
      screen: {
        isCapturing: false,
        sessionId: null,
        frameCounter: 0,
        intervalMs: 0,
      },
      audio: { isRecording: false, sessionId: null, mode: "unsupported" },
      privacyMode: false,
    };
  }
  return {
    screen: harperVisionScreen.status(),
    audio: harperVisionAudio.status(),
    privacyMode: harperVisionScreen.privacyMode === true,
  };
});

// [claude-code 2026-04-23] S32-T2 Harper Vision — privacy mode persistence
const HV_PRIVACY_PATH = path.join(
  app.getPath("userData"),
  "harper-vision-privacy.json",
);

function readHarperVisionPrivacy() {
  try {
    if (fs.existsSync(HV_PRIVACY_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(HV_PRIVACY_PATH, "utf8"));
      return !!parsed.enabled;
    }
  } catch {}
  return false;
}

function writeHarperVisionPrivacy(enabled) {
  try {
    fs.writeFileSync(
      HV_PRIVACY_PATH,
      JSON.stringify({ enabled: !!enabled }, null, 2),
      "utf8",
    );
  } catch (err) {
    console.error(
      "[HarperVision] Failed to persist privacy flag:",
      err.message,
    );
  }
}

function applyHarperVisionPrivacy(enabled) {
  if (harperVisionScreen) harperVisionScreen.setPrivacyMode(enabled);
  if (harperVisionAudio) harperVisionAudio.setPrivacyMode(enabled);
}

// Apply persisted flag on startup so capture respects it before the UI mounts
if (IS_MAC) applyHarperVisionPrivacy(readHarperVisionPrivacy());

ipcMain.handle("harper-vision:set-privacy-mode", async (_event, enabled) => {
  const flag = !!enabled;
  applyHarperVisionPrivacy(flag);
  writeHarperVisionPrivacy(flag);
  return { ok: true, privacyMode: flag };
});

ipcMain.handle("harper-vision:get-privacy-mode", async () => {
  return { privacyMode: readHarperVisionPrivacy() };
});

// S38-T1: Cmd+K menu shortcut bridge — allow renderer to unregister/re-register
// the Cmd+K accelerator so the command palette captures it.
let savedShortcuts = {};
ipcMain.handle("menu:unregister-shortcut", (_event, shortcut) => {
  try {
    const menu = require("electron").Menu.getApplicationMenu();
    if (!menu) return { ok: false, reason: "no application menu" };
    const items = menu.items;
    for (const item of items) {
      if (item.accelerator === shortcut) {
        savedShortcuts[shortcut] = item.accelerator;
        item.accelerator = null;
        require("electron").Menu.setApplicationMenu(menu);
        return { ok: true };
      }
      // Search submenus
      if (item.submenu) {
        for (const sub of item.submenu.items) {
          if (sub.accelerator === shortcut) {
            savedShortcuts[shortcut] = {
              parent: item,
              sub: sub,
              accel: sub.accelerator,
            };
            sub.accelerator = null;
            require("electron").Menu.setApplicationMenu(menu);
            return { ok: true };
          }
        }
      }
    }
    return { ok: false, reason: "shortcut not found in menu" };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle("menu:register-shortcut", (_event, shortcut) => {
  try {
    const saved = savedShortcuts[shortcut];
    if (!saved) return { ok: false, reason: "no saved shortcut state" };
    const menu = require("electron").Menu.getApplicationMenu();
    if (!menu) return { ok: false, reason: "no application menu" };
    if (saved.sub) {
      saved.sub.accelerator = saved.accel;
    } else {
      for (const item of menu.items) {
        if (item.accelerator === null && saved === shortcut) {
          item.accelerator = shortcut;
          break;
        }
      }
    }
    require("electron").Menu.setApplicationMenu(menu);
    delete savedShortcuts[shortcut];
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

// [claude-code 2026-05-12] TopStepX PWA Blocker — system-level IPC handlers
// Layer 1: /etc/hosts (zero-config block on standard macOS)
// Layer 2: /etc/resolver/ (per-domain DNS override for systems with custom DNS resolvers)
// Layer 3: Electron webRequest (blocks in-app, see createWindow() for registration)
/* ------------------------------------------------------------------ */
const BLOCKER_MARKER_START = "# FINTHEON-BLOCKER-START";
const BLOCKER_MARKER_END = "# FINTHEON-BLOCKER-END";
const RESOLVER_DIR = "/etc/resolver";

/** Build the /etc/hosts block entries from a domain list */
function buildHostsBlockEntries(domains) {
  const lines = domains.map((d) => `0.0.0.0 ${d}`);
  return [BLOCKER_MARKER_START, ...lines, BLOCKER_MARKER_END].join("\n");
}

/** Get unique eTLD+1 domains from a domain list (for /etc/resolver/ files) */
function getEtldPlusOne(domains) {
  return Array.from(
    new Set(
      domains.map((d) => {
        const parts = d.split(".");
        return parts.length >= 2 ? parts.slice(-2).join(".") : d;
      }),
    ),
  );
}

/** Flush macOS DNS cache */
function flushDns() {
  try {
    execFileSync("dscacheutil", ["-flushcache"], { timeout: 5000 });
    execFileSync("killall", ["-HUP", "mDNSResponder"], { timeout: 5000 });
  } catch {}
}

/** Run a shell command with sudo via osascript (standard macOS auth dialog) */
function sudoRun(command) {
  const script = `do shell script "${command.replace(/"/g, '\\"')}" with administrator privileges`;
  return execFileSync("osascript", ["-e", script], { timeout: 30000 });
}

/** Read /etc/hosts and check for blocker markers */
function readHostsBlocked() {
  try {
    const hosts = fs.readFileSync("/etc/hosts", "utf8");
    return hosts.includes(BLOCKER_MARKER_START);
  } catch {
    return false;
  }
}

/** Check resolver dir exists with at least one resolver file for known resolver domains */
function readResolverBlocked() {
  try {
    if (!fs.existsSync(RESOLVER_DIR)) return false;
    const files = fs.readdirSync(RESOLVER_DIR);
    const resolverDomains = getEtldPlusOne(loadBlockedDomains());
    return resolverDomains.some((domain) => files.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Enable blocking: writes /etc/hosts entries AND creates /etc/resolver/ overrides.
 * The resolver files force macOS to use 127.0.0.1 for DNS on just these domains,
 * which takes priority over system-wide custom resolvers (Control D, NextDNS, etc.).
 */
function enableBlocking() {
  if (IS_WIN) return { ok: false, reason: "blocker is macOS-only" };
  const domains = loadBlockedDomains();
  if (domains.length === 0)
    return { ok: false, reason: "no domains configured" };

  // Layer 1: /etc/hosts
  let hostsResult = "noop";
  if (!readHostsBlocked()) {
    const entries = buildHostsBlockEntries(domains);
    const current = fs.readFileSync("/etc/hosts", "utf8");
    const updated = current.trimEnd() + "\n\n" + entries + "\n";
    const escaped = updated.replace(/"/g, '\\"').replace(/\n/g, "\\n");
    sudoRun(`printf '%b' '${escaped}' > /etc/hosts`);
    hostsResult = "written";
  }

  // Layer 2: /etc/resolver/ per-domain overrides
  let resolverResult = "noop";
  const etld = getEtldPlusOne(domains);
  const commands = [`mkdir -p ${RESOLVER_DIR}`];
  for (const domain of etld) {
    commands.push(`echo 'nameserver 127.0.0.1' > ${RESOLVER_DIR}/${domain}`);
  }
  sudoRun(commands.join(" && "));
  resolverResult = "written";

  flushDns();
  return {
    ok: true,
    hosts: hostsResult,
    resolver: resolverResult,
    domainCount: domains.length,
  };
}

/**
 * Disable blocking: removes /etc/hosts entries AND removes /etc/resolver/ overrides.
 */
function disableBlocking() {
  if (IS_WIN) return { ok: false, reason: "blocker is macOS-only" };

  // Layer 1: /etc/hosts
  let hostsResult = "noop";
  if (readHostsBlocked()) {
    const current = fs.readFileSync("/etc/hosts", "utf8");
    const startIdx = current.indexOf(BLOCKER_MARKER_START);
    const endIdx = current.indexOf(BLOCKER_MARKER_END);
    if (startIdx !== -1 && endIdx !== -1) {
      const updated =
        current.slice(0, startIdx - 1).trimEnd() +
        "\n" +
        current.slice(endIdx + BLOCKER_MARKER_END.length + 1).trimStart();
      const escaped = updated.replace(/"/g, '\\"').replace(/\n/g, "\\n");
      sudoRun(`printf '%b' '${escaped}' > /etc/hosts`);
      hostsResult = "removed";
    }
  }

  // Layer 2: /etc/resolver/ removals — remove only files for the active block list.
  let resolverResult = "noop";
  try {
    if (fs.existsSync(RESOLVER_DIR)) {
      const resolverDomains = getEtldPlusOne(loadBlockedDomains());
      const files = fs
        .readdirSync(RESOLVER_DIR)
        .filter((file) => resolverDomains.includes(file));
      if (files.length > 0) {
        const removeCmds = files.map((f) => `rm -f ${RESOLVER_DIR}/${f}`);
        sudoRun(removeCmds.join(" && "));
      }
    }
    resolverResult = "removed";
  } catch {}

  flushDns();
  return { ok: true, hosts: hostsResult, resolver: resolverResult };
}

ipcMain.handle("blocker:status", async () => {
  if (IS_WIN)
    return { ok: true, blocked: false, reason: "blocker is macOS-only" };
  try {
    const hostsBlocked = readHostsBlocked();
    const resolverBlocked = readResolverBlocked();
    const blocked = hostsBlocked || resolverBlocked || fastBlockerEnabled;
    const domains = loadBlockedDomains();
    return {
      ok: true,
      blocked,
      layers: {
        hosts: hostsBlocked,
        resolver: resolverBlocked,
        runtime: fastBlockerEnabled,
      },
      domains,
    };
  } catch (err) {
    return { ok: false, blocked: false, reason: err.message };
  }
});

ipcMain.handle("blocker:get-domains", async () => {
  try {
    return { ok: true, domains: loadBlockedDomains() };
  } catch (err) {
    return {
      ok: false,
      domains: [...DEFAULT_BLOCKED_DOMAINS],
      reason: err.message,
    };
  }
});

ipcMain.handle("blocker:set-domains", async (_event, domains) => {
  if (!Array.isArray(domains)) {
    return { ok: false, reason: "domains must be an array" };
  }
  const cleaned = domains
    .map((d) => {
      if (typeof d !== "string") return null;
      // Strip protocol, path, trailing slash, whitespace
      let s = d.trim().toLowerCase();
      s = s.replace(/^https?:\/\//, "");
      s = s.replace(/\/.*$/, "");
      s = s.replace(/^www\./, "");
      return s || null;
    })
    .filter(Boolean);
  const unique = Array.from(new Set(cleaned));
  if (unique.length === 0) {
    return { ok: false, reason: "at least one valid domain required" };
  }
  saveBlockedDomains(unique);
  // Keep domain updates passwordless during runtime lock cycles.
  // webRequest reads domains dynamically, so it picks up changes instantly.
  return { ok: true, domains: unique };
});

ipcMain.handle("blocker:enable", async () => {
  if (IS_WIN) return { ok: false, reason: "blocker is macOS-only" };
  try {
    return enableBlocking();
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});

ipcMain.handle("blocker:enable-fast", async () => {
  fastBlockerEnabled = true;
  return { ok: true, mode: "runtime" };
});

ipcMain.handle("blocker:disable-fast", async () => {
  fastBlockerEnabled = false;
  return { ok: true, mode: "runtime" };
});

ipcMain.handle("blocker:disable", async () => {
  if (IS_WIN) return { ok: false, reason: "blocker is macOS-only" };
  try {
    fastBlockerEnabled = false;
    if (!readHostsBlocked() && !readResolverBlocked()) {
      return { ok: true, hosts: "noop", resolver: "noop", mode: "runtime" };
    }
    return disableBlocking();
  } catch (err) {
    return { ok: false, reason: err.message };
  }
});
