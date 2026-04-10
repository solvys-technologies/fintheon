// [claude-code 2026-03-10] Safe execFile wrapper — prevents shell injection, returns null on failure

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface ExecFileResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/**
 * Execute a binary safely via execFile (NOT exec — no shell injection risk).
 * Returns null if the process errors or times out.
 * Always pass arguments as an array — never interpolate into a shell string.
 */
export async function execFileNoThrow(
  file: string,
  args: string[],
  opts?: { timeout?: number },
): Promise<ExecFileResult | null> {
  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      timeout: opts?.timeout ?? 10_000,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: any) {
    // execFile throws with .stdout/.stderr even on non-zero exit
    if (err?.stdout !== undefined || err?.stderr !== undefined) {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
        exitCode: err.code ?? 1,
      };
    }
    return null;
  }
}
