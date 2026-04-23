// [claude-code 2026-04-23] S32-T3 Ollama fallback chain — generateTextViaClaude now goes through provider-chain
// [claude-code 2026-03-10] Claude Code SDK process manager — spawns CLI with --print for headless inference
/**
 * Claude Code Process Manager
 * Manages the Claude Code CLI subprocess lifecycle.
 * Uses `claude --print --output-format stream-json` for zero-cost Opus inference via Max subscription.
 *
 * Architecture:
 *   - Per-request spawning (Claude CLI exits after each --print invocation)
 *   - Health checks via `claude --version`
 *   - Configurable model, effort, and allowed tools
 *   - Inherits ~/.claude/ config (MCP servers, credentials, settings)
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createLogger } from "../../lib/logger.js";
import { getSessionManager } from "./session-manager.js";
import { generateViaChain } from "../ai/provider-chain.js";

const log = createLogger("ClaudeSDK");

// ── Types ──────────────────────────────────────────────────────────────────

/** A single streaming event from Claude Code's stream-json output */
export type ClaudeStreamEvent =
  | {
      type: "assistant";
      message: {
        id: string;
        content: ContentBlock[];
        model: string;
        stop_reason: string | null;
      };
    }
  | { type: "content_block_start"; index: number; content_block: ContentBlock }
  | {
      type: "content_block_delta";
      index: number;
      delta: { type: string; text?: string };
    }
  | { type: "content_block_stop"; index: number }
  | { type: "message_start"; message: { id: string; model: string } }
  | {
      type: "message_delta";
      delta: { stop_reason: string };
      usage: { output_tokens: number };
    }
  | { type: "message_stop" }
  | {
      type: "result";
      result: string;
      duration_ms: number;
      num_turns: number;
      session_id: string;
    }
  | { type: "system"; message: string; session_id?: string }
  | { type: "error"; error: { message: string } };

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

export interface ClaudeSDKConfig {
  /** Path to claude binary (default: 'claude') */
  binaryPath: string;
  /** Model to use (default: 'opus') */
  model: string;
  /** Effort level: low | medium | high (default: 'high') */
  effort: "low" | "medium" | "high";
  /** Max turns for agentic loops (default: 1 for chat) */
  maxTurns: number;
  /** Timeout per request in ms (default: 120_000) */
  timeoutMs: number;
  /** Working directory for Claude (default: process.cwd()) */
  cwd: string;
  /** System prompt override */
  systemPrompt?: string;
  /** Allowed tools (default: none — read-only inference) */
  allowedTools: string[];
  /** Whether to skip permission checks (default: false) */
  dangerouslySkipPermissions: boolean;
}

export interface ProcessHealth {
  available: boolean;
  version: string | null;
  lastCheckAt: number;
  error: string | null;
}

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ClaudeSDKConfig = {
  binaryPath: process.env.CLAUDE_BINARY_PATH ?? "claude",
  model: process.env.CLAUDE_SDK_MODEL ?? "opus",
  effort:
    (process.env.CLAUDE_SDK_EFFORT as ClaudeSDKConfig["effort"]) ?? "high",
  maxTurns: Number(process.env.CLAUDE_SDK_MAX_TURNS ?? "3"),
  timeoutMs: Number(process.env.CLAUDE_SDK_TIMEOUT_MS ?? "300000"),
  cwd: process.env.CLAUDE_SDK_CWD ?? process.cwd(),
  systemPrompt: process.env.CLAUDE_SDK_SYSTEM_PROMPT,
  allowedTools: [],
  dangerouslySkipPermissions:
    process.env.CLAUDE_SDK_SKIP_PERMISSIONS === "true",
};

// ── State ──────────────────────────────────────────────────────────────────

let config: ClaudeSDKConfig = { ...DEFAULT_CONFIG };
let health: ProcessHealth = {
  available: false,
  version: null,
  lastCheckAt: 0,
  error: null,
};
let activeProcesses = 0;
const MAX_CONCURRENT = Number(process.env.CLAUDE_SDK_MAX_CONCURRENT ?? "2");

// Concurrency queue — prevents spawning more than MAX_CONCURRENT Claude processes
const waitQueue: Array<() => void> = [];

async function acquireSlot(): Promise<void> {
  if (activeProcesses < MAX_CONCURRENT) return;
  log.info(
    ` Queued (${activeProcesses}/${MAX_CONCURRENT} active, ${waitQueue.length} waiting)`,
  );
  await new Promise<void>((resolve) => waitQueue.push(resolve));
}

function releaseSlot(): void {
  const next = waitQueue.shift();
  if (next) next();
}

// ── Health ─────────────────────────────────────────────────────────────────

/** Check if Claude CLI is available and get version */
export async function checkHealth(): Promise<ProcessHealth> {
  try {
    const version = await new Promise<string>((resolve, reject) => {
      const proc = spawn(config.binaryPath, ["--version"], {
        timeout: 5_000,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      proc.stdout.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      proc.on("close", (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`claude --version exited with code ${code}`));
      });
      proc.on("error", reject);
    });

    health = { available: true, version, lastCheckAt: Date.now(), error: null };
    log.info(` Health check passed: ${version}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    health = {
      available: false,
      version: null,
      lastCheckAt: Date.now(),
      error: message,
    };
    log.warn(` Health check failed: ${message}`);
  }
  return health;
}

/** Get cached health (re-checks if stale >60s) */
export async function getHealth(): Promise<ProcessHealth> {
  if (Date.now() - health.lastCheckAt > 60_000) {
    return checkHealth();
  }
  return health;
}

export function isAvailable(): boolean {
  return health.available && activeProcesses < MAX_CONCURRENT;
}

// ── Process Spawning ───────────────────────────────────────────────────────

export interface SpawnResult {
  process: ChildProcess;
  /** Abort this request */
  abort: () => void;
}

/**
 * Spawn a Claude Code CLI process for a single prompt.
 * Returns the child process for streaming stdout.
 */
export function spawnClaudeProcess(
  prompt: string,
  options?: Partial<ClaudeSDKConfig>,
): SpawnResult {
  const opts = { ...config, ...options };

  const args: string[] = [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
    "--model",
    opts.model,
    "--max-turns",
    String(opts.maxTurns),
  ];

  if (opts.systemPrompt) {
    args.push("--system-prompt", opts.systemPrompt);
  }

  if (opts.allowedTools.length > 0) {
    args.push("--allowedTools", ...opts.allowedTools);
  }

  if (opts.dangerouslySkipPermissions) {
    args.push("--dangerously-skip-permissions");
  }

  // Prompt goes last
  args.push(prompt);

  log.info(
    ` Spawning: ${opts.binaryPath} ${args.slice(0, 4).join(" ")} ... (prompt: ${prompt.length} chars)`,
  );

  const proc = spawn(opts.binaryPath, args, {
    cwd: opts.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: opts.timeoutMs,
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  activeProcesses++;

  const cleanup = () => {
    activeProcesses = Math.max(0, activeProcesses - 1);
    releaseSlot();
  };

  proc.on("close", cleanup);
  proc.on("error", cleanup);

  // Log stderr (debug info, warnings)
  let stderr = "";
  proc.stderr?.on("data", (d: Buffer) => {
    stderr += d.toString();
  });
  proc.on("close", (code) => {
    if (code !== 0 && stderr) {
      log.warn(` Process exited ${code}, stderr: ${stderr.slice(0, 500)}`);
    }
  });

  const abort = () => {
    if (!proc.killed) {
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 3_000);
    }
  };

  return { process: proc, abort };
}

// ── Simple Text Generation ────────────────────────────────────────────────

/**
 * Generate text via Claude CLI (non-streaming).
 * Routes through the persistent session manager when available,
 * falls back to per-request spawn if session is down.
 * Used by brief generator, agent notes, and any service that needs
 * Claude inference without the AI SDK client pattern.
 */
export async function generateTextViaClaude(
  prompt: string,
  options?: Partial<ClaudeSDKConfig>,
): Promise<string> {
  // Preferred path for Harper flows: VProxy → Ollama-via-Hermes chain.
  try {
    const chain = await generateViaChain({
      prompt,
      systemPrompt: options?.systemPrompt,
      model: options?.model,
      maxOutputTokens: 8192,
      timeoutMs: options?.timeoutMs ?? config.timeoutMs,
    });
    return chain.response;
  } catch (err) {
    log.warn(
      "AI chain (VProxy+Ollama) failed — falling back to Claude CLI if available",
      { error: err instanceof Error ? err.message : String(err) },
    );
  }

  if (!isAvailable()) {
    throw new Error("Claude CLI not available and VProxy request failed");
  }

  // Try persistent session first (serialized, no concurrency management needed)
  const session = getSessionManager();
  if (session.isSessionAlive()) {
    try {
      log.info("Routing sync request through persistent session");
      return await session.sendPromptSync(prompt, options);
    } catch (err) {
      log.warn("Session failed, falling back to per-request spawn", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fallback: per-request spawn with concurrency gate
  await acquireSlot();

  return new Promise((resolve, reject) => {
    const { process: proc, abort } = spawnClaudeProcess(prompt, options);
    let fullText = "";
    let buffer = "";

    const timeout = setTimeout(() => {
      abort();
      reject(new Error("Claude CLI timed out"));
    }, options?.timeoutMs ?? config.timeoutMs);

    proc.stdout?.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (event.type === "assistant" && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === "text") fullText += block.text;
            }
          }
          // stream-json text delta events
          if (event.type === "content_block_delta" && event.delta?.text) {
            fullText += event.delta.text;
          }
        } catch {
          // Not JSON — might be raw text output
          if (trimmed && !trimmed.startsWith("{")) fullText += trimmed;
        }
      }
    });

    proc.on("close", (code) => {
      clearTimeout(timeout);
      releaseSlot();
      if (code === 0 || fullText.length > 0) {
        resolve(fullText.trim());
      } else {
        reject(new Error(`Claude CLI exited with code ${code}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      releaseSlot();
      reject(err);
    });
  });
}

// ── Configuration ──────────────────────────────────────────────────────────

export function configure(overrides: Partial<ClaudeSDKConfig>): void {
  config = { ...config, ...overrides };
  log.info(` Config updated:`, {
    model: config.model,
    effort: config.effort,
    maxTurns: config.maxTurns,
    timeoutMs: config.timeoutMs,
  });
}

export function getConfig(): Readonly<ClaudeSDKConfig> {
  return { ...config };
}

export function getActiveCount(): number {
  return activeProcesses;
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

/** Initialize: check health on startup */
export async function initClaudeSDK(): Promise<void> {
  log.info(` Initializing Claude SDK bridge...`);
  await checkHealth();
  if (health.available) {
    log.info(
      ` Ready — Claude Code ${health.version}, model: ${config.model}, max concurrent: ${MAX_CONCURRENT}`,
    );
  } else {
    log.warn(
      ` Claude Code CLI not available — bridge disabled. Error: ${health.error}`,
    );
  }
}

/** Graceful shutdown: kill any active processes */
export function shutdownClaudeSDK(): void {
  log.info(` Shutting down (${activeProcesses} active processes)`);
  // Active processes will be cleaned up by their individual abort() calls
  // or OS process group cleanup on parent exit
}

// Re-export session manager for consumers
export { getSessionManager } from "./session-manager.js";
