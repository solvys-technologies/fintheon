// [claude-code 2026-02-26] Ensure OAuth popups work for embedded webviews.
// [claude-code 2026-03-11] Auto-start backend on app init.

// [claude-code 2026-03-16] Backend build fallback dialog, Discord OAuth popup support
const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const fs = require("fs");

let mainWindow = null;
let backendProcess = null;

function startBackend() {
  const backendDir = path.join(__dirname, "..", "backend-hono");
  const distEntry = path.join(backendDir, "dist", "index.js");

  if (!fs.existsSync(distEntry)) {
    console.warn("[Electron] Backend dist not found — attempting build...");
    try {
      execFileSync("npm", ["run", "build"], { cwd: backendDir, stdio: "inherit" });
      console.log("[Electron] Backend build succeeded");
    } catch (buildErr) {
      console.error("[Electron] Backend build failed:", buildErr.message);
      dialog.showErrorBox(
        "Backend Not Built",
        "The backend could not be compiled.\n\nRun manually:\n  cd backend-hono && npm run build\n\nThen relaunch the app."
      );
      return;
    }
  }

  console.log("[Electron] Starting backend server...");
  backendProcess = spawn("node", [distEntry], {
    cwd: backendDir,
    env: { ...process.env, NODE_ENV: "production" },
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
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log("[Electron] Stopping backend...");
    backendProcess.kill("SIGTERM");
    backendProcess = null;
  }
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

app.whenReady().then(() => {
  startBackend();
  createWindow();

  // Handle window.open from embedded <webview> tags.
  app.on("web-contents-created", (_event, contents) => {
    try {
      if (contents.getType && contents.getType() === "webview") {
        contents.setWindowOpenHandler(({ url }) => {
          if (shouldAllowInAppPopup(url)) {
            // Allow an in-app popup so the auth session stays in the same partition.
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
                },
              },
            };
          }

          // For non-auth links, open externally to avoid popup spam.
          shell.openExternal(url).catch(() => {});
          return { action: "deny" };
        });
      }
    } catch {
      // Best-effort only.
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});

ipcMain.handle("toggle-mini-widget", () => {
  // Placeholder for widget toggle behavior.
  return { ok: true };
});

// Pulse CLI: run shell command from project root and stream output to renderer
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
