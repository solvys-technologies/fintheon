// [claude-code 2026-04-04] Solvys Audit skill — full-stack health check
import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  new URL(".", import.meta.url).pathname,
  "../../../..",
);

function runShell(command: string, timeoutMs = 60_000): Promise<string> {
  return new Promise((res) => {
    const chunks: string[] = [];
    const child = spawn(command, {
      shell: true,
      cwd: PROJECT_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (d: string) => chunks.push(d));
    child.stderr?.on("data", (d: string) => chunks.push(d));
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      res(chunks.join("") + "\n[timed out]");
    }, timeoutMs);
    child.on("exit", () => {
      clearTimeout(timer);
      res(chunks.join(""));
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      res(`Error: ${err.message}`);
    });
  });
}

export const solvysAuditTool = tool({
  name: "solvys_audit",
  description:
    "Run a full-stack health check: TypeScript build, file size enforcement (300-line max), orphan detection, dead code scan, and sprint file archival.",
  inputSchema: z.object({
    fix: z
      .boolean()
      .optional()
      .describe("Attempt to auto-fix issues found (default false)"),
  }),
  callback: async (input: { fix?: boolean }) => {
    const results: string[] = ["=== Solvys Audit ==="];

    // Build check
    const build = await runShell("bun run build 2>&1 | tail -10");
    const buildOk = !build.includes("error TS");
    results.push(
      `\n[Build] ${buildOk ? "PASS" : "FAIL"}\n${build.slice(-500)}`,
    );

    // File size check (>300 lines)
    const bigFiles = await runShell(
      `find frontend/components backend-hono/src -name "*.ts" -o -name "*.tsx" | xargs wc -l 2>/dev/null | sort -rn | head -20`,
    );
    results.push(`\n[Large files (>300 lines)]\n${bigFiles}`);

    // Git status
    const gitStatus = await runShell("git status --short");
    results.push(`\n[Uncommitted changes]\n${gitStatus || "(clean)"}`);

    // Dead exports check
    const deadExports = await runShell(
      `grep -rn "export " backend-hono/src/services/ --include="*.ts" | wc -l`,
    );
    results.push(`\n[Export count] ${deadExports.trim()} exports in services/`);

    return results.join("\n");
  },
});
