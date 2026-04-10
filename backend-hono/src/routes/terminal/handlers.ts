// [claude-code 2026-03-20] Terminal handlers: spawn shell commands + SSE stream output for browser terminal
import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("terminal");

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../../.."); // backend-hono/ → project root

const MAX_BUFFER = 200;
const PROCESS_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

interface ProcessEntry {
  child: ChildProcess;
  emitter: EventEmitter;
  buffer: Array<{ event: string; data: string }>;
  done: boolean;
  timer: ReturnType<typeof setTimeout>;
}

const processes = new Map<string, ProcessEntry>();

function isLocalRequest(c: Context): boolean {
  // Allow terminal access from localhost in all environments.
  // This is a desktop Electron app — the backend always runs locally.
  const host = c.req.header("host") || "";
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
}

function pushEvent(entry: ProcessEntry, event: string, data: string) {
  const item = { event, data };
  entry.buffer.push(item);
  if (entry.buffer.length > MAX_BUFFER) entry.buffer.shift();
  entry.emitter.emit("event", item);
}

function cleanup(processId: string) {
  const entry = processes.get(processId);
  if (!entry) return;
  clearTimeout(entry.timer);
  if (!entry.done) {
    try {
      entry.child.kill("SIGTERM");
    } catch {}
  }
  entry.emitter.removeAllListeners();
  processes.delete(processId);
}

/** POST /api/terminal/run — spawn a shell command, return processId */
export async function handleRun(c: Context) {
  if (!isLocalRequest(c)) {
    return c.json({ error: "Terminal endpoint is local-dev only" }, 403);
  }

  const body = await c.req
    .json<{ command?: string }>()
    .catch(() => ({ command: undefined }));
  const command = body.command?.trim();
  if (!command) {
    return c.json({ error: "command is required" }, 400);
  }

  const processId = randomUUID();
  log.info(`Spawning command`, { processId, command: command.slice(0, 120) });

  const emitter = new EventEmitter();
  const child = spawn(command, {
    shell: true,
    cwd: PROJECT_ROOT,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");

  const entry: ProcessEntry = {
    child,
    emitter,
    buffer: [],
    done: false,
    timer: setTimeout(() => {
      log.info("Process timeout, killing", { processId });
      cleanup(processId);
    }, PROCESS_TIMEOUT_MS),
  };

  processes.set(processId, entry);

  child.stdout?.on("data", (data: string) => {
    pushEvent(entry, "stdout", data);
  });

  child.stderr?.on("data", (data: string) => {
    pushEvent(entry, "stderr", data);
  });

  child.on("exit", (code, signal) => {
    entry.done = true;
    pushEvent(
      entry,
      "exit",
      JSON.stringify({ code: code ?? null, signal: signal ?? null }),
    );
    // Keep entry around briefly so SSE can drain the exit event
    setTimeout(() => cleanup(processId), 5000);
  });

  child.on("error", (err) => {
    pushEvent(entry, "stderr", err.message);
    entry.done = true;
    pushEvent(entry, "exit", JSON.stringify({ code: null, signal: null }));
    setTimeout(() => cleanup(processId), 5000);
  });

  return c.json({ ok: true, processId });
}

/** GET /api/terminal/stream/:processId — SSE stream of stdout/stderr/exit */
export async function handleStream(c: Context) {
  if (!isLocalRequest(c)) {
    return c.json({ error: "Terminal endpoint is local-dev only" }, 403);
  }

  const processId = c.req.param("processId");
  const entry = processes.get(processId);
  if (!entry) {
    return c.json({ error: "Process not found" }, 404);
  }

  return streamSSE(c, async (stream) => {
    // Replay buffered events
    for (const item of entry.buffer) {
      await stream.writeSSE({ event: item.event, data: item.data });
    }

    if (entry.done) {
      return; // Process already finished, buffer has everything
    }

    // Subscribe to new events
    let closed = false;
    const onEvent = async (item: { event: string; data: string }) => {
      if (closed) return;
      try {
        await stream.writeSSE({ event: item.event, data: item.data });
      } catch {
        closed = true;
      }
    };

    entry.emitter.on("event", onEvent);

    // Block until process exits or client disconnects
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (entry.done || closed) {
          clearInterval(check);
          entry.emitter.off("event", onEvent);
          resolve();
        }
      }, 200);
    });
  });
}

/** POST /api/terminal/kill/:processId — kill a running process */
export async function handleKill(c: Context) {
  if (!isLocalRequest(c)) {
    return c.json({ error: "Terminal endpoint is local-dev only" }, 403);
  }

  const processId = c.req.param("processId");
  const entry = processes.get(processId);
  if (!entry) {
    return c.json({ error: "Process not found" }, 404);
  }

  try {
    entry.child.kill("SIGTERM");
    log.info("Process killed", { processId });
  } catch {}

  return c.json({ ok: true });
}
