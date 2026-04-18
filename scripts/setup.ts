#!/usr/bin/env bun
// [claude-code 2026-03-22] Fintheon CLI Setup Wizard — interactive onboarding for team use

import * as p from "@clack/prompts";
import pc from "picocolors";
import { resolve, join } from "path";
import { existsSync } from "fs";
import {
  isPortAvailable,
  isFintheonRunning,
  parseEnvFile,
  mergeEnvFile,
  waitForHealth,
  runCommand,
  commandExists,
  getVersion,
  validateOpenRouterKey,
} from "./setup-utils";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ROOT = resolve(import.meta.dir, "..");
const BACKEND_DIR = join(ROOT, "backend-hono");
const FRONTEND_DIR = join(ROOT, "frontend");
const ENV_EXAMPLE = join(BACKEND_DIR, ".env.example");
const ENV_FILE = join(BACKEND_DIR, ".env");
const FRONTEND_ENV = join(FRONTEND_DIR, ".env.local");
const DEFAULT_PORT = 8080;
const FLY_DEPLOYED_SUPABASE_DATABASE_URL =
  "postgresql://postgres:PIR0670963957%24@db.nrcfnzclbjboctptxaxx.supabase.co:5432/postgres";

/* ------------------------------------------------------------------ */
/*  Setup context — accumulated across steps                           */
/* ------------------------------------------------------------------ */

interface SetupContext {
  port: number;
  openRouterKey: string;
  openAiKey: string;
  databaseUrl: string;
  vproxyReady: boolean;
  hermesInstalled: boolean;
  backendRunning: boolean;
  backendAlreadyRunning: boolean;
}

const ctx: SetupContext = {
  port: DEFAULT_PORT,
  openRouterKey: "",
  openAiKey: "",
  databaseUrl: "",
  vproxyReady: false,
  hermesInstalled: false,
  backendRunning: false,
  backendAlreadyRunning: false,
};

/* ------------------------------------------------------------------ */
/*  Banner                                                             */
/* ------------------------------------------------------------------ */

function showBanner() {
  console.log("");
  console.log(pc.yellow("  ╔══════════════════════════════════════╗"));
  console.log(pc.yellow("  ║       FINTHEON SETUP WIZARD          ║"));
  console.log(pc.yellow("  ║   Priced In Capital Trading System   ║"));
  console.log(pc.yellow("  ╚══════════════════════════════════════╝"));
  console.log("");
}

/* ------------------------------------------------------------------ */
/*  Step A: Check prerequisites                                        */
/* ------------------------------------------------------------------ */

async function checkPrerequisites() {
  const s = p.spinner();
  s.start("Checking prerequisites");

  const bunVersion = await getVersion("bun");
  const nodeVersion = await getVersion("node");
  const gitVersion = await getVersion("git");

  s.stop("Prerequisites checked");

  const results: { name: string; version: string | null; required: boolean }[] =
    [
      { name: "bun", version: bunVersion, required: true },
      { name: "node", version: nodeVersion, required: true },
      { name: "git", version: gitVersion, required: true },
    ];

  for (const r of results) {
    if (r.version) {
      p.log.success(`${pc.green("✓")} ${r.name} ${pc.dim(r.version)}`);
    } else if (r.required) {
      p.log.error(`${pc.red("✗")} ${r.name} — not found`);
    }
  }

  // Validate Node 20+
  if (nodeVersion) {
    const major = parseInt(nodeVersion.replace(/^v/, ""), 10);
    if (major < 20) {
      p.log.warn(`Node ${nodeVersion} detected — Node 20+ recommended`);
    }
  }

  const missing = results.filter((r) => r.required && !r.version);
  if (missing.length > 0) {
    p.log.error(`Missing: ${missing.map((m) => m.name).join(", ")}`);
    p.log.info("Install with: brew install bun node git");
    p.cancel("Cannot continue without prerequisites.");
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/*  Step B: Install dependencies                                       */
/* ------------------------------------------------------------------ */

async function installDependencies() {
  const workspaces = [
    { name: "root", dir: ROOT },
    { name: "frontend", dir: FRONTEND_DIR },
    { name: "backend-hono", dir: BACKEND_DIR },
  ];

  for (const ws of workspaces) {
    if (!existsSync(join(ws.dir, "package.json"))) {
      p.log.warn(`Skipping ${ws.name} — no package.json`);
      continue;
    }

    const s = p.spinner();
    s.start(`Installing ${ws.name} dependencies`);
    const result = await runCommand("bun", ["install"], { cwd: ws.dir });
    if (result.ok) {
      s.stop(`${ws.name} dependencies installed`);
    } else {
      s.stop(`${ws.name} install failed`);
      p.log.warn(result.stderr.slice(0, 200));
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Step C: Homebrew + Hermes                                          */
/* ------------------------------------------------------------------ */

async function installHermes() {
  // Check if Hermes is already installed
  const hermesExists = await commandExists("hermes");
  if (hermesExists) {
    const version = await getVersion("hermes");
    p.log.success(
      `${pc.green("✓")} Hermes already installed ${pc.dim(version ?? "")}`,
    );
    ctx.hermesInstalled = true;
    return;
  }

  const shouldInstall = await p.confirm({
    message: "Hermes CLI not found. Install via Homebrew?",
    initialValue: true,
  });

  if (p.isCancel(shouldInstall) || !shouldInstall) {
    p.log.info("Skipping Hermes — AI features will be limited");
    return;
  }

  // Check Homebrew
  const brewExists = await commandExists("brew");
  if (!brewExists) {
    p.log.warn("Homebrew not installed. Install it first:");
    p.log.info(
      '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
    );
    p.log.info("Then re-run: bun run setup");
    return;
  }

  const s = p.spinner();
  s.start("Installing Hermes via Homebrew (may take a minute)");

  const tap = await runCommand("brew", ["tap", "solvys-technologies/hermes"]);
  if (!tap.ok) {
    s.stop("Hermes tap failed");
    p.log.warn("Could not tap solvys-technologies/hermes");
    p.log.info("Non-fatal — backend runs without Hermes");
    return;
  }

  const install = await runCommand("brew", ["install", "hermes"]);
  if (install.ok) {
    s.stop("Hermes installed");
    ctx.hermesInstalled = true;
    const version = await getVersion("hermes");
    p.log.success(`${pc.green("✓")} Hermes ${pc.dim(version ?? "installed")}`);
  } else {
    s.stop("Hermes install failed");
    p.log.warn("Non-fatal — backend runs without Hermes");
  }
}

/* ------------------------------------------------------------------ */
/*  Step D: Collect API keys                                           */
/* ------------------------------------------------------------------ */

async function collectApiKeys() {
  p.log.info(
    pc.dim("API keys are stored in backend-hono/.env (never committed)"),
  );

  const existing = parseEnvFile(ENV_FILE);

  // --- OpenRouter API Key (optional fallback) ---
  if (existing.OPENROUTER_API_KEY) {
    const keep = await p.confirm({
      message: `OpenRouter key already configured (${pc.dim(existing.OPENROUTER_API_KEY.slice(0, 10) + "...")}). Keep it?`,
      initialValue: true,
    });
    if (p.isCancel(keep)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    if (keep) {
      ctx.openRouterKey = existing.OPENROUTER_API_KEY;
    }
  }

  if (!ctx.openRouterKey) {
    const maybeKey = await p.password({
      message: "OpenRouter API key (optional fallback, press Enter to skip):",
      validate: (v) => {
        if (!v) return;
        if (!v.startsWith("sk-or-")) return "Must start with sk-or-";
        if (v.length < 20) return "Key seems too short";
      },
    });

    if (p.isCancel(maybeKey)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }

    if (maybeKey) {
      const s = p.spinner();
      s.start("Validating OpenRouter fallback key");
      const valid = await validateOpenRouterKey(maybeKey);
      s.stop(
        valid
          ? "OpenRouter fallback key validated"
          : "OpenRouter key validation failed",
      );
      if (valid) {
        ctx.openRouterKey = maybeKey;
      } else {
        p.log.warn("Invalid OpenRouter key — skipping fallback provider");
      }
    }
  }

  // --- OpenAI API Key (optional — voice) ---
  if (existing.OPENAI_API_KEY) {
    p.log.success(`${pc.green("✓")} OpenAI key already configured`);
    ctx.openAiKey = existing.OPENAI_API_KEY;
  } else {
    const openAiKey = await p.text({
      message:
        "OpenAI API key (optional — for voice features, press Enter to skip):",
      placeholder: "sk-...",
      validate: (v) => {
        if (v && !v.startsWith("sk-")) return "Must start with sk-";
      },
    });
    if (p.isCancel(openAiKey)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    ctx.openAiKey = openAiKey || "";
  }

  // --- Database URL — NOT prompted (cloud backend handles persistence) ---
  if (existing.DATABASE_URL) {
    p.log.success(`${pc.green("✓")} Database URL already configured`);
    ctx.databaseUrl = existing.DATABASE_URL;
  }
}

/* ------------------------------------------------------------------ */
/*  Step E: Write .env files                                           */
/* ------------------------------------------------------------------ */

function writeEnvFiles() {
  const databaseUrl = ctx.databaseUrl || FLY_DEPLOYED_SUPABASE_DATABASE_URL;
  if (!ctx.databaseUrl) ctx.databaseUrl = databaseUrl;

  // Backend .env
  const updates: Record<string, string> = {
    BYPASS_AUTH: "true",
    DATABASE_URL: databaseUrl,
    USE_VPROXY_ANTHROPIC: "true",
    VPROXY_BASE_URL: "http://localhost:8317",
    VPROXY_API_KEY: "CLI_PROXY_API_KEY",
    VPROXY_ANTHROPIC_MODEL: "claude-opus-4.6",
    AI_PRIMARY_PROVIDER: "anthropic-vproxy",
  };

  if (ctx.openRouterKey) updates.OPENROUTER_API_KEY = ctx.openRouterKey;
  if (ctx.openAiKey) updates.OPENAI_API_KEY = ctx.openAiKey;
  if (ctx.port !== DEFAULT_PORT) updates.PORT = String(ctx.port);

  // If no .env exists, seed from .env.example first
  if (!existsSync(ENV_FILE) && existsSync(ENV_EXAMPLE)) {
    const { readFileSync, writeFileSync } = require("fs");
    writeFileSync(ENV_FILE, readFileSync(ENV_EXAMPLE, "utf8"), "utf8");
  }

  mergeEnvFile(ENV_FILE, updates);
  p.log.success(`${pc.green("✓")} backend-hono/.env updated`);

  // Frontend .env.local — only write if port differs or key needs injecting
  if (ctx.port !== DEFAULT_PORT || ctx.openRouterKey) {
    const frontendUpdates: Record<string, string> = {};
    if (ctx.port !== DEFAULT_PORT) {
      frontendUpdates.VITE_API_URL = `http://localhost:${ctx.port}`;
    }
    if (ctx.openRouterKey) {
      frontendUpdates.VITE_OPENROUTER_API_KEY = ctx.openRouterKey;
    }
    mergeEnvFile(FRONTEND_ENV, frontendUpdates);
    p.log.success(`${pc.green("✓")} frontend/.env.local updated`);
  }
}

/* ------------------------------------------------------------------ */
/*  Step F: VProxy Anthropic OAuth                                     */
/* ------------------------------------------------------------------ */

async function ensureVProxyOAuth() {
  const oauthScript = join(ROOT, "scripts", "vproxy-anthropic-oauth.sh");
  if (!existsSync(oauthScript)) {
    p.log.warn("VProxy OAuth helper script missing — run fintheon oauth later");
    return;
  }

  const shouldRun = await p.confirm({
    message: "Connect Anthropic subscription via VProxy now?",
    initialValue: true,
  });
  if (p.isCancel(shouldRun)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
  if (!shouldRun) {
    p.log.info("Skipping OAuth for now. Run later with: fintheon oauth");
    return;
  }

  const s = p.spinner();
  s.start("Launching VProxy Anthropic OAuth");
  const result = await runCommand("bash", [oauthScript, "--yes"], {
    cwd: ROOT,
  });
  if (result.ok) {
    s.stop("Anthropic OAuth complete");
    ctx.vproxyReady = true;
  } else {
    s.stop("Anthropic OAuth failed");
    p.log.warn("You can retry later with: fintheon oauth");
    if (result.stderr) p.log.warn(result.stderr.slice(0, 200));
  }
}

/* ------------------------------------------------------------------ */
/*  Step G: Port detection                                             */
/* ------------------------------------------------------------------ */

async function detectPort() {
  // Check if Fintheon is already running on default port
  const alreadyRunning = await isFintheonRunning(DEFAULT_PORT);
  if (alreadyRunning) {
    p.log.success(
      `${pc.green("✓")} Backend already running on :${DEFAULT_PORT}`,
    );
    ctx.port = DEFAULT_PORT;
    ctx.backendAlreadyRunning = true;
    return;
  }

  // Check if default port is available
  const available = await isPortAvailable(DEFAULT_PORT);
  if (available) {
    ctx.port = DEFAULT_PORT;
    p.log.success(`${pc.green("✓")} Port ${DEFAULT_PORT} available`);
    return;
  }

  // Port occupied by another service — offer alternatives
  p.log.warn(`Port ${DEFAULT_PORT} is occupied by another service`);

  const choice = await p.select({
    message: "Choose an alternative port:",
    options: [
      { value: 8081, label: "8081" },
      { value: 8082, label: "8082" },
      { value: 3001, label: "3001" },
      { value: 0, label: "Custom..." },
    ],
  });

  if (p.isCancel(choice)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  if (choice === 0) {
    const custom = await p.text({
      message: "Enter port number:",
      validate: (v) => {
        const n = parseInt(v, 10);
        if (isNaN(n) || n < 1024 || n > 65535)
          return "Enter a valid port (1024–65535)";
      },
    });
    if (p.isCancel(custom)) {
      p.cancel("Setup cancelled.");
      process.exit(0);
    }
    ctx.port = parseInt(custom, 10);
  } else {
    ctx.port = choice;
  }

  p.log.success(`Using port ${ctx.port}`);
}

/* ------------------------------------------------------------------ */
/*  Step H: Build & start backend                                      */
/* ------------------------------------------------------------------ */

async function buildAndStartBackend() {
  if (ctx.backendAlreadyRunning) {
    p.log.info("Backend already running — skipping build & start");
    ctx.backendRunning = true;
    return;
  }

  // Build
  const buildSpinner = p.spinner();
  buildSpinner.start("Building backend (tsc)");
  const buildResult = await runCommand("bun", ["run", "build"], {
    cwd: BACKEND_DIR,
  });
  if (!buildResult.ok) {
    buildSpinner.stop("Backend build failed");
    p.log.error(buildResult.stderr.slice(0, 300));
    p.log.info("Fix errors and re-run: bun run setup");
    return;
  }
  buildSpinner.stop("Backend built");

  // Start as detached child
  const startSpinner = p.spinner();
  startSpinner.start("Starting backend");

  const { spawn: spawnProcess } = require("child_process");
  const envPath = join(BACKEND_DIR, ".env");
  const child = spawnProcess("node", [join(BACKEND_DIR, "dist", "index.js")], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      NODE_ENV: "production",
      DOTENV_CONFIG_PATH: envPath,
      PORT: String(ctx.port),
    },
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  // Wait for health
  const health = await waitForHealth(
    `http://localhost:${ctx.port}/health`,
    10,
    2000,
  );
  if (health) {
    startSpinner.stop("Backend started");
    ctx.backendRunning = true;
  } else {
    startSpinner.stop("Backend did not respond to health check");
    p.log.warn("The backend process was started but may still be initializing");
    p.log.info(`Check manually: curl http://localhost:${ctx.port}/health`);
  }
}

/* ------------------------------------------------------------------ */
/*  Step I: Verify health                                              */
/* ------------------------------------------------------------------ */

async function verifyHealth() {
  if (!ctx.backendRunning) {
    p.log.warn("Backend not running — skipping health verification");
    return;
  }

  const s = p.spinner();
  s.start("Verifying services");

  const health = await waitForHealth(
    `http://localhost:${ctx.port}/health`,
    3,
    1000,
  );
  s.stop("Health check complete");

  if (!health) {
    p.log.warn("Could not reach health endpoint");
    return;
  }

  // Show component statuses
  if (health.components) {
    for (const [name, info] of Object.entries(health.components)) {
      const icon =
        info.status === "ok"
          ? pc.green("✓")
          : info.status === "degraded"
            ? pc.yellow("~")
            : pc.red("✗");
      p.log.info(`${icon} ${name}: ${info.detail ?? info.status}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Step J: Verify Hermes gateway                                      */
/* ------------------------------------------------------------------ */

async function verifyHermes() {
  if (!ctx.backendRunning) return;

  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/diagnostics`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const data = (await res.json()) as any;
    const hermes = data?.services?.find((s: any) => s.name?.includes("Hermes"));

    if (hermes?.status === "ok") {
      p.log.success(`${pc.green("✓")} Hermes AI gateway connected`);
    } else if (hermes) {
      // Try restarting
      const s = p.spinner();
      s.start("Restarting Hermes gateway");
      await fetch(
        `http://localhost:${ctx.port}/api/diagnostics/hermes/restart`,
        {
          method: "POST",
          signal: AbortSignal.timeout(10000),
        },
      );
      await new Promise((r) => setTimeout(r, 3000));
      s.stop("Hermes restart attempted");
    }
  } catch {
    // Non-fatal
  }
}

/* ------------------------------------------------------------------ */
/*  Step K: Harper welcome message                                     */
/* ------------------------------------------------------------------ */

async function triggerWelcome() {
  if (!ctx.backendRunning) {
    p.log.info(
      pc.dim("Skipping welcome message (backend or AI not available)"),
    );
    return;
  }

  const s = p.spinner();
  s.start("Harper is preparing your welcome");

  try {
    const res = await fetch(`http://localhost:${ctx.port}/api/setup/welcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      s.stop("Welcome received");

      if (data.message) {
        const truncated =
          data.message.length > 500
            ? data.message.slice(0, 500) + "..."
            : data.message;
        console.log("");
        console.log(pc.yellow("  Harper:"));
        console.log(pc.dim(`  "${truncated}"`));
        console.log("");
        if (data.message.length > 500) {
          p.log.info("Full message available in the Fintheon chat panel");
        }
      }
    } else {
      s.stop("Welcome endpoint not available");
      p.log.info(pc.dim("Non-fatal — full welcome available in-app"));
    }
  } catch {
    s.stop("Welcome message skipped");
    p.log.info(pc.dim("Non-fatal — Harper will greet you in-app"));
  }
}

/* ------------------------------------------------------------------ */
/*  Success summary                                                    */
/* ------------------------------------------------------------------ */

function showSummary() {
  const backendStatus = ctx.backendRunning
    ? pc.green("[running]")
    : pc.red("[stopped]");
  const hermesStatus = ctx.vproxyReady
    ? pc.green("[oauth ready]")
    : pc.yellow("[run fintheon oauth]");
  const dbStatus = ctx.databaseUrl
    ? pc.green("[connected]")
    : pc.dim("[in-memory]");

  console.log("");
  p.log.success(pc.bold("Setup Complete"));
  console.log("");
  console.log(`  Backend:    http://localhost:${ctx.port}  ${backendStatus}`);
  console.log(`  Hermes AI:  Anthropic via VProxy   ${hermesStatus}`);
  console.log(
    `  Database:   ${ctx.databaseUrl ? "PostgreSQL" : "In-memory mode"}         ${dbStatus}`,
  );
  if (ctx.openRouterKey) {
    console.log(`  Fallback:   OpenRouter configured  ${pc.green("[ok]")}`);
  }
  console.log("");
  console.log(pc.dim("  Next steps:"));
  console.log(
    `    1. Start frontend:  ${pc.cyan("cd frontend && bun run dev")}`,
  );
  console.log(`    2. Open browser:    ${pc.cyan("http://localhost:5173")}`);
  console.log(
    `    3. Desktop app:     ${pc.cyan("bun run desktop:build")} (for DMG)`,
  );
  console.log("");
  console.log(pc.dim("  Re-run 'bun run setup' anytime to reconfigure."));
  console.log("");
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  showBanner();

  p.intro(pc.yellow("Fintheon Setup"));

  // Phase 1: Prerequisites & Dependencies
  await checkPrerequisites();
  await installDependencies();
  await installHermes();

  // Phase 2: API Keys & Environment
  await ensureVProxyOAuth();
  await collectApiKeys();
  await detectPort();
  writeEnvFiles();

  // Phase 3: Backend Start & Verification
  await buildAndStartBackend();
  await verifyHealth();
  await verifyHermes();

  // Phase 4: Welcome
  await triggerWelcome();

  // Summary
  showSummary();

  p.outro(pc.yellow("Happy trading."));
}

main().catch((err) => {
  p.log.error(`Setup failed: ${err.message}`);
  process.exit(1);
});
