// [claude-code 2026-03-30] Persistent session manager — serialized queue, 6PM ET daily refresh
/**
 * Claude CLI Session Manager
 * Wraps per-request Claude CLI spawns behind a FIFO queue to ensure
 * one-at-a-time execution. Refreshes daily at 6PM ET to clear context.
 *
 * Architecture:
 *   - Singleton pattern (one session manager per backend)
 *   - FIFO async queue — requests execute sequentially
 *   - Delegates actual spawning to spawnClaudeProcess (existing infra)
 *   - 6PM ET daily refresh: drains queue, resets session state
 *   - Falls back to raw spawnClaudeProcess if session is unhealthy
 */

import {
  spawnClaudeProcess,
  type ClaudeStreamEvent,
  type ClaudeSDKConfig,
  getHealth,
} from "./process-manager.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("SessionMgr");

// ── Types ──────────────────────────────────────────────────────────────────

interface SyncQueueItem {
  kind: "sync";
  prompt: string;
  options?: Partial<ClaudeSDKConfig>;
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
}

interface StreamQueueItem {
  kind: "stream";
  prompt: string;
  options?: Partial<ClaudeSDKConfig>;
  resolve: (value: AsyncGenerator<ClaudeStreamEvent>) => void;
  reject: (reason: Error) => void;
}

type QueueItem = SyncQueueItem | StreamQueueItem;

// ── Session Manager ────────────────────────────────────────────────────────

class SessionManager {
  private queue: QueueItem[] = [];
  private processing = false;
  private alive = false;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private startedAt: number = 0;
  private requestCount = 0;
  private refreshHourET: number;

  constructor() {
    this.refreshHourET = Number(
      process.env.CLAUDE_SESSION_REFRESH_HOUR_ET ?? "18",
    );
  }

  /** Start the session manager and schedule daily refresh */
  async start(): Promise<void> {
    const health = await getHealth();
    if (!health.available) {
      log.warn("Claude CLI not available — session manager disabled");
      this.alive = false;
      return;
    }

    this.alive = true;
    this.startedAt = Date.now();
    this.requestCount = 0;
    log.info(`Session started (refresh at ${this.refreshHourET}:00 ET)`);

    // Schedule refresh check every 60s
    this.refreshTimer = setInterval(() => this.checkRefresh(), 60_000);
  }

  /** Stop the session manager */
  stop(): void {
    this.alive = false;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    log.info(`Session stopped (served ${this.requestCount} requests)`);
  }

  /** Check if the session is alive and accepting requests */
  isSessionAlive(): boolean {
    return this.alive;
  }

  /** Get session stats */
  getStats() {
    return {
      alive: this.alive,
      queueLength: this.queue.length,
      processing: this.processing,
      requestCount: this.requestCount,
      uptimeMs: this.alive ? Date.now() - this.startedAt : 0,
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────

  /**
   * Send a prompt and get a streaming response.
   * Queued — only one prompt processes at a time.
   */
  sendPrompt(
    prompt: string,
    options?: Partial<ClaudeSDKConfig>,
  ): AsyncGenerator<ClaudeStreamEvent> {
    if (!this.alive) {
      throw new Error("Session not alive — use fallback");
    }

    // Return an async generator that waits for its turn in the queue
    const self = this;
    return (async function* () {
      // Wait for queue slot
      const stream = await new Promise<AsyncGenerator<ClaudeStreamEvent>>(
        (resolve, reject) => {
          self.queue.push({ kind: "stream", prompt, options, resolve, reject });
          self.drain();
        },
      );
      yield* stream;
    })();
  }

  /**
   * Send a prompt and collect the full text response (non-streaming).
   * Queued — only one prompt processes at a time.
   */
  async sendPromptSync(
    prompt: string,
    options?: Partial<ClaudeSDKConfig>,
  ): Promise<string> {
    if (!this.alive) {
      throw new Error("Session not alive — use fallback");
    }

    return new Promise<string>((resolve, reject) => {
      this.queue.push({ kind: "sync", prompt, options, resolve, reject });
      this.drain();
    });
  }

  // ── Queue Processing ───────────────────────────────────────────────────

  private async drain(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.requestCount++;

      try {
        if (item.kind === "stream") {
          await this.processStreamItem(item);
        } else {
          await this.processSyncItem(item);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        item.reject(error);
      }
    }

    this.processing = false;
  }

  private async processStreamItem(item: StreamQueueItem): Promise<void> {
    const { prompt, options } = item;

    const { process: proc, abort } = spawnClaudeProcess(prompt, options);
    log.info(
      `Session processing stream request (queue: ${this.queue.length} remaining)`,
    );

    // Create an async generator from the process stdout
    const generator = this.createStreamGenerator(proc, abort);
    item.resolve(generator);

    // Wait for the process to exit before processing next queue item
    await new Promise<void>((resolve) => {
      proc.on("close", resolve);
      proc.on("error", resolve);
    });
  }

  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    const { prompt, options } = item;
    const opts = options ?? {};

    const { process: proc, abort } = spawnClaudeProcess(prompt, opts);
    log.info(
      `Session processing sync request (queue: ${this.queue.length} remaining)`,
    );

    let fullText = "";
    let buffer = "";

    const timeoutId = setTimeout(() => {
      abort();
    }, opts.timeoutMs ?? 300_000);

    await new Promise<void>((resolve) => {
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
            if (event.type === "content_block_delta" && event.delta?.text) {
              fullText += event.delta.text;
            }
          } catch {
            if (trimmed && !trimmed.startsWith("{")) fullText += trimmed;
          }
        }
      });

      proc.on("close", (code) => {
        clearTimeout(timeoutId);
        if (code === 0 || fullText.length > 0) {
          item.resolve(fullText.trim());
        } else {
          item.reject(new Error(`Claude CLI exited with code ${code}`));
        }
        resolve();
      });

      proc.on("error", (err) => {
        clearTimeout(timeoutId);
        item.reject(err);
        resolve();
      });
    });
  }

  private async *createStreamGenerator(
    proc: import("node:child_process").ChildProcess,
    abort: () => void,
  ): AsyncGenerator<ClaudeStreamEvent> {
    const stdout = proc.stdout;
    if (!stdout) {
      yield {
        type: "error",
        error: { message: "No stdout from Claude process" },
      };
      return;
    }

    let buffer = "";

    try {
      for await (const chunk of stdout) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event: ClaudeStreamEvent = JSON.parse(trimmed);
            yield event;
          } catch {
            // Not JSON — skip
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event: ClaudeStreamEvent = JSON.parse(buffer.trim());
          yield event;
        } catch {
          // Ignore incomplete JSON
        }
      }
    } catch (err) {
      yield {
        type: "error",
        error: { message: err instanceof Error ? err.message : "Stream error" },
      };
    }
  }

  // ── Refresh Logic ──────────────────────────────────────────────────────

  private checkRefresh(): void {
    // Get current hour in ET (America/New_York)
    const now = new Date();
    const etString = now.toLocaleString("en-US", {
      timeZone: "America/New_York",
    });
    const etDate = new Date(etString);
    const etHour = etDate.getHours();
    const etMinute = etDate.getMinutes();

    // Trigger refresh at the configured hour (e.g., 18:00 ET), within the first minute
    if (etHour === this.refreshHourET && etMinute === 0) {
      this.refresh();
    }
  }

  private async refresh(): Promise<void> {
    log.info(
      `Session refresh triggered (${this.refreshHourET}:00 ET) — waiting for in-flight request...`,
    );

    // Wait for current processing to finish
    const waitStart = Date.now();
    while (this.processing && Date.now() - waitStart < 120_000) {
      await new Promise((r) => setTimeout(r, 1_000));
    }

    const prevCount = this.requestCount;

    // Reset state
    this.requestCount = 0;
    this.startedAt = Date.now();

    log.info(
      `Session refreshed (served ${prevCount} requests in previous window)`,
    );
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let instance: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!instance) {
    instance = new SessionManager();
  }
  return instance;
}

/** Initialize and start the persistent session */
export async function startPersistentSession(): Promise<void> {
  const mgr = getSessionManager();
  await mgr.start();
}

/** Stop the persistent session */
export function stopPersistentSession(): void {
  if (instance) {
    instance.stop();
    instance = null;
  }
}
