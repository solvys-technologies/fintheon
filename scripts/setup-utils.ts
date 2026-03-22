// [claude-code 2026-03-22] Setup utilities — port check, env parser, health poll, command runner
import { createConnection } from 'net';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';

/* ------------------------------------------------------------------ */
/*  Port availability check                                            */
/* ------------------------------------------------------------------ */

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: '127.0.0.1' });
    socket.setTimeout(1500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(false); // port is in use
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(true); // port is free
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(true); // no response = free
    });
  });
}

/* ------------------------------------------------------------------ */
/*  .env file parser — preserves comments and order                    */
/* ------------------------------------------------------------------ */

export function parseEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf8');
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

/**
 * Merge updates into an existing .env file, preserving comments and unmodified keys.
 * If the file doesn't exist, creates it from scratch.
 */
export function mergeEnvFile(filePath: string, updates: Record<string, string>): void {
  const pending = { ...updates };

  if (existsSync(filePath)) {
    const lines = readFileSync(filePath, 'utf8').split('\n');
    const output: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        output.push(line);
        continue;
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) {
        output.push(line);
        continue;
      }
      const key = trimmed.slice(0, eqIdx).trim();
      if (key in pending) {
        output.push(`${key}=${pending[key]}`);
        delete pending[key];
      } else {
        output.push(line);
      }
    }

    // Append any new keys not already in the file
    for (const [key, value] of Object.entries(pending)) {
      output.push(`${key}=${value}`);
    }

    writeFileSync(filePath, output.join('\n'), 'utf8');
  } else {
    const content = Object.entries(updates)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    writeFileSync(filePath, content + '\n', 'utf8');
  }
}

/* ------------------------------------------------------------------ */
/*  Health check poller                                                */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  status: string;
  components?: Record<string, { status: string; detail?: string }>;
}

export async function waitForHealth(
  url: string,
  maxAttempts = 10,
  intervalMs = 2000
): Promise<HealthResponse | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        return (await res.json()) as HealthResponse;
      }
    } catch {
      // Not ready yet
    }
    if (i < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return null;
}

/**
 * Check if a Fintheon backend is already running on the given port.
 */
export async function isFintheonRunning(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Subprocess runner                                                   */
/* ------------------------------------------------------------------ */

export interface CommandResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

export function runCommand(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: Record<string, string> }
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts?.cwd,
      env: { ...process.env, ...opts?.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));

    child.on('error', (err) => {
      resolve({ ok: false, stdout, stderr: stderr + err.message, code: null });
    });

    child.on('close', (code) => {
      resolve({ ok: code === 0, stdout, stderr, code });
    });
  });
}

/**
 * Check if a command exists on PATH.
 */
export async function commandExists(cmd: string): Promise<boolean> {
  const result = await runCommand('which', [cmd]);
  return result.ok && result.stdout.trim().length > 0;
}

/**
 * Get version output from a command (e.g. `node --version`).
 */
export async function getVersion(cmd: string): Promise<string | null> {
  const result = await runCommand(cmd, ['--version']);
  if (!result.ok) return null;
  return result.stdout.trim();
}

/**
 * Validate an OpenRouter API key by hitting the models endpoint.
 */
export async function validateOpenRouterKey(key: string): Promise<boolean> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
