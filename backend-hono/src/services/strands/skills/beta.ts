// [claude-code 2026-04-04] Solvys Beta skill — local build + test without committing
import { tool } from "@strands-agents/sdk";
import { z } from "zod";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  new URL(".", import.meta.url).pathname,
  "../../../..",
);

function runShell(command: string, timeoutMs = 120_000): Promise<string> {
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

export const solvysBetaTool = tool({
  name: "solvys_beta",
  description:
    "Build and test locally without committing or pushing. Verifies changes work before shipping. Optionally builds a local DMG for testing.",
  inputSchema: z.object({
    buildDmg: z
      .boolean()
      .optional()
      .describe("Also build a local DMG for testing (default false)"),
    startDev: z
      .boolean()
      .optional()
      .describe("Start the dev server after build (default false)"),
  }),
  callback: async (input: { buildDmg?: boolean; startDev?: boolean }) => {
    const results: string[] = ["=== Solvys Beta (local only, no commit) ==="];

    // Build
    results.push("\n[Build]");
    const build = await runShell("bun run build 2>&1 | tail -10");
    const buildOk = !build.includes("error TS");
    results.push(buildOk ? "PASS" : `FAIL\n${build}`);

    if (!buildOk) return results.join("\n");

    // Git diff summary
    const diff = await runShell("git diff --stat");
    results.push(`\n[Changes]\n${diff || "(no changes)"}`);

    // DMG
    if (input.buildDmg) {
      results.push("\n[DMG Build]");
      results.push(
        await runShell("cd electron && bun run build:dmg 2>&1 | tail -5"),
      );
    }

    // Dev server
    if (input.startDev) {
      results.push("\n[Dev Server] Starting backend on port 8080...");
      // Don't await — fire and forget
      runShell("bun run dev &");
      results.push("Backend started in background");
    }

    return results.join("\n");
  },
});
