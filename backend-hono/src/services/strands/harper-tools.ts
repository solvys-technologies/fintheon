// [claude-code 2026-04-04] Harper CAO tools — ported from Vercel AI SDK to Strands
// [claude-code 2026-04-23] S32-T8 added browser_harness (Harper-only web control)
import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { createLogger } from "../../lib/logger.js";
import { isToolApproved, requestApproval } from "../tool-approval-store.js";
import { browserHarness } from "../browser/harness-tool.js";

const log = createLogger("HarperTools");

const PROJECT_ROOT = resolve(
  new URL(".", import.meta.url).pathname,
  "../../..",
);
const HOME = homedir();

/** Read-only tools that skip the approval gate */
const AUTO_APPROVED_TOOLS = new Set([
  "read_file",
  "read_mcp_config",
  "get_fintheon_paths",
  // [S32-T8] Harper drives the headless browser freely — rate-limited to 20/min
  // and every call is audited to browser_harness_audit.
  "browser_harness",
]);

/** Ensure tool results are never empty — OpenAI-compatible clients reject empty content */
function ensureNonEmpty(result: unknown): string {
  const s = typeof result === "string" ? result : JSON.stringify(result ?? "");
  return s.trim().length > 0 ? s : "(no output)";
}

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

// ── Shell runner ────────────────────────────────────────────────────────────

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

// ── Approval gate ───────────────────────────────────────────────────────────

async function withApprovalGate<T>(
  requestId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
  description: string,
  executeFn: () => Promise<T>,
  opts?: { noTimeout?: boolean; userId?: string },
): Promise<T | string> {
  if (AUTO_APPROVED_TOOLS.has(toolName)) return executeFn();
  if (isToolApproved(toolName)) return executeFn();

  const decision = await requestApproval(
    requestId,
    toolName,
    toolInput,
    description,
    opts,
  );
  if (decision === "denied") {
    return `[Permission denied] User denied ${toolName}. Do not retry this tool.`;
  }
  return executeFn();
}

// ── Tool factory ────────────────────────────────────────────────────────────

/** Create Harper's tool set bound to a specific requestId for approval gating */
export function createHarperTools(
  requestId: string,
  approvalOpts?: { noTimeout?: boolean; userId?: string },
) {
  return [
    tool({
      name: "run_command",
      description:
        "Run a shell command on the local machine. The working directory is the Fintheon project root. Use this to inspect files, grep code, check logs, run scripts, query the database, build the project, or execute any CLI tool.",
      inputSchema: z.object({
        command: z.string().describe("The shell command to execute (bash)"),
      }),
      callback: async (input: { command: string }) => {
        log.info("Harper tool: run_command", {
          command: input.command.slice(0, 120),
        });
        const result = await withApprovalGate(
          requestId,
          "run_command",
          { command: input.command },
          `Run shell command: ${input.command.slice(0, 200)}`,
          async () => {
            const r = await runShell(input.command);
            return (
              r.stdout + (r.stderr ? `\n[stderr] ${r.stderr}` : "")
            ).slice(0, 12_000);
          },
          approvalOpts,
        );
        return ensureNonEmpty(result);
      },
    }),

    tool({
      name: "read_file",
      description:
        "Read the contents of a file from the Fintheon codebase or system. Returns the full text content.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Absolute path or path relative to the Fintheon project root",
          ),
      }),
      callback: async (input: { path: string }) => {
        const abs = input.path.startsWith("/")
          ? input.path
          : resolve(PROJECT_ROOT, input.path);
        log.info("Harper tool: read_file", { path: abs });
        const result = await withApprovalGate(
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
          approvalOpts,
        );
        return ensureNonEmpty(result);
      },
    }),

    tool({
      name: "write_file",
      description:
        "Write content to a file. Use this to create or update files in the Fintheon codebase.",
      inputSchema: z.object({
        path: z
          .string()
          .describe(
            "Absolute path or path relative to the Fintheon project root",
          ),
        content: z.string().describe("The content to write"),
      }),
      callback: async (input: { path: string; content: string }) => {
        const abs = input.path.startsWith("/")
          ? input.path
          : resolve(PROJECT_ROOT, input.path);
        log.info("Harper tool: write_file", {
          path: abs,
          contentLen: input.content.length,
        });
        const result = await withApprovalGate(
          requestId,
          "write_file",
          { path: abs, contentLength: input.content.length },
          `Write file: ${abs} (${input.content.length} chars)`,
          async () => {
            try {
              await writeFile(abs, input.content, "utf8");
              return `Successfully wrote ${input.content.length} chars to ${abs}`;
            } catch (err) {
              return `Error: ${err instanceof Error ? err.message : String(err)}`;
            }
          },
          approvalOpts,
        );
        return ensureNonEmpty(result);
      },
    }),

    tool({
      name: "web_fetch",
      description:
        "Fetch a URL and return the text content. Use this to browse the internet, read documentation, check APIs, or research topics.",
      inputSchema: z.object({
        url: z.string().describe("The URL to fetch"),
        maxChars: z
          .number()
          .optional()
          .describe("Max characters to return (default 15000)"),
      }),
      callback: async (input: { url: string; maxChars?: number }) => {
        const limit = input.maxChars ?? 15_000;
        log.info("Harper tool: web_fetch", { url: input.url });
        const result = await withApprovalGate(
          requestId,
          "web_fetch",
          { url: input.url },
          `Fetch URL: ${input.url}`,
          async () => {
            try {
              const resp = await fetch(input.url, {
                headers: {
                  "User-Agent": "Fintheon/Harper (research agent)",
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
          approvalOpts,
        );
        return ensureNonEmpty(result);
      },
    }),

    tool({
      name: "read_mcp_config",
      description:
        "Read the MCP (Model Context Protocol) server configuration from the local machine. Returns configs from ~/.claude/settings.json, .mcp.json, and .vscode/mcp.json.",
      inputSchema: z.object({}),
      callback: async () => {
        log.info("Harper tool: read_mcp_config");
        const result = await withApprovalGate(
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
          approvalOpts,
        );
        return ensureNonEmpty(result);
      },
    }),

    tool({
      name: "get_fintheon_paths",
      description:
        "Returns the key file paths for the Fintheon installation on this device. Use this to know where config, logs, data, and source files live.",
      inputSchema: z.object({}),
      callback: async () => {
        return JSON.stringify(FINTHEON_PATHS, null, 2);
      },
    }),

    // [S32-T8] browser_harness — Harper-only headless browser control. Open,
    // navigate, and observe web pages for web search, fact checks,
    // documentation lookup, UI/UX testing, and RiskFlow feed debugging.
    tool({
      name: "browser_harness",
      description:
        "Open, navigate, and observe web pages. Use for web search, fact checks, documentation lookup, UI/UX testing, and RiskFlow feed debugging. Actions: search(query), open(url), read(selector?), click(selector), fill(selector, text), screenshot(), close(). Rate-limited to 20 actions/minute per user; every call is audited.",
      inputSchema: z.object({
        action: z
          .enum([
            "search",
            "open",
            "read",
            "click",
            "fill",
            "screenshot",
            "close",
          ])
          .describe("The harness action to invoke"),
        query: z.string().optional().describe("Search query (action='search')"),
        url: z
          .string()
          .optional()
          .describe("URL to navigate to (action='open')"),
        selector: z
          .string()
          .optional()
          .describe(
            "CSS selector for the target element (read/click/fill — optional for read, defaults to body)",
          ),
        text: z
          .string()
          .optional()
          .describe("Value to type into the selector (action='fill')"),
      }),
      callback: async (input: {
        action:
          | "search"
          | "open"
          | "read"
          | "click"
          | "fill"
          | "screenshot"
          | "close";
        query?: string;
        url?: string;
        selector?: string;
        text?: string;
      }) => {
        log.info("Harper tool: browser_harness", {
          action: input.action,
          url: input.url?.slice(0, 120),
          query: input.query?.slice(0, 120),
          selector: input.selector?.slice(0, 120),
        });
        const user = approvalOpts?.userId || "anonymous";
        const result = await browserHarness(user, input);
        return ensureNonEmpty(JSON.stringify(result));
      },
    }),
  ];
}
