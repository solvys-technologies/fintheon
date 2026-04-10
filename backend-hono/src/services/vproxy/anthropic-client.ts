// [claude-code 2026-04-10] Use shared round-robin getNextBaseUrl() from strands/provider
// [claude-code 2026-04-04] Auto-approve read-only tools (read_file, read_mcp_config) — skip approval gate
// [claude-code 2026-04-03] Added approval-gated tool factory, web_fetch, write_file, read_mcp_config tools
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { createLogger } from "../../lib/logger.js";
import { isToolApproved, requestApproval } from "../tool-approval-store.js";
import { getNextBaseUrl } from "../strands/provider.js";

const log = createLogger("VProxyAnthropic");

const DEFAULT_BASE_URL = "http://localhost:8317";
const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_API_KEY = "CLI_PROXY_API_KEY";
const HEALTH_CACHE_TTL_MS = 15_000;

export interface VProxyHealth {
  enabled: boolean;
  available: boolean;
  baseUrl: string;
  model: string;
  checkedAt: number;
  error: string | null;
}

export interface VProxyTextOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

export interface VProxyStreamOptions extends VProxyTextOptions {
  abortSignal?: AbortSignal;
}

let healthCache: VProxyHealth | null = null;

function normalizeBaseUrl(raw: string): string {
  // @ai-sdk/anthropic appends /messages directly — base must end with /v1
  const stripped = raw.replace(/\/+$/, "");
  return stripped.endsWith("/v1") ? stripped : `${stripped}/v1`;
}

function resolveModel(modelOverride?: string): string {
  const configured =
    modelOverride || process.env.VPROXY_ANTHROPIC_MODEL || DEFAULT_MODEL;
  let model = configured;
  if (model.startsWith("anthropic/")) {
    model = model.slice("anthropic/".length);
  }
  if (model === "opus") {
    model = process.env.VPROXY_ANTHROPIC_MODEL || DEFAULT_MODEL;
  }
  // VProxy (Claude CLI proxy) requires hyphens — dots cause 502
  // Normalize any dot-format model IDs (e.g. claude-opus-4.6 → claude-opus-4-6)
  model = model.replace(/(\d+)\.(\d+)/g, "$1-$2");
  return model;
}

function getClient(modelOverride?: string) {
  // Use round-robin base URL from shared provider config
  const baseUrl = getNextBaseUrl();
  const apiKey = process.env.VPROXY_API_KEY || DEFAULT_API_KEY;
  const anthropic = createAnthropic({
    apiKey,
    baseURL: baseUrl,
  });
  return anthropic(resolveModel(modelOverride));
}

export function isVProxyAnthropicEnabled(): boolean {
  return process.env.USE_VPROXY_ANTHROPIC !== "false";
}

export function getVProxyAnthropicBaseUrl(): string {
  return normalizeBaseUrl(process.env.VPROXY_BASE_URL || DEFAULT_BASE_URL);
}

export async function getVProxyHealth(force = false): Promise<VProxyHealth> {
  const enabled = isVProxyAnthropicEnabled();
  const baseUrl = getVProxyAnthropicBaseUrl();
  const model = resolveModel();

  if (!enabled) {
    const disabledState: VProxyHealth = {
      enabled: false,
      available: false,
      baseUrl,
      model,
      checkedAt: Date.now(),
      error: "USE_VPROXY_ANTHROPIC=false",
    };
    healthCache = disabledState;
    return disabledState;
  }

  if (
    !force &&
    healthCache &&
    Date.now() - healthCache.checkedAt < HEALTH_CACHE_TTL_MS
  ) {
    return healthCache;
  }

  try {
    const apiKey = process.env.VPROXY_API_KEY || DEFAULT_API_KEY;
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `models endpoint returned ${response.status}: ${text.slice(0, 160)}`,
      );
    }

    const payload = (await response.json()) as {
      data?: Array<{ id?: string }>;
    };
    const hasClaude = (payload.data ?? []).some((entry) =>
      (entry.id ?? "").includes("claude"),
    );
    if (!hasClaude) {
      throw new Error("no Claude models reported by VProxy");
    }

    healthCache = {
      enabled: true,
      available: true,
      baseUrl,
      model,
      checkedAt: Date.now(),
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    healthCache = {
      enabled: true,
      available: false,
      baseUrl,
      model,
      checkedAt: Date.now(),
      error: message,
    };
    log.warn("VProxy health check failed", { error: message, baseUrl });
  }

  return healthCache;
}

export async function generateTextViaVProxy(
  options: VProxyTextOptions,
): Promise<string> {
  const health = await getVProxyHealth();
  if (!health.available) {
    throw new Error(`VProxy unavailable: ${health.error ?? "unknown error"}`);
  }

  const call = generateText({
    model: getClient(options.model),
    system: options.systemPrompt,
    prompt: options.prompt,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
  });

  if (!options.timeoutMs || options.timeoutMs <= 0) {
    const { text } = await call;
    return text;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(
        new Error(`VProxy request timed out after ${options.timeoutMs}ms`),
      );
    }, options.timeoutMs);
    timeoutHandle.unref?.();
  });

  const result = await Promise.race([call, timeoutPromise]);
  if (timeoutHandle) {
    clearTimeout(timeoutHandle);
  }
  return result.text;
}

// ── Shell + tool infrastructure for Harper CAO ───────────────────────────

/** Read-only tools that skip the approval gate entirely */
const AUTO_APPROVED_TOOLS = new Set([
  "read_file",
  "read_mcp_config",
  "get_fintheon_paths",
]);

const PROJECT_ROOT = resolve(
  new URL(".", import.meta.url).pathname,
  "../../..",
);
const HOME = homedir();

/** Key file paths Harper and the user should know about */
export const FINTHEON_PATHS = {
  projectRoot: PROJECT_ROOT,
  frontend: resolve(PROJECT_ROOT, "frontend"),
  backend: resolve(PROJECT_ROOT, "backend-hono"),
  electron: resolve(PROJECT_ROOT, "electron"),
  claudeConfig: resolve(HOME, ".claude"),
  claudeSettings: resolve(HOME, ".claude", "settings.json"),
  mcpConfig: resolve(PROJECT_ROOT, ".mcp.json"),
  mcpConfigVscode: resolve(PROJECT_ROOT, ".vscode", "mcp.json"),
  toolPermissions: resolve(HOME, ".fintheon", "tool-permissions.json"),
  hermesLogs: resolve(HOME, ".hermes", "logs"),
  fintheonData: resolve(HOME, ".fintheon"),
};

function runShell(
  command: string,
  timeoutMs = 30_000,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((res) => {
    const chunks: string[] = [];
    const errChunks: string[] = [];
    const child = spawn(command, {
      shell: true,
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (d: string) => chunks.push(d));
    child.stderr?.on("data", (d: string) => errChunks.push(d));

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      res({
        stdout: chunks.join(""),
        stderr: errChunks.join("") + "\n[timed out]",
        exitCode: null,
      });
    }, timeoutMs);

    child.on("exit", (code) => {
      clearTimeout(timer);
      res({
        stdout: chunks.join(""),
        stderr: errChunks.join(""),
        exitCode: code,
      });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      res({ stdout: "", stderr: err.message, exitCode: null });
    });
  });
}

/**
 * Wraps a tool execute function with the approval gate.
 * If the tool is permanently approved, executes immediately.
 * Otherwise, emits a cognition event and waits for user decision.
 */
async function withApprovalGate<T>(
  requestId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  description: string,
  executeFn: () => Promise<T>,
): Promise<T | string> {
  // Read-only tools skip the gate entirely
  if (AUTO_APPROVED_TOOLS.has(toolName)) {
    return executeFn();
  }

  // Check permanent permission
  if (isToolApproved(toolName)) {
    return executeFn();
  }

  // Request approval and wait (30s timeout → auto-approve)
  const decision = await requestApproval(
    requestId,
    toolName,
    toolInput,
    description,
  );

  if (decision === "denied") {
    return `[Permission denied] User denied ${toolName}. Do not retry this tool.`;
  }

  return executeFn();
}

/**
 * Create Harper tools bound to a specific requestId for approval gating.
 * Each chat request gets its own tool set so approvals route correctly.
 */
export function createHarperTools(requestId: string) {
  return {
    run_command: tool({
      description:
        "Run a shell command on the local machine. The working directory is the Fintheon project root. Use this to inspect files, grep code, check logs, run scripts, query the database, build the project, or execute any CLI tool.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to execute (bash)"),
      }) as z.ZodType<{ command: string }>,
      execute: async ({ command }) => {
        log.info("Harper tool: run_command", {
          command: command.slice(0, 120),
        });
        return withApprovalGate(
          requestId,
          "run_command",
          { command },
          `Run shell command: ${command.slice(0, 200)}`,
          async () => {
            const result = await runShell(command);
            return (
              result.stdout +
              (result.stderr ? `\n[stderr] ${result.stderr}` : "")
            ).slice(0, 12_000);
          },
        );
      },
    }),

    read_file: tool({
      description:
        "Read the contents of a file from the Fintheon codebase or system. Returns the full text content.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Absolute path or path relative to the Fintheon project root",
          ),
      }) as z.ZodType<{ path: string }>,
      execute: async ({ path: filePath }) => {
        const abs = filePath.startsWith("/")
          ? filePath
          : resolve(PROJECT_ROOT, filePath);
        log.info("Harper tool: read_file", { path: abs });
        return withApprovalGate(
          requestId,
          "read_file",
          { path: abs },
          `Read file: ${abs}`,
          async () => {
            try {
              const content = await readFile(abs, "utf8");
              return (
                content.slice(0, 20_000) +
                (content.length > 20_000 ? "\n[truncated]" : "")
              );
            } catch (err) {
              return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
          },
        );
      },
    }),

    write_file: tool({
      description:
        "Write content to a file. Use this to create or update files in the Fintheon codebase.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Absolute path or path relative to the Fintheon project root",
          ),
        content: z.string().describe("The content to write"),
      }) as z.ZodType<{ path: string; content: string }>,
      execute: async ({ path: filePath, content }) => {
        const abs = filePath.startsWith("/")
          ? filePath
          : resolve(PROJECT_ROOT, filePath);
        log.info("Harper tool: write_file", {
          path: abs,
          contentLen: content.length,
        });
        return withApprovalGate(
          requestId,
          "write_file",
          { path: abs, contentLength: content.length },
          `Write file: ${abs} (${content.length} chars)`,
          async () => {
            try {
              await writeFile(abs, content, "utf8");
              return `Successfully wrote ${content.length} chars to ${abs}`;
            } catch (err) {
              return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
          },
        );
      },
    }),

    web_fetch: tool({
      description:
        "Fetch a URL and return the text content. Use this to browse the internet, read documentation, check APIs, or research topics.",
      inputSchema: z.object({
        url: z.string().describe("The URL to fetch"),
        maxChars: z
          .number()
          .optional()
          .describe("Max characters to return (default 15000)"),
      }) as z.ZodType<{ url: string; maxChars?: number }>,
      execute: async ({ url, maxChars }) => {
        const limit = maxChars ?? 15_000;
        log.info("Harper tool: web_fetch", { url });
        return withApprovalGate(
          requestId,
          "web_fetch",
          { url },
          `Fetch URL: ${url}`,
          async () => {
            try {
              const resp = await fetch(url, {
                headers: {
                  "User-Agent": "Fintheon/Harper-Opus (research agent)",
                },
                signal: AbortSignal.timeout(15_000),
              });
              if (!resp.ok) return `HTTP ${resp.status}: ${resp.statusText}`;
              const text = await resp.text();
              return (
                text.slice(0, limit) +
                (text.length > limit ? "\n[truncated]" : "")
              );
            } catch (err) {
              return `Fetch error: ${err instanceof Error ? err.message : String(err)}`;
            }
          },
        );
      },
    }),

    read_mcp_config: tool({
      description:
        "Read the MCP (Model Context Protocol) server configuration from the local machine. Returns configs from ~/.claude/settings.json, .mcp.json, and .vscode/mcp.json.",
      inputSchema: z.object({}) as z.ZodType<Record<string, never>>,
      execute: async () => {
        log.info("Harper tool: read_mcp_config");
        return withApprovalGate(
          requestId,
          "read_mcp_config",
          {},
          "Read MCP server configuration files",
          async () => {
            const results: Record<string, string> = {};
            const paths = [
              { key: "claude_settings", path: FINTHEON_PATHS.claudeSettings },
              { key: "project_mcp", path: FINTHEON_PATHS.mcpConfig },
              { key: "vscode_mcp", path: FINTHEON_PATHS.mcpConfigVscode },
            ];
            for (const { key, path } of paths) {
              try {
                results[key] = await readFile(path, "utf8");
              } catch {
                results[key] = "(not found)";
              }
            }
            return JSON.stringify(results, null, 2).slice(0, 20_000);
          },
        );
      },
    }),

    get_fintheon_paths: tool({
      description:
        "Returns the key file paths for the Fintheon installation on this device. Use this to know where config, logs, data, and source files live.",
      inputSchema: z.object({}) as z.ZodType<Record<string, never>>,
      execute: async () => {
        // No approval needed — read-only, no side effects
        return JSON.stringify(FINTHEON_PATHS, null, 2);
      },
    }),
  };
}

// ── Stream (with optional tools) ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function streamTextViaVProxy(
  options: VProxyStreamOptions & { enableTools?: boolean; requestId?: string },
): any {
  const tools =
    options.enableTools && options.requestId
      ? createHarperTools(options.requestId)
      : undefined;

  log.info("streamTextViaVProxy", {
    hasTools: !!tools,
    toolCount: tools ? Object.keys(tools).length : 0,
    model: resolveModel(options.model),
  });

  const result = streamText({
    model: getClient(options.model),
    system: options.systemPrompt,
    prompt: options.prompt,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
    abortSignal: options.abortSignal,
    ...(tools ? { tools, stopWhen: stepCountIs(10) } : {}),
    onError: ({ error }) => {
      log.error("streamText onError callback", { error: String(error) });
    },
    onStepFinish: (event: any) => {
      log.info("streamText step finished", {
        stepNumber: event.stepNumber,
        finishReason: event.finishReason,
        textLen: event.text?.length ?? 0,
        toolCallCount: event.toolCalls?.length ?? 0,
        toolResultCount: event.toolResults?.length ?? 0,
        usage: event.usage,
      });
    },
    onFinish: (event: any) => {
      log.info("streamText FINISHED", {
        finishReason: event.finishReason,
        textLen: event.text?.length ?? 0,
        stepsCount: event.steps?.length ?? 0,
        totalUsage: event.totalUsage,
      });
    },
  });

  return result;
}
